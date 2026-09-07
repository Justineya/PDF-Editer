import type { PDFDocumentProxy } from 'pdfjs-dist'
import { MACAU_ADDR } from '@forgepdf/overlay-fonts'
import { getPageTextItemRects } from './textLayer'
import { layoutTextBlock } from './textLayout'
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
  const fontSize = opts.fontSize ?? 8
  // Natural width of longest line — avoid forcing wrap that orphans「座」
  const natural = layoutTextBlock(text, fontSize)
  const blockW = Math.max(hit.rect.w + 8, natural.w + 4, 240)
  const laid = layoutTextBlock(text, fontSize, blockW)
  const pad = 3
  const cover: WhiteoutRect = {
    id: opts.idCover,
    pageIndex: hit.pageIndex,
    rect: {
      x: Math.max(0, hit.rect.x - pad),
      y: Math.max(0, hit.rect.y - pad),
      w: blockW + pad * 2,
      h: laid.h + pad * 2,
    },
    color: '#ffffff',
    shape: 'rect',
  }
  const textObj: OverlayText = {
    id: opts.idText,
    pageIndex: hit.pageIndex,
    x: hit.rect.x,
    y: hit.rect.y,
    text,
    fontSize,
    color: opts.color ?? '#111111',
    fontFamily: opts.fontFamily ?? 'tc-regular',
    w: blockW,
    h: laid.h,
  }
  return { cover, text: textObj }
}
