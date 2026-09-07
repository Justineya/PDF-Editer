import type { PageSelection } from '../pdf/selection'

type Props = {
  selection: PageSelection
  onCopy: () => void
  onHighlight: () => void
  onUnderline: () => void
  onStrike: () => void
  onCoverReplace: () => void
  onDismiss: () => void
  showCoverReplace?: boolean
}

export function SelectionToolbar({
  selection,
  onCopy,
  onHighlight,
  onUnderline,
  onStrike,
  onCoverReplace,
  onDismiss,
  showCoverReplace = true,
}: Props) {
  const left = Math.min(selection.anchor.left, selection.anchor.right)
  const top = Math.max(0, selection.anchor.top - 44)

  return (
    <div
      className="selection-toolbar"
      style={{ left, top }}
      role="toolbar"
      aria-label="选区操作"
      onMouseDown={(e) => e.preventDefault()}
    >
      <button type="button" onClick={onCopy}>复制</button>
      <button type="button" onClick={onHighlight}>高亮</button>
      <button type="button" onClick={onUnderline}>下划线</button>
      <button type="button" onClick={onStrike}>删除线</button>
      {showCoverReplace && (
        <button type="button" className="primary" onClick={onCoverReplace}>改文字</button>
      )}
      <button type="button" className="ghost" onClick={onDismiss} title="关闭">×</button>
      <span className="selection-toolbar-meta" title={selection.text}>
        {selection.text.slice(0, 28)}
        {selection.text.length > 28 ? '…' : ''}
      </span>
    </div>
  )
}
