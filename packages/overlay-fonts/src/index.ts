/**
 * TC OTF registry for vector overlay export.
 * Prefer user-copied fonts from 字体/ → assets/fonts/tc/
 */

export type OverlayFontId = 'tc-light' | 'tc-demilight'

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
    id: 'tc-light',
    files: [
      'SourceHanSansTC-Light.otf',
      'SourceHanSansTC-Light.subset.otf',
      'SourceHanSansTC-Light.ttf',
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
  return 'tc-light'
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
  // case-insensitive fallback
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
