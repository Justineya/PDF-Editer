import type { Rect } from '../types'
import {
  IconClose,
  IconImage,
  IconShape,
  IconStreamEdit,
  IconText,
} from './icons'

export type RegionAction =
  | 'add-text'
  | 'shape'
  | 'stream-edit'
  | 'insert-image'
  | 'cancel'

type Props = {
  region: Rect
  scale: number
  onAction: (action: RegionAction) => void
}

/**
 * Post-marquee menu: add text / shape / stream-edit / image.
 * Cover-replace removed — use the shape tool with a fill color instead.
 */
export function RegionActionMenu({ region, scale, onAction }: Props) {
  const left = region.x * scale
  const top = Math.max(0, region.y * scale - 48)

  return (
    <div
      className="region-action-menu"
      style={{ left, top }}
      role="menu"
      aria-label="区域操作"
      onMouseDown={(e) => e.preventDefault()}
    >
      <button type="button" role="menuitem" onClick={() => onAction('add-text')}>
        <IconText size={15} />
        <span>添加文字</span>
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => onAction('stream-edit')}
        title="改写页面内容流（简单拉丁 PDF 较稳）"
      >
        <IconStreamEdit size={15} />
        <span>修改原文</span>
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => onAction('shape')}
        title="用当前颜色填充此区域"
      >
        <IconShape size={15} />
        <span>填充矩形</span>
      </button>
      <button type="button" role="menuitem" onClick={() => onAction('insert-image')}>
        <IconImage size={15} />
        <span>插入图片</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="ghost"
        onClick={() => onAction('cancel')}
        title="取消"
      >
        <IconClose size={15} />
      </button>
    </div>
  )
}
