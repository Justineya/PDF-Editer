import { useEffect, useRef } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { renderTextLayerToContainer } from '../pdf/textLayer'

type Props = {
  pdf: PDFDocumentProxy
  pageIndex: number
  scale: number
  interactive: boolean
  onHasText?: (has: boolean) => void
}

/** Selectable PDF.js text layer aligned to the page canvas. */
export function PageTextLayer({ pdf, pageIndex, scale, interactive, onHasText }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let alive = true
    let handle: ReturnType<typeof renderTextLayerToContainer> | null = null

    ;(async () => {
      try {
        const page = await pdf.getPage(pageIndex + 1)
        if (!alive || !ref.current) return
        handle = renderTextLayerToContainer(page, scale, ref.current)
        const result = await handle.promise
        if (!alive) return
        onHasText?.(result.hasText)
      } catch (err) {
        console.error(err)
        onHasText?.(false)
      }
    })()

    return () => {
      alive = false
      handle?.cancel()
    }
  }, [pdf, pageIndex, scale, onHasText])

  return (
    <div
      ref={ref}
      className={`textLayer ${interactive ? 'is-interactive' : 'is-inert'}`}
      aria-hidden={!interactive}
    />
  )
}
