import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { v4 as uuid } from 'uuid'
import type {
  AnnotTool,
  AppMode,
  DocumentModel,
  EditTool,
  EditObjectRef,
} from './types'
import { PageView } from './components/PageView'
import { EditToolbar, EDIT_TOOL_META } from './components/EditToolbar'
import { MenuBar } from './components/MenuBar'
import { useDocHistory } from './hooks/useDocHistory'
import type { PageSelection } from './pdf/selection'
import {
  bytesToModel,
  fileToModel,
  loadRecent,
  openBlank,
  openSampleForm,
  reloadBytes,
} from './pdf/document'
import {
  destroyPdf,
  extractPageImageDataUrl,
  getCachedPdf,
  getOutline,
  getPageText,
  renderPageToCanvas,
  searchInPdf,
} from './pdf/engine'
import {
  applyHardRedaction,
  deletePages,
  extractPages,
  imagesToPdf,
  listFormFields,
  mergePdfs,
  reorderPages,
  rotatePages,
  stripMetadata,
  exportDocument,
} from './pdf/ops'
import {
  comparePageCanvases,
  downloadBytes,
  downloadText,
  pdfToImagesZip,
  pdfToMarkdown,
} from './pdf/convert'
import './styles/app.css'

async function ocrImageDataUrl(
  _url: string,
  _lang?: string,
  _onProgress?: (p: number) => void,
): Promise<string> {
  throw new Error('OCR 未包含在本阶段构建中')
}
function extractiveSummary(text: string): string {
  return text.slice(0, 400) || '（无文本）'
}
async function answerFromContext(question: string, context: string): Promise<string> {
  const q = question.toLowerCase()
  const hit = context.split(/\n+/).find((p) => q && p.toLowerCase().includes(q.split(/\s+/)[0] || ''))
  return hit ? `本地检索：${hit.slice(0, 280)}` : '未找到相关段落'
}


const MODE_LABEL: Record<AppMode, string> = {
  browse: '浏览',
  select: '选择文字',
  annotate: '批注',
  organize: '整理',
  edit: '编辑',
  form: '表单',
  sign: '签名',
  redact: '遮盖',
  convert: '导出工具',
  compare: '比较',
  security: '安全',
}

const PRIMARY_MODES: AppMode[] = [
  'browse',
  'select',
  'annotate',
  'organize',
  'edit',
  'form',
  'sign',
  'redact',
  'convert',
  'compare',
  'security',
]

const ANNOT_LABEL: Record<AnnotTool, string> = {
  highlight: '高亮',
  underline: '下划线',
  strike: '删除线',
  note: '便签',
  ink: '墨迹',
  stamp: '图章',
  area: '区域',
}

function useToast() {
  const [toast, setToast] = useState<string | null>(null)
  const show = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3200)
  }, [])
  return { toast, show }
}


export default function App() {
  const { toast, show } = useToast()
  const [docs, setDocs] = useState<DocumentModel[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mode, setMode] = useState<AppMode>('browse')
  const [annotTool, setAnnotTool] = useState<AnnotTool>('highlight')
  const [color, setColor] = useState('#f2c94c')
  const [inkWidth, setInkWidth] = useState(2)
  const [scale, setScale] = useState(1.15)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Array<{ pageIndex: number; snippet: string }>>([])
  const [outline, setOutline] = useState<Array<{ title: string; pageIndex: number | null }>>([])
  const [formFields, setFormFields] = useState<Array<{ name: string; type: string }>>([])
  const [selectedPages, setSelectedPages] = useState<number[]>([])
  const [editTool, setEditTool] = useState<EditTool>('region')
  const [selectedEdit, setSelectedEdit] = useState<EditObjectRef | null>(null)
  const [pendingSelection, setPendingSelection] = useState<PageSelection | null>(null)
  const history = useDocHistory(activeId)
  const [editText, setEditText] = useState('ForgePDF')
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL')
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [compareResult, setCompareResult] = useState<{ pct: number; url: string } | null>(null)
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiAnswer, setAiAnswer] = useState('')
  const compareRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQ, setPaletteQ] = useState('')
  const [scrollToPage, setScrollToPage] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const mergeRef = useRef<HTMLInputElement>(null)
  const signCanvasRef = useRef<HTMLCanvasElement>(null)
  const recent = useMemo(() => loadRecent(), [docs.length])

  const active = docs.find((d) => d.id === activeId) ?? null

  const updateActive = useCallback(
    (updater: (d: DocumentModel) => DocumentModel) => {
      setDocs((prev) =>
        prev.map((d) => {
          if (d.id !== activeId) return d
          const next = updater(d)
          history.commit(next)
          return next
        }),
      )
    },
    [activeId, history],
  )

  const openFiles = async (files: FileList | File[]) => {
    setBusy('正在打开…')
    try {
      const list = [...files]
      const opened: DocumentModel[] = []
      for (const f of list) {
        try {
          opened.push(await fileToModel(f))
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          if (msg.toLowerCase().includes('password')) {
            const pw = window.prompt(`文件 ${f.name} 需要密码`) || undefined
            if (pw) opened.push(await fileToModel(f, pw))
          } else {
            show(`无法打开 ${f.name}: ${msg}`)
          }
        }
      }
      if (opened.length) {
        setDocs((d) => [...d, ...opened])
        setActiveId(opened[opened.length - 1].id)
        history.replace(opened[opened.length - 1])
        setMode('browse')
      }
    } finally {
      setBusy(null)
    }
  }

  
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        const prev = history.undo()
        if (prev) setDocs((ds) => ds.map((d) => (d.id === prev.id ? prev : d)))
      }
      if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') {
        e.preventDefault()
        const next = history.redo()
        if (next) setDocs((ds) => ds.map((d) => (d.id === next.id ? next : d)))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [history])

useEffect(() => {
    if (!active) {
      setOutline([])
      setFormFields([])
      return
    }
    const pdf = getCachedPdf(active.id)
    if (!pdf) return
    getOutline(pdf).then(setOutline).catch(() => setOutline([]))
    listFormFields(active.bytes).then(setFormFields).catch(() => setFormFields([]))
  }, [active?.id, active?.bytes])

  const saveActive = async (asCopy = false) => {
    if (!active) return
    setBusy('正在导出…')
    try {
      const bytes = await exportDocument(active)
      const base = active.name.replace(/\.pdf$/i, '')
      downloadBytes(bytes, asCopy ? `${base}-副本.pdf` : `${base}-forge.pdf`)
      if (active.annotations.length) {
        downloadText(
          JSON.stringify({ version: 1, annotations: active.annotations }, null, 2),
          `${base}.forge-annot.json`,
        )
      }
      updateActive((d) => ({ ...d, dirty: false }))
      show('已导出（批注/叠加/签名扁平化写入；表单写回 AcroForm）')
    } catch (e) {
      show(`导出失败：${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey
      const tag = (e.target as HTMLElement)?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA'
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
      if (meta && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        fileRef.current?.click()
      }
      if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveActive(e.shiftKey)
      }
      if (meta && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        document.getElementById('search-input')?.focus()
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false)
        setMode('browse')
      }
      if (!meta && !typing && active) {
        const map: Partial<Record<string, AppMode>> = {
          v: 'browse',
          t: 'select',
          a: 'annotate',
          o: 'organize',
          e: 'edit',
          f: 'form',
          s: 'sign',
        }
        const m = map[e.key.toLowerCase()]
        if (m) {
          e.preventDefault()
          setMode(m)
        }
        if (e.key === '+' || e.key === '=') setScale((s) => Math.min(3, Number((s + 0.1).toFixed(2))))
        if (e.key === '-') setScale((s) => Math.max(0.5, Number((s - 0.1).toFixed(2))))
        if (e.key === '0') setScale(1.15)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (docs.some((d) => d.dirty)) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [docs])

  useEffect(() => {
    if (scrollToPage == null) return
    const el = document.querySelector(`[data-page="${scrollToPage}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setScrollToPage(null)
  }, [scrollToPage])

  const runSearch = async () => {
    if (!active) return
    const pdf = getCachedPdf(active.id)
    if (!pdf) return
    const res = await searchInPdf(pdf, query)
    setHits(res)
    if (res[0]) setScrollToPage(res[0].pageIndex)
  }

  const replaceStructure = async (bytes: Uint8Array, clearEdits = true) => {
    if (!active) return
    const next = await reloadBytes(
      clearEdits
        ? {
            ...active,
            annotations: [],
            overlays: [],
            images: [],
            signatures: [],
            redactions: [],
            watermark: undefined,
          }
        : active,
      bytes,
      true,
    )
    setDocs((prev) => prev.map((d) => (d.id === active.id ? next : d)))
    setSelectedPages([])
    show('页面结构已更新')
  }

  const closeDoc = async (id: string) => {
    const d = docs.find((x) => x.id === id)
    if (d?.dirty && !confirm(`「${d.name}」有未导出更改，确定关闭？`)) return
    await destroyPdf(id)
    setDocs((prev) => {
      const next = prev.filter((x) => x.id !== id)
      if (activeId === id) setActiveId(next[0]?.id ?? null)
      return next
    })
  }

  const commands = useMemo(() => {
    const items: Array<{ id: string; label: string; run: () => void }> = [
      { id: 'open', label: '打开 PDF', run: () => fileRef.current?.click() },
      { id: 'save', label: '导出保存', run: () => void saveActive(false) },
      { id: 'saveas', label: '另存副本', run: () => void saveActive(true) },
      {
        id: 'blank',
        label: '新建空白 PDF',
        run: () =>
          void openBlank().then((m) => {
            setDocs((d) => [...d, m])
            setActiveId(m.id)
          }),
      },
      {
        id: 'sample',
        label: '打开示例表单',
        run: () =>
          void openSampleForm().then((m) => {
            setDocs((d) => [...d, m])
            setActiveId(m.id)
            setMode('form')
          }),
      },
    ]
    PRIMARY_MODES.forEach((m) => {
      items.push({ id: `mode-${m}`, label: `切换到：${MODE_LABEL[m]}`, run: () => setMode(m) })
    })
    return items
  }, [activeId])

  const filteredCommands = commands.filter((c) =>
    c.label.toLowerCase().includes(paletteQ.toLowerCase()),
  )

  useEffect(() => {
    const canvas = signCanvasRef.current
    if (!canvas || mode !== 'sign') return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#15202b'
    ctx.lineWidth = 2
    let drawing = false
    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return {
        x: ((e.clientX - r.left) / r.width) * canvas.width,
        y: ((e.clientY - r.top) / r.height) * canvas.height,
      }
    }
    const down = (e: PointerEvent) => {
      drawing = true
      const p = pos(e)
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
    }
    const move = (e: PointerEvent) => {
      if (!drawing) return
      const p = pos(e)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
    }
    const up = () => {
      drawing = false
    }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [mode, activeId])

  return (
    <div className="app-shell">
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        multiple
        hidden
        onChange={(e) => e.target.files && void openFiles(e.target.files)}
      />
      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={async (e) => {
          if (!e.target.files?.length) return
          const urls: string[] = []
          for (const f of [...e.target.files]) {
            urls.push(
              await new Promise<string>((resolve, reject) => {
                const r = new FileReader()
                r.onload = () => resolve(String(r.result))
                r.onerror = reject
                r.readAsDataURL(f)
              }),
            )
          }
          if (mode === 'edit' && active) {
            updateActive((d) => ({
              ...d,
              dirty: true,
              images: [
                ...d.images,
                {
                  id: uuid(),
                  pageIndex: selectedPages[0] ?? 0,
                  x: 72,
                  y: 72,
                  w: 180,
                  h: 120,
                  dataUrl: urls[0],
                },
              ],
            }))
            show('已插入图片（导出时写入）')
          } else {
            const bytes = await imagesToPdf(urls)
            const model = await bytesToModel('图片转PDF.pdf', bytes)
            setDocs((d) => [...d, model])
            setActiveId(model.id)
            show('图片已转为 PDF')
          }
        }}
      />
      <input
        ref={mergeRef}
        type="file"
        accept="application/pdf"
        multiple
        hidden
        onChange={async (e) => {
          if (!e.target.files?.length || !active) return
          setBusy('合并中…')
          try {
            const extras: Uint8Array[] = []
            for (const f of [...e.target.files]) {
              extras.push(new Uint8Array(await f.arrayBuffer()))
            }
            const bytes = await mergePdfs([active.bytes, ...extras])
            await replaceStructure(bytes)
          } finally {
            setBusy(null)
          }
        }}
      />

      <input
        ref={compareRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file || !active) return
          setBusy('比较中…')
          try {
            const other = await fileToModel(file)
            const pdfA = getCachedPdf(active.id)!
            const pdfB = getCachedPdf(other.id)!
            const ca = document.createElement('canvas')
            const cb = document.createElement('canvas')
            await renderPageToCanvas(pdfA, 0, 1.2, ca).promise
            await renderPageToCanvas(pdfB, 0, 1.2, cb).promise
            const { diffPercent, diffCanvas } = await comparePageCanvases(ca, cb)
            setCompareResult({ pct: diffPercent, url: diffCanvas.toDataURL('image/png') })
            await destroyPdf(other.id)
            show(`首页像素差异约 ${diffPercent.toFixed(2)}%`)
          } catch (err) {
            show(`比较失败：${err instanceof Error ? err.message : err}`)
          } finally {
            setBusy(null)
          }
        }}
      />
      <header className="topbar">
        <div className="brand">
          <strong>ForgePDF</strong>
          <span>本地 PDF 工作台</span>
        </div>
        <div className="tabs">
          {docs.map((d) => (
            <button
              key={d.id}
              className={`tab ${d.id === activeId ? 'active' : ''}`}
              onClick={() => setActiveId(d.id)}
            >
              {d.dirty ? '• ' : ''}
              {d.name}
              <span
                className="close"
                onClick={(ev) => {
                  ev.stopPropagation()
                  void closeDoc(d.id)
                }}
              >
                ×
              </span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => fileRef.current?.click()}>
          打开
        </button>
        <button
          type="button"
          className="primary"
          disabled={!active}
          onClick={() => void saveActive(false)}
        >
          导出
        </button>
        <button type="button" disabled={!active} onClick={() => void saveActive(true)}>
          另存
        </button>
        <button type="button" onClick={() => setPaletteOpen(true)}>
          命令 ⌘K
        </button>
      </header>

      <MenuBar
        menus={[
          {
            id: 'file',
            label: '文件',
            items: [
              { kind: 'item', id: 'open', label: '打开…', shortcut: '⌘O', onClick: () => fileRef.current?.click() },
              {
                kind: 'item',
                id: 'export',
                label: '导出保存',
                shortcut: '⌘S',
                disabled: !active,
                onClick: () => void saveActive(false),
              },
              {
                kind: 'item',
                id: 'saveas',
                label: '另存副本…',
                disabled: !active,
                onClick: () => void saveActive(true),
              },
              { kind: 'sep' },
              {
                kind: 'item',
                id: 'blank',
                label: '新建空白 PDF',
                onClick: () =>
                  void openBlank().then((m) => {
                    setDocs((d) => [...d, m])
                    setActiveId(m.id)
                  }),
              },
            ],
          },
          {
            id: 'edit-menu',
            label: '编辑',
            items: [
              {
                kind: 'item',
                id: 'undo',
                label: '撤销',
                shortcut: '⌘Z',
                disabled: !history.canUndo,
                onClick: () => {
                  const prev = history.undo()
                  if (prev) setDocs((ds) => ds.map((d) => (d.id === prev.id ? prev : d)))
                },
              },
              {
                kind: 'item',
                id: 'redo',
                label: '重做',
                shortcut: '⇧⌘Z',
                disabled: !history.canRedo,
                onClick: () => {
                  const next = history.redo()
                  if (next) setDocs((ds) => ds.map((d) => (d.id === next.id ? next : d)))
                },
              },
              { kind: 'sep' },
              {
                kind: 'item',
                id: 'mode-edit',
                label: '进入编辑模式',
                disabled: !active,
                onClick: () => {
                  setMode('edit')
                  setEditTool('region')
                },
              },
              {
                kind: 'item',
                id: 'tool-region',
                label: '框选区域…',
                disabled: !active,
                onClick: () => {
                  setMode('edit')
                  setEditTool('region')
                },
              },
              {
                kind: 'item',
                id: 'tool-text',
                label: '添加文字',
                disabled: !active,
                onClick: () => {
                  setMode('edit')
                  setEditTool('text')
                },
              },
              {
                kind: 'item',
                id: 'tool-whiteout',
                label: '白盖清除',
                disabled: !active,
                onClick: () => {
                  setMode('edit')
                  setEditTool('whiteout')
                },
              },
              {
                kind: 'item',
                id: 'insert-image',
                label: '插入图片…',
                disabled: !active,
                onClick: () => {
                  setMode('edit')
                  setEditTool('image')
                  imageRef.current?.click()
                },
              },
            ],
          },
          {
            id: 'view',
            label: '视图',
            items: [
              {
                kind: 'item',
                id: 'zoom-out',
                label: '缩小',
                disabled: !active,
                onClick: () => setScale((s) => Math.max(0.5, Number((s - 0.1).toFixed(2)))),
              },
              {
                kind: 'item',
                id: 'zoom-in',
                label: '放大',
                disabled: !active,
                onClick: () => setScale((s) => Math.min(3, Number((s + 0.1).toFixed(2)))),
              },
              {
                kind: 'item',
                id: 'zoom-100',
                label: '实际大小 100%',
                disabled: !active,
                onClick: () => setScale(1),
              },
            ],
          },
        ]}
        trailing={
          <span className="muted menubar-doc">
            {active ? `${active.name}${active.dirty ? ' •' : ''}` : '未打开文档'}
          </span>
        }
      />

      <div className="modebar">
        {PRIMARY_MODES.map((m) => (
          <button
            key={m}
            type="button"
            className={mode === m ? 'active' : ''}
            disabled={!active}
            onClick={() => {
              setMode(m)
              if (m === 'edit') setEditTool('region')
            }}
            title={m}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
        <button
          type="button"
          disabled={!history.canUndo}
          onClick={() => {
            const prev = history.undo()
            if (prev) setDocs((ds) => ds.map((d) => (d.id === prev.id ? prev : d)))
          }}
        >
          撤销
        </button>
        <button
          type="button"
          disabled={!history.canRedo}
          onClick={() => {
            const next = history.redo()
            if (next) setDocs((ds) => ds.map((d) => (d.id === next.id ? next : d)))
          }}
        >
          重做
        </button>
        <div style={{ flex: 1 }} />
        <input
          id="search-input"
          type="text"
          placeholder="搜索文本…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
          style={{ width: 180 }}
        />
        <button type="button" disabled={!active} onClick={() => void runSearch()}>
          查找
        </button>
        <button
          type="button"
          disabled={!active}
          onClick={() => setScale((s) => Math.max(0.5, Number((s - 0.1).toFixed(2))))}
        >
          −
        </button>
        <span className="muted">{Math.round(scale * 100)}%</span>
        <button
          type="button"
          disabled={!active}
          onClick={() => setScale((s) => Math.min(3, Number((s + 0.1).toFixed(2))))}
        >
          +
        </button>
      </div>

      {mode === 'edit' && active && (
        <EditToolbar editTool={editTool} onChange={setEditTool} />
      )}

      {!active ? (
        <div
          className="welcome"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            if (e.dataTransfer.files.length) void openFiles(e.dataTransfer.files)
          }}
        >
          <div className="welcome-card">
            <h1>ForgePDF</h1>
            <p className="lead">
              本地优先的 PDF 工作台：阅读、批注、页面整理、编辑、填表与签名。文件默认不出本机。
            </p>
            <div className="welcome-actions">
              <button type="button" className="primary" onClick={() => fileRef.current?.click()}>
                打开 PDF
              </button>
              <button
                type="button"
                onClick={() =>
                  void openBlank().then((m) => {
                    setDocs((d) => [...d, m])
                    setActiveId(m.id)
                  })
                }
              >
                新建空白
              </button>
              <button
                type="button"
                onClick={() =>
                  void openSampleForm().then((m) => {
                    setDocs((d) => [...d, m])
                    setActiveId(m.id)
                    setMode('form')
                  })
                }
              >
                示例表单
              </button>
            </div>
            <h3 className="field-label">最近打开（仅记文件名）</h3>
            <ul className="recent-list">
              {recent.length === 0 && <li className="muted">暂无记录 · Ctrl+O 打开</li>}
              {recent.map((r) => (
                <li key={r.name + r.openedAt}>
                  <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>
                    {r.name}
                  </button>
                  <span className="muted">{new Date(r.openedAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
            <div className="phase-pills">
              <span className="pill">P1 阅读·批注·整理</span>
              <span className="pill">P2 编辑·表单·签名</span>
              <span className="pill">导出=扁平化写回</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="workspace">
          <aside className="side">
            <div className="side-section">
              <h3>缩略图</h3>
              <div className="thumb-grid">
                {Array.from({ length: active.pageCount }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`thumb ${selectedPages.includes(i) ? 'selected' : ''}`}
                    onClick={(e) => {
                      setScrollToPage(i)
                      setSelectedPages((prev) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey) {
                          return prev.includes(i)
                            ? prev.filter((x) => x !== i)
                            : [...prev, i].sort((a, b) => a - b)
                        }
                        return [i]
                      })
                    }}
                  >
                    <Thumb docId={active.id} pageIndex={i} />
                    <span>{i + 1}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="side-section">
              <h3>大纲</h3>
              <div className="stack">
                {outline.length === 0 && <div className="muted">无书签</div>}
                {outline.map((o, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="ghost"
                    style={{ textAlign: 'left' }}
                    disabled={o.pageIndex == null}
                    onClick={() => o.pageIndex != null && setScrollToPage(o.pageIndex)}
                  >
                    {o.title}
                  </button>
                ))}
              </div>
            </div>
            {hits.length > 0 && (
              <div className="side-section">
                <h3>搜索结果</h3>
                <div className="stack">
                  {hits.map((h, i) => (
                    <button
                      key={i}
                      type="button"
                      className="list-item"
                      onClick={() => setScrollToPage(h.pageIndex)}
                    >
                      p{h.pageIndex + 1}: {h.snippet}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <main className="viewer">
            <div className="pages">
              {Array.from({ length: active.pageCount }, (_, i) => (
                <PageView
                  key={`${active.id}-${i}-${active.bytes.byteLength}`}
                  doc={active}
                  pageIndex={i}
                  scale={scale}
                  mode={mode}
                  annotTool={annotTool}
                  inkWidth={inkWidth}
                  color={color}
                  selectedOrganize={selectedPages}
                  editText={editText}
                  signatureDataUrl={signatureDataUrl}
                  editTool={editTool}
                  selectedEdit={selectedEdit}
                  pendingSelection={pendingSelection}
                  onSelectOrganize={(pageIndex, multi) => {
                    setSelectedPages((prev) => {
                      if (multi) {
                        return prev.includes(pageIndex)
                          ? prev.filter((x) => x !== pageIndex)
                          : [...prev, pageIndex].sort((a, b) => a - b)
                      }
                      return [pageIndex]
                    })
                  }}
                  onAddAnnotation={(ann) =>
                    updateActive((d) => ({
                      ...d,
                      dirty: true,
                      annotations: [...d.annotations, ann],
                    }))
                  }
                  onMutateDoc={(updater) => updateActive(updater)}
                  onPlaceSignature={(pageIndex, x, y) => {
                    if (!signatureDataUrl) return
                    updateActive((d) => ({
                      ...d,
                      dirty: true,
                      signatures: [
                        ...d.signatures,
                        {
                          id: uuid(),
                          pageIndex,
                          x,
                          y,
                          w: 160,
                          h: 64,
                          dataUrl: signatureDataUrl,
                        },
                      ],
                    }))
                  }}
                  onSelectEdit={setSelectedEdit}
                  onPendingSelection={setPendingSelection}
                  onPickImage={(pageIndex, x, y) => {
                    imageRef.current?.setAttribute('data-page', String(pageIndex))
                    imageRef.current?.setAttribute('data-x', String(x))
                    imageRef.current?.setAttribute('data-y', String(y))
                    imageRef.current?.click()
                  }}
                />
              ))}
            </div>
          </main>

          <aside className="inspector">
            <h3>{MODE_LABEL[mode]}</h3>

            {mode === 'browse' && (
              <div className="stack">
                <div className="muted">滚轮浏览 · +/- 缩放 · V 浏览 / A 批注 / O 整理</div>
                <div className="muted">
                  批注 {active.annotations.length} · 叠字 {active.overlays.length} · 签名{' '}
                  {active.signatures.length}
                </div>
                <div className="divider" />
                <button
                  type="button"
                  onClick={async () => {
                    setBusy('导出图片…')
                    try {
                      await pdfToImagesZip(
                        getCachedPdf(active.id)!,
                        active.name.replace(/\.pdf$/i, ''),
                      )
                    } finally {
                      setBusy(null)
                    }
                  }}
                >
                  导出页面为图片 ZIP
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const pdf = getCachedPdf(active.id)!
                    const parts = [`# ${active.name}`, '']
                    for (let i = 0; i < pdf.numPages; i++) {
                      parts.push(`## 第 ${i + 1} 页`, '', (await getPageText(pdf, i)) || '_无文本_', '')
                    }
                    downloadText(parts.join('\n'), active.name.replace(/\.pdf$/i, '') + '.md')
                  }}
                >
                  导出 Markdown 文本
                </button>
                <div className="muted">导出策略：批注扁平化；表单写回。≠ OCR / 真红act / Office 转换。</div>
              </div>
            )}

            {mode === 'select' && (
              <div className="stack">
                <div className="muted">拖选文字 → 浮动条：复制 / 高亮 / 下划线 / 删除线 / 覆盖替换</div>
                {!pendingSelection && <div className="muted">尚未选中文字。扫描件请先 OCR。</div>}
                {pendingSelection && (
                  <div className="muted">已选：{pendingSelection.text.slice(0, 80)}</div>
                )}
              </div>
            )}

            {mode === 'annotate' && (
              <div className="stack">
                <div className="row">
                  {(Object.keys(ANNOT_LABEL) as AnnotTool[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={annotTool === t ? 'active' : ''}
                      onClick={() => setAnnotTool(t)}
                    >
                      {ANNOT_LABEL[t]}
                    </button>
                  ))}
                </div>
                <label className="field-label">
                  颜色{' '}
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
                </label>
                <label className="field-label">
                  墨迹粗细{' '}
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={inkWidth}
                    onChange={(e) => setInkWidth(Number(e.target.value))}
                  />
                </label>
                <div className="divider" />
                <h3>批注列表</h3>
                {active.annotations.length === 0 && (
                  <div className="muted">在页面上拖拽或点击添加</div>
                )}
                {active.annotations.map((a) => (
                  <div key={a.id} className="list-item">
                    p{a.pageIndex + 1} · {ANNOT_LABEL[a.kind as AnnotTool] ?? a.kind}
                    <button
                      type="button"
                      className="danger"
                      onClick={() =>
                        updateActive((d) => ({
                          ...d,
                          dirty: true,
                          annotations: d.annotations.filter((x) => x.id !== a.id),
                        }))
                      }
                    >
                      删
                    </button>
                  </div>
                ))}
              </div>
            )}

            {mode === 'organize' && (
              <div className="stack">
                <div className="muted">点选缩略图或页面（⌘/Ctrl 多选）· 已选 {selectedPages.length}</div>
                <button type="button" onClick={() => mergeRef.current?.click()}>
                  合并其他 PDF…
                </button>
                <button
                  type="button"
                  disabled={!selectedPages.length}
                  onClick={async () => {
                    const bytes = await extractPages(active.bytes, selectedPages)
                    downloadBytes(bytes, active.name.replace(/\.pdf$/i, '') + '-extract.pdf')
                  }}
                >
                  提取所选页
                </button>
                <button
                  type="button"
                  disabled={!selectedPages.length}
                  onClick={async () => {
                    if (!confirm(`删除 ${selectedPages.length} 页？`)) return
                    const bytes = await deletePages(active.bytes, selectedPages)
                    await replaceStructure(bytes)
                  }}
                >
                  删除所选页
                </button>
                <button
                  type="button"
                  disabled={!selectedPages.length}
                  onClick={async () => {
                    const bytes = await rotatePages(active.bytes, selectedPages, 90)
                    await replaceStructure(bytes, false)
                  }}
                >
                  旋转 90°
                </button>
                <button
                  type="button"
                  disabled={selectedPages.length < 1}
                  onClick={async () => {
                    const rest = Array.from({ length: active.pageCount }, (_, i) => i).filter(
                      (i) => !selectedPages.includes(i),
                    )
                    const bytes = await reorderPages(active.bytes, [...selectedPages, ...rest])
                    await replaceStructure(bytes)
                  }}
                >
                  所选页移到最前
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setBusy('拆分中…')
                    try {
                      const JSZip = (await import('jszip')).default
                      const zip = new JSZip()
                      for (let i = 0; i < active.pageCount; i++) {
                        const part = await extractPages(active.bytes, [i])
                        zip.file(`page-${i + 1}.pdf`, part)
                      }
                      const blob = await zip.generateAsync({ type: 'blob' })
                      const { saveAs } = await import('file-saver')
                      saveAs(blob, active.name.replace(/\.pdf$/i, '') + '-split.zip')
                      show(`已拆为 ${active.pageCount} 个单页`)
                    } finally {
                      setBusy(null)
                    }
                  }}
                >
                  拆为单页 ZIP
                </button>
              </div>
            )}

            {mode === 'edit' && (
              <div className="stack">
                <div className="edit-inspector-hero">
                  <strong>{EDIT_TOOL_META[editTool].label}</strong>
                  <p className="muted">{EDIT_TOOL_META[editTool].hint}</p>
                </div>
                {editTool === 'region' && (
                  <ol className="edit-steps muted">
                    <li>在页面上拖拽框选一块区域</li>
                    <li>在弹出菜单中选「添加文字 / 覆盖改字 / 白盖」</li>
                    <li>就地输入后点「完成」</li>
                  </ol>
                )}
                <label className="field-label">默认文字（可选预填）</label>
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder="框选后可修改"
                />
                <button type="button" onClick={() => imageRef.current?.click()}>
                  插入图片…
                </button>
                <div className="divider" />
                <label className="field-label">水印文字</label>
                <input
                  type="text"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() =>
                    updateActive((d) => ({
                      ...d,
                      dirty: true,
                      watermark: {
                        text: watermarkText,
                        opacity: 0.22,
                        fontSize: 48,
                        rotate: 35,
                        color: '#888888',
                      },
                    }))
                  }
                >
                  应用水印到全部页
                </button>
                <button type="button" onClick={() => setMode('redact')}>
                  视觉遮盖工具…
                </button>
                <div className="muted">
                  当前为覆盖编辑（白盖 + 新字叠层），不是 Acrobat 级内容流改写。导出时写入页面。
                </div>
                <div className="divider" />
                <h4 className="field-label">本页对象</h4>
                {active.overlays.length === 0 && (active.whiteouts?.length ?? 0) === 0 && (
                  <div className="muted">尚无编辑对象 · 用「框选区域」开始</div>
                )}
                {active.overlays.map((o) => (
                  <div key={o.id} className="list-item">
                    文本 p{o.pageIndex + 1}: {o.text}
                    <button
                      type="button"
                      className="danger"
                      onClick={() =>
                        updateActive((d) => ({
                          ...d,
                          overlays: d.overlays.filter((x) => x.id !== o.id),
                          dirty: true,
                        }))
                      }
                    >
                      删
                    </button>
                  </div>
                ))}
              </div>
            )}

            {mode === 'redact' && (
              <div className="stack">
                <div className="ctx-warn muted" style={{ color: 'var(--danger)' }}>
                  遮盖仅为视觉黑条（≠ 合规红act）。导出时黑条写入页面；强力栅格化为实验能力。
                </div>
                <div className="muted">拖拽框选密文区域</div>
                {active.redactions.map((r) => (
                  <div key={r.id} className="list-item">
                    p{r.pageIndex + 1}
                    <button
                      type="button"
                      className="danger"
                      onClick={() =>
                        updateActive((d) => ({
                          ...d,
                          redactions: d.redactions.filter((x) => x.id !== r.id),
                          dirty: true,
                        }))
                      }
                    >
                      删
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="danger"
                  disabled={!active.redactions.length}
                  onClick={async () => {
                    setBusy('正在强力密文…')
                    try {
                      const bytes = await applyHardRedaction(
                        active.bytes,
                        active.redactions,
                        true,
                        async (pageIndex) =>
                          extractPageImageDataUrl(getCachedPdf(active.id)!, pageIndex, 2),
                      )
                      await replaceStructure(bytes, true)
                      updateActive((d) => ({ ...d, redactions: [], dirty: true }))
                      show('已应用强力密文（相关页栅格化）')
                    } catch (err) {
                      show(`密文失败：${err instanceof Error ? err.message : err}`)
                    } finally {
                      setBusy(null)
                    }
                  }}
                >
                  应用强力密文并写回
                </button>
              </div>
            )}

            {mode === 'convert' && (
              <div className="stack">
                <button
                  type="button"
                  disabled={!active}
                  onClick={async () => {
                    if (!active) return
                    setBusy('导出图片…')
                    try {
                      await pdfToImagesZip(
                        getCachedPdf(active.id)!,
                        active.name.replace(/\.pdf$/i, ''),
                      )
                    } finally {
                      setBusy(null)
                    }
                  }}
                >
                  PDF → 图片 ZIP
                </button>
                <button
                  type="button"
                  disabled={!active}
                  onClick={async () => {
                    if (!active) return
                    const md = await pdfToMarkdown(getCachedPdf(active.id)!, active.name)
                    downloadText(md, active.name.replace(/\.pdf$/i, '') + '.md')
                  }}
                >
                  PDF → Markdown
                </button>
                <button type="button" onClick={() => imageRef.current?.click()}>
                  图片 → PDF
                </button>
                <div className="divider" />
                <button
                  type="button"
                  disabled={!active}
                  onClick={async () => {
                    if (!active) return
                    const pageIndex = selectedPages[0] ?? 0
                    setBusy('OCR 中…')
                    try {
                      const url = await extractPageImageDataUrl(
                        getCachedPdf(active.id)!,
                        pageIndex,
                        2,
                      )
                      const text = await ocrImageDataUrl(url, 'eng', (p: number) =>
                        setBusy(`OCR ${Math.round(p * 100)}%`),
                      )
                      updateActive((d) => ({
                        ...d,
                        dirty: true,
                        ocrTextByPage: { ...d.ocrTextByPage, [pageIndex]: text },
                      }))
                      setAiAnswer(text || '（未识别到文字）')
                      show('OCR 完成（当前页，eng）')
                    } catch (err) {
                      show(`OCR 失败：${err instanceof Error ? err.message : err}`)
                    } finally {
                      setBusy(null)
                    }
                  }}
                >
                  OCR 当前页（eng）
                </button>
                <div className="muted">本阶段不做 OCR / Office 转换；可导出图片 ZIP 与 Markdown 文本。</div>
              </div>
            )}

            {mode === 'compare' && (
              <div className="stack">
                <button type="button" onClick={() => compareRef.current?.click()}>
                  选择另一 PDF，比较首页
                </button>
                {compareResult && (
                  <div className="stack">
                    <img src={compareResult.url} alt="diff" style={{ width: '100%', borderRadius: 8 }} />
                    <div className="muted">差异约 {compareResult.pct.toFixed(2)}%（红=不同）</div>
                  </div>
                )}
              </div>
            )}

            {mode === 'security' && (
              <div className="stack">
                <button
                  type="button"
                  disabled={!active}
                  onClick={async () => {
                    if (!active) return
                    const bytes = await stripMetadata(active.bytes)
                    await replaceStructure(bytes, false)
                    show('元数据已清理')
                  }}
                >
                  清理元数据
                </button>
                <label className="field-label">导出密码（可选）</label>
                <input
                  type="password"
                  placeholder="设置后导出将加密"
                  onChange={(e) =>
                    updateActive((d) => ({
                      ...d,
                      password: e.target.value || undefined,
                      dirty: true,
                    }))
                  }
                />
                <div className="divider" />
                <h3>本地 AI（无云端）</h3>
                <button
                  type="button"
                  disabled={!active}
                  onClick={async () => {
                    if (!active) return
                    const pdf = getCachedPdf(active.id)!
                    const parts: string[] = []
                    for (let i = 0; i < pdf.numPages; i++) {
                      parts.push(active.ocrTextByPage[i] || (await getPageText(pdf, i)))
                    }
                    setAiAnswer(extractiveSummary(parts.join('\n')))
                  }}
                >
                  自动摘要
                </button>
                <input
                  type="text"
                  placeholder="问文档…"
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                />
                <button
                  type="button"
                  disabled={!active}
                  onClick={async () => {
                    if (!active) return
                    const pdf = getCachedPdf(active.id)!
                    const parts: string[] = []
                    for (let i = 0; i < pdf.numPages; i++) {
                      parts.push(active.ocrTextByPage[i] || (await getPageText(pdf, i)))
                    }
                    setAiAnswer(await answerFromContext(aiQuestion, parts.join('\n')))
                  }}
                >
                  本地问答
                </button>
                {aiAnswer && (
                  <div className="list-item" style={{ whiteSpace: 'pre-wrap' }}>
                    {aiAnswer}
                  </div>
                )}
              </div>
            )}

            {mode === 'form' && (
              <div className="stack">
                {formFields.length === 0 && (
                  <div className="muted">未检测到 AcroForm。可点欢迎页「示例表单」。</div>
                )}
                {formFields.map((f) => (
                  <label key={f.name} className="stack">
                    <span className="field-label">
                      {f.name} ({f.type})
                    </span>
                    <input
                      type="text"
                      value={active.formValues[f.name] ?? ''}
                      onChange={(e) =>
                        updateActive((d) => ({
                          ...d,
                          dirty: true,
                          formValues: { ...d.formValues, [f.name]: e.target.value },
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            )}

            {mode === 'sign' && (
              <div className="stack">
                <div className="muted">手写签名后点「使用此签名」，再点击页面放置</div>
                <canvas
                  ref={signCanvasRef}
                  className="sign-pad"
                  width={280}
                  height={100}
                />
                <div className="row">
                  <button
                    type="button"
                    className="primary"
                    onClick={() => {
                      const c = signCanvasRef.current
                      if (!c) return
                      setSignatureDataUrl(c.toDataURL('image/png'))
                      show('签名已就绪，点击页面放置')
                    }}
                  >
                    使用此签名
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const c = signCanvasRef.current
                      if (!c) return
                      const ctx = c.getContext('2d')!
                      ctx.fillStyle = '#fff'
                      ctx.fillRect(0, 0, c.width, c.height)
                      setSignatureDataUrl(null)
                    }}
                  >
                    清空
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'image/*'
                    input.onchange = async () => {
                      const f = input.files?.[0]
                      if (!f) return
                      const url = await new Promise<string>((resolve, reject) => {
                        const r = new FileReader()
                        r.onload = () => resolve(String(r.result))
                        r.onerror = reject
                        r.readAsDataURL(f)
                      })
                      setSignatureDataUrl(url)
                      show('已载入签名图片')
                    }
                    input.click()
                  }}
                >
                  导入签名图
                </button>
                {!signatureDataUrl && <div className="muted">尚未准备签名</div>}
                {signatureDataUrl && <div className="muted">已就绪 · 点击页面放置</div>}
              </div>
            )}
          </aside>
        </div>
      )}

      <footer className="statusbar">
        <span>
          {busy ||
            (active ? `${active.name}${active.dirty ? ' · 未导出更改' : ''}` : '就绪')}
        </span>
        <span>
          {active
            ? `${active.pageCount} 页 · ${MODE_LABEL[mode]} · 扁平化导出`
            : 'ForgePDF Phase 1–4'}
        </span>
      </footer>

      {toast && <div className="toast">{toast}</div>}

      {paletteOpen && (
        <div className="palette" onClick={() => setPaletteOpen(false)}>
          <div className="palette-panel" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              placeholder="输入命令…"
              value={paletteQ}
              onChange={(e) => setPaletteQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filteredCommands[0]) {
                  filteredCommands[0].run()
                  setPaletteOpen(false)
                  setPaletteQ('')
                }
              }}
            />
            <ul>
              {filteredCommands.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={i === 0 ? 'active' : ''}
                    onClick={() => {
                      c.run()
                      setPaletteOpen(false)
                      setPaletteQ('')
                    }}
                  >
                    {c.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

function Thumb({ docId, pageIndex }: { docId: string; pageIndex: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const pdf = getCachedPdf(docId)
    const canvas = ref.current
    if (!pdf || !canvas) return
    const handle = renderPageToCanvas(pdf, pageIndex, 0.2, canvas)
    handle.promise.catch(() => undefined)
    return () => handle.cancel()
  }, [docId, pageIndex])
  return <canvas ref={ref} />
}
