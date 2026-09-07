import type { PDFDocumentProxy } from 'pdfjs-dist'
import { MACAU_ADDR } from '@forgepdf/overlay-fonts'
import { expandHitCluster, mergeOverlappingHits } from './addressCluster'
import { getPageTextItemRects } from './textLayer'
import { layoutTextBlock } from './textLayout'
import type { OverlayText, WhiteoutRect } from '../types'

export { MACAU_ADDR }
export { expandHitCluster, mergeOverlappingHits } from './addressCluster'

export type AddressHit = {
  pageIndex: number
  str: string
  rect: { x: number; y: number; w: number; h: number }
}

/** Search text-layer items for 財神 / Fortune… then expand to full address cluster. */
export async function findOldAddressHits(
  pdf: PDFDocumentProxy,
  keys: readonly string[] = MACAU_ADDR.findKeys,
): Promise<AddressHit[]> {
  const seeds: AddressHit[] = []
  const pageItems: Array<Array<{ str: string; rect: { x: number; y: number; w: number; h: number } }>> =
    []

  for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex++) {
    const items = await getPageTextItemRects(pdf, pageIndex)
    pageItems.push(items)
    for (const it of items) {
      if (!keys.some((k) => it.str.includes(k))) continue
      seeds.push({ pageIndex, str: it.str, rect: { ...it.rect } })
    }
  }

  const expanded = seeds.map((seed) => {
    const items = pageItems[seed.pageIndex] ?? []
    const rect = expandHitCluster(seed.rect, items)
    return { ...seed, rect }
  })

  return mergeOverlappingHits(expanded)
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
  const natural = layoutTextBlock(text, fontSize)
  const blockW = Math.max(hit.rect.w + 8, natural.w + 6, 260)
  const laid = layoutTextBlock(text, fontSize, blockW)
  const padX = 6
  const padY = 5
  const coverW = Math.max(blockW, hit.rect.w) + padX * 2
  const coverH = Math.max(laid.h, hit.rect.h) + padY * 2
  const coverX = Math.max(0, hit.rect.x - padX)
  const coverY = Math.max(0, hit.rect.y - padY)

  const cover: WhiteoutRect = {
    id: opts.idCover,
    pageIndex: hit.pageIndex,
    rect: {
      x: coverX,
      y: coverY,
      w: coverW,
      h: coverH,
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
