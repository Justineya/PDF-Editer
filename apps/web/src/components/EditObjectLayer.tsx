import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type {
  EditObjectRef,
  OverlayImage,
  OverlayText,
  Rect,
  WhiteoutRect,
} from '../types'
import { layoutTextBlock } from '../pdf/textLayout'
import { FONT_OPTIONS } from './EditToolbar'

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

/** Which edges move during resize. */
type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const MIN_W = 24
const MIN_H = 14

function safePointerCapture(el: HTMLElement, pointerId: number) {
  try {
    el.setPointerCapture(pointerId)
  } catch {
    /* ignore */
  }
}

function cssFont(family?: string) {
  return (
    FONT_OPTIONS.find((f) => f.id === family)?.css ??
    '"Source Han Sans TC", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif'
  )
}

function cssWeight(family?: string, bold?: boolean): number {
  if (bold || family === 'tc-bold') return 700
  if (family === 'tc-light') return 300
  if (family === 'tc-demilight') return 350
  return 400
}

function textRect(o: OverlayText): Rect {
  const laid = layoutTextBlock(o.text, o.fontSize, o.w)
  return {
    x: o.x,
    y: o.y,
    w: o.w ?? laid.w,
    // Honor explicit user height so vertical shrink sticks
    h: o.h ?? laid.h,
  }
}

function applyResize(start: Rect, dx: number, dy: number, edge: ResizeEdge): Rect {
  let { x, y, w, h } = start
  const moveW = edge.includes('w')
  const moveE = edge.includes('e')
  const moveN = edge.includes('n')
  const moveS = edge.includes('s')

  if (moveE) w = start.w + dx
  if (moveS) h = start.h + dy
  if (moveW) {
    w = start.w - dx
    x = start.x + dx
  }
  if (moveN) {
    h = start.h - dy
    y = start.y + dy
  }

  if (w < MIN_W) {
    if (moveW) x = start.x + start.w - MIN_W
    w = MIN_W
  }
  if (h < MIN_H) {
    if (moveN) y = start.y + start.h - MIN_H
    h = MIN_H
  }
  return { x, y, w, h }
}

const HANDLE_EDGES: ResizeEdge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

function ResizeHandles({
  rect,
  locked,
  onStart,
}: {
  rect: Rect
  locked?: boolean
  onStart: (edge: ResizeEdge, e: ReactPointerEvent) => void
}) {
  return (
    <>
      {HANDLE_EDGES.map((edge) => (
        <span
          key={edge}
          className={`resize-handle edge-${edge}`}
          data-edge={edge}
          title={
            edge === 'e' || edge === 'w'
              ? '左右缩放'
              : edge === 'n' || edge === 's'
                ? '上下缩放'
                : '对角缩放'
          }
          onPointerDown={(e) => onStart(edge, e)}
          style={{ pointerEvents: locked ? 'none' : 'auto' }}
        />
      ))}
    </>
  )
}

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
    edge: ResizeEdge
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

  useEffect(() => {
    const onMoveWin = (e: PointerEvent) => {
      if (drag.current) {
        const dx = (e.clientX - drag.current.ox) / scale
        const dy = (e.clientY - drag.current.oy) / scale
        onMove(drag.current.ref, drag.current.start.x + dx, drag.current.start.y + dy)
        return
      }
      if (resize.current) {
        const dx = (e.clientX - resize.current.originX) / scale
        const dy = (e.clientY - resize.current.originY) / scale
        onResize(resize.current.ref, applyResize(resize.current.start, dx, dy, resize.current.edge))
      }
    }
    const onUpWin = () => {
      drag.current = null
      resize.current = null
    }
    window.addEventListener('pointermove', onMoveWin)
    window.addEventListener('pointerup', onUpWin)
    window.addEventListener('pointercancel', onUpWin)
    return () => {
      window.removeEventListener('pointermove', onMoveWin)
      window.removeEventListener('pointerup', onUpWin)
      window.removeEventListener('pointercancel', onUpWin)
    }
  }, [scale, onMove, onResize])

  const isSelected = (kind: EditObjectRef['kind'], id: string) =>
    selected?.kind === kind && selected.id === id

  const onPointerDownMove =
    (ref: EditObjectRef, rect: Rect, locked?: boolean) => (e: ReactPointerEvent) => {
      if (!interactive || locked || editingId) return
      e.stopPropagation()
      e.preventDefault()
      onSelect(ref)
      resize.current = null
      safePointerCapture(e.currentTarget as HTMLElement, e.pointerId)
      drag.current = { ref, ox: e.clientX, oy: e.clientY, start: { ...rect } }
    }

  const startResize =
    (ref: EditObjectRef, rect: Rect, locked?: boolean) =>
    (edge: ResizeEdge, e: ReactPointerEvent) => {
      if (!interactive || locked) return
      e.stopPropagation()
      e.preventDefault()
      onSelect(ref)
      drag.current = null
      safePointerCapture(e.currentTarget as HTMLElement, e.pointerId)
      resize.current = {
        ref,
        start: { ...rect },
        originX: e.clientX,
        originY: e.clientY,
        edge,
      }
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
    <div className={`edit-object-layer ${interactive ? 'is-interactive' : ''}`}>
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
              title="图形 · 拖动 / 边角缩放"
            >
              {sel && (
                <>
                  {chrome(ref)}
                  <ResizeHandles
                    rect={w.rect}
                    locked={w.locked}
                    onStart={startResize(ref, w.rect, w.locked)}
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
              title="图片 · 拖动 / 边角缩放"
            >
              <img src={o.dataUrl} alt="" draggable={false} />
              {sel && (
                <>
                  {chrome(ref)}
                  <ResizeHandles
                    rect={rect}
                    locked={o.locked}
                    onStart={startResize(ref, rect, o.locked)}
                  />
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
          const rect = textRect(o)
          const editing = editingId === o.id
          return (
            <div
              key={o.id}
              className={`edit-obj text ${sel ? 'selected' : ''} ${editing ? 'editing' : ''}`}
              style={{
                left: o.x * scale,
                top: o.y * scale,
                width: rect.w * scale,
                height: rect.h * scale,
                color: o.color,
                fontSize: o.fontSize * scale,
                fontWeight: cssWeight(o.fontFamily, o.bold),
                lineHeight: 1.25,
                whiteSpace: 'pre-wrap',
                overflow: 'visible',
                fontFamily: cssFont(o.fontFamily),
              }}
              onPointerDown={editing ? undefined : onPointerDownMove(ref, rect, o.locked)}
              onDoubleClick={(e) => {
                e.stopPropagation()
                onSelect(ref)
                setEditingId(o.id)
              }}
              title="文字 · 四边/四角缩放（左右、上下可单独拖）"
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
                  <ResizeHandles
                    rect={rect}
                    locked={o.locked}
                    onStart={startResize(ref, rect, o.locked)}
                  />
                </>
              )}
            </div>
          )
        })}
    </div>
  )
}
