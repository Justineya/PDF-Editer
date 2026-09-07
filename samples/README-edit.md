# 编辑测试样例

用于检查清晰度与编辑稳定性。

| 文件 | 用途 |
|------|------|
| `E-edit-latin.pdf` | 拉丁文：图形 / 文字 / 修改原文（内容流） |
| `E-edit-cjk-ui.pdf` | 中文 UI：先选黑体/宋体再放字；椭圆填充 |
| `E-edit-mixed.pdf` | 混合压力：选中 / 拖动 / Delete |

生成：

```bash
node scripts/gen-edit-samples.mjs
```

自动化试用报告：

```bash
node scripts/trial-edit-samples.mjs
# -> artifacts/edit-trials/index.html
```

检查清单：

1. 150% / 200% 缩放下文字是否清晰  
2. 样式条是否能先选字体/字号/颜色/形状再放置  
3. 画图形后是否自动选中，Delete 能否删掉  
4. 放文字后是否出现多余白块  
5. Latin 样例框选 →「修改原文」是否可用  
