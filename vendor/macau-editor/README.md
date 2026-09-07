# 澳门投保书编辑器原型（用户提交）

来源：`main` 提交 `澳门修改测试版`（`index.html`）。

这是你本机 `pdf编辑器/` 的叠层交互参考实现：遮盖旧地址 → 文字框 → 插图裁切/擦白 → 另存。

## 重要差异（ForgePDF 第 1 期）

| 原型 | ForgePDF Phase-1 |
|------|------------------|
| 文字导出用 **Canvas PNG** 贴图 | **矢量嵌入 TC OTF**（fontkit） |
| 建议 Regular | 默认 `tc-regular`，另有 Light/DemiLight |
| 单文件 HTML + vendor/fonts 外置 | 并入 `packages/doc-model` + Tauri 桌面壳 |

原型仍依赖未入库的 `vendor/pdf*.js` 与 `fonts/*.otf`；请把本机 `字体/` 全量 OTF 放到仓库 `assets/fonts/tc/`。

真地址文案已写入 `samples/phase1/address-copy.json`。
