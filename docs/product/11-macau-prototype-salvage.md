# 澳门投保书原型 · 可取之处（相对 ForgePDF Phase-1）

来源：`main` @ `澳门修改测试版` → `vendor/macau-editor/index.html`  
（截至审查时 GitHub **无更新提交**；若你另传了 fonts/zip，仓库侧尚未见到。）

## 采纳（已进 / 正在进 Phase-1）

| 点 | 原因 |
|----|------|
| 中葡地址 `ADDR_BLOCK` / 大厦名预设 | 真业务文案 |
| 搜「財神／Fortune」→ 遮盖 + 重打 | 改址主路径 |
| 地址用 **Regular** 字重 | 贴近原稿 |
| 遮盖工具 + 文字框叠层 | 与文档模型一致 |
| 无文字层时提示改用遮盖 | 投保书图档路径 |
| 插图可编辑（裁切/擦白） | 下一刀移植；本期先插入/移动 |

## 不采纳 / 改写

| 点 | 原因 |
|----|------|
| `renderTextPng` 导出 | 你已明确禁止用 Canvas PNG 冒充原稿 → **fontkit 矢量 OTF** |
| 单文件 HTML 当产品壳 | 冻结网页堆功能；主线 Tauri + 文档模型 |
| 依赖未入库的 `vendor/` `fonts/` | 需你拷 `字体/` 到 `assets/fonts/tc/` |

## 坐标注意

原型叠层用 PDF **底左**原点；ForgePDF 对象层用 **顶左**。移植命中/放置时已在 `macauAddress.ts` 按顶左处理。
