# AGENTS.md

## 展示范围

1. 页面主展示对象限定为文学家、诗人、小说家、剧作家、哲学家、思想家和相关学者。
2. 禁止把自媒体作者、网红、运营号、AI Agent 团队、多 Agent 框架、EQ 训练、课程模块、古籍本身、目录名、README 条目或工具型项目作为主展示对象。
3. 新增人物必须是真实可核查的人物，并且必须带 `references` 和 `dataQuality`。
4. 不要编造人物生平、代表作品、出生地、头像或头像来源。缺失数据使用 `null`、空数组或“待补充”。

## 视觉与交互

1. 未点击人物时保持高级纪录片地球界面：写实地球、轻量星空、低饱和大气辉光、少 UI 干扰。
2. 点击人物后保持人物百科式交互档案馆：居中海报 modal、清晰生平、作品、人格摘要和来源。
3. 禁止重新引入大面积霓虹面板、紫色三角 marker、AI dashboard 卡片、彩虹渐变、随机科技线框、过度玻璃拟态或调试数字常驻页面。
4. 头像必须是真实照片或可靠公开肖像。无法确认时使用低饱和文字占位头像，不得用 AI 生成肖像冒充真实图片。
5. 卡片 hover、marker hover 和自动漫游只做预览与聚焦，不能自动打开人物 modal；点击才打开详细档案。
6. 代表作品点击只打开作品阅读层，不切走人物档案；公版作品可读全文，版权保护作品只显示说明和来源。
7. 修改坐标生成、marker 布局、hover 聚焦、卡片交互或 modal 状态锁后，必须运行 `npm run validate:data` 和 `npm run build`。

## 数据维护

1. 修改人物数据后必须运行：

```bash
npm run validate:data
```

2. 新增或修改数据字段时，同步更新：

- `src/data/personas.enriched.json`
- `src/data/curation-copy.json`
- `src/data/avatar-manifest.json`
- `src/data/works-catalog.json`
- `README.md`

3. `src/data/curation-copy.json` 的 `personaEditorial` 必须覆盖所有人物，短句不得出现 AI、Agent、Skill、模块、GitHub 等工程词。
4. `dataQuality.avatar` 必须与头像状态一致。缺失头像为 `missing`，可靠头像才可标为 `verified`。
5. 新增头像字段时同步维护 `avatarCredit` 和 `src/data/avatar-manifest.json`。没有可核查来源时保留 `pending`，不要编造 `sourceUrl`、`license` 或本地文件。
6. 新增或修改代表作品时同步维护 `src/data/works-catalog.json`；只有 `public-domain` 或 `open-license` 作品可以有 `contentPath`，现代/当代受版权保护作品不得缓存或展示完整正文。
7. 新增路线时同步更新 `src/data/routes.json`、`src/data/visual-themes.json` 和 README。默认路线仍为“中西对照”。

## 工程规则

1. 修改 Three.js 场景、地球材质、marker、相机或交互代码后必须运行：

```bash
npm run build
```

2. 优先保持无后端、静态部署可用。运行时以本地策展 JSON 为主，断网也必须可渲染。
3. 坐标布局必须保持文化区域合理：东亚人物留在东亚，希腊留在地中海，欧洲、俄罗斯、美洲、南亚、中东/波斯、日本等保持对应区域，不为视觉分散跨洲乱放。
4. 公共资源、贴图、头像和资料来源必须在 README 或人物 `references` 中注明。
5. 运行 `npm run data:works` 会刷新作品目录和公版全文缓存；刷新后必须运行 `npm run validate:data` 和 `npm run build`。
