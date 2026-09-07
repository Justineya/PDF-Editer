# TC OTF（矢量叠字）

- **优先**：从用户本机 `字体/` / GitHub 上传拷入全量字重。  
- 仓库默认提交的是 **地址样张子集**（~80KB），仅够 Phase1 中葡文案验收。  
- 用户已上传：`NotoSansCJKtc-Bold.otf`（main @ Add files via upload）→ 已子集进仓库；**地址正文仍建议 Regular**，Bold 作标题。  
- Adobe Source Han Sans TC 中，**DemiLight 对应发行文件 `SourceHanSansTC-Normal.otf`**。

```bash
node scripts/fetch-tc-fonts.mjs
```

`.cache/` 下的全量 OTF **不入库**（见根 `.gitignore`）。

还缺（请继续上传）：`NotoSansCJKtc-Regular.otf` / `Medium` / `Light`（原型改地址首选 Regular）。
