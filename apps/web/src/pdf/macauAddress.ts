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
  const fontSize = opts.fontSize ?? 8
  const lines = String(text).split(/\r?\n/)
  const lineHeight = fontSize * 1.25
  const blockH = Math.max(hit.rect.h + 4, lines.length * lineHeight + 4)
  // Estimate width: CJK ~1em, Latin ~0.55em
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0)
  const blockW = Math.max(hit.rect.w + 8, longest * fontSize * 0.7, 220)
  const pad = 2
  const cover: WhiteoutRect = {
    id: opts.idCover,
    pageIndex: hit.pageIndex,
    rect: {
      x: Math.max(0, hit.rect.x - pad),
      y: Math.max(0, hit.rect.y - pad),
      w: blockW + pad * 2,
      h: blockH + pad * 2,
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
    h: blockH,
  }
  return { cover, text: textObj }
}
