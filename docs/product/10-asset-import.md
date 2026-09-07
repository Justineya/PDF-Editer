# 本机资产导入：`pdf编辑器/` · `字体/`

云端仓库里 **没有** 你本机的这两个目录。第 1 期按下列约定对齐。

## `字体/`（TC OTF）

把 Traditional Chinese OTF（优先 **Light / DemiLight**）拷到：

```text
assets/fonts/tc/
  SourceHanSansTC-Light.otf      # 或你的 TC Light 文件名，见 registry 别名
  SourceHanSansTC-DemiLight.otf  # 若只有 Normal 字重，可复制/改名为 DemiLight
```

也可用：

```bash
node scripts/fetch-tc-fonts.mjs          # 拉 Adobe Source Han Sans TC
node scripts/fetch-tc-fonts.mjs --subset # 仅地址样张子集（默认已提交子集）
```

**验收**：`scripts/smoke-phase1-overlay.mjs` 检查导出 PDF 是否嵌入自定义字体（非仅 Standard 14 / 非整页 PNG 字）。

## `pdf编辑器/`（叠层编辑）

用户已把「澳门修改测试版」提交到 `main` 的根 `index.html`。  
本分支将其保存为参考：`vendor/macau-editor/index.html`。

期望复用的能力：

1. 对象层：文本框 / 遮盖(擦除) / 图片（含裁切、擦白）
2. 中葡地址预设 `ADDR_BLOCK`（已同步到 `samples/phase1/address-copy.json`）
3. 搜旧址关键词（財神 / Fortune…）→ 遮盖 + 重打
4. 选中 · 拖移 · 删除 · 另存

**不要再复用**原型里的 `renderTextPng` 导出路径。

本仓库对应实现：

- 模型：`packages/doc-model`
- 字体注册与嵌入：`packages/overlay-fonts`
- 写回：`apps/web/src/pdf/ops.ts`（fontkit 嵌 OTF）

## 地址「中葡文」样张

已从用户原型提取：

```
澳門南灣湖景大馬路810號中國工商銀行大廈6樓E座
Avenida Panorâmica do Lago Nam Van, nº 810,
Edif. ICBC Tower, 6º andar E, Macau
```

字重：原型建议 **Regular**；ForgePDF 默认 `tc-regular`，并保留 Light/DemiLight。

