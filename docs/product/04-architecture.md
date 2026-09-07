# 技术架构与选型

## 1. 总览

```
┌─────────────────────────────────────────────────────────┐
│  UI Shell (Tauri 2 + WebView)                           │
│  React/Vue + Canvas/WebGL 呈现层（批注交互、面板）        │
└───────────────────────┬─────────────────────────────────┘
                        │ IPC (typed commands / events)
┌───────────────────────▼─────────────────────────────────┐
│  App Core (Rust)                                        │
│  Session · Commands · Undo · Plugin Host · Perf Probe   │
└───────────┬─────────────────────┬───────────────────────┘
            │                     │
┌───────────▼──────────┐  ┌───────▼───────────────────────┐
│  Render Engine       │  │  Document Ops                 │
│  PDFium (native)     │  │  page organize / encrypt      │
│  tile cache · decode │  │  pdfcpu/qpdf 或自研 Rust 绑定  │
└──────────────────────┘  └───────────────┬───────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
            ┌───────▼──────┐      ┌───────▼──────┐      ┌───────▼──────┐
            │ Edit Engine  │      │ OCR Module   │      │ Convert Hub  │
            │ (Phase 2–3)  │      │ (Phase 3)    │      │ (Phase 3)    │
            └──────────────┘      └──────────────┘      └──────────────┘
```

**本地优先**：所有模块默认同进程或本地子进程；网络仅用于可选 AI/更新检查。

## 2. 为什么是这条技术栈

| 决策 | 选择 | 理由 |
|------|------|------|
| 壳 | **Tauri 2** | 比 Electron 内存更低；Rust 便于绑 PDFium/做高性能 I/O |
| 渲染 | **PDFium** | Chrome 同款、BSD 许可友好、表单/字体生态成熟 |
| UI | Web 技术（建议 React + TypeScript） | 面板/复杂交互迭代快；重绘页用引擎位图，不靠 DOM 排 PDF |
| 页面结构操作 | **pdfcpu** 或 **qpdf**（先），逐步 Rust 化 | Phase 1 快速交付合并拆分；许可 Apache |
| 轻修改 | 自研写回 + 可参考 pdf-lib 模型 | 浏览器库可作算法参考，桌面以 Rust/C++ 写回为准 |
| OCR | 可插拔（Tesseract 起步） | 满足本地；后续可换更高质量引擎 |
| Office 转换 | 外置引擎（LibreOffice headless 等） | 自研版面重建并行，不挡产品 |

## 3. 核心抽象

### 3.1 DocumentSession

```text
DocumentSession {
  id, path, password?,
  page_count, meta,
  annotations: AnnotationStore,
  edit_tx: EditTransactionStack,
  dirty: bool,
  render_handle: EngineDoc
}
```

规则：

- 一个标签页 = 一个 Session
- 所有写操作走 Command，支持 Undo（Phase 2 起强制）
- 保存 = 序列化到 PDF（标准对象）+ 可选侧车

### 3.2 渲染管线

1. UI 请求可视页范围 + 缩放 + 设备像素比
2. Core 查 tile/page 缓存 → miss 则后台解码
3. 位图经共享内存/DMA 友好路径回传 WebView（避免 base64）
4. 批注层由 UI 向量叠加（或引擎合成，Phase 1 可先 UI 叠加 + 导出时写入）

### 3.3 插件点（Phase 0 预留接口，Phase 3 启用）

```text
trait OcrProvider
trait ConvertProvider
trait AiProvider
trait SignatureProvider
```

主程序不编译死某一家云服务。

## 4. 目录规划（建议落地时）

```text
/
├── apps/
│   └── desktop/          # Tauri 应用
├── crates/
│   ├── forge-core/       # Session、命令、插件宿主
│   ├── forge-render/     # PDFium 绑定与缓存
│   ├── forge-ops/        # 页面组织、加密
│   ├── forge-edit/       # 编辑引擎（后期）
│   └── forge-pdfium-sys/ # FFI
├── packages/
│   └── ui/               # 前端 UI
├── docs/product/         # 本产品设计
├── samples/              # 基准样例（注意版权）
└── scripts/bench/        # 性能基准
```

## 5. 许可策略

| 允许默认引入 | 需评审 | 默认拒绝（除非商用授权） |
|--------------|--------|--------------------------|
| PDFium (BSD) | LGPL 动态链接库 | MuPDF AGPL |
| pdfcpu / qpdf / PDFBox (Apache) | OpenPDF (LGPL/MPL) | iText AGPL 未授权 |
| PDF.js（若作参考/测试）Apache | Tesseract (Apache) | 任意「源码必须开源」传染到整仓的依赖 |
| Tauri / Rust 生态 MIT/Apache | LibreOffice 作为**外部**进程 | 把 Stirling 专有目录代码拷进闭源 |

维护 `THIRD_PARTY_NOTICES`；CI 扫描 license。

## 6. 性能预算

| 操作 | 预算（目标机：近 3 年笔记本，SSD） |
|------|-------------------------------------|
| 冷启动到主窗口 | ≤ 800ms |
| 打开 200 页文本 PDF 到首页可读 | ≤ 1.5s |
| 邻页翻页（已缓存） | ≤ 16ms |
| 缩放一档（已有 tile） | ≤ 32ms |
| 墨迹点到点 | ≤ 20ms |
| 合并 10 个小 PDF | ≤ 3s |

基准脚本进 `scripts/bench/`，Phase 0 即跑。

## 7. 安全

- 沙箱打开不可信 PDF（PDFium 自身较稳，仍限制文件 API）
- 密码只进内存，不写日志
- 红act（Phase 4）单独威胁模型文档
- 自动更新可选、签名校验

## 8. 各阶段技术 Spike（必须先做的试验）

| ID | Spike | 通过标准 | 阶段 |
|----|-------|----------|------|
| SP-1 | Rust 绑定 PDFium 渲染 1 页到 RGBA | 正确像素 + 无泄漏 | 0 |
| SP-2 | 多页 tile 缓存与滚动 | 200 页流畅 | 0 |
| SP-3 | 批注写回 PDF 后 Acrobat/Preview 可见 | 互操作通过 | 1 |
| SP-4 | 合并/拆分大文件内存峰值 | 峰值可控 | 1 |
| SP-5 | AcroForm 填写写回 | 字段不丢 | 2 |
| SP-6 | 内容流文本编辑简单样例 | 字体不炸 | 3 |
| SP-7 | OCR 中文扫描件可搜索 | 抽检准确率达标 | 3 |
| SP-8 | 红act 后字符串搜不到敏感词 | 含压缩流/图片 | 4 |

## 9. 与「浏览器版」的关系

- **主产品是桌面**（性能终局）。
- 若需要浏览器：同一 `forge-ops` 可抽成本地服务，`localhost` UI 复用；**渲染仍建议原生或 WASM PDFium**，而不是只靠 PDF.js 作为终局引擎。
- PDF.js 可用于：自动化测试对照、Web 演示原型、批注 UX 原型——不作为 Phase 3+ 真编辑唯一引擎。
