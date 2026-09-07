import type { EditTool } from '../types'
import type { ReactElement } from 'react'
import {
  IconImage,
  IconRegion,
  IconReplace,
  IconSelect,
  IconText,
  IconWatermark,
  IconWhiteout,
} from './icons'

export const EDIT_TOOL_META: Record<
  EditTool,
  { label: string; hint: string; Icon: (p: { size?: number }) => ReactElement }
> = {
  region: {
    label: '框选区域',
    hint: '拖拽框选 → 再选添加文字 / 白盖 / 改字（推荐，类似 WPS）',
    Icon: IconRegion,
  },
  select: {
    label: '选择对象',
    hint: '点选已放置的文字、白盖、图片，可拖动与缩放',
    Icon: IconSelect,
  },
  text: {
    label: '文本框',
    hint: '点击放置文本框（也可先框选区域）',
    Icon: IconText,
  },
  whiteout: {
    label: '白盖',
    hint: '拖拽画白色遮盖，盖住原文',
    Icon: IconWhiteout,
  },
  image: {
    label: '图片',
    hint: '点击页面插入图片',
    Icon: IconImage,
  },
  replace: {
    label: '点选替换',
    hint: '点击原文文本块，白盖后就地改字',
    Icon: IconReplace,
  },
  watermark: {
    label: '水印',
    hint: '在右侧面板设置并应用到全部页',
    Icon: IconWatermark,
  },
}

type Props = {
  editTool: EditTool
  onChange: (tool: EditTool) => void
}

/** Icon toolbar shown under the mode bar while editing. */
export function EditToolbar({ editTool, onChange }: Props) {
  const tools = (Object.keys(EDIT_TOOL_META) as EditTool[]).filter((t) => t !== 'watermark')
  return (
    <div className="edit-toolbar" role="toolbar" aria-label="编辑工具">
      <span className="edit-toolbar-label">编辑</span>
      {tools.map((k) => {
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
      <div className="edit-toolbar-hint muted">{EDIT_TOOL_META[editTool].hint}</div>
    </div>
  )
}
