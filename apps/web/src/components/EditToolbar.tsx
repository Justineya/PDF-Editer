import type { EditStyle, EditTool } from '../types'
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
    hint: '单击选中 · 双击改字 · Delete 删除',
    Icon: IconSelect,
  },
  shape: {
    label: '图形',
    hint: '先选下方颜色/形状，再拖拽绘制',
    Icon: IconShape,
  },
  text: {
    label: '文字',
    hint: '先选字体/字号/颜色，再点击放置',
    Icon: IconText,
  },
  image: {
    label: '图片',
    hint: '点击页面插入图片',
    Icon: IconImage,
  },
  region: {
    label: '框选',
    hint: '框选后添加文字 / 改原文 / 填充',
    Icon: IconRegion,
  },
  replace: {
    label: '改原文',
    hint: '点原文块后改字（优先改内容流，不再自动盖白块）',
    Icon: IconText,
  },
  watermark: {
    label: '水印',
    hint: '在右侧面板设置',
    Icon: IconWatermark,
  },
}

export const FONT_OPTIONS: Array<{ id: string; label: string; css: string }> = [
  {
    id: 'tc-regular',
    label: 'TC Regular（地址）',
    css: '"Source Han Sans TC", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif',
  },
  {
    id: 'tc-light',
    label: 'TC Light',
    css: '"Source Han Sans TC Light", "Noto Sans TC", "PingFang TC", sans-serif',
  },
  {
    id: 'tc-demilight',
    label: 'TC DemiLight',
    css: '"Source Han Sans TC", "Noto Sans TC", "PingFang TC", sans-serif',
  },
  {
    id: 'tc-bold',
    label: 'TC Bold',
    css: '"Noto Sans CJK TC", "Source Han Sans TC", "PingFang TC", sans-serif',
  },
  { id: 'helvetica', label: 'Helvetica', css: 'Helvetica, Arial, sans-serif' },
  { id: 'times', label: 'Times', css: '"Times New Roman", Times, serif' },
  { id: 'courier', label: 'Courier', css: '"Courier New", Courier, monospace' },
]

const PRIMARY_TOOLS: EditTool[] = ['select', 'shape', 'text', 'image', 'replace', 'region']

type Props = {
  editTool: EditTool
  onChange: (tool: EditTool) => void
  style: EditStyle
  onStyleChange: (patch: Partial<EditStyle>) => void
}

/** Tools + style strip: pick font/shape/color BEFORE placing. */
export function EditToolbar({ editTool, onChange, style, onStyleChange }: Props) {
  const fontCss = FONT_OPTIONS.find((f) => f.id === style.fontFamily)?.css ?? FONT_OPTIONS[0].css
  return (
    <div className="edit-toolbar-wrap">
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
        <div className="edit-toolbar-hint muted">{EDIT_TOOL_META[editTool].hint}</div>
      </div>

      <div className="edit-stylebar" role="group" aria-label="放置样式">
        <span className="edit-stylebar-label">放置前先选样式</span>

        <label className="edit-style-field">
          <span>字体</span>
          <select
            value={style.fontFamily}
            onChange={(e) => onStyleChange({ fontFamily: e.target.value })}
            style={{ fontFamily: fontCss }}
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.id} value={f.id} style={{ fontFamily: f.css }}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="edit-style-field">
          <span>字号</span>
          <input
            type="number"
            min={8}
            max={96}
            value={style.fontSize}
            onChange={(e) => onStyleChange({ fontSize: Math.max(8, Number(e.target.value) || 14) })}
          />
        </label>

        <label className="edit-style-field" title="文字颜色">
          <span>字色</span>
          <input
            type="color"
            value={style.textColor}
            onChange={(e) => onStyleChange({ textColor: e.target.value })}
          />
        </label>

        <label className="edit-style-field" title="图形填充颜色">
          <span>填色</span>
          <input
            type="color"
            value={style.fillColor}
            onChange={(e) => onStyleChange({ fillColor: e.target.value })}
          />
        </label>

        <div className="edit-style-shapes" role="group" aria-label="图形形状">
          <span>形状</span>
          <button
            type="button"
            className={style.shape === 'rect' ? 'active' : ''}
            title="矩形"
            aria-pressed={style.shape === 'rect'}
            onClick={() => onStyleChange({ shape: 'rect' })}
          >
            <IconShape size={14} />
            矩形
          </button>
          <button
            type="button"
            className={style.shape === 'ellipse' ? 'active' : ''}
            title="椭圆"
            aria-pressed={style.shape === 'ellipse'}
            onClick={() => onStyleChange({ shape: 'ellipse' })}
          >
            <span className="shape-ellipse-ico" aria-hidden />
            椭圆
          </button>
        </div>

        <div className="edit-style-preview muted" style={{ fontFamily: fontCss, color: style.textColor }}>
          预览 {style.fontSize}px · Aa 中文
        </div>
      </div>
    </div>
  )
}
