import type { Rect } from '../types'

export type AddressHitLike = {
  pageIndex: number
  str: string
  rect: Rect
}

const ADDR_FRAG =
  /財神|财神|Fortune|FORTUNE|Edif[ií]cio|Edif\.|Avenida|Panorâmica|Panoramica|Nam Van|湖景|南灣|南湾|澳門|澳门|Macau|工商銀行|工商银行|ICBC|andar|nº|n°|樓|楼|大馬路|大马路|\b810\b|\b6\s*E\b|E座/i

function unionRect(a: Rect, b: Rect): Rect {
  const x0 = Math.min(a.x, b.x)
  const y0 = Math.min(a.y, b.y)
  const x1 = Math.max(a.x + a.w, b.x + b.w)
  const y1 = Math.max(a.y + a.h, b.y + b.h)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

function overlapsBand(a: Rect, b: Rect, padX: number, padY: number): boolean {
  return !(
    a.x + a.w + padX < b.x ||
    b.x + b.w + padX < a.x ||
    a.y + a.h + padY < b.y ||
    b.y + b.h + padY < a.y
  )
}

/**
 * Grow a Fortune/財神 seed rect to the full multi-line address block.
 * Letterheads often split「810」「6 E」into separate text items.
 */
export function expandHitCluster(
  seed: Rect,
  items: Array<{ str: string; rect: Rect }>,
  opts?: { padX?: number; padY?: number; maxPasses?: number },
): Rect {
  const padX = opts?.padX ?? 28
  const padY = opts?.padY ?? 14
  const maxPasses = opts?.maxPasses ?? 8
  let box = { ...seed }
  const absorbed = new Set<number>()

  for (let pass = 0; pass < maxPasses; pass++) {
    let grew = false
    items.forEach((it, idx) => {
      if (absorbed.has(idx)) return
      const r = it.rect
      if (r.w < 1 || r.h < 1) return
      if (!overlapsBand(box, r, padX, padY)) return
      const text = String(it.str || '').trim()
      if (!text) return
      const addrLike = ADDR_FRAG.test(text) || text.length >= 6
      const sameColumn =
        r.x < box.x + box.w + 40 && r.x + r.w > box.x - 40 && Math.abs(r.y - box.y) < 48
      if (!addrLike && !sameColumn) return
      absorbed.add(idx)
      box = unionRect(box, r)
      grew = true
    })
    if (!grew) break
  }
  return box
}

/** Merge overlapping expanded hits on the same page into one cover target. */
export function mergeOverlappingHits(hits: AddressHitLike[]): AddressHitLike[] {
  const byPage = new Map<number, AddressHitLike[]>()
  for (const h of hits) {
    const list = byPage.get(h.pageIndex) ?? []
    list.push(h)
    byPage.set(h.pageIndex, list)
  }
  const out: AddressHitLike[] = []
  for (const [pageIndex, list] of byPage) {
    const merged: AddressHitLike[] = []
    for (const h of list) {
      let absorbed = false
      for (const m of merged) {
        if (overlapsBand(m.rect, h.rect, 12, 8)) {
          m.rect = unionRect(m.rect, h.rect)
          m.str = `${m.str} | ${h.str}`
          absorbed = true
          break
        }
      }
      if (!absorbed) merged.push({ ...h, rect: { ...h.rect } })
    }
    for (const m of merged) out.push({ ...m, pageIndex })
  }
  return out
}
