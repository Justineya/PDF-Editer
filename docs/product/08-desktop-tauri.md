# 桌面壳（Tauri）

ForgePDF 桌面版 = **同一套 Web 前端** + **Tauri 2** 原生窗口。

## 目标（本切片）

- 本地窗口运行，不依赖浏览器标签页
- 系统「打开 / 保存」对话框读写 PDF
- 功能与 Web 版对齐（批注、整理、覆盖编辑、有限内容流改写）

## 非目标（诚实）

- **不是**换了 Acrobat 级编辑引擎
- 渲染仍是 pdf.js；写回仍是 pdf-lib
- 「完美真编辑」仍受开源天花板限制（见产品讨论）

## 运行

```bash
pnpm --dir apps/web install
pnpm desktop          # 开发
pnpm desktop:build    # 打包
```

Linux 需安装 webkit2gtk 等依赖，见 Tauri 官方 Prerequisites。

## 结构

```
apps/web/src/desktop.ts     # 是否 Tauri、原生打开/保存桥
apps/web/src-tauri/         # Rust 壳、权限、插件（dialog / fs）
```
