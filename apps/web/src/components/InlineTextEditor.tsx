import { useEffect, useRef } from 'react'
import type { Rect } from '../types'
import { IconCheck, IconClose } from './icons'

type Props = {
  region: Rect
  scale: number
  initialText?: string
  placeholder?: string
  /** White background under the editor (cover-edit mode) */
  withWhiteout?: boolean
  onCommit: (text: string) => void
  onCancel: () => void
}

/**
 * In-place text editor inside a selected page region (no window.prompt).
 */
export function InlineTextEditor({
  region,
  scale,
  initialText = '',
  placeholder = '输入文字…',
  withWhiteout = false,
  onCommit,
  onCancel,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.select()
  }, [])

  const commit = () => {
    const text = (ref.current?.value ?? '').trimEnd()
    onCommit(text)
  }

  return (
    <div
      className={`inline-text-editor ${withWhiteout ? 'with-whiteout' : ''}`}
      style={{
        left: region.x * scale,
        top: region.y * scale,
        width: Math.max(region.w * scale, 80),
        minHeight: Math.max(region.h * scale, 28),
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <textarea
        ref={ref}
        defaultValue={initialText}
        placeholder={placeholder}
        style={{ fontSize: Math.max(12, Math.min(28, region.h * scale * 0.55)) }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            commit()
          }
        }}
      />
      <div className="inline-text-actions">
        <button type="button" className="primary" onClick={commit} title="完成 (⌘/Ctrl+Enter)">
          <IconCheck size={14} />
          完成
        </button>
        <button type="button" className="ghost" onClick={onCancel} title="取消">
          <IconClose size={14} />
        </button>
      </div>
    </div>
  )
}
