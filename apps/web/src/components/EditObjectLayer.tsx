import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type {
  EditObjectRef,
  OverlayImage,
  OverlayText,
  Rect,
  WhiteoutRect,
} from '../types'

type Props = {
  scale: number
  pageIndex: number
  /** Prefer true for every edit tool so objects stay clickable. */
  interactive: boolean
  overlays: OverlayText[]
  images: OverlayImage[]
  whiteouts: WhiteoutRect[]
  selected: EditObjectRef | null
  onSelect: (ref: EditObjectRef | null) => void
  onMove: (ref: EditObjectRef, x: number, y: number) => void
  onResize: (ref: EditObjectRef, rect: Rect) => void
  onEditText: (id: string, text: string) => void
  onDelete: (ref: EditObjectRef) => void
}

function safePointerCapture(el: HTMLElement, pointerId: number) {
  try {
    el.setPointerCapture(pointerId)
  } catch {
    /* Synthetic / already-released pointers throw NotFoundError */
  }
}

function approxTextSize(o: OverlayText): { w: number; h: number } {
  const h = o.h ?? o.fontSize * 1.35
  const w = o.w ?? Math.max(40, o.text.length * o.fontSize * 0.62)
  return { w, h }
}

/**
 * Click selects, double-click edits text, chrome Delete removes.
 * Objects stay above the page overlay so they can be selected anytime.
 */
export function EditObjectLayer({
  scale,
  pageIndex,
  interactive,
  overlays,
  images,
  whiteouts,
  selected,
  onSelect,
  onMove,
  onResize,
  onEditText,
  onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const editRef = useRef<HTMLDivElement>(null)
  const drag = useRef<null | {
    ref: EditObjectRef
    ox: number
    oy: number
    start: Rect
  }>(null)
  const resize = useRef<null | {
    ref: EditObjectRef
    start: Rect
    originX: number
    originY: number
  }>(null)

  useEffect(() => {
    if (!editingId || !editRef.current) return
    const el = editRef.current
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }, [editingId])

  useEffect(() => {
    if (!editingId) return
    if (selected?.kind !== 'text' || selected.id !== editingId) setEditingId(null)
  }, [selected, editingId])

  const isSelected = (kind: EditObjectRef['kind'], id: string) =>
    selected?.kind === kind && selected.id === id

  const onPointerDownMove =
    (ref: EditObjectRef, rect: Rect, locked?: boolean) => (e: ReactPointerEvent) => {
      if (!interactive || locked || editingId) return
      e.stopPropagation()
      e.preventDefault()
      onSelect(ref)
      safePointerCapture(e.currentTarget as HTMLElement, e.pointerId)
      drag.current = { ref, ox: e.clientX, oy: e.clientY, start: { ...rect } }
    }

  const onPointerMove = (e: ReactPointerEvent) => {
    if (drag.current) {
      const dx = (e.clientX - drag.current.ox) / scale
      const dy = (e.clientY - drag.current.oy) / scale
      onMove(drag.current.ref, drag.current.start.x + dx, drag.current.start.y + dy)
      return
    }
    if (resize.current) {
      const dx = (e.clientX - resize.current.originX) / scale
      const dy = (e.clientY - resize.current.originY) / scale
      const s = resize.current.start
      onResize(resize.current.ref, {
        x: s.x,
        y: s.y,
        w: Math.max(16, s.w + dx),
        h: Math.max(12, s.h + dy),
      })
    }
  }

  const onPointerUp = () => {
    drag.current = null
    resize.current = null
  }

  const startResize =
    (ref: EditObjectRef, rect: Rect, locked?: boolean) => (e: ReactPointerEvent) => {
      if (!interactive || locked) return
      e.stopPropagation()
      e.preventDefault()
      onSelect(ref)
      safePointerCapture(e.currentTarget as HTMLElement, e.pointerId)
      resize.current = { ref, start: { ...rect }, originX: e.clientX, originY: e.clientY }
    }

  const chrome = (ref: EditObjectRef, opts?: { editText?: boolean }) => (
    <div className="edit-obj-chrome" onPointerDown={(e) => e.stopPropagation()}>
      {opts?.editText && (
        <button
          type="button"
          className="edit-obj-chrome-btn"
          onClick={() => {
            onSelect(ref)
            setEditingId(ref.id)
          }}
        >
          编辑
        </button>
      )}
      <button
        type="button"
        className="edit-obj-chrome-btn danger"
        onClick={() => onDelete(ref)}
        title="删除 (Delete)"
      >
        删除
      </button>
    </div>
  )

  return (
    <div
      className={`edit-object-layer ${interactive ? 'is-interactive' : ''}`}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {whiteouts
        .filter((w) => w.pageIndex === pageIndex)
        .map((w) => {
          const sel = isSelected('whiteout', w.id)
          const ref: EditObjectRef = { kind: 'whiteout', id: w.id }
          return (
            <div
              key={w.id}
              className={`edit-obj shape ${w.shape === 'ellipse' ? 'ellipse' : 'rect'} ${sel ? 'selected' : ''}`}
              style={{
                left: w.rect.x * scale,
                top: w.rect.y * scale,
                width: w.rect.w * scale,
                height: w.rect.h * scale,
                background: w.color || '#ffffff',
                borderRadius: w.shape === 'ellipse' ? '50%' : undefined,
              }}
              onPointerDown={onPointerDownMove(ref, w.rect, w.locked)}
              title="图形 · 单击选中，可拖动 / 删除"
            >
              {sel && (
                <>
                  {chrome(ref)}
                  <span
                    className="resize-handle"
                    onPointerDown={startResize(ref, w.rect, w.locked)}
                  />
                </>
              )}
            </div>
          )
        })}

      {images
        .filter((o) => o.pageIndex === pageIndex)
        .map((o) => {
          const sel = isSelected('image', o.id)
          const ref: EditObjectRef = { kind: 'image', id: o.id }
          const rect: Rect = { x: o.x, y: o.y, w: o.w, h: o.h }
          return (
            <div
              key={o.id}
              className={`edit-obj image ${sel ? 'selected' : ''}`}
              style={{
                left: o.x * scale,
                top: o.y * scale,
                width: o.w * scale,
                height: o.h * scale,
              }}
              onPointerDown={onPointerDownMove(ref, rect, o.locked)}
              title="图片 · 单击选中，可拖动 / 删除"
            >
              <img src={o.dataUrl} alt="" draggable={false} />
              {sel && (
                <>
                  {chrome(ref)}
                  <span className="resize-handle" onPointerDown={startResize(ref, rect, o.locked)} />
                </>
              )}
            </div>
          )
        })}

      {overlays
        .filter((o) => o.pageIndex === pageIndex)
        .map((o) => {
          const sel = isSelected('text', o.id)
          const ref: EditObjectRef = { kind: 'text', id: o.id }
          const size = approxTextSize(o)
          const rect: Rect = { x: o.x, y: o.y, w: size.w, h: size.h }
          const editing = editingId === o.id
          return (
            <div
              key={o.id}
              className={`edit-obj text ${sel ? 'selected' : ''} ${editing ? 'editing' : ''}`}
              style={{
                left: o.x * scale,
                top: o.y * scale,
                minWidth: size.w * scale,
                minHeight: size.h * scale,
                color: o.color,
                fontSize: o.fontSize * scale,
                fontWeight: o.bold ? 700 : 400,
                lineHeight: 1.25,
                whiteSpace: 'pre-wrap',
                fontFamily: (
                  o.fontFamily === 'tc-regular' || o.fontFamily === 'sans-cjk'
                    ? '"Source Han Sans TC", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif'
                    : o.fontFamily === 'tc-light'
                      ? '"Source Han Sans TC Light", "Noto Sans TC", "PingFang TC", sans-serif'
                      : o.fontFamily === 'tc-demilight'
                        ? '"Source Han Sans TC", "Noto Sans TC", "PingFang TC", sans-serif'
                        : o.fontFamily === 'times'
                          ? '"Times New Roman", Times, serif'
                          : o.fontFamily === 'courier'
                            ? '"Courier New", Courier, monospace'
                            : 'Helvetica, Arial, sans-serif'
                ),
              }}
              onPointerDown={editing ? undefined : onPointerDownMove(ref, rect, o.locked)}
              onDoubleClick={(e) => {
                e.stopPropagation()
                onSelect(ref)
                setEditingId(o.id)
              }}
              title="文字 · 单击选中，双击编辑"
            >
              {editing ? (
                <div
                  ref={editRef}
                  className="edit-obj-editor"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const next = e.currentTarget.innerText.replace(/\u00a0/g, ' ')
                    onEditText(o.id, next)
                    setEditingId(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      setEditingId(null)
                    }
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      ;(e.target as HTMLElement).blur()
                    }
                    e.stopPropagation()
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {o.text}
                </div>
              ) : (
                <span className="edit-obj-label">{o.text}</span>
              )}
              {sel && !editing && (
                <>
                  {chrome(ref, { editText: true })}
                  <span className="resize-handle" onPointerDown={startResize(ref, rect, o.locked)} />
                </>
              )}
            </div>
          )
        })}
    </div>
  )
}
