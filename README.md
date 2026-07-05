# 文渊舆图

一座写实 3D 地球上的文学、哲学与思想人物人格档案馆。页面默认是克制的纪录片式地球：自动沿策展路线聚焦人物，hover 只做轻预览，click 才打开居中的百科海报式人物档案。

## 项目定位

本项目灵感来自“小红书 3D 地球 + 人格星球漫游”的公开演示，但当前版本已经重新策展为文学、哲学与思想人物星图。主展示对象限定为文学家、诗人、小说家、剧作家、哲学家、思想家和相关学者，不展示自媒体作者、训练课程、古籍集合、自动化团队体系或目录名。

## 数据来源与 Attribution

- 初始灵感与仓库范围来自一个公开人格素材仓库：[momozi1996/awesome-ai-persona-skills](https://github.com/momozi1996/awesome-ai-persona-skills)。
- 进入页本地原型直接引用 [qingnang.cc](https://www.qingnang.cc/) 首页的两张水墨云海 WebP 资源，保存于 `public/assets/qingnang/`，仅用于本地学习与视觉对齐；授权状态待确认，公开发布或商业使用前必须替换为自有、委托或已授权素材，详见 `public/assets/qingnang/SOURCE.md`。
- 背景音乐文件已接入 `public/assets/audio/wenyuan-bgm.mp3`，当前来源为本地文件 `rainstreetcat-dreams-of-the-mortal-world-1-428651.mp3`；授权状态需在公开发布或商业使用前确认，详见 `public/assets/audio/SOURCE.md`。
- 当前人物资料整理在 `src/data/personas.enriched.json`，参考来源主要包括 Wikipedia、Britannica、Stanford Encyclopedia of Philosophy 等公开资料页面。
- 地球贴图优先加载 `public/assets/earth/` 下的本地运行资源：NASA Blue Marble / Black Marble 方向的日夜贴图，以及 Three.js examples 云层、法线贴图。`earth-specular.jpg` 仅保留为候选海洋遮罩资源，当前渲染不再混入地表颜色。具体来源、下载 URL、尺寸和复核要求见 `public/assets/earth/SOURCE.md`。加载失败时使用程序化地球材质。
- 当前 500 位人物头像已统一本地化为分层 WebP：优先使用 Wikimedia Commons / Wikidata P18、Wikipedia 可追溯肖像、国家肖像馆、出版社作者页等来源；无可靠肖像的人物保留为 `pending_authentic_image`，只显示“图像待核验”骨架，不再用单字印章或 AI 生成头像冒充真实人物。

## 本地运行

```bash
npm install
npm run dev
```

启动后访问终端输出的 Vite 地址，通常是 `http://localhost:5173/`。如果端口被占用，Vite 会自动选择下一个端口。

## 构建

```bash
npm run build
```

## 背景音乐配置

项目已预留全局背景音乐入口，音频文件固定放置在：

```text
public/assets/audio/wenyuan-bgm.mp3
```

请仅使用自有、已授权、公版或开放授权音乐，不要使用未授权商业歌曲、盗版下载地址或第三方音乐平台热链。推荐气质为华语器乐、古琴、箫、笛、琵琶、星夜氛围与低音弦乐，整体应缓慢、克制、温润，不抢走阅读和观察地球的注意力。

浏览器通常禁止网页在无用户交互时自动播放有声音频。本项目会在页面加载时准备音乐系统，但只在用户点击“入卷”或音乐开关等交互后尝试播放；播放后循环，并以淡入淡出的方式开关。页面提供轻量音乐开关，会记住用户的乐声/静音选择。

如果 `public/assets/audio/wenyuan-bgm.mp3` 不存在，页面仍会正常运行，音乐开关会进入不可用状态，并在控制台提示：

```text
[Audio] Background music file not found: /assets/audio/wenyuan-bgm.mp3
```

## 数据维护

```bash
npm run data:expand
npm run data:seed500
npm run audit:avatars
npm run fetch:avatars
npm run screenshot:avatars
npm run crop:avatars
npm run generate:avatar-sizes
npm run generate:avatar-manifest
npm run generate:persona-index
npm run generate:search-index
npm run generate:routes
npm run generate:tour-path
npm run generate:stats
npm run data:avatars
npm run data:works
npm run validate:data
```

`data:expand` 会生成 78 位人物、7 条路线、题跋文案、主题和头像 manifest。头像管线由 `fetch:avatars`、`screenshot:avatars`、`crop:avatars`、`generate:avatar-sizes` 和 `generate:avatar-manifest` 维护：下载或截取可追溯来源图像，生成 256 / 96 / 64 三层 WebP，并同步 `src/data/personas.enriched.json` 与 `src/data/avatar-manifest.json`。`data:works` 会生成代表作品目录，并只为公版或开放授权作品缓存全文到 `public/data/works-content/`。`scripts/generate-works-enriched.mjs` 会从作品目录生成 `src/data/works.enriched.json`，`scripts/enrich-work-guides.mjs` 会补齐作品导读、题记、阅读路径、展示模式和来源索引。

### GPT 人物介绍与作品导读

高质量人物档案与作品导读使用本地生成、审计、合并流程维护。生成脚本需要 `OPENAI_API_KEY`，缺失时会停止并明确提示，不会写入占位内容或伪造结果。

```bash
npm run generate:gpt-profiles
npm run generate:gpt-works
npm run merge:gpt-content
npm run audit:content
npm run validate:data
npm run build
```

生成结果先写入 `src/data/generated/persona-profiles.gpt.json` 与 `src/data/generated/work-guides.gpt.json`，通过 `merge:gpt-content` 合并到 `src/data/personas.details.json`、`src/data/personas.enriched.json`、`src/data/works.details.json` 和 `src/data/works.enriched.json`。合并前会在 `public/debug/content-backups/` 生成备份；`audit:content` 会输出 `public/debug/content-audit.json` 与 `public/debug/content-audit-report.md`，检查禁用模板腔、字段完整性、基础长度和相似度。

### 500 人扩容批次

`data:seed500` 用于把人物库稳定扩充到 500 位：脚本会保留原始 78 位核心人物，移除旧的自动扩充批次，再从 `src/data/persona-candidates.500.json` 生成 422 位新增人物。候选来源来自 Wikidata 查询缓存，新增对象限定为文学家、诗人、小说家、剧作家、哲学家、思想家和相关学者，不把自媒体作者、网红、运营号、AI Agent 团队、课程模块、目录条目或工具型项目作为主展示对象。

扩容批次同步维护这些文件：

- `src/data/personas.enriched.json`
- `src/data/curation-copy.json`
- `src/data/avatar-manifest.json`
- `src/data/works-catalog.json`
- `src/data/works.enriched.json`
- `src/data/search-index.json`
- `src/data/route-sequences.json`
- `src/data/persona-stats.json`

当前 500 位人物头像统一本地化到 `public/assets/avatars/`：详情页使用 256x256，底部卡片使用 `thumbs/` 96x96，地球 marker 使用 `markers/` 64x64。最近一次审计为 479 个真实/可追溯头像、21 个 `pending_authentic_image`，默认 `globalTourNearestSurface` 前 100 人 pending 为 0。pending 人物仍进入待补图清单，并使用低饱和“图像待核验”骨架，不使用远程热链、随机头像、单字印章或 AI 生成肖像冒充真实人物照片。`audit:avatars` 会检查本地文件、字段、manifest 覆盖、禁用来源、pending 数量和默认路线前 100 的头像状态。

自动漫游使用 `generate:tour-path` 生成 `globalTourNearestSurface`，以人物 `visualLat` / `visualLng` 计算球面相邻距离，从屈原附近开始覆盖 500 人，并输出 `public/debug/tour-stats.json`。右上角策展路线仍保留原有交互，自动播放默认使用邻近地表路径以避免跨半个地球跳转。

新增代表作品默认采用导读模式，`rightsStatus` 保持为版权未知或受限，不缓存、不展示完整正文。坐标生成遵守文化区域约束：东亚、地中海、欧洲、俄罗斯、美洲、南亚和中东/波斯等人物保持在对应区域内做稳定视觉扩散。

每次修改人物、路线、作品、头像或索引数据后，至少运行：

```bash
npm run validate:data
npm run build
```

## 作品文本与版权策略

- 本项目不是电子书下载站，也不嵌入未授权作品全文。
- 公版或明确开放授权作品可以展示合法文本来源、必要短摘录和来源说明；如使用站内缓存，必须保留来源、授权状态和检索日期。
- 现代/当代仍受保护、译本权利复杂或数字来源不清的作品采用导读模式，只展示作品简介、主题提示、阅读路径、相关人物和书目索引。
- 作品详情页以原创导读、阅读提示、思想脉络和延伸阅读方向为核心；数据字段中保留权利状态用于内部校验，前端 UI 不把版权声明作为主要内容。
- 译本、校注本、整理本、出版社电子版和数据库文本的权利状态需要单独复核，不能因原著公版就默认译文可公开展示。
- 头像、地球贴图、星空背景、作品文本和外部来源在公开发布前都需要复核授权。
- 本项目不使用盗版资源站、未授权 PDF/EPUB/MOBI 下载站、论坛搬运全文或网盘链接作为数据来源。
- 后续如接入自有授权文本库或用户提供的合法本地材料，应只在授权范围内生成导读和摘要，不把受保护全文写入公开仓库。

## 功能清单

- Three.js 写实地球、云层、夜间灯光、大气辉光、星空背景。
- OrbitControls 拖拽旋转、滚轮缩放、阻尼、距离限制。
- Hybrid geo layout：优先使用出生地坐标，再按文化区域、时代和流派做稳定视觉扩散，避免节点挤在一起或跨洲乱飞。
- 500 位文学、哲学、思想人物，默认路线为“中西对照”；其中原 78 位保留为核心策展人物，新增 422 位来自可核查公开资料的扩充批次。
- 7 条策展路线：中西对照、东方思想、中国文学、西方哲学、世界文学、现代主义、文明边界。
- 低饱和圆形 marker、细光环、前后景透明度衰减和少量关系弧线。
- GSAP 驱动首屏进入、hover 聚焦、镜头飞行、marker 高亮、弹窗进入和主题色温过渡。
- 底部人物卡 hover 或键盘 focus 只旋转地球、更新题跋和轻亮 marker；点击才打开 profile modal。
- 代表作品按钮打开“作品导读档案”：公版或开放授权作品提供可核验文本线索和必要缓存，其他作品只显示导读、元数据、阅读提示和书目索引。
- 搜索人物名、英文名、身份、时代、流派、作品和关键词。
- 方向键切换路线人物，`Esc` 关闭弹窗，`/` 聚焦搜索框。
- 移动端地球居中、顶部筛选横滑、底部卡片横滑、modal 自适应窄屏。

## 数据字段

核心字段位于 `src/data/personas.enriched.json`：

- `id`、`name`、`displayName`、`latinName`
- `category`、`identity`、`nationality`
- `birthYear`、`deathYear`、`birthplace`、`birthLat`、`birthLng`
- `visualLat`、`visualLng`
- `era`、`school`、`movement`
- `avatarUrl`、`avatarLocal`、`avatarCredit`
- `summary`、`biography`、`works`、`personaSummary`、`keywords`
- `profileEpigraph`、`whoHeIs`、`lifeArc`、`whyMatters`、`styleAndTemperament`、`howToRead`、`historicalRelation`、`relatedPath`
- `references`、`sourceUrl`
- `dataQuality`

## 已知限制

- 公开信息未包含完整原项目源码，本项目基于公开说明、截图和开源仓库范围进行工程复刻与重新策展。
- 人物资料、出生地、作品归属和头像版权仍需人工复核，古代人物尤其可能存在学术争议。
- 仍有 21 位人物处于 `pending_authentic_image`，需要继续人工确认可靠肖像来源；已本地化头像中标记 `needsReview` 的条目仍需在公开发布前复核身份、裁切与授权。
- 作品全文仅可在公版或开放授权且来源清晰时缓存；现代/当代仍受版权保护、译本权利不明或来源不清的作品不会缓存或展示完整正文。
- 路线是策展顺序，不代表严格学术师承、影响链或历史因果。
- Three.js 体积较大，生产环境可继续通过动态导入或手动分包优化。
