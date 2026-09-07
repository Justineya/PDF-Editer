/**
 * TC OTF registry for vector overlay export.
 * Prefer user-copied fonts from 字体/ → assets/fonts/tc/
 *
 * Macau address workflow (用户投保書原型): prefer Regular for body address text.
 * Light / DemiLight remain available for lighter overlays.
 */

export type OverlayFontId = 'tc-regular' | 'tc-light' | 'tc-demilight'

export type FontFaceInfo = {
  id: OverlayFontId
  /** Preferred filenames, first match wins */
  files: string[]
  label: string
  /** CSS stack for on-screen preview (not export) */
  css: string
}

export const OVERLAY_FONT_FACES: FontFaceInfo[] = [
  {
    id: 'tc-regular',
    files: [
      'SourceHanSansTC-Regular.otf',
      'SourceHanSansTC-Regular.subset.otf',
      'NotoSansCJKtc-Regular.otf',
    ],
    label: 'TC Regular（地址建议）',
    css: '"Source Han Sans TC", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif',
  },
  {
    id: 'tc-light',
    files: [
      'SourceHanSansTC-Light.otf',
      'SourceHanSansTC-Light.subset.otf',
    ],
    label: 'TC Light',
    css: '"Source Han Sans TC Light", "Noto Sans TC", "PingFang TC", sans-serif',
  },
  {
    id: 'tc-demilight',
    files: [
      'SourceHanSansTC-DemiLight.otf',
      'SourceHanSansTC-DemiLight.subset.otf',
      // Adobe package names DemiLight as Normal (wght 350)
      'SourceHanSansTC-Normal.otf',
    ],
    label: 'TC DemiLight',
    css: '"Source Han Sans TC", "Noto Sans TC", "PingFang TC", sans-serif',
  },
]

export function defaultOverlayFontId(): OverlayFontId {
  return 'tc-regular'
}

/** Resolve font bytes from a directory listing map (filename → bytes). */
export function resolveFontBytes(
  id: string,
  files: Map<string, Uint8Array>,
): Uint8Array | null {
  const face = OVERLAY_FONT_FACES.find((f) => f.id === id)
  if (!face) return null
  for (const name of face.files) {
    const hit = files.get(name)
    if (hit && hit.byteLength > 1000) return hit
  }
  const lower = new Map([...files.entries()].map(([k, v]) => [k.toLowerCase(), v]))
  for (const name of face.files) {
    const hit = lower.get(name.toLowerCase())
    if (hit && hit.byteLength > 1000) return hit
  }
  return null
}

export function listMissingFonts(files: Map<string, Uint8Array>): OverlayFontId[] {
  return OVERLAY_FONT_FACES.filter((f) => !resolveFontBytes(f.id, files)).map((f) => f.id)
}

/** Canonical Macau address block from user prototype (澳门修改测试版). */
export const MACAU_ADDR = {
  zh: '澳門南灣湖景大馬路810號中國工商銀行大廈6樓E座',
  pt: 'Avenida Panorâmica do Lago Nam Van, nº 810, Edif. ICBC Tower, 6º andar E, Macau',
  block:
    '澳門南灣湖景大馬路810號中國工商銀行大廈6樓E座\n' +
    'Avenida Panorâmica do Lago Nam Van, nº 810,\n' +
    'Edif. ICBC Tower, 6º andar E, Macau',
  bldg: '中國工商銀行大廈',
  findKeys: ['財神', '财神', 'Fortune', 'FORTUNE', 'Edifício Fortune', 'Edificio Fortune'],
} as const
