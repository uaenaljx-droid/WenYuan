# 文渊舆图宣传视频

## 主题

这支视频把“文渊舆图”呈现为一座交互式星球档案馆：沿一颗写实地球，寻访文学家、诗人、小说家、剧作家、哲学家、思想家与相关学者的精神坐标，并从人物进入作品导读。

## 规格

- 主版本：`WenyuanAtlasPromo60s`
- 时长：62.059 秒，1860 帧
- 帧率：30fps
- 分辨率：1920x1080
- 输出：`dist/video/wenyuan-atlas-promo-60s.mp4`

## 分镜结构

1. 诗意开场：星空、山海、宣纸雾色与项目名。
2. 入卷进入：首页、入卷点击、加载页与地球页淡入。
3. 地球漫游：地球、头像 marker、底部人物卡与左侧题跋。
4. 筛选与搜索：分类筛选、搜索与地图聚焦。
5. 人物档案：人物头像、生平、作品与人格摘要。
6. 作品导读：作品标题、简介、目录与正文导读。
7. 容量与系统感：500 位人物、真实头像、出生地坐标、自动漫游、人物档案、作品导读。
8. 品牌收束：项目名与 slogan 淡出。

## 使用的网页片段

采集脚本会从 `http://localhost:5176/` 自动保存截图序列到：

- `public/promo/frames/scene-01-home/`
- `public/promo/frames/scene-02-enter/`
- `public/promo/frames/scene-03-earth-tour/`
- `public/promo/frames/scene-04-filter-search/`
- `public/promo/frames/scene-05-profile/`
- `public/promo/frames/scene-06-work-guide/`
- `public/promo/frames/scene-07-finale-earth/`

## 生成图像

`@image` 生成素材保存在：

- `src/video/assets/generated/opening-wenyuan-atlas.png`
- `src/video/assets/generated/finale-wenyuan-atlas.png`
- `src/video/assets/generated/star-sea-transition.png`
- `src/video/assets/generated/ink-soft-mask.png`
- `src/video/assets/generated/gold-dust-overlay.png`
- `src/video/assets/generated/title-backdrop.png`

渲染时会同步复制到 `public/promo/generated/` 供 `staticFile()` 使用。为避免生成图出现错字，视频中的中文标题与字幕全部由 Remotion 精确排版。

## 背景音乐

使用项目已有音乐：

- `public/assets/audio/wenyuan-bgm.mp3`

Remotion 中音量约为 `0.22`，开头 3 秒淡入，结尾 3 秒淡出。

## 重新录制素材

确保网页在本地运行：

```bash
npm run dev -- --port 5176
```

然后执行：

```bash
npm run video:capture
```

也可以用环境变量指定其他地址：

```bash
set PROMO_URL=http://localhost:5176/&& npm run video:capture
```

## 预览视频

```bash
npm run video:preview
```

本项目在当前 Windows/Node 环境下通过 `NAPI_RS_FORCE_WASI=1` 让 Remotion 避开 Rspack 原生 binding 问题。

## 导出视频

```bash
npm run video:render
```

可用以下脚本检查最终 MP4 的元数据，并从视频文件本身抽取关键帧：

```bash
node scripts/check-promo-video.mjs
```

## 已知限制

- 当前主合成以网页关键帧截图加电影化推镜完成，优先保证流畅与无浏览器 UI。
- 如果 WebGL 实时录屏足够稳定，可以后续把 `public/promo/frames/` 替换为实机短片段。
- 当前交付只包含横版主视频，不包含竖版视频。
