import type { Rect } from '../types'

export type PageSelection = {
  pageIndex: number
  text: string
  rects: Rect[]
  /** Floating toolbar anchor in CSS px relative to page wrap */
  anchor: { left: number; top: number; right: number; bottom: number }
}

/**
 * Map the current DOM selection into page-local PDF coords (top-left, unscaled).
 */
export function captureSelectionOnPage(
  pageEl: HTMLElement,
  pageIndex: number,
  scale: number,
): PageSelection | null {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null

  const text = sel.toString().replace(/\u00a0/g, ' ').trim()
  if (!text) return null

  const range = sel.getRangeAt(0)
  if (!pageEl.contains(range.commonAncestorContainer)) return null

  const pageBox = pageEl.getBoundingClientRect()
  let clientRects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0)
  // PDF.js text layer sometimes yields an empty ClientRectList for synthetic ranges
  if (!clientRects.length) {
    const br = range.getBoundingClientRect()
    if (br.width > 0 && br.height > 0) clientRects = [br]
  }
  if (!clientRects.length) return null

  const rects: Rect[] = []
  for (const cr of clientRects) {
    if (cr.bottom < pageBox.top || cr.top > pageBox.bottom) continue
    const x = (cr.left - pageBox.left) / scale
    const y = (cr.top - pageBox.top) / scale
    const w = cr.width / scale
    const h = cr.height / scale
    if (w < 0.5 || h < 0.5) continue
    rects.push({ x, y, w, h })
  }
  if (!rects.length) return null

  const merged = mergeNearbyRects(rects)
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const cr of clientRects) {
    left = Math.min(left, cr.left - pageBox.left)
    top = Math.min(top, cr.top - pageBox.top)
    right = Math.max(right, cr.right - pageBox.left)
    bottom = Math.max(bottom, cr.bottom - pageBox.top)
  }

  return {
    pageIndex,
    text,
    rects: merged,
    anchor: { left, top, right, bottom },
  }
}

function mergeNearbyRects(rects: Rect[]): Rect[] {
  if (rects.length <= 1) return rects
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x)
  const out: Rect[] = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (
      last &&
      Math.abs(last.y - r.y) < Math.max(last.h, r.h) * 0.45 &&
      Math.abs(last.h - r.h) < Math.max(last.h, r.h) * 0.5 &&
      r.x <= last.x + last.w + 4
    ) {
      const right = Math.max(last.x + last.w, r.x + r.w)
      const bottom = Math.max(last.y + last.h, r.y + r.h)
      last.x = Math.min(last.x, r.x)
      last.y = Math.min(last.y, r.y)
      last.w = right - last.x
      last.h = bottom - last.y
    } else {
      out.push({ ...r })
    }
  }
  return out
}

export function clearDomSelection() {
  window.getSelection()?.removeAllRanges()
}
