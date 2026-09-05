# ForgePDF

本地优先、性能优先的 PDF 工作台（阅读 · 批注 · 页面整理 · 轻编辑 · 表单 · 签名）。

可运行实现：**Vite + React + TypeScript + PDF.js（渲染）+ pdf-lib（写回）**。  
当前环境缺少 WebKit 时未捆绑 Tauri；浏览器全屏即可日用，后续可套桌面壳。产品设计见 [`docs/product/`](./docs/product/)。

## 启动

```bash
pnpm --dir apps/web install
pnpm samples          # 生成 samples/*.pdf
pnpm start            # http://localhost:5173
# 或: pnpm --dir apps/web dev
```

一条命令：`pnpm start`（需先 `pnpm --dir apps/web install`）。

## 功能清单（Phase 1 / 2）

### Phase 1
- 打开本地 PDF；拖拽；多标签；最近文件名；脏标记与关闭前提示
- 连续滚动、缩放、缩略图、大纲、全文搜索
- 批注：高亮 / 下划线 / 删除线 / 便签 / 墨迹 / 图章；列表可删
- **导出带批注 PDF**（扁平化写入内容流，可靠可见）
- 侧车 `.forge-annot.json` 备份
- 页面整理：合并、拆分 ZIP、提取、删除、旋转、重排
- 中文 UI；模式切换；欢迎页；快捷键 Ctrl+O/S/F/K、V/T/A/O/E/F/S

### Phase 2
- 叠加文字、图片、水印、视觉遮盖（明确 ≠ 红act）
- AcroForm 填写并写回；内置「示例表单」
- 手绘 / 图片签名并放置；另存副本

### 本阶段不做
OCR、Office 转换、真红act、AI、账号云同步、印刷 Preflight。

## 持久化策略

| 内容 | 策略 |
|------|------|
| 批注 / 叠加 / 签名 / 水印 / 遮盖 | **扁平化绘制进页面**后导出；PDF.js 等阅读器再开可见。非 Annotation 字典互操作。 |
| 表单 | **写回 AcroForm** |
| 批注侧车 | 可选 `.forge-annot.json` |

## 样例

`pnpm samples` → `samples/`：

- `S-text-multipage.pdf` — 多页文本
- `S-form.pdf` — AcroForm
- `S-merge-b.pdf` — 合并用第二文件

自测：`pnpm smoke`（无头 ops）· `node scripts/e2e-smoke.mjs`（需 Chrome + 已 `pnpm start`）。

## 目录

```
apps/web/       Vite React 应用
docs/product/   产品设计
samples/        样例 PDF
scripts/        generate-samples / smoke / e2e
```

## 已知限制

- 浏览器下载导出，非原生「覆盖保存」
- 批注非标准 Annotation 字典（见上）
- 文本批注为框选区域
- 超大扫描件受浏览器内存限制；终局渲染仍规划 PDFium（见架构文档）

## 许可

依赖默认 Apache/MIT/BSD（PDF.js、pdf-lib、React、Vite）；未引入 MuPDF/iText 等 AGPL。
