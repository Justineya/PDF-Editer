import fontkit from '@pdf-lib/fontkit'
import type { PDFDocument, PDFFont } from 'pdf-lib'
import {
  OVERLAY_FONT_FACES,
  resolveFontBytes,
  type OverlayFontId,
} from '@forgepdf/overlay-fonts'

const cache = new Map<string, Uint8Array>()

export function ensureFontkit(pdf: PDFDocument) {
  pdf.registerFontkit(fontkit)
}

/** Load TC OTF bytes (public/fonts/tc or injected map). */
export async function loadOverlayFontFileMap(): Promise<Map<string, Uint8Array>> {
  if (cache.size >= 2) return cache
  const names = OVERLAY_FONT_FACES.flatMap((f) => f.files)
  const unique = [...new Set(names)]
  await Promise.all(
    unique.map(async (name) => {
      if (cache.has(name)) return
      try {
        const res = await fetch(`/fonts/tc/${name}`)
        if (!res.ok) return
        const buf = new Uint8Array(await res.arrayBuffer())
        if (buf.byteLength > 1000) cache.set(name, buf)
      } catch {
        /* optional */
      }
    }),
  )
  return cache
}

/** Node / smoke: seed from filesystem map */
export function seedOverlayFontFiles(files: Map<string, Uint8Array>) {
  for (const [k, v] of files) cache.set(k, v)
}

export async function embedOverlayFont(
  pdf: PDFDocument,
  family: string,
): Promise<PDFFont | null> {
  ensureFontkit(pdf)
  const files = await loadOverlayFontFileMap()
  const bytes = resolveFontBytes(family, files)
  if (!bytes) return null
  return pdf.embedFont(bytes, { subset: true })
}

export function isTcOverlayFont(family?: string): family is OverlayFontId {
  return family === 'tc-light' || family === 'tc-demilight'
}

export { OVERLAY_FONT_FACES }
