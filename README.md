# ForgePDF

本地优先、性能优先的全能 PDF 工作台。终局对标 Acrobat Pro 能力集；当前已落地 **Phase 1–4 可日用 Web 版**（Vite + React + PDF.js 渲染 + pdf-lib 写回）。

环境暂未捆绑 Tauri 壳时，浏览器全屏即可当桌面工作台用；架构仍按本地桌面演进（见 `docs/product/`）。

## 快速开始

```bash
# Node.js ≥ 20
cd apps/web && npm install

# 生成验收样例
node ../../scripts/generate-samples.mjs
# 或从仓库根：node scripts/generate-samples.mjs

# 启动
npm run dev
```

浏览器打开终端提示的地址（默认 http://localhost:5173）。

根目录也可：

```bash
npm run dev --prefix apps/web
# 或 pnpm start（若已装 pnpm）
```

## 功能清单（Phase 1 → 4）

### Phase 1 — 阅读 / 批注 / 整理

- 打开本地 PDF、拖拽、多标签、最近文件名
- 连续翻页、缩放、缩略图、大纲、全文搜索
- 批注：高亮、下划线、删除线、便签、墨迹、图章
- 导出时扁平化写入 PDF（重新打开可见）
- 页面整理：合并、提取、删除、旋转、重排

### Phase 2 — 轻编辑 / 表单 / 签名

- 叠加文字、图片、水印、视觉遮盖
- AcroForm 填写并写回
- 手绘 / 图片签名放置

### Phase 3 — OCR / 转换

- 当前页 OCR（Tesseract.js，默认 eng，可扩中文包）
- PDF → 图片 ZIP、PDF → Markdown、图片 → PDF
- Office 高质量互转仍为外置引擎规划项（UI 已标明）

### Phase 4 — 密文 / 安全 / 比较 / 本地 AI

- **强力密文**：框选后栅格化写回，降低复制残留风险（并标注能力边界）
- 元数据查看与清理；可选导出密码加密
- 双 PDF 首页像素比较
- 本地提取式摘要 / 关键词问答（无云端）

## 持久化策略

| 内容 | 策略 |
|------|------|
| 批注 / 叠字 / 签名 / 水印 / 密文框 | 导出时写入页面内容流（扁平化） |
| 表单字段 | pdf-lib 写回 AcroForm |
| 强力密文 | 相关页栅格化后重建，避免文本层残留 |

## 样例文件

`node scripts/generate-samples.mjs` → `samples/`：

| 文件 | 用途 |
|------|------|
| `S-text-multipage.pdf` | 翻页 / 搜索 / 批注 / 整理 |
| `S-form.pdf` | 填表 + 签名 |
| `S-merge-b.pdf` | 合并测试 |

## 目录

```
apps/web/         # 可运行应用
docs/product/     # 产品设计（愿景 / 路线 / 架构 / UX / MVP）
samples/          # 验收样例
scripts/          # generate-samples.mjs
```

## 已知限制

- 浏览器下载式保存（非系统原生另存）；Tauri 壳后续套
- 批注为扁平化绘制，非完整 PDF Annotation 字典互操作
- OCR 默认 eng；中文需语言包
- 真文本回流编辑、高质量 Office 转换仍为后续深化
- 加密 PDF 为尽力打开（ignoreEncryption）

## 许可

依赖默认 Apache/MIT/BSD（PDF.js、pdf-lib、React、Vite、Tesseract.js）；未引入 MuPDF/iText 等 AGPL。
