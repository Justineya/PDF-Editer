import type { PDFDocumentProxy } from 'pdfjs-dist'
import { MACAU_ADDR } from '@forgepdf/overlay-fonts'
import { getPageTextItemRects } from './textLayer'
import type { OverlayText, WhiteoutRect } from '../types'

export { MACAU_ADDR }

export type AddressHit = {
  pageIndex: number
  str: string
  rect: { x: number; y: number; w: number; h: number }
}

/** Search text-layer items for 財神 / Fortune… (user Macau prototype FIND_KEYS). */
export async function findOldAddressHits(
  pdf: PDFDocumentProxy,
  keys: readonly string[] = MACAU_ADDR.findKeys,
): Promise<AddressHit[]> {
  const hits: AddressHit[] = []
  for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex++) {
    const items = await getPageTextItemRects(pdf, pageIndex)
    for (const it of items) {
      if (!keys.some((k) => it.str.includes(k))) continue
      hits.push({ pageIndex, str: it.str, rect: it.rect })
    }
  }
  return hits
}

export function coverAndRetypeHit(
  hit: AddressHit,
  text: string,
  opts: {
    idCover: string
    idText: string
    fontFamily?: string
    fontSize?: number
    color?: string
  },
): { cover: WhiteoutRect; text: OverlayText } {
  const pad = 1
  const cover: WhiteoutRect = {
    id: opts.idCover,
    pageIndex: hit.pageIndex,
    rect: {
      x: Math.max(0, hit.rect.x - pad),
      y: Math.max(0, hit.rect.y - pad),
      w: Math.max(hit.rect.w + pad * 2, 120),
      h: Math.max(hit.rect.h + pad * 2, 14),
    },
    color: '#ffffff',
    shape: 'rect',
  }
  const textObj: OverlayText = {
    id: opts.idText,
    pageIndex: hit.pageIndex,
    x: hit.rect.x,
    y: hit.rect.y + Math.max(hit.rect.h, 10) - 2,
    text,
    fontSize: opts.fontSize ?? 8,
    color: opts.color ?? '#111111',
    fontFamily: opts.fontFamily ?? 'tc-regular',
    w: Math.max(hit.rect.w + 80, 220),
    h: Math.max(hit.rect.h + 4, 36),
  }
  return { cover, text: textObj }
}
