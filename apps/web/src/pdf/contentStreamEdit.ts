/**
 * True page content-stream text rewrite (not cover/whiteout overlays).
 *
 * Limits: best on simple Latin PDFs. CJK / CID / Type0 / scans may miss runs
 * or fail to re-encode replacement glyphs. Cover-edit remains the fallback.
 */

import {
  PDFArray,
  PDFDocument,
  PDFName,
  PDFRawStream,
  StandardFonts,
  rgb,
} from 'pdf-lib'
// Deep import — public pdf-lib API cannot decode arbitrary content streams.
import { decodePDFRawStream } from 'pdf-lib/cjs/core/streams/decode.js'
import type { Rect } from '../types'

export type StreamEditRequest = {
  pageIndex: number
  /** Top-left origin region (same as ForgePDF UI / pdf.js text layer) */
  region: Rect
  newText: string
  fontSize?: number
  color?: string
}

export type StreamEditResult = {
  bytes: Uint8Array
  removedRuns: number
  drewReplacement: boolean
  warnings: string[]
}

type Mat = [number, number, number, number, number, number]

type Tok =
  | { type: 'number'; raw: string; value: number }
  | { type: 'name'; raw: string; value: string }
  | { type: 'string'; raw: string; value: string }
  | { type: 'hex'; raw: string; value: string }
  | { type: 'array'; raw: string }
  | { type: 'dict'; raw: string }
  | { type: 'op'; raw: string; value: string }

function mul(a: Mat, b: Mat): Mat {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ]
}

function applyMat(m: Mat, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

function intersects(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function hexToLatin1(hex: string) {
  const clean = hex.replace(/\s/g, '')
  let out = ''
  for (let i = 0; i + 1 < clean.length; i += 2) {
    out += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16))
  }
  return out
}

function extractArrayText(raw: string) {
  let text = ''
  const re = /\((?:\\.|[^\\)])*\)|<[^>]*>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw))) {
    const p = m[0]
    text += p.startsWith('<') ? hexToLatin1(p.slice(1, -1)) : p.slice(1, -1)
  }
  return text
}

function blankToken(tok: Tok): Tok {
  if (tok.type === 'hex') return { type: 'hex', raw: '<>', value: '' }
  if (tok.type === 'string') return { type: 'string', raw: '()', value: '' }
  if (tok.type === 'array') return { type: 'array', raw: '[]' }
  return tok
}

function tokenize(src: string): Tok[] {
  const tokens: Tok[] = []
  let i = 0
  const isWs = (c: string) => c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '\f'

  while (i < src.length) {
    const c = src[i]!
    if (isWs(c)) {
      i++
      continue
    }
    if (c === '%') {
      while (i < src.length && src[i] !== '\n' && src[i] !== '\r') i++
      continue
    }
    if (c === '(') {
      let j = i + 1
      let depth = 1
      let value = ''
      while (j < src.length && depth > 0) {
        if (src[j] === '\\') {
          value += src[j]! + (src[j + 1] ?? '')
          j += 2
          continue
        }
        if (src[j] === '(') depth++
        else if (src[j] === ')') {
          depth--
          if (depth === 0) {
            j++
            break
          }
        }
        if (depth > 0) value += src[j]!
        j++
      }
      tokens.push({ type: 'string', raw: src.slice(i, j), value })
      i = j
      continue
    }
    if (c === '<') {
      if (src[i + 1] === '<') {
        let j = i + 2
        while (j < src.length - 1 && !(src[j] === '>' && src[j + 1] === '>')) j++
        j += 2
        tokens.push({ type: 'dict', raw: src.slice(i, j) })
        i = j
        continue
      }
      let j = i + 1
      while (j < src.length && src[j] !== '>') j++
      j++
      const hex = src.slice(i + 1, j - 1)
      tokens.push({ type: 'hex', raw: src.slice(i, j), value: hex })
      i = j
      continue
    }
    if (c === '[') {
      let j = i + 1
      let depth = 1
      while (j < src.length && depth > 0) {
        if (src[j] === '(') {
          j++
          let d = 1
          while (j < src.length && d > 0) {
            if (src[j] === '\\') {
              j += 2
              continue
            }
            if (src[j] === '(') d++
            else if (src[j] === ')') d--
            j++
          }
          continue
        }
        if (src[j] === '<') {
          j++
          while (j < src.length && src[j] !== '>') j++
          j++
          continue
        }
        if (src[j] === '[') depth++
        else if (src[j] === ']') {
          depth--
          if (depth === 0) {
            j++
            break
          }
        }
        j++
      }
      tokens.push({ type: 'array', raw: src.slice(i, j) })
      i = j
      continue
    }
    if (c === '/') {
      let j = i + 1
      while (j < src.length && !isWs(src[j]!) && !'()<>[]{}/%'.includes(src[j]!)) j++
      tokens.push({ type: 'name', raw: src.slice(i, j), value: src.slice(i + 1, j) })
      i = j
      continue
    }
    if ((c >= '0' && c <= '9') || c === '.' || c === '+' || c === '-') {
      let j = i + 1
      while (
        j < src.length &&
        ((src[j]! >= '0' && src[j]! <= '9') ||
          src[j] === '.' ||
          src[j] === 'e' ||
          src[j] === 'E' ||
          src[j] === '+' ||
          src[j] === '-')
      ) {
        j++
      }
      tokens.push({ type: 'number', raw: src.slice(i, j), value: parseFloat(src.slice(i, j)) })
      i = j
      continue
    }
    if (c === "'" || c === '"') {
      tokens.push({ type: 'op', raw: c, value: c })
      i++
      continue
    }
    let j = i
    while (j < src.length && /[A-Za-z*]/.test(src[j]!)) j++
    if (j === i) {
      tokens.push({ type: 'op', raw: c, value: c })
      i++
      continue
    }
    tokens.push({ type: 'op', raw: src.slice(i, j), value: src.slice(i, j) })
    i = j
  }
  return tokens
}

function bytesToLatin1(bytes: Uint8Array) {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!)
  return s
}

function latin1ToBytes(s: string) {
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff
  return out
}

function blankIntersectingText(
  content: string,
  regionPdf: Rect,
): { content: string; removed: number } {
  const tokens = tokenize(content)
  let ctm: Mat = [1, 0, 0, 1, 0, 0]
  let textMatrix: Mat = [1, 0, 0, 1, 0, 0]
  let textLineMatrix: Mat = [1, 0, 0, 1, 0, 0]
  let fontSize = 12
  let leading = 0
  const stack: Array<{ ctm: Mat; tm: Mat; tlm: Mat; fontSize: number; leading: number }> = []
  const argIdx: number[] = []
  let removed = 0

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!
    if (t.type !== 'op') {
      argIdx.push(i)
      continue
    }
    const op = t.value
    const take = (n: number) => argIdx.splice(Math.max(0, argIdx.length - n), n)

    if (op === 'q') {
      stack.push({
        ctm: [...ctm] as Mat,
        tm: [...textMatrix] as Mat,
        tlm: [...textLineMatrix] as Mat,
        fontSize,
        leading,
      })
    } else if (op === 'Q') {
      const s = stack.pop()
      if (s) {
        ctm = s.ctm
        textMatrix = s.tm
        textLineMatrix = s.tlm
        fontSize = s.fontSize
        leading = s.leading
      }
    } else if (op === 'cm') {
      const idxs = take(6)
      if (idxs.length === 6) {
        const v = idxs.map((ix) => (tokens[ix] as { value: number }).value) as Mat
        ctm = mul(ctm, v)
      }
    } else if (op === 'BT') {
      textMatrix = [1, 0, 0, 1, 0, 0]
      textLineMatrix = [1, 0, 0, 1, 0, 0]
    } else if (op === 'Tf') {
      const idxs = take(2)
      if (idxs.length === 2) fontSize = (tokens[idxs[1]!] as { value: number }).value
    } else if (op === 'TL') {
      const idxs = take(1)
      if (idxs.length === 1) leading = (tokens[idxs[0]!] as { value: number }).value
    } else if (op === 'Tm') {
      const idxs = take(6)
      if (idxs.length === 6) {
        const v = idxs.map((ix) => (tokens[ix] as { value: number }).value) as Mat
        textMatrix = v
        textLineMatrix = v
      }
    } else if (op === 'Td' || op === 'TD') {
      const idxs = take(2)
      if (idxs.length === 2) {
        const tx = (tokens[idxs[0]!] as { value: number }).value
        const ty = (tokens[idxs[1]!] as { value: number }).value
        if (op === 'TD') leading = -ty
        const m = mul(textLineMatrix, [1, 0, 0, 1, tx, ty])
        textMatrix = m
        textLineMatrix = m
      }
    } else if (op === 'T*') {
      const m = mul(textLineMatrix, [1, 0, 0, 1, 0, -leading])
      textMatrix = m
      textLineMatrix = m
    } else if (op === 'Tj' || op === 'TJ' || op === "'" || op === '"') {
      if (op === "'") {
        const m = mul(textLineMatrix, [1, 0, 0, 1, 0, -leading])
        textMatrix = m
        textLineMatrix = m
      }
      let strIdx: number | undefined
      if (op === '"') {
        take(2)
        strIdx = take(1)[0]
      } else {
        strIdx = take(1)[0]
      }
      if (strIdx != null) {
        const strTok = tokens[strIdx]!
        let text = ''
        if (strTok.type === 'hex') text = hexToLatin1(strTok.value)
        else if (strTok.type === 'string') text = strTok.value
        else if (strTok.type === 'array') text = extractArrayText(strTok.raw)

        const [x0, y0] = applyMat(mul(ctm, textMatrix), 0, 0)
        const width = Math.max(text.length, 1) * fontSize * 0.5
        const bbox = { x: x0, y: y0, w: width, h: Math.max(fontSize, 1) }
        if (intersects(bbox, regionPdf) && text.trim()) {
          tokens[strIdx] = blankToken(strTok)
          removed++
        }
        textMatrix = mul(textMatrix, [1, 0, 0, 1, width, 0])
      }
    } else {
      argIdx.length = 0
    }
  }

  return { content: tokens.map((t) => t.raw).join('\n'), removed }
}

function collectPageStreams(page: ReturnType<PDFDocument['getPages']>[number]) {
  const ctx = page.node.context
  let contents = page.node.get(PDFName.of('Contents'))
  contents = ctx.lookup(contents) ?? contents
  const out: Array<{ stream: PDFRawStream; bytes: Uint8Array }> = []

  const walk = (obj: unknown) => {
    if (obj instanceof PDFArray) {
      for (let i = 0; i < obj.size(); i++) walk(ctx.lookup(obj.get(i)))
      return
    }
    if (obj instanceof PDFRawStream) {
      out.push({ stream: obj, bytes: decodePDFRawStream(obj).decode() })
    }
  }

  walk(contents)
  return out
}

function canEmbedWinAnsi(text: string) {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c === 9 || c === 10 || c === 13) continue
    if (c < 32 || c > 255) return false
  }
  return true
}

function hexToRgb01(hex: string) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full || '1a2332', 16)
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255,
  }
}

/** Erase text runs in a page region and write replacement into the content stream. */
export async function rewritePageRegionText(
  pdfBytes: Uint8Array,
  req: StreamEditRequest,
): Promise<StreamEditResult> {
  const warnings: string[] = []
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  const pages = pdf.getPages()
  if (req.pageIndex < 0 || req.pageIndex >= pages.length) {
    throw new Error(`页码越界：${req.pageIndex + 1}`)
  }

  const page = pages[req.pageIndex]!
  const { width: pageW, height: pageH } = page.getSize()
  const region = req.region
  const regionPdf: Rect = {
    x: region.x,
    y: pageH - region.y - region.h,
    w: region.w,
    h: region.h,
  }

  const streams = collectPageStreams(page)
  if (!streams.length) warnings.push('本页没有可解析的内容流，仅追加新文字')

  let removedRuns = 0
  const rewrittenParts: string[] = []
  for (const s of streams) {
    const latin1 = bytesToLatin1(s.bytes)
    const { content, removed } = blankIntersectingText(latin1, regionPdf)
    removedRuns += removed
    rewrittenParts.push(content)
  }

  if (removedRuns === 0) {
    warnings.push('未命中内容流文字（可能是扫描件、矢量字或复杂字体）。已尝试直接写入新字。')
  }

  const merged = rewrittenParts.join('\n\n')
  const newStream = page.node.context.flateStream(latin1ToBytes(merged))
  const newRef = page.node.context.register(newStream)
  page.node.set(PDFName.of('Contents'), newRef)

  const text = (req.newText ?? '').replace(/\r\n/g, '\n')
  let drewReplacement = false
  if (text.trim()) {
    if (!canEmbedWinAnsi(text)) {
      warnings.push(
        '替换文字含 WinAnsi 无法编码的字符（如部分中文）。请改用「覆盖改字」，或仅使用拉丁字符。',
      )
    } else {
      const font = await pdf.embedFont(StandardFonts.Helvetica)
      const size =
        req.fontSize ?? Math.max(10, Math.min(28, region.h > 0 ? region.h * 0.7 : 14))
      const { r, g, b } = hexToRgb01(req.color ?? '#1a2332')
      const drawX = Math.max(0, Math.min(pageW - 4, region.x + 2))
      const drawY = Math.max(0, Math.min(pageH - 4, pageH - region.y - size - 2))
      page.drawText(text, {
        x: drawX,
        y: drawY,
        size,
        font,
        color: rgb(r, g, b),
        maxWidth: Math.max(region.w - 4, 40),
        lineHeight: size * 1.2,
      })
      drewReplacement = true
    }
  }

  const bytes = await pdf.save()
  return { bytes, removedRuns, drewReplacement, warnings }
}
