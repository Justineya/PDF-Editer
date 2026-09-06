import type { EditTool } from '../types'
import type { ReactElement } from 'react'
import {
  IconImage,
  IconRegion,
  IconSelect,
  IconShape,
  IconText,
  IconWatermark,
} from './icons'

export const EDIT_TOOL_META: Record<
  EditTool,
  { label: string; hint: string; Icon: (p: { size?: number }) => ReactElement }
> = {
  select: {
    label: '选择',
    hint: '单击选中对象 · 双击改字 · Delete 删除 · 空白处取消选中',
    Icon: IconSelect,
  },
  shape: {
    label: '矩形',
    hint: '先选颜色，再按住左键拖拽画矩形（替代白盖/覆盖）',
    Icon: IconShape,
  },
  text: {
    label: '文字',
    hint: '点击页面放置文字；完成后自动回到选择',
    Icon: IconText,
  },
  image: {
    label: '图片',
    hint: '点击页面插入图片；完成后自动回到选择',
    Icon: IconImage,
  },
  region: {
    label: '框选',
    hint: '框选区域后添加文字 / 改原文（高级）',
    Icon: IconRegion,
  },
  replace: {
    label: '点选原文',
    hint: '点原文文本块后就地改字（高级）',
    Icon: IconText,
  },
  watermark: {
    label: '水印',
    hint: '在右侧面板设置并应用到全部页',
    Icon: IconWatermark,
  },
}

const PRIMARY_TOOLS: EditTool[] = ['select', 'shape', 'text', 'image', 'region']

type Props = {
  editTool: EditTool
  onChange: (tool: EditTool) => void
  fillColor: string
  onFillColorChange: (color: string) => void
}

/** Icon toolbar under the mode bar while editing. */
export function EditToolbar({ editTool, onChange, fillColor, onFillColorChange }: Props) {
  return (
    <div className="edit-toolbar" role="toolbar" aria-label="编辑工具">
      <span className="edit-toolbar-label">编辑</span>
      {PRIMARY_TOOLS.map((k) => {
        const meta = EDIT_TOOL_META[k]
        const Icon = meta.Icon
        return (
          <button
            key={k}
            type="button"
            className={`tool-btn ${editTool === k ? 'active' : ''}`}
            title={meta.hint}
            aria-pressed={editTool === k}
            onClick={() => onChange(k)}
          >
            <Icon size={16} />
            <span>{meta.label}</span>
          </button>
        )
      })}
      <label className="edit-toolbar-color" title="矩形填充颜色">
        <span>颜色</span>
        <input
          type="color"
          value={fillColor}
          onChange={(e) => onFillColorChange(e.target.value)}
          aria-label="矩形填充颜色"
        />
      </label>
      <div className="edit-toolbar-hint muted">{EDIT_TOOL_META[editTool].hint}</div>
    </div>
  )
}
