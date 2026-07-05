const LITERATURE_CATEGORIES = ["文学家", "诗人", "小说家", "剧作家", "散文家", "词人", "文学批评家"];
const THOUGHT_CATEGORIES = ["哲学家", "思想家", "学者"];
const CHINA_TERMS = [
  "中国",
  "中國",
  "中华",
  "中華",
  "华夏",
  "春秋",
  "战国",
  "戰國",
  "楚国",
  "楚國",
  "秦",
  "汉",
  "漢",
  "魏",
  "晋",
  "晉",
  "南北朝",
  "隋",
  "唐",
  "宋",
  "元",
  "明",
  "清",
  "民国",
  "民國"
];
const JAPAN_TERMS = ["日本"];
const KOREA_TERMS = ["韩国", "韓國", "朝鲜", "朝鮮", "高丽", "高麗", "大韩民国", "大韓民國"];
const NORTH_AMERICA_TERMS = ["美国", "美國", "加拿大"];
const LATIN_AMERICA_TERMS = ["巴西", "阿根廷", "智利", "墨西哥", "秘鲁", "秘魯", "哥伦比亚", "哥倫比亞"];
const EUROPE_TERMS = [
  "英国",
  "英國",
  "法国",
  "法國",
  "德国",
  "德國",
  "意大利",
  "義大利",
  "西班牙",
  "葡萄牙",
  "俄国",
  "俄國",
  "俄罗斯",
  "俄羅斯",
  "希腊",
  "希臘",
  "爱尔兰",
  "愛爾蘭",
  "波兰",
  "波蘭",
  "捷克",
  "奥地利",
  "奧地利",
  "瑞士",
  "荷兰",
  "荷蘭",
  "挪威",
  "瑞典",
  "丹麦",
  "丹麥"
];
const WESTERN_CIVILIZATIONS = ["欧洲", "北美", "拉美"];
const NON_CHINA_EXCLUSION_TERMS = [...JAPAN_TERMS, ...NORTH_AMERICA_TERMS, ...LATIN_AMERICA_TERMS, ...EUROPE_TERMS];
const EXPLICIT_CHINA_TERMS = [
  "中国",
  "中國",
  "中华",
  "中華",
  "华夏",
  "楚国",
  "楚國",
  "中华人民共和国",
  "中華人民共和國",
  "中华民国",
  "中華民國"
];
const CHINESE_HISTORICAL_PERIOD_PATTERN = /(春秋|战国|戰國|秦朝|汉朝|漢朝|魏晋|魏晉|晋朝|晉朝|南北朝|隋朝|唐朝|宋朝|元朝|明朝|清朝|先秦|两汉|兩漢|晚清|近现代中国|現代中國)/;
const SOUTH_ASIA_TERMS = ["印度", "孟加拉", "巴基斯坦", "斯里兰卡", "斯里蘭卡", "尼泊尔", "尼泊爾"];
const MIDDLE_EAST_TERMS = ["伊朗", "波斯", "土耳其", "阿拉伯", "埃及", "黎巴嫩", "叙利亚", "敘利亞"];

export const FILTER_PRESETS = {
  "全部": { id: "全部", type: "all", label: "全部" },
  "中国文学": {
    id: "中国文学",
    label: "中国文学",
    cultureRegion: ["中国"],
    domain: ["文学"],
    categoryAny: LITERATURE_CATEGORIES
  },
  "中国思想": {
    id: "中国思想",
    label: "中国思想",
    cultureRegion: ["中国"],
    domain: ["思想", "哲学", "学术"]
  },
  "西方文学": {
    id: "西方文学",
    label: "西方文学",
    civilizationRegion: WESTERN_CIVILIZATIONS,
    domain: ["文学"]
  },
  "西方哲学": {
    id: "西方哲学",
    label: "西方哲学",
    civilizationRegion: ["欧洲", "北美"],
    domain: ["哲学", "思想"]
  },
  "世界文学": {
    id: "世界文学",
    label: "世界文学",
    domain: ["文学"]
  },
  "世界思想": {
    id: "世界思想",
    label: "世界思想",
    domain: ["哲学", "思想", "学术"]
  }
};

export const FILTER_ORDER = Object.keys(FILTER_PRESETS);

export const ROUTE_FILTER_MAP = {
  "east-west-dialogue": "全部",
  "oriental-thought": "中国思想",
  "chinese-literature": "中国文学",
  "western-philosophy": "西方哲学",
  "world-literature": "世界文学",
  "modernism": "世界文学",
  "civilization-border": "全部"
};

export const FILTER_ROUTE_MAP = {
  "全部": "east-west-dialogue",
  "中国文学": "chinese-literature",
  "中国思想": "oriental-thought",
  "西方文学": "world-literature",
  "西方哲学": "western-philosophy",
  "世界文学": "world-literature",
  "世界思想": "western-philosophy"
};

export function normalizePersonaTaxonomy(persona = {}) {
  const category = normalizeCategoryList(persona.category || persona.primaryCategory);
  const taxonomyText = [
    persona.birthCountry,
    persona.nationality,
    persona.culturalRegion,
    persona.cultureRegion,
    persona.culturalIdentity,
    persona.identity,
    persona.shortRole
  ].filter(Boolean).join(" ");
  const domainText = [
    taxonomyText,
    persona.summary,
    persona.displayName,
    persona.name,
    persona.works?.join(" ")
  ].filter(Boolean).join(" ");
  const cultureRegion = persona.cultureRegion || inferCultureRegion(persona, taxonomyText);
  const civilizationRegion = persona.civilizationRegion || inferCivilizationRegion(cultureRegion, persona, taxonomyText);
  const domain = normalizeDomain(persona.domain, category, domainText);
  return {
    ...persona,
    birthCountry: persona.birthCountry || inferBirthCountry(persona, taxonomyText),
    cultureRegion,
    civilizationRegion,
    domain,
    category: category[0] || persona.category || "",
    categoryList: category,
    primaryCategory: persona.primaryCategory || category[0] || persona.category || ""
  };
}

export function applyFilterPreset(personas, presetId = "全部") {
  const preset = FILTER_PRESETS[presetId] || FILTER_PRESETS["全部"];
  const normalized = personas.map(normalizePersonaTaxonomy);
  if (preset.type === "all") return normalized;
  return normalized.filter((persona) => matchesPreset(persona, preset));
}

export function matchesPreset(persona, preset) {
  const normalized = normalizePersonaTaxonomy(persona);
  if (preset.cultureRegion && !preset.cultureRegion.includes(normalized.cultureRegion)) return false;
  if (preset.civilizationRegion && !preset.civilizationRegion.includes(normalized.civilizationRegion)) return false;
  if (preset.domain && !preset.domain.some((item) => normalized.domain.includes(item))) return false;
  const categories = normalized.categoryList || normalizeCategoryList(normalized.category);
  if (preset.categoryAny && !preset.categoryAny.some((item) => categories.includes(item))) return false;
  if (preset.id === "中国文学" && !isChineseLiteraturePersona(normalized)) return false;
  return true;
}

export function isChineseLiteraturePersona(persona) {
  const normalized = normalizePersonaTaxonomy(persona);
  const text = [
    normalized.birthCountry,
    normalized.nationality,
    normalized.culturalRegion,
    normalized.cultureRegion,
    normalized.identity,
    normalized.shortRole
  ].filter(Boolean).join(" ");
  const isChina = normalized.cultureRegion === "中国" || hasExplicitChinaSignal(text);
  const explicitlyElsewhere = containsAny(text, NON_CHINA_EXCLUSION_TERMS) && !hasExplicitChinaSignal(text);
  const categories = normalized.categoryList || normalizeCategoryList(normalized.category);
  return isChina && !explicitlyElsewhere && normalized.domain.includes("文学") && categories.some((item) => LITERATURE_CATEGORIES.includes(item));
}

export function personaSearchText(persona, indexed) {
  return (indexed?.text || [
    persona.displayName,
    persona.name,
    persona.nameZh,
    persona.nameEn,
    persona.nameOriginal,
    persona.latinName,
    normalizeCategoryList(persona.category).join(" "),
    persona.identity,
    persona.shortRole,
    persona.summary,
    persona.birthCountry,
    persona.cultureRegion,
    persona.civilizationRegion,
    Array.isArray(persona.domain) ? persona.domain.join(" ") : persona.domain,
    persona.works?.join(" "),
    persona.keywords?.join(" ")
  ].filter(Boolean).join(" ")).toLowerCase();
}

export function normalizeCategoryList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function normalizeDomain(value, category, text) {
  const domain = Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
  if (category.some((item) => LITERATURE_CATEGORIES.includes(item)) || /文学|文學|作家|诗|詩|词|詞|小说|小說|剧作|劇作|戏曲|戲曲|散文|批评|批評/.test(text)) {
    domain.push("文学");
  }
  if (category.some((item) => THOUGHT_CATEGORIES.includes(item)) || /哲学|哲學|思想|学者|學者|教育|伦理|倫理|政治人物/.test(text)) {
    domain.push("思想");
  }
  if (/哲学|哲學/.test(text) || category.includes("哲学家")) domain.push("哲学");
  if (/学者|學者|学术|學術|教育/.test(text) || category.includes("学者")) domain.push("学术");
  return Array.from(new Set(domain.length ? domain : ["文学"]));
}

function inferBirthCountry(persona, text) {
  if (persona.birthCountry) return persona.birthCountry;
  if (hasExplicitChinaSignal(text)) return "中国";
  if (containsAny(text, JAPAN_TERMS)) return "日本";
  if (containsAny(text, KOREA_TERMS)) return "韩国";
  if (containsAny(text, SOUTH_ASIA_TERMS)) return SOUTH_ASIA_TERMS.find((term) => text.includes(term));
  if (containsAny(text, MIDDLE_EAST_TERMS)) return MIDDLE_EAST_TERMS.find((term) => text.includes(term));
  const matched = [...NORTH_AMERICA_TERMS, ...LATIN_AMERICA_TERMS, ...EUROPE_TERMS].find((term) => text.includes(term));
  return matched || null;
}

function inferCultureRegion(persona, text) {
  const region = String(persona.culturalRegion || "").toLowerCase();
  if (region.includes("east-asia-china")) return "中国";
  if (region.includes("east-asia-japan")) return "日本";
  if (region.includes("east-asia-korea")) return "韩国";
  if (region.includes("south-asia")) return "南亚";
  if (region.includes("middle-east") || region.includes("west-asia") || region.includes("persian")) return "西亚";
  if (region.includes("latin-america")) return "拉美";
  if (region.includes("north-america")) return "北美";
  if (region.includes("western-europe") || region.includes("eastern-europe") || region.includes("europe")) return "欧洲";
  if (hasExplicitChinaSignal(text)) return "中国";
  if (containsAny(text, NON_CHINA_EXCLUSION_TERMS)) {
    if (containsAny(text, JAPAN_TERMS)) return "日本";
    if (containsAny(text, NORTH_AMERICA_TERMS)) return "北美";
    if (containsAny(text, LATIN_AMERICA_TERMS)) return "拉美";
    if (containsAny(text, EUROPE_TERMS)) return "欧洲";
  }
  if (containsAny(text, SOUTH_ASIA_TERMS)) return "南亚";
  if (containsAny(text, MIDDLE_EAST_TERMS)) return "西亚";
  if (containsAny(text, JAPAN_TERMS)) return "日本";
  if (containsAny(text, KOREA_TERMS)) return "韩国";
  const lng = Number(persona.visualLng ?? persona.birthLng);
  if (Number.isFinite(lng)) {
    if (lng >= 73 && lng <= 135) return "东亚";
    if (lng > 135 && lng <= 150) return "日本";
    if (lng < -30 && lng > -125) return lng < -80 ? "北美" : "拉美";
    if (lng >= -20 && lng <= 45) return "欧洲";
  }
  return "世界";
}

function inferCivilizationRegion(cultureRegion, persona, text) {
  if (cultureRegion === "中国" || cultureRegion === "日本" || cultureRegion === "韩国" || cultureRegion === "东亚") return "东亚";
  if (cultureRegion === "南亚") return "南亚";
  if (cultureRegion === "西亚") return "西亚";
  if (cultureRegion === "北美") return "北美";
  if (cultureRegion === "拉美") return "拉美";
  if (cultureRegion === "欧洲") return "欧洲";
  if (containsAny(text, SOUTH_ASIA_TERMS)) return "南亚";
  if (containsAny(text, MIDDLE_EAST_TERMS)) return "西亚";
  if (containsAny(text, NORTH_AMERICA_TERMS)) return "北美";
  if (containsAny(text, LATIN_AMERICA_TERMS)) return "拉美";
  if (containsAny(text, EUROPE_TERMS)) return "欧洲";
  const lng = Number(persona.visualLng ?? persona.birthLng);
  if (Number.isFinite(lng)) {
    if (lng >= 70 && lng <= 150) return "东亚";
    if (lng < -30 && lng > -125) return lng < -80 ? "北美" : "拉美";
    if (lng >= -20 && lng <= 45) return "欧洲";
  }
  return "世界";
}

function containsAny(text, terms) {
  return terms.some((term) => String(text || "").includes(term));
}

function hasExplicitChinaSignal(text) {
  const value = String(text || "");
  return containsAny(value, EXPLICIT_CHINA_TERMS) || CHINESE_HISTORICAL_PERIOD_PATTERN.test(value);
}
