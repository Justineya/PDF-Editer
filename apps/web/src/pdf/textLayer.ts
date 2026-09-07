import { TextLayer, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist'
import type { Rect } from '../types'

export type TextLayerHandle = {
  cancel: () => void
  promise: Promise<{ hasText: boolean; itemCount: number }>
}

/**
 * Render an invisible selectable PDF.js text layer into `container`.
 * Coordinates match the page viewport used for canvas rendering.
 */
export function renderTextLayerToContainer(
  page: PDFPageProxy,
  scale: number,
  container: HTMLElement,
): TextLayerHandle {
  let cancelled = false
  let layer: TextLayer | null = null

  const promise = (async () => {
    container.replaceChildren()
    container.style.setProperty('--scale-factor', String(scale))

    const viewport = page.getViewport({ scale })
    const textContent = await page.getTextContent()
    if (cancelled) return { hasText: false, itemCount: 0 }

    const items = textContent.items.filter((it) => 'str' in it && (it as { str: string }).str)
    const hasText = items.length > 0

    layer = new TextLayer({
      textContentSource: textContent,
      container,
      viewport,
    })
    await layer.render()
    if (cancelled) {
      layer.cancel()
      container.replaceChildren()
      return { hasText: false, itemCount: 0 }
    }
    return { hasText, itemCount: items.length }
  })()

  return {
    cancel() {
      cancelled = true
      try {
        layer?.cancel()
      } catch {
        /* ignore */
      }
      container.replaceChildren()
    },
    promise,
  }
}

export async function pageHasSelectableText(
  pdf: PDFDocumentProxy,
  pageIndex: number,
): Promise<boolean> {
  const page = await pdf.getPage(pageIndex + 1)
  const content = await page.getTextContent()
  return content.items.some((it) => 'str' in it && Boolean((it as { str: string }).str.trim()))
}

/** Approximate PDF-user-space rects (top-left origin) for each text item. */
export async function getPageTextItemRects(
  pdf: PDFDocumentProxy,
  pageIndex: number,
): Promise<Array<{ str: string; rect: Rect }>> {
  const page = await pdf.getPage(pageIndex + 1)
  const viewport = page.getViewport({ scale: 1 })
  const content = await page.getTextContent()
  const out: Array<{ str: string; rect: Rect }> = []

  for (const item of content.items) {
    if (!('str' in item) || !item.str) continue
    const tx = item.transform
    const x = tx[4]
    const fontHeight = Math.hypot(tx[2], tx[3]) || item.height || 12
    const width = item.width || fontHeight * item.str.length * 0.5
    const pdfYBottom = tx[5]
    const top = viewport.height - pdfYBottom - fontHeight
    out.push({
      str: item.str,
      rect: { x, y: Math.max(0, top), w: Math.max(width, 2), h: Math.max(fontHeight, 8) },
    })
  }
  return out
}

export function hitTestTextItem(
  items: Array<{ str: string; rect: Rect }>,
  x: number,
  y: number,
): { str: string; rect: Rect } | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const r = items[i].rect
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return items[i]
  }
  return null
}
