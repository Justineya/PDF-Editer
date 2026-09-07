# WPS 对照清单 · 桌面第 1 期（冻结网页堆功能）

> 状态：2026-09 起生效  
> 原则：**停止在网页原型上继续堆功能**；交付重心 = **Tauri 桌面壳 + 文档模型 + 叠层 + Undo**。  
> 复用约定：用户本机 `pdf编辑器/` 的叠层编辑交互、`字体/` 内 **TC OTF（优先 Light / DemiLight）**。仓库内暂无这两目录时，用 `assets/fonts/tc/` 子集 + 现有对象层逻辑对齐，用户拷入后替换。

## 0. 非目标（本期内明确不做）

- 不再向 `apps/web` 加模式/工具条/炫技能力
- 不以 Canvas PNG 栅格字冒充原稿叠字
- 不做 OCR / Office 转换 / 真红act / 证书签名（更后期）
- Electron 仅作备选壳；默认 **Tauri 2**（已有 `apps/web/src-tauri`）

## 1. WPS 日用编辑对照 → 第 1 期范围

| WPS 典型能力 | 第 1 期 ForgePDF | 验收 |
|--------------|------------------|------|
| 打开 / 另存 PDF | Tauri 原生对话框 + `desktopSavePdf` | 另存后第三方阅读器可见叠层 |
| 编辑文字（轻） | **矢量叠字**：嵌入 TC OTF，擦除区 + 重打 | 地址样张目视 ≈ Light/DemiLight |
| 擦除后重打 | whiteout/擦除矩形 + 文本 Overlay | 旧字被盖，新字为矢量路径/字体 |
| 图片编辑 | 插入 / 移动 / 缩放 OverlayImage | 另存后图在正确位置 |
| 撤销 | `UndoStack`（文档模型层） | Ctrl+Z 可回退叠层操作 |
| 扫描件/无字层 | **投保书路径**：检测无 Text Layer → 仅叠层，不假装选字 | 提示「无文字层图档」 |
| 中葡地址改址 | 样张 + TC 矢量叠字 | 见 `samples/phase1/` |

## 2. 文档模型（必须先稳）

```
DocumentSession
  path?, name, bytes, pageCount, dirty
  overlays: text[] / image[] / erase[]
  undo: UndoStack<Patch>
```

- 所有编辑先写模型，再渲染，再导出扁平化
- 导出路径：**pdf-lib + fontkit + 嵌入 OTF**（禁止「截屏贴图」当正文字）

## 3. 字体

| 键 | 文件（优先用户 `字体/`） | 备注 |
|----|-------------------------|------|
| `tc-light` | `SourceHanSansTC-Light.otf` 或用户同名 TC Light | 地址细字默认 |
| `tc-demilight` | `SourceHanSansTC-DemiLight.otf`；Adobe 发行包中对应 **Normal** 字重 | 略加重 |

安装：把用户 `字体/` 拷到 `assets/fonts/tc/`（全量优先于仓库子集）。见 [10-asset-import.md](./10-asset-import.md)。

## 4. 样张

| ID | 文件 | 用途 |
|----|------|------|
| P1-address | `samples/phase1/P1-address-cn-pt.pdf` | 中葡地址改址（占位文案，待用户真样替换） |
| P1-policy | `samples/phase1/P1-insurance-image-only.pdf` | 投保书：无文字层图档 |

## 5. 退出标准（第 1 期）

1. `pnpm desktop` 可开窗；原生打开 / 另存可用  
2. `node scripts/smoke-phase1-overlay.mjs` 通过：矢量字体嵌入、擦除重打、插图、另存  
3. 地址样张叠字 **不是** PNG 贴图（PDF 内含 Embedded Font）  
4. 投保书打开后走无字层路径  
5. 产品文档声明：网页原型冻结  

## 6. 与旧路线图关系

旧 `02-roadmap` Phase1=读批整理；**本清单的「第 1 期」是编辑交付切片**，覆盖旧 Phase2 轻编辑中的文字/擦除/图/另存，并强制桌面壳 + 真矢量字体。旧 Web 能力保留可用，但不再扩面。
