# ForgePDF

本地优先的 PDF 工作台（阅读 · 批注 · 整理 · 轻编辑 · 表单 · 签名）。

**当前可运行实现**：Vite + React + TypeScript + **pdf.js 4.10**（渲染）+ pdf-lib（写回）。

> 已在本机用 Chrome 无头实测：打开密文样例、缩略图、搜索、批注、导出、表单均通过。  
> 不要用 pdf.js 5+/6+（会触发 `getOrInsertComputed`，整页空白）。

## 启动

```bash
# Node.js >= 20
pnpm --dir apps/web install
node scripts/generate-samples.mjs   # 生成可读样例
pnpm start                          # http://localhost:5173
```

没有 pnpm：

```bash
cd apps/web && npm install && npm run dev -- --host --port 5173
```

请用 `samples/S-text-multipage.pdf` 或 `samples/S-form.pdf` 验证。  
若仍空白：硬刷新（Ctrl/Cmd+Shift+R），确认 Network 里 `/pdf.worker.min.mjs` 为 **200**。

## 我已跑过的自测

| 步骤 | 结果 |
|------|------|
| 打开 `S-text-multipage.pdf` | 正文可见；缩略图有字 |
| 搜索 | 可命中 |
| 批注 → 导出 | 下载成功，PDF 有效（5 页） |
| 打开 `S-form.pdf` → 表单 | 可填字段可见 |

```bash
pnpm start   # 终端 1
cd apps/web && node ../../scripts/acceptance-run.mjs   # 终端 2
```

## 功能（Phase 1 / 2）

打开/拖拽/多标签；滚动缩放缩略图搜索；批注（高亮/下划线/删除线/便签/墨迹/图章）；页面合并提取删除旋转重排；叠字/图片/水印/视觉遮盖；AcroForm 填写；手绘/图片签名；扁平化导出。

## 本阶段不做

OCR、高质量 Office 转换、合规级红act、云账号。

## 目录

```
apps/web/      可运行应用
docs/product/  产品设计
samples/       验收样例
scripts/       样例生成 / 验收脚本
```
