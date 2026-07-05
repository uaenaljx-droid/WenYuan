export type PromoSceneId =
  | "opening"
  | "home-enter"
  | "earth-tour"
  | "filter-search"
  | "profile"
  | "work-guide"
  | "scale"
  | "finale";

export type PromoScene = {
  id: PromoSceneId;
  start: number;
  end: number;
  label: string;
  subtitle: string;
  framePath?: string;
};

export const scenes: PromoScene[] = [
  {
    id: "opening",
    start: 0,
    end: 180,
    label: "诗意开场",
    subtitle: "一颗地球，\n收藏五百位文学与思想的精神坐标。",
  },
  {
    id: "home-enter",
    start: 180,
    end: 390,
    label: "入卷进入",
    subtitle: "从一卷流动云海，\n进入作家、诗人与思想者的地理。",
    framePath: "promo/frames/scene-02-enter/poster.png",
  },
  {
    id: "earth-tour",
    start: 390,
    end: 750,
    label: "地球漫游",
    subtitle: "人物不再只是名字，\n他们被安放回出生地、时代与精神流派之中。",
    framePath: "promo/frames/scene-03-earth-tour/poster.png",
  },
  {
    id: "filter-search",
    start: 750,
    end: 1020,
    label: "筛选与搜索",
    subtitle: "按文明、文类与思想路径，\n重新打开一张人类精神地图。",
    framePath: "promo/frames/scene-04-filter-search/poster.png",
  },
  {
    id: "profile",
    start: 1020,
    end: 1320,
    label: "人物档案",
    subtitle: "每一位人物，\n都有生平、作品与人格气质的导读档案。",
    framePath: "promo/frames/scene-05-profile/poster.png",
  },
  {
    id: "work-guide",
    start: 1320,
    end: 1590,
    label: "作品导读",
    subtitle: "从人物进入作品，\n从作品回到时代与思想。",
    framePath: "promo/frames/scene-06-work-guide/poster.png",
  },
  {
    id: "scale",
    start: 1590,
    end: 1740,
    label: "容量与系统感",
    subtitle: "五百位人物，\n一张可以漫游的精神星图。",
    framePath: "promo/frames/scene-07-finale-earth/poster.png",
  },
  {
    id: "finale",
    start: 1740,
    end: 1860,
    label: "品牌收束",
    subtitle: "文渊舆图\n\n沿一颗地球，\n寻访文学与思想的精神坐标。",
  },
];

export const keywords = ["500 位人物", "真实头像", "出生地坐标", "自动漫游", "人物档案", "作品导读", "文学与思想"];
