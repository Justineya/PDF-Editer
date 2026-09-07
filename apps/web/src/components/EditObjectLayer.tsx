import type { PointerEvent as ReactPointerEvent } from 'react'
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

function approxTextSize(o: OverlayText): { w: number; h: number } {
  const h = o.h ?? o.fontSize * 1.35
  const w = o.w ?? Math.max(40, o.text.length * o.fontSize * 0.62)
  return { w, h }
}

/** Interactive edit objects: select / drag / resize / inline text. */
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
  const drag = {
    current: null as null | { ref: EditObjectRef; ox: number; oy: number; start: Rect },
  }
  const resize = {
    current: null as null | {
      ref: EditObjectRef
      start: Rect
      originX: number
      originY: number
    },
  }

  const isSelected = (kind: EditObjectRef['kind'], id: string) =>
    selected?.kind === kind && selected.id === id

  const onPointerDownMove =
    (ref: EditObjectRef, rect: Rect, locked?: boolean) => (e: ReactPointerEvent) => {
      if (!interactive || locked) return
      e.stopPropagation()
      e.preventDefault()
      onSelect(ref)
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
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
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      resize.current = { ref, start: { ...rect }, originX: e.clientX, originY: e.clientY }
    }

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
              className={`edit-obj whiteout ${sel ? 'selected' : ''}`}
              style={{
                left: w.rect.x * scale,
                top: w.rect.y * scale,
                width: w.rect.w * scale,
                height: w.rect.h * scale,
                background: w.color || '#ffffff',
              }}
              onPointerDown={onPointerDownMove(ref, w.rect, w.locked)}
              onDoubleClick={(e) => {
                e.stopPropagation()
                if (confirm('删除此白盖？')) onDelete(ref)
              }}
            >
              {sel && (
                <span className="resize-handle" onPointerDown={startResize(ref, w.rect, w.locked)} />
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
            >
              <img src={o.dataUrl} alt="" draggable={false} />
              {sel && (
                <span className="resize-handle" onPointerDown={startResize(ref, rect, o.locked)} />
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
          return (
            <div
              key={o.id}
              className={`edit-obj text ${sel ? 'selected' : ''}`}
              style={{
                left: o.x * scale,
                top: o.y * scale,
                minWidth: size.w * scale,
                minHeight: size.h * scale,
                color: o.color,
                fontSize: o.fontSize * scale * 0.85,
                fontWeight: o.bold ? 700 : 600,
              }}
              onPointerDown={onPointerDownMove(ref, rect, o.locked)}
              onDoubleClick={(e) => {
                e.stopPropagation()
                const next = window.prompt('编辑文字', o.text)
                if (next != null) onEditText(o.id, next)
              }}
            >
              {o.text}
              {sel && (
                <span className="resize-handle" onPointerDown={startResize(ref, rect, o.locked)} />
              )}
            </div>
          )
        })}
    </div>
  )
}
