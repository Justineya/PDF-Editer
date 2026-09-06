import { useEffect, useRef } from 'react'
import type { Rect } from '../types'
import { IconCheck, IconClose } from './icons'
import { FONT_OPTIONS } from './EditToolbar'

type Props = {
  region: Rect
  scale: number
  initialText?: string
  placeholder?: string
  /** Deprecated cover mode — prefer false */
  withWhiteout?: boolean
  fontFamily?: string
  fontSize?: number
  color?: string
  onCommit: (text: string) => void
  onCancel: () => void
}

/** In-place text editor; uses the style chosen in the edit style bar. */
export function InlineTextEditor({
  region,
  scale,
  initialText = '',
  placeholder = '输入文字…',
  withWhiteout = false,
  fontFamily = 'helvetica',
  fontSize,
  color = '#1a2332',
  onCommit,
  onCancel,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const css = FONT_OPTIONS.find((f) => f.id === fontFamily)?.css ?? FONT_OPTIONS[0].css
  const size = fontSize ?? Math.max(12, Math.min(28, region.h * scale * 0.55))

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
        minHeight: Math.max(region.h * scale, size + 8),
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <textarea
        ref={ref}
        defaultValue={initialText}
        placeholder={placeholder}
        style={{ fontSize: size, fontFamily: css, color }}
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
