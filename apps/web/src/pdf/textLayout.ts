/** Shared text block metrics for on-screen boxes + PDF export. */

export function charWidthEm(ch: string): number {
  if (!ch || ch === '\n' || ch === '\r') return 0
  // CJK / fullwidth
  if (/[\u3400-\u9fff\uf900-\ufaff\uff00-\uffef]/.test(ch)) return 1
  if (ch === ' ') return 0.35
  return 0.55
}

export function measureLineWidth(line: string, fontSize: number): number {
  let w = 0
  for (const ch of line) w += charWidthEm(ch) * fontSize
  return w
}

/** Wrap a single paragraph to maxWidth (CJK-aware). Avoid 1-char orphan lines when possible. */
export function wrapParagraph(para: string, fontSize: number, maxWidth: number): string[] {
  if (!para) return ['']
  if (!(maxWidth > fontSize)) return [para]
  const lines: string[] = []
  let cur = ''
  let curW = 0
  for (const ch of para) {
    const cw = charWidthEm(ch) * fontSize
    if (cur && curW + cw > maxWidth) {
      lines.push(cur)
      cur = ch
      curW = cw
    } else {
      cur += ch
      curW += cw
    }
  }
  if (cur) lines.push(cur)
  // Pull single-char orphan up if previous line can spare room
  if (lines.length >= 2 && lines[lines.length - 1].length === 1) {
    const last = lines.pop()!
    const prev = lines.pop()!
    const merged = prev + last
    if (measureLineWidth(merged, fontSize) <= maxWidth * 1.02) {
      lines.push(merged)
    } else {
      // move last char of prev onto orphan line
      lines.push(prev.slice(0, -1), prev.slice(-1) + last)
    }
  }
  return lines
}

export function layoutTextBlock(
  text: string,
  fontSize: number,
  boxW?: number,
): { lines: string[]; w: number; h: number } {
  const lineHeight = fontSize * 1.25
  const paras = String(text ?? '').split(/\r?\n/)
  const lines: string[] = []
  let contentW = 0
  for (const para of paras) {
    if (boxW && boxW > fontSize) {
      const wrapped = wrapParagraph(para, fontSize, boxW)
      for (const ln of wrapped) {
        lines.push(ln)
        contentW = Math.max(contentW, measureLineWidth(ln, fontSize))
      }
    } else {
      lines.push(para)
      contentW = Math.max(contentW, measureLineWidth(para, fontSize))
    }
  }
  if (!lines.length) lines.push('')
  const w = boxW && boxW > 8 ? boxW : Math.max(contentW + 2, fontSize * 2)
  const h = Math.max(lines.length * lineHeight, fontSize * 1.25)
  return { lines, w, h }
}
