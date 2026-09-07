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

期望从该目录复用的能力：

1. 对象层：文本框 / 擦除块 / 图片  
2. 选中 · 拖移 · 删除 · 另存扁平化  
3. 先选字体再放置  

本仓库对应实现：

- 模型：`packages/doc-model`  
- 字体注册与嵌入：`packages/overlay-fonts`  
- UI 对象层（暂用现有）：`apps/web/src/components/EditObjectLayer.tsx`  
- 写回：`apps/web/src/pdf/ops.ts`（经 fontkit 嵌 OTF）

若你后续把 `pdf编辑器/` 源码放进仓库（例如 `vendor/pdf-editor/`），在本文件补「目录映射表」，优先替换对象层交互，**不要**再分叉一套网页工具条。

## 地址「中葡文」样张

对话里写了「用上面的中葡文」，但历史消息中 **未找到具体字符串**。  
当前 `samples/phase1/address-copy.json` 使用 **PLACEHOLDER** 澳门双语地址；请用你的真样张替换 JSON + PDF 后重跑 smoke。
