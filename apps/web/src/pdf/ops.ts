import {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib'
import type {
  Annotation,
  DocumentModel,
  OverlayImage,
  OverlayText,
  RedactionRect,
  SignaturePlacement,
  WatermarkSpec,
  WhiteoutRect,
} from '../types'
import { layoutTextBlock } from './textLayout'

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? ''
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function embedImage(pdf: PDFDocument, dataUrl: string) {
  const bytes = dataUrlToBytes(dataUrl)
  if (dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg')) {
    return pdf.embedJpg(bytes)
  }
  return pdf.embedPng(bytes)
}

function drawInk(page: PDFPage, ann: Extract<Annotation, { kind: 'ink' }>) {
  const { height } = page.getSize()
  const color = hexToRgb(ann.color)
  for (const path of ann.paths) {
    if (path.length < 2) continue
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]
      const b = path[i]
      page.drawLine({
        start: { x: a.x, y: height - a.y },
        end: { x: b.x, y: height - b.y },
        thickness: ann.width,
        color,
        opacity: 0.9,
      })
    }
  }
}

function drawMarkup(
  page: PDFPage,
  ann: Extract<Annotation, { kind: 'highlight' | 'underline' | 'strike' }>,
) {
  const { height } = page.getSize()
  const color = hexToRgb(ann.color)
  for (const r of ann.rects) {
    if (ann.kind === 'highlight') {
      page.drawRectangle({
        x: r.x,
        y: height - r.y - r.h,
        width: r.w,
        height: r.h,
        color,
        opacity: 0.35,
        borderWidth: 0,
      })
    } else {
      const y =
        ann.kind === 'underline'
          ? height - r.y - r.h + 2
          : height - r.y - r.h / 2
      page.drawLine({
        start: { x: r.x, y },
        end: { x: r.x + r.w, y },
        thickness: ann.kind === 'strike' ? 1.5 : 1.2,
        color,
      })
    }
  }
}

function drawNote(page: PDFPage, ann: Extract<Annotation, { kind: 'note' }>, font: PDFFont) {
  const { height } = page.getSize()
  const color = hexToRgb(ann.color)
  page.drawRectangle({
    x: ann.x,
    y: height - ann.y - 18,
    width: 16,
    height: 16,
    color,
    borderColor: rgb(0.1, 0.1, 0.1),
    borderWidth: 0.5,
  })
  if (ann.content) {
    page.drawText(ann.content.slice(0, 80), {
      x: ann.x + 20,
      y: height - ann.y - 14,
      size: 9,
      font,
      color: rgb(0.15, 0.15, 0.15),
      maxWidth: 200,
    })
  }
}

function drawStamp(page: PDFPage, ann: Extract<Annotation, { kind: 'stamp' }>, font: PDFFont) {
  const { height } = page.getSize()
  const color = hexToRgb(ann.color)
  page.drawRectangle({
    x: ann.x,
    y: height - ann.y - ann.h,
    width: ann.w,
    height: ann.h,
    borderColor: color,
    borderWidth: 2,
    color: rgb(1, 1, 1),
    opacity: 0.15,
  })
  page.drawText(ann.label, {
    x: ann.x + 8,
    y: height - ann.y - ann.h / 2 - 6,
    size: 14,
    font,
    color,
  })
}

async function fontForFamily(pdf: PDFDocument, family?: string, bold?: boolean) {
  // Phase-1: TC Light/DemiLight as true vector embeds (not Canvas PNG).
  if (
    family === 'tc-light' ||
    family === 'tc-demilight' ||
    family === 'tc-regular' ||
    family === 'tc-bold' ||
    family === 'sans-cjk'
  ) {
    const { embedOverlayFont } = await import('./vectorFonts')
    const id =
      family === 'tc-demilight'
        ? 'tc-demilight'
        : family === 'tc-light'
          ? 'tc-light'
          : family === 'tc-bold'
            ? 'tc-bold'
            : 'tc-regular'
    const embedded = await embedOverlayFont(pdf, id)
    if (embedded) return embedded
  }
  const map: Record<string, StandardFonts> = {
    helvetica: bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica,
    times: bold ? StandardFonts.TimesRomanBold : StandardFonts.TimesRoman,
    courier: bold ? StandardFonts.CourierBold : StandardFonts.Courier,
  }
  const key = family && map[family] ? family : 'helvetica'
  return pdf.embedFont(map[key])
}

async function drawOverlays(
  pdf: PDFDocument,
  page: PDFPage,
  pageIndex: number,
  texts: OverlayText[],
  images: OverlayImage[],
  _font: PDFFont,
) {
  const { height } = page.getSize()
  for (const t of texts.filter((x) => x.pageIndex === pageIndex)) {
    const textFont = await fontForFamily(pdf, t.fontFamily, t.bold)
    const useVectorCjk =
      t.fontFamily === 'tc-light' ||
      t.fontFamily === 'tc-demilight' ||
      t.fontFamily === 'tc-regular' ||
      t.fontFamily === 'tc-bold' ||
      t.fontFamily === 'sans-cjk'
    const size = t.fontSize
    const lineHeight = size * 1.25
    // Honor explicit newlines + CJK-aware wrap to box width (no pdf-lib maxWidth orphans).
    const { lines } = layoutTextBlock(t.text, size, t.w)
    lines.forEach((line, i) => {
      if (!line) return
      const baselineScreenY = t.y + size * 0.9 + i * lineHeight
      const pdfY = height - baselineScreenY
      try {
        page.drawText(line, {
          x: t.x,
          y: pdfY,
          size,
          font: textFont,
          color: hexToRgb(t.color),
        })
      } catch (err) {
        if (useVectorCjk) throw err
        page.drawText(line.replace(/[^\x00-\xFF]/g, '?'), {
          x: t.x,
          y: pdfY,
          size,
          font: textFont,
          color: hexToRgb(t.color),
        })
      }
    })
  }
  for (const img of images.filter((x) => x.pageIndex === pageIndex)) {
    const embedded = await embedImage(pdf, img.dataUrl)
    page.drawImage(embedded, {
      x: img.x,
      y: height - img.y - img.h,
      width: img.w,
      height: img.h,
    })
  }
}

async function drawSignatures(
  pdf: PDFDocument,
  page: PDFPage,
  pageIndex: number,
  signatures: SignaturePlacement[],
) {
  const { height } = page.getSize()
  for (const s of signatures.filter((x) => x.pageIndex === pageIndex)) {
    const embedded = await embedImage(pdf, s.dataUrl)
    page.drawImage(embedded, {
      x: s.x,
      y: height - s.y - s.h,
      width: s.w,
      height: s.h,
    })
  }
}

function drawWatermark(page: PDFPage, wm: WatermarkSpec, font: PDFFont) {
  const { width, height } = page.getSize()
  page.drawText(wm.text, {
    x: width * 0.2,
    y: height * 0.45,
    size: wm.fontSize,
    font,
    color: hexToRgb(wm.color),
    opacity: wm.opacity,
    rotate: degrees(wm.rotate),
  })
}

function drawRedactions(page: PDFPage, pageIndex: number, redactions: RedactionRect[]) {
  const { height } = page.getSize()
  for (const r of redactions.filter((x) => x.pageIndex === pageIndex)) {
    page.drawRectangle({
      x: r.rect.x,
      y: height - r.rect.y - r.rect.h,
      width: r.rect.w,
      height: r.rect.h,
      color: rgb(0, 0, 0),
      borderWidth: 0,
    })
  }
}

export async function applyFormValues(bytes: Uint8Array, values: Record<string, string>) {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const form = pdf.getForm()
  for (const [name, value] of Object.entries(values)) {
    try {
      const field = form.getField(name)
      const anyField = field as { setText?: (v: string) => void; check?: () => void; uncheck?: () => void }
      if (typeof anyField.setText === 'function') {
        anyField.setText(value)
      } else if (value === 'true' || value === 'Yes') {
        anyField.check?.()
      } else if (value === 'false' || value === 'Off') {
        anyField.uncheck?.()
      }
    } catch {
      /* field type mismatch */
    }
  }
  return pdf.save()
}

export async function listFormFields(bytes: Uint8Array): Promise<Array<{ name: string; type: string }>> {
  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true })
    const fields = pdf.getForm().getFields()
    return fields.map((f) => ({
      name: f.getName(),
      type: f.constructor.name.replace('PDF', ''),
    }))
  } catch {
    return []
  }
}


function drawWhiteouts(page: PDFPage, pageIndex: number, whiteouts: WhiteoutRect[]) {
  const { height } = page.getSize()
  for (const w of whiteouts.filter((x) => x.pageIndex === pageIndex)) {
    const color = hexToRgb(w.color || '#ffffff')
    if (w.shape === 'ellipse') {
      page.drawEllipse({
        x: w.rect.x + w.rect.w / 2,
        y: height - w.rect.y - w.rect.h / 2,
        xScale: Math.max(w.rect.w / 2, 0.5),
        yScale: Math.max(w.rect.h / 2, 0.5),
        color,
        borderWidth: 0,
      })
    } else {
      page.drawRectangle({
        x: w.rect.x,
        y: height - w.rect.y - w.rect.h,
        width: w.rect.w,
        height: w.rect.h,
        color,
        borderWidth: 0,
      })
    }
  }
}

export async function exportDocument(model: DocumentModel): Promise<Uint8Array> {
  let working = model.bytes

  if (Object.keys(model.formValues).length) {
    working = await applyFormValues(working, model.formValues)
  }

  const pdf = await PDFDocument.load(working, { ignoreEncryption: true })
  const font = await pdf.embedFont(StandardFonts.Helvetica)

  if (model.metaEdits) {
    if (model.metaEdits.title != null) pdf.setTitle(model.metaEdits.title)
    if (model.metaEdits.author != null) pdf.setAuthor(model.metaEdits.author)
    if (model.metaEdits.subject != null) pdf.setSubject(model.metaEdits.subject)
    if (model.metaEdits.keywords != null) pdf.setKeywords(model.metaEdits.keywords.split(/[,，]/).map((s) => s.trim()).filter(Boolean))
    if (model.metaEdits.creator != null) pdf.setCreator(model.metaEdits.creator)
    pdf.setProducer(model.metaEdits.producer ?? 'ForgePDF')
    pdf.setModificationDate(new Date())
  } else {
    pdf.setProducer('ForgePDF')
    pdf.setModificationDate(new Date())
  }

  const pages = pdf.getPages()
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    for (const ann of model.annotations.filter((a) => a.pageIndex === i)) {
      if (ann.kind === 'highlight' || ann.kind === 'underline' || ann.kind === 'strike') {
        drawMarkup(page, ann)
      } else if (ann.kind === 'ink') {
        drawInk(page, ann)
      } else if (ann.kind === 'note') {
        drawNote(page, ann, font)
      } else if (ann.kind === 'stamp') {
        drawStamp(page, ann, font)
      }
    }
    // Erase/whiteout under vector text (擦除重打)
    drawWhiteouts(page, i, model.whiteouts ?? [])
    await drawOverlays(pdf, page, i, model.overlays, model.images, font)
    await drawSignatures(pdf, page, i, model.signatures)
    if (model.watermark?.text) drawWatermark(page, model.watermark, font)
    drawRedactions(page, i, model.redactions)
  }

  // Phase 4: if password set, encrypt on save
  if (model.password) {
    return pdf.save({
      userPassword: model.password,
      ownerPassword: model.password + '-owner',
    } as Parameters<typeof pdf.save>[0])
  }

  return pdf.save()
}

export async function mergePdfs(files: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  for (const bytes of files) {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach((p) => out.addPage(p))
  }
  out.setProducer('ForgePDF')
  return out.save()
}

export async function extractPages(bytes: Uint8Array, indices: number[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const out = await PDFDocument.create()
  const pages = await out.copyPages(src, indices)
  pages.forEach((p) => out.addPage(p))
  out.setProducer('ForgePDF')
  return out.save()
}

export async function deletePages(bytes: Uint8Array, indices: number[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const keep = src.getPageIndices().filter((i) => !indices.includes(i))
  if (!keep.length) throw new Error('不能删除全部页面')
  return extractPages(bytes, keep)
}

export async function rotatePages(
  bytes: Uint8Array,
  indices: number[],
  angle: 90 | 180 | 270,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true })
  for (const i of indices) {
    const page = pdf.getPage(i)
    const current = page.getRotation().angle
    page.setRotation(degrees((current + angle) % 360))
  }
  return pdf.save()
}

export async function reorderPages(bytes: Uint8Array, order: number[]): Promise<Uint8Array> {
  return extractPages(bytes, order)
}

export async function imagesToPdf(dataUrls: string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  for (const url of dataUrls) {
    const img = await embedImage(pdf, url)
    const page = pdf.addPage([img.width, img.height])
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
  }
  pdf.setProducer('ForgePDF')
  return pdf.save()
}

export async function readMetadata(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const kw = pdf.getKeywords()
  const keywords = Array.isArray(kw) ? kw.join(', ') : String(kw ?? '')
  return {
    title: pdf.getTitle() ?? '',
    author: pdf.getAuthor() ?? '',
    subject: pdf.getSubject() ?? '',
    keywords,
    creator: pdf.getCreator() ?? '',
    producer: pdf.getProducer() ?? '',
    creationDate: pdf.getCreationDate()?.toISOString(),
    modificationDate: pdf.getModificationDate()?.toISOString(),
    pageCount: pdf.getPageCount(),
  }
}

export async function stripMetadata(bytes: Uint8Array): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true })
  pdf.setTitle('')
  pdf.setAuthor('')
  pdf.setSubject('')
  pdf.setKeywords([])
  pdf.setCreator('ForgePDF')
  pdf.setProducer('ForgePDF')
  pdf.setCreationDate(new Date(0))
  pdf.setModificationDate(new Date())
  return pdf.save()
}

/** Flatten + black boxes. Content under boxes remains in stream unless pages are rasterized. */
export async function applyHardRedaction(
  bytes: Uint8Array,
  redactions: RedactionRect[],
  rasterize: boolean,
  renderPage?: (pageIndex: number) => Promise<string>,
): Promise<Uint8Array> {
  if (!rasterize || !renderPage) {
    const model: DocumentModel = {
      id: 'tmp',
      name: 'tmp.pdf',
      bytes,
      dirty: true,
      pageCount: 0,
      annotations: [],
      overlays: [],
      images: [],
      whiteouts: [],
      signatures: [],
      redactions,
      formValues: {},
      ocrTextByPage: {},
    }
    return exportDocument(model)
  }

  // Stronger path: rasterize affected pages so underlying text cannot be copied
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const out = await PDFDocument.create()
  const affected = new Set(redactions.map((r) => r.pageIndex))

  for (let i = 0; i < src.getPageCount(); i++) {
    if (!affected.has(i)) {
      const [p] = await out.copyPages(src, [i])
      out.addPage(p)
      continue
    }
    const dataUrl = await renderPage(i)
    // Draw redactions onto a canvas first
    const imgEl = await loadHtmlImage(dataUrl)
    const canvas = document.createElement('canvas')
    canvas.width = imgEl.width
    canvas.height = imgEl.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(imgEl, 0, 0)
    const page = src.getPage(i)
    const { width, height } = page.getSize()
    const sx = canvas.width / width
    const sy = canvas.height / height
    ctx.fillStyle = '#000'
    for (const r of redactions.filter((x) => x.pageIndex === i)) {
      ctx.fillRect(r.rect.x * sx, r.rect.y * sy, r.rect.w * sx, r.rect.h * sy)
    }
    const png = canvas.toDataURL('image/png')
    const embedded = await embedImage(out, png)
    const newPage = out.addPage([width, height])
    newPage.drawImage(embedded, { x: 0, y: 0, width, height })
  }
  out.setProducer('ForgePDF-Redact')
  return out.save()
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export async function createBlankPdf(pageCount = 1): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  for (let i = 0; i < pageCount; i++) pdf.addPage([595.28, 841.89])
  pdf.setTitle('未命名')
  pdf.setProducer('ForgePDF')
  return pdf.save()
}

export async function createSampleFormPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  page.drawText('ForgePDF Sample Form', { x: 50, y: 780, size: 18, font })
  page.drawText('Name', { x: 50, y: 720, size: 12, font })
  page.drawText('Company', { x: 50, y: 680, size: 12, font })
  page.drawText('Agree to terms', { x: 50, y: 640, size: 12, font })
  const form = pdf.getForm()
  const name = form.createTextField('full_name')
  name.addToPage(page, { x: 140, y: 710, width: 300, height: 24 })
  const company = form.createTextField('company')
  company.addToPage(page, { x: 140, y: 670, width: 300, height: 24 })
  const agree = form.createCheckBox('agree')
  agree.addToPage(page, { x: 160, y: 630, width: 16, height: 16 })
  page.drawText('Signature area below — use Sign mode.', { x: 50, y: 560, size: 11, font })
  pdf.setProducer('ForgePDF')
  return pdf.save()
}
