import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'

// Static worker in /public — avoids Vite dep-optimize 504 blank pages
GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

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
  const copy = Uint8Array.from(data)
  const loadingTask = getDocument({
    data: copy,
    password,
    useSystemFonts: true,
    cMapUrl: '/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/standard_fonts/',
    isEvalSupported: false,
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

export type CanvasRenderHandle = {
  cancel: () => void
  promise: Promise<{ width: number; height: number }>
}

function isCancelError(err: unknown) {
  if (!err || typeof err !== 'object') return false
  const name = 'name' in err ? String((err as { name: unknown }).name) : ''
  const msg = 'message' in err ? String((err as { message: unknown }).message) : ''
  return /cancel/i.test(name) || /cancel/i.test(msg)
}

function makeCancelError() {
  const err = new Error('Rendering cancelled')
  err.name = 'RenderingCancelledException'
  return err
}

/**
 * Render PDF page to canvas via offscreen buffer, then blit.
 * Prevents React StrictMode cancel from wiping a finished frame.
 */
export function renderPageToCanvas(
  pdf: PDFDocumentProxy,
  pageIndex: number,
  scale: number,
  canvas: HTMLCanvasElement,
): CanvasRenderHandle {
  let cancelled = false
  let pdfTask: { cancel: () => void } | null = null

  const promise = (async () => {
    const page = await pdf.getPage(pageIndex + 1)
    if (cancelled) throw makeCancelError()

    // HiDPI: bake DPR into viewport scale (sharper than CSS transform path).
    const dpr =
      typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const outputScale = Math.min(Math.max(dpr, 1), 3)
    const viewport = page.getViewport({ scale: scale * outputScale })
    const cssW = Math.max(1, viewport.width / outputScale)
    const cssH = Math.max(1, viewport.height / outputScale)
    const w = Math.max(1, Math.floor(viewport.width + 0.5))
    const h = Math.max(1, Math.floor(viewport.height + 0.5))

    const off = document.createElement('canvas')
    off.width = w
    off.height = h
    const offCtx = off.getContext('2d', { alpha: false })
    if (!offCtx) throw new Error('无法创建画布上下文')
    offCtx.fillStyle = '#ffffff'
    offCtx.fillRect(0, 0, w, h)

    // Render at device pixels without an extra transform matrix.
    const task = page.render({
      canvasContext: offCtx,
      viewport,
    })
    pdfTask = task
    try {
      await task.promise
    } catch (err) {
      if (cancelled || isCancelError(err)) throw makeCancelError()
      throw err
    }
    if (cancelled) throw makeCancelError()

    canvas.width = w
    canvas.height = h
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('无法创建画布上下文')
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(off, 0, 0)
    return { width: cssW, height: cssH }
  })()

  return {
    cancel() {
      cancelled = true
      try {
        pdfTask?.cancel()
      } catch {
        /* ignore */
      }
    },
    promise,
  }
}

export async function renderPageToCanvasAwait(
  pdf: PDFDocumentProxy,
  pageIndex: number,
  scale: number,
  canvas: HTMLCanvasElement,
): Promise<{ width: number; height: number } | null> {
  try {
    return await renderPageToCanvas(pdf, pageIndex, scale, canvas).promise
  } catch (err) {
    if (isCancelError(err)) return null
    throw err
  }
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
      return await pdf.getPageIndex(d[0])
    } catch {
      return null
    }
  }

  async function walk(items: NonNullable<typeof outline>) {
    for (const item of items) {
      result.push({ title: item.title, pageIndex: await resolvePage(item.dest) })
      if (item.items?.length) await walk(item.items as NonNullable<typeof outline>)
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
  const result = await renderPageToCanvasAwait(pdf, pageIndex, scale, canvas)
  if (!result) throw new Error('页面渲染被取消')
  return canvas.toDataURL('image/png')
}
