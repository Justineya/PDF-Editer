# TC OTF（矢量叠字）

- **优先**：从用户本机 `字体/` 拷入全量 Light / DemiLight。  
- 仓库默认提交的是 **地址样张子集**（~76KB），仅够 Phase1 中葡占位文案验收。  
- Adobe Source Han Sans TC 中，**DemiLight 对应发行文件 `SourceHanSansTC-Normal.otf`**（字重 350）；registry 将 `tc-demilight` 映射到 `SourceHanSansTC-DemiLight.otf`（可由 Normal 复制改名）。

```bash
node scripts/fetch-tc-fonts.mjs
```

`.cache/` 下的全量 OTF **不入库**（见根 `.gitignore`）。
