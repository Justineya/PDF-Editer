import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { v4 as uuid } from 'uuid'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type {
  Annotation,
  AnnotTool,
  AppMode,
  DocumentModel,
  EditObjectRef,
  EditTool,
  Point,
  Rect,
} from '../types'
import { getCachedPdf, renderPageToCanvas } from '../pdf/engine'
import {
  captureSelectionOnPage,
  clearDomSelection,
  type PageSelection,
} from '../pdf/selection'
import { getPageTextItemRects, hitTestTextItem } from '../pdf/textLayer'
import { PageTextLayer } from './PageTextLayer'
import { SelectionToolbar } from './SelectionToolbar'
import { EditObjectLayer } from './EditObjectLayer'

function AnnotPaint(props: {
  doc: DocumentModel
  pageIndex: number
  scale: number
  coverRects: Rect[]
  paintOverlays: boolean
}) {
  const { doc, pageIndex, scale, coverRects, paintOverlays } = props
  return (
    <div className="annot-paint" style={{ pointerEvents: 'none' }}>
      {doc.annotations
        .filter((a) => a.pageIndex === pageIndex)
        .map((a) => {
          if (a.kind === 'highlight' || a.kind === 'underline' || a.kind === 'strike') {
            return a.rects.map((r, i) => (
              <div
                key={`${a.id}-${i}`}
                className={`markup ${a.kind}`}
                style={{
                  left: r.x * scale,
                  top:
                    a.kind === 'highlight'
                      ? r.y * scale
                      : a.kind === 'underline'
                        ? (r.y + r.h - 2) * scale
                        : (r.y + r.h / 2) * scale,
                  width: r.w * scale,
                  height: a.kind === 'highlight' ? r.h * scale : 2,
                  background: a.color,
                }}
              />
            ))
          }
          if (a.kind === 'note') {
            return (
              <div
                key={a.id}
                className="markup note"
                title={a.content}
                style={{ left: a.x * scale, top: a.y * scale, background: a.color }}
              >
                📝
              </div>
            )
          }
          if (a.kind === 'ink') {
            return (
              <svg key={a.id} className="ink-svg">
                {a.paths.map((path, i) => (
                  <polyline
                    key={i}
                    fill="none"
                    stroke={a.color}
                    strokeWidth={a.width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={path.map((p) => `${p.x * scale},${p.y * scale}`).join(' ')}
                  />
                ))}
              </svg>
            )
          }
          if (a.kind === 'stamp') {
            return (
              <div
                key={a.id}
                className="markup stamp"
                style={{
                  left: a.x * scale,
                  top: a.y * scale,
                  width: a.w * scale,
                  height: a.h * scale,
                  borderColor: a.color,
                  color: a.color,
                }}
              >
                {a.label}
              </div>
            )
          }
          return null
        })}
      {paintOverlays &&
        (doc.whiteouts ?? [])
          .filter((w) => w.pageIndex === pageIndex)
          .map((w) => (
            <div
              key={w.id}
              className="whiteout-box"
              style={{
                left: w.rect.x * scale,
                top: w.rect.y * scale,
                width: w.rect.w * scale,
                height: w.rect.h * scale,
                background: w.color || '#fff',
              }}
            />
          ))}
      {paintOverlays &&
        doc.overlays
          .filter((o) => o.pageIndex === pageIndex)
          .map((o) => (
            <div
              key={o.id}
              className="overlay-text"
              style={{
                left: o.x * scale,
                top: o.y * scale,
                color: o.color,
                fontSize: o.fontSize * scale * 0.85,
                fontWeight: o.bold ? 700 : 600,
              }}
            >
              {o.text}
            </div>
          ))}
      {paintOverlays &&
        doc.images
          .filter((o) => o.pageIndex === pageIndex)
          .map((o) => (
            <img
              key={o.id}
              className="overlay-img"
              src={o.dataUrl}
              alt=""
              style={{
                left: o.x * scale,
                top: o.y * scale,
                width: o.w * scale,
                height: o.h * scale,
              }}
            />
          ))}
      {doc.signatures
        .filter((o) => o.pageIndex === pageIndex)
        .map((o) => (
          <img
            key={o.id}
            className="sig-img"
            src={o.dataUrl}
            alt="签名"
            style={{
              left: o.x * scale,
              top: o.y * scale,
              width: o.w * scale,
              height: o.h * scale,
            }}
          />
        ))}
      {coverRects.map((r, i) => (
        <div
          key={i}
          className="redact-box"
          style={{
            left: r.x * scale,
            top: r.y * scale,
            width: r.w * scale,
            height: r.h * scale,
            opacity: 0.92,
          }}
        />
      ))}
      {doc.watermark && (
        <div
          className="overlay-text is-wm"
          style={{
            left: '18%',
            top: '42%',
            fontSize: doc.watermark.fontSize * scale * 0.55,
            color: doc.watermark.color,
            opacity: doc.watermark.opacity,
            transform: `rotate(-${doc.watermark.rotate}deg)`,
          }}
        >
          {doc.watermark.text}
        </div>
      )}
    </div>
  )
}

export type PageViewProps = {
  doc: DocumentModel
  pageIndex: number
  scale: number
  mode: AppMode
  annotTool: AnnotTool
  inkWidth: number
  color: string
  selectedOrganize: number[]
  editText: string
  signatureDataUrl: string | null
  editTool: EditTool
  selectedEdit: EditObjectRef | null
  pendingSelection: PageSelection | null
  onSelectOrganize: (pageIndex: number, multi: boolean) => void
  onAddAnnotation: (ann: Annotation) => void
  onMutateDoc: (updater: (d: DocumentModel) => DocumentModel) => void
  onPlaceSignature: (pageIndex: number, x: number, y: number) => void
  onSelectEdit: (ref: EditObjectRef | null) => void
  onPendingSelection: (sel: PageSelection | null) => void
  onPickImage?: (pageIndex: number, x: number, y: number) => void
}

export function PageView({
  doc,
  pageIndex,
  scale,
  mode,
  annotTool,
  inkWidth,
  color,
  selectedOrganize,
  editText,
  signatureDataUrl,
  editTool,
  selectedEdit,
  pendingSelection,
  onSelectOrganize,
  onAddAnnotation,
  onMutateDoc,
  onPlaceSignature,
  onSelectEdit,
  onPendingSelection,
  onPickImage,
}: PageViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const drawing = useRef<Point[]>([])
  const boxStart = useRef<Point | null>(null)
  const [box, setBox] = useState<Rect | null>(null)
  const [inkLive, setInkLive] = useState<Point[]>([])
  const [hasText, setHasText] = useState(true)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)

  useEffect(() => {
    setPdf(getCachedPdf(doc.id) ?? null)
  }, [doc.id, doc.bytes])

  useEffect(() => {
    const cached = getCachedPdf(doc.id)
    const canvas = canvasRef.current
    if (!cached || !canvas) return
    const handle = renderPageToCanvas(cached, pageIndex, scale, canvas)
    handle.promise.catch((err: unknown) => {
      if (
        err &&
        typeof err === 'object' &&
        'name' in err &&
        /cancel/i.test(String((err as { name: string }).name))
      ) {
        return
      }
      console.error(err)
    })
    return () => handle.cancel()
  }, [doc.id, pageIndex, scale, doc.bytes])

  const toLocal = (e: ReactPointerEvent | React.MouseEvent) => {
    const el = pageRef.current!
    const rect = el.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale }
  }

  const textInteractive = mode === 'select' || (mode === 'edit' && editTool === 'replace')
  const paintOverlays = mode !== 'edit'

  const finishSelection = useCallback(() => {
    const el = pageRef.current
    if (!el) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      onPendingSelection(null)
      return
    }
    const captured = captureSelectionOnPage(el, pageIndex, scale)
    // Keep previous toolbar if capture failed for a non-collapsed selection
    if (captured) onPendingSelection(captured)
  }, [pageIndex, scale, onPendingSelection])

  useEffect(() => {
    if (!textInteractive) {
      onPendingSelection(null)
      return
    }
    const onUp = () => window.setTimeout(finishSelection, 0)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearDomSelection()
        onPendingSelection(null)
      }
    }
    document.addEventListener('mouseup', onUp)
    document.addEventListener('selectionchange', onUp)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('selectionchange', onUp)
      document.removeEventListener('keydown', onKey)
    }
  }, [textInteractive, finishSelection, onPendingSelection])

  const applyMarkup = (kind: 'highlight' | 'underline' | 'strike') => {
    if (!pendingSelection || pendingSelection.pageIndex !== pageIndex) return
    onAddAnnotation({
      id: uuid(),
      kind,
      pageIndex,
      rects: pendingSelection.rects,
      text: pendingSelection.text,
      color: kind === 'highlight' ? '#f2c94c' : color,
      createdAt: Date.now(),
    })
    clearDomSelection()
    onPendingSelection(null)
  }

  const coverReplace = () => {
    if (!pendingSelection || pendingSelection.pageIndex !== pageIndex) return
    const next = window.prompt('覆盖替换为（覆盖编辑，非改内容流）', pendingSelection.text)
    if (next == null) return
    const rects = pendingSelection.rects
    onMutateDoc((d) => ({
      ...d,
      dirty: true,
      whiteouts: [
        ...(d.whiteouts ?? []),
        ...rects.map((rect) => ({
          id: uuid(),
          pageIndex,
          rect: { ...rect, h: Math.max(rect.h, 10), w: Math.max(rect.w, 8) },
          color: '#ffffff',
        })),
      ],
      overlays: [
        ...d.overlays,
        {
          id: uuid(),
          pageIndex,
          x: rects[0].x,
          y: rects[0].y,
          text: next || ' ',
          fontSize: Math.max(10, rects[0].h * 0.85),
          color: '#1a2332',
          w: rects.reduce((m, r) => Math.max(m, r.x + r.w - rects[0].x), 40),
          h: rects[0].h,
        },
      ],
    }))
    clearDomSelection()
    onPendingSelection(null)
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (mode === 'browse' || textInteractive) return
    if (mode === 'organize') {
      onSelectOrganize(pageIndex, e.metaKey || e.ctrlKey || e.shiftKey)
      return
    }
    if (mode === 'edit' && editTool === 'select') {
      onSelectEdit(null)
      return
    }
    const p = toLocal(e)

    if (mode === 'annotate' && annotTool === 'ink') {
      drawing.current = [p]
      setInkLive([p])
      overlayRef.current?.setPointerCapture(e.pointerId)
      return
    }
    if (
      mode === 'annotate' &&
      (annotTool === 'highlight' ||
        annotTool === 'underline' ||
        annotTool === 'strike' ||
        annotTool === 'stamp' ||
        annotTool === 'area')
    ) {
      boxStart.current = p
      setBox({ x: p.x, y: p.y, w: 0, h: 0 })
      overlayRef.current?.setPointerCapture(e.pointerId)
      return
    }
    if (mode === 'annotate' && annotTool === 'note') {
      const content = window.prompt('便签内容', '备注') || ''
      onAddAnnotation({
        id: uuid(),
        kind: 'note',
        pageIndex,
        x: p.x,
        y: p.y,
        content,
        color,
        createdAt: Date.now(),
      })
      return
    }
    if (mode === 'edit' && editTool === 'text') {
      const text = window.prompt('输入文字', editText || '文本')
      if (text == null) return
      onMutateDoc((d) => ({
        ...d,
        dirty: true,
        overlays: [
          ...d.overlays,
          {
            id: uuid(),
            pageIndex,
            x: p.x,
            y: p.y,
            text: text || '文本',
            fontSize: 16,
            color: '#1a2332',
          },
        ],
      }))
      return
    }
    if (mode === 'edit' && editTool === 'image') {
      onPickImage?.(pageIndex, p.x, p.y)
      return
    }
    if (mode === 'edit' && editTool === 'whiteout') {
      boxStart.current = p
      setBox({ x: p.x, y: p.y, w: 0, h: 0 })
      overlayRef.current?.setPointerCapture(e.pointerId)
      return
    }
    if (mode === 'edit' && editTool === 'replace') {
      const cached = getCachedPdf(doc.id)
      if (!cached) return
      void (async () => {
        const items = await getPageTextItemRects(cached, pageIndex)
        const hit = hitTestTextItem(items, p.x, p.y)
        if (!hit) {
          window.alert('未命中文本块。也可先切到「选择」拖选后点覆盖替换。')
          return
        }
        const next = window.prompt('替换文本（白盖+重绘）', hit.str)
        if (next == null) return
        onMutateDoc((d) => ({
          ...d,
          dirty: true,
          whiteouts: [
            ...(d.whiteouts ?? []),
            { id: uuid(), pageIndex, rect: hit.rect, color: '#ffffff' },
          ],
          overlays: [
            ...d.overlays,
            {
              id: uuid(),
              pageIndex,
              x: hit.rect.x,
              y: hit.rect.y,
              text: next,
              fontSize: Math.max(10, hit.rect.h * 0.85),
              color: '#1a2332',
              w: hit.rect.w,
              h: hit.rect.h,
            },
          ],
        }))
      })()
      return
    }
    if (mode === 'sign' && signatureDataUrl) {
      onPlaceSignature(pageIndex, p.x, p.y)
      return
    }
    if (mode === 'redact') {
      boxStart.current = p
      setBox({ x: p.x, y: p.y, w: 0, h: 0 })
      overlayRef.current?.setPointerCapture(e.pointerId)
    }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    if (textInteractive) return
    const p = toLocal(e)
    if (mode === 'annotate' && annotTool === 'ink' && drawing.current.length) {
      drawing.current.push(p)
      setInkLive(drawing.current.slice())
      return
    }
    if (boxStart.current) {
      const s = boxStart.current
      setBox({
        x: Math.min(s.x, p.x),
        y: Math.min(s.y, p.y),
        w: Math.abs(p.x - s.x),
        h: Math.abs(p.y - s.y),
      })
    }
  }

  const onPointerUp = () => {
    if (textInteractive) return
    if (mode === 'annotate' && annotTool === 'ink' && drawing.current.length > 1) {
      onAddAnnotation({
        id: uuid(),
        kind: 'ink',
        pageIndex,
        paths: [drawing.current.slice()],
        width: inkWidth,
        color,
        createdAt: Date.now(),
      })
    }
    if (box && boxStart.current && box.w > 2 && box.h > 2) {
      if (
        mode === 'annotate' &&
        (annotTool === 'highlight' ||
          annotTool === 'underline' ||
          annotTool === 'strike' ||
          annotTool === 'area')
      ) {
        const kind =
          annotTool === 'area'
            ? 'highlight'
            : (annotTool as 'highlight' | 'underline' | 'strike')
        onAddAnnotation({
          id: uuid(),
          kind,
          pageIndex,
          rects: [box],
          color,
          createdAt: Date.now(),
          text: annotTool === 'area' ? '(区域)' : undefined,
        })
      }
      if (mode === 'annotate' && annotTool === 'stamp') {
        onAddAnnotation({
          id: uuid(),
          kind: 'stamp',
          pageIndex,
          x: box.x,
          y: box.y,
          w: Math.max(box.w, 80),
          h: Math.max(box.h, 36),
          label: 'APPROVED',
          color,
          createdAt: Date.now(),
        })
      }
      if (mode === 'edit' && editTool === 'whiteout') {
        onMutateDoc((d) => ({
          ...d,
          dirty: true,
          whiteouts: [
            ...(d.whiteouts ?? []),
            { id: uuid(), pageIndex, rect: box, color: '#ffffff' },
          ],
        }))
      }
      if (mode === 'redact') {
        onMutateDoc((d) => ({
          ...d,
          dirty: true,
          redactions: [...d.redactions, { id: uuid(), pageIndex, rect: box }],
        }))
      }
    }
    drawing.current = []
    boxStart.current = null
    setBox(null)
    setInkLive([])
  }

  const selected = selectedOrganize.includes(pageIndex)
  const covers = doc.redactions.filter((r) => r.pageIndex === pageIndex).map((r) => r.rect)
  const showToolbar =
    !!pendingSelection &&
    pendingSelection.pageIndex === pageIndex &&
    pendingSelection.rects.length > 0

  return (
    <div ref={pageRef} className={`page-wrap ${selected ? 'selected' : ''}`} data-page={pageIndex}>
      <canvas ref={canvasRef} className="page-canvas" />
      {pdf && (
        <PageTextLayer
          pdf={pdf}
          pageIndex={pageIndex}
          scale={scale}
          interactive={textInteractive}
          onHasText={setHasText}
        />
      )}
      <AnnotPaint
        doc={doc}
        pageIndex={pageIndex}
        scale={scale}
        coverRects={covers}
        paintOverlays={paintOverlays}
      />
      {mode === 'edit' && (
        <EditObjectLayer
          scale={scale}
          pageIndex={pageIndex}
          interactive={editTool === 'select'}
          overlays={doc.overlays}
          images={doc.images}
          whiteouts={doc.whiteouts ?? []}
          selected={selectedEdit}
          onSelect={onSelectEdit}
          onMove={(ref, x, y) => {
            onMutateDoc((d) => {
              if (ref.kind === 'text') {
                return {
                  ...d,
                  dirty: true,
                  overlays: d.overlays.map((o) => (o.id === ref.id ? { ...o, x, y } : o)),
                }
              }
              if (ref.kind === 'image') {
                return {
                  ...d,
                  dirty: true,
                  images: d.images.map((o) => (o.id === ref.id ? { ...o, x, y } : o)),
                }
              }
              return {
                ...d,
                dirty: true,
                whiteouts: (d.whiteouts ?? []).map((o) =>
                  o.id === ref.id ? { ...o, rect: { ...o.rect, x, y } } : o,
                ),
              }
            })
          }}
          onResize={(ref, rect) => {
            onMutateDoc((d) => {
              if (ref.kind === 'text') {
                return {
                  ...d,
                  dirty: true,
                  overlays: d.overlays.map((o) =>
                    o.id === ref.id ? { ...o, x: rect.x, y: rect.y, w: rect.w, h: rect.h } : o,
                  ),
                }
              }
              if (ref.kind === 'image') {
                return {
                  ...d,
                  dirty: true,
                  images: d.images.map((o) =>
                    o.id === ref.id ? { ...o, x: rect.x, y: rect.y, w: rect.w, h: rect.h } : o,
                  ),
                }
              }
              return {
                ...d,
                dirty: true,
                whiteouts: (d.whiteouts ?? []).map((o) => (o.id === ref.id ? { ...o, rect } : o)),
              }
            })
          }}
          onEditText={(id, text) => {
            onMutateDoc((d) => ({
              ...d,
              dirty: true,
              overlays: d.overlays.map((o) => (o.id === id ? { ...o, text } : o)),
            }))
          }}
          onDelete={(ref) => {
            onMutateDoc((d) => {
              if (ref.kind === 'text') {
                return { ...d, dirty: true, overlays: d.overlays.filter((o) => o.id !== ref.id) }
              }
              if (ref.kind === 'image') {
                return { ...d, dirty: true, images: d.images.filter((o) => o.id !== ref.id) }
              }
              return {
                ...d,
                dirty: true,
                whiteouts: (d.whiteouts ?? []).filter((o) => o.id !== ref.id),
              }
            })
            onSelectEdit(null)
          }}
        />
      )}
      {!textInteractive && (
        <div
          ref={overlayRef}
          className={`page-overlay ${mode}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      )}
      {inkLive.length > 1 && (
        <svg className="live-ink">
          <polyline
            fill="none"
            stroke={color}
            strokeWidth={inkWidth}
            strokeLinecap="round"
            points={inkLive.map((p) => `${p.x * scale},${p.y * scale}`).join(' ')}
          />
        </svg>
      )}
      {box && (
        <div
          className="sel-box"
          style={{
            left: box.x * scale,
            top: box.y * scale,
            width: Math.max(box.w * scale, 1),
            height: Math.max(box.h * scale, 1),
            background:
              mode === 'redact'
                ? 'rgba(0,0,0,0.55)'
                : editTool === 'whiteout'
                  ? 'rgba(255,255,255,0.75)'
                  : undefined,
          }}
        />
      )}
      {showToolbar && pendingSelection && (
        <SelectionToolbar
          selection={pendingSelection}
          onCopy={() => void navigator.clipboard.writeText(pendingSelection.text)}
          onHighlight={() => applyMarkup('highlight')}
          onUnderline={() => applyMarkup('underline')}
          onStrike={() => applyMarkup('strike')}
          onCoverReplace={coverReplace}
          onDismiss={() => {
            clearDomSelection()
            onPendingSelection(null)
          }}
        />
      )}
      {mode === 'select' && !hasText && (
        <div className="page-empty-text">本页无可选文字 · 可用批注「区域」或先 OCR</div>
      )}
      <div className="muted page-num">第 {pageIndex + 1} 页</div>
    </div>
  )
}
