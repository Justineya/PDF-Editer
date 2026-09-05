import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = pdfWorker

type PdfDoc = PDFDocumentProxy & { destroy?: () => Promise<void> | void }

const cache = new Map<string, PdfDoc>()

async function safeDestroy(pdf: PdfDoc) {
  try {
    await pdf.destroy?.()
  } catch {
    /* ignore */
  }
}

export async function loadPdfDocument(
  id: string,
  data: Uint8Array,
  password?: string,
): Promise<PDFDocumentProxy> {
  const existing = cache.get(id)
  if (existing) {
    await safeDestroy(existing)
    cache.delete(id)
  }
  const loadingTask = getDocument({
    data: data.slice(),
    password,
    useSystemFonts: true,
    cMapUrl: '/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/standard_fonts/',
  })
  const pdf = (await loadingTask.promise) as PdfDoc
  cache.set(id, pdf)
  return pdf
}

export function getCachedPdf(id: string): PDFDocumentProxy | undefined {
  return cache.get(id)
}

export async function destroyPdf(id: string) {
  const pdf = cache.get(id)
  if (pdf) {
    await safeDestroy(pdf)
    cache.delete(id)
  }
}

export async function renderPageToCanvas(
  pdf: PDFDocumentProxy,
  pageIndex: number,
  scale: number,
  canvas: HTMLCanvasElement,
): Promise<{ width: number; height: number }> {
  const page = await pdf.getPage(pageIndex + 1)
  const viewport = page.getViewport({ scale })
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布上下文')
  // Abort any in-flight render on this canvas (React StrictMode / rapid zoom)
  const prev = (canvas as HTMLCanvasElement & { __forgeRender?: { cancel: () => void } }).__forgeRender
  try {
    prev?.cancel()
  } catch {
    /* ignore */
  }
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  const task = page.render({ canvas, canvasContext: ctx, viewport })
  ;(canvas as HTMLCanvasElement & { __forgeRender?: { cancel: () => void } }).__forgeRender = task
  try {
    await task.promise
  } finally {
    const cur = (canvas as HTMLCanvasElement & { __forgeRender?: { cancel: () => void } }).__forgeRender
    if (cur === task) {
      delete (canvas as HTMLCanvasElement & { __forgeRender?: { cancel: () => void } }).__forgeRender
    }
  }
  return { width: viewport.width, height: viewport.height }
}

export async function getPageText(pdf: PDFDocumentProxy, pageIndex: number): Promise<string> {
  const page = await pdf.getPage(pageIndex + 1)
  const content = await page.getTextContent()
  return content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
}

export async function searchInPdf(
  pdf: PDFDocumentProxy,
  query: string,
): Promise<Array<{ pageIndex: number; snippet: string }>> {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  const hits: Array<{ pageIndex: number; snippet: string }> = []
  for (let i = 0; i < pdf.numPages; i++) {
    const text = await getPageText(pdf, i)
    const idx = text.toLowerCase().indexOf(q)
    if (idx >= 0) {
      const start = Math.max(0, idx - 24)
      const end = Math.min(text.length, idx + query.length + 24)
      hits.push({ pageIndex: i, snippet: text.slice(start, end) })
    }
  }
  return hits
}

export async function getOutline(
  pdf: PDFDocumentProxy,
): Promise<Array<{ title: string; pageIndex: number | null }>> {
  const outline = await pdf.getOutline()
  if (!outline) return []
  const destCache = new Map<string, number>()
  const result: Array<{ title: string; pageIndex: number | null }> = []

  async function resolvePage(dest: unknown): Promise<number | null> {
    try {
      let d = dest
      if (typeof d === 'string') {
        if (destCache.has(d)) return destCache.get(d)!
        d = await pdf.getDestination(d)
      }
      if (!Array.isArray(d) || !d[0]) return null
      const pageIndex = await pdf.getPageIndex(d[0])
      return pageIndex
    } catch {
      return null
    }
  }

  async function walk(items: typeof outline) {
    for (const item of items) {
      const pageIndex = await resolvePage(item.dest)
      result.push({ title: item.title, pageIndex })
      if (item.items?.length) await walk(item.items as typeof outline)
    }
  }
  await walk(outline)
  return result
}

export async function extractPageImageDataUrl(
  pdf: PDFDocumentProxy,
  pageIndex: number,
  scale = 1.5,
): Promise<string> {
  const canvas = document.createElement('canvas')
  await renderPageToCanvas(pdf, pageIndex, scale, canvas)
  return canvas.toDataURL('image/png')
}

