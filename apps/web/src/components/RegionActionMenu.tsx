import type { Rect } from '../types'
import {
  IconClose,
  IconImage,
  IconReplace,
  IconStreamEdit,
  IconText,
  IconWhiteout,
} from './icons'

export type RegionAction =
  | 'add-text'
  | 'whiteout'
  | 'cover-edit'
  | 'stream-edit'
  | 'insert-image'
  | 'cancel'

type Props = {
  /** Region in page PDF coords */
  region: Rect
  scale: number
  onAction: (action: RegionAction) => void
}

/**
 * WPS-style post-marquee menu: pick what to do with the selected area.
 */
export function RegionActionMenu({ region, scale, onAction }: Props) {
  const left = region.x * scale
  const top = Math.max(0, region.y * scale - 48)

  return (
    <div
      className="region-action-menu"
      style={{ left, top }}
      role="menu"
      aria-label="区域编辑"
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
        title="改写页面内容流（真编辑，简单拉丁 PDF 效果最好）"
      >
        <IconStreamEdit size={15} />
        <span>修改原文</span>
      </button>
      <button type="button" role="menuitem" onClick={() => onAction('cover-edit')}>
        <IconReplace size={15} />
        <span>覆盖改字</span>
      </button>
      <button type="button" role="menuitem" onClick={() => onAction('whiteout')}>
        <IconWhiteout size={15} />
        <span>白盖清除</span>
      </button>
      <button type="button" role="menuitem" onClick={() => onAction('insert-image')}>
        <IconImage size={15} />
        <span>插入图片</span>
      </button>
      <button type="button" role="menuitem" className="ghost" onClick={() => onAction('cancel')} title="取消">
        <IconClose size={15} />
      </button>
    </div>
  )
}
