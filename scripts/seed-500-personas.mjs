import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { getCulturalRegion, resolveVisualCoordinates } from "../src/utils/geoLayout.js";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "src", "data");
const AVATAR_DIR = path.join(ROOT, "public", "assets", "avatars");
const TARGET_TOTAL = 500;
const RETRIEVED_AT = "2026-07-04";
const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";
const CACHE_VERSION = 2;

const OCCUPATION_BATCHES = [
  { id: "Q6625963", category: "小说家", limit: 520 },
  { id: "Q15949613", category: "小说家", limit: 360 },
  { id: "Q18844224", category: "小说家", limit: 260 },
  { id: "Q4853732", category: "文学家", limit: 220 },
  { id: "Q49757", category: "诗人", limit: 520 },
  { id: "Q214917", category: "剧作家", limit: 320 },
  { id: "Q4964182", category: "哲学家", limit: 520 },
  { id: "Q4263842", category: "学者", limit: 260 },
  { id: "Q11774202", category: "文学家", limit: 360 },
  { id: "Q201788", category: "学者", limit: 260 },
  { id: "Q14467526", category: "学者", limit: 220 },
  { id: "Q333634", category: "文学家", limit: 260 }
];

const BAD_OCCUPATIONS = new Set([
  "Q33999",
  "Q177220",
  "Q2526255",
  "Q82955",
  "Q169470",
  "Q170790",
  "Q2066131",
  "Q43845",
  "Q28389",
  "Q82594",
  "Q42973",
  "Q36834",
  "Q639669",
  "Q1930187",
  "Q947873",
  "Q1028181",
  "Q1281618",
  "Q10800557",
  "Q15981151"
]);

const ERA_THEMES = [
  "春秋",
  "战国",
  "秦汉",
  "魏晋南北朝",
  "唐代",
  "宋代",
  "元代",
  "明代",
  "清代",
  "现代中国",
  "当代中国",
  "古希腊",
  "古罗马晚期",
  "中世纪",
  "文艺复兴",
  "17世纪",
  "启蒙时代",
  "19世纪",
  "现代主义时期",
  "20世纪思想",
  "20世纪文学"
];

const CATEGORY_KEYWORDS = {
  文学家: ["文学", "文本", "时代", "语言", "精神"],
  诗人: ["诗歌", "意象", "声音", "抒情", "时间"],
  小说家: ["小说", "叙事", "人物", "社会", "记忆"],
  剧作家: ["戏剧", "舞台", "冲突", "对白", "命运"],
  哲学家: ["哲学", "概念", "判断", "存在", "伦理"],
  思想家: ["思想", "公共", "秩序", "批判", "历史"],
  学者: ["学术", "文献", "方法", "传统", "解释"]
};

const CATEGORY_IDENTITY = {
  文学家: "文学家",
  诗人: "诗人",
  小说家: "小说家",
  剧作家: "剧作家",
  哲学家: "哲学家",
  思想家: "思想家",
  学者: "学者"
};

const BATCH_TARGETS = [150, 250, 350, 500];

await main();

async function main() {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });

  const currentPersonas = readJson("personas.enriched.json");
  const basePersonas = currentPersonas.filter((persona) => !persona.importBatch);
  const baseIds = new Set(basePersonas.map((persona) => persona.id));
  const personas = basePersonas;
  const worksCatalog = readJson("works-catalog.json").filter((work) => baseIds.has(work.personaId));
  const worksEnriched = readJson("works.enriched.json").filter((work) => !work.authorId || baseIds.has(work.authorId));
  const copy = readJson("curation-copy.json");
  const avatarManifest = readJson("avatar-manifest.json").filter((entry) => baseIds.has(entry.personaId));

  const needed = TARGET_TOTAL - personas.length;
  if (needed <= 0) throw new Error(`Current persona count ${personas.length} is over ${TARGET_TOTAL}.`);

  const candidates = await loadCandidates();
  const existingNames = new Set(
    personas.flatMap((persona) => [persona.id, persona.name, persona.displayName, persona.latinName].filter(Boolean).map(normalizeKey))
  );
  const existingWorkKeys = new Set(worksCatalog.map((work) => `${work.personaId}::${work.title}`));
  const selected = [];

  for (const candidate of candidates) {
    if (selected.length >= needed) break;
    if (!isUsableCandidate(candidate)) continue;
    const id = uniquePersonaId(candidate, existingNames, selected);
    const nameKeys = [id, candidate.nameZh, candidate.nameEn].filter(Boolean).map(normalizeKey);
    if (nameKeys.some((key) => existingNames.has(key))) continue;
    selected.push({ ...candidate, id });
  }

  if (selected.length < needed) {
    throw new Error(`Only found ${selected.length} usable candidates; need ${needed}.`);
  }

  const allPersonas = [...personas];
  const newPersonas = selected.map((candidate, index) => {
    const persona = buildPersona(candidate, allPersonas, index);
    allPersonas.push(persona);
    return persona;
  });

  const newWorksCatalog = [];
  const newWorksEnriched = [];
  for (const persona of newPersonas) {
    const title = persona.works[0];
    const key = `${persona.id}::${title}`;
    if (existingWorkKeys.has(key)) continue;
    const catalogEntry = buildWorkCatalog(persona);
    const enrichedEntry = buildEnrichedWork(persona, catalogEntry, allPersonas);
    newWorksCatalog.push(catalogEntry);
    newWorksEnriched.push(enrichedEntry);
    existingWorkKeys.add(key);
  }

  const retainedEditorial = Object.fromEntries(
    Object.entries(copy.personaEditorial || {}).filter(([id]) => baseIds.has(id))
  );
  const nextCopy = {
    ...copy,
    personaEditorial: {
      ...retainedEditorial,
      ...Object.fromEntries(newPersonas.map((persona) => [persona.id, buildEditorial(persona)]))
    }
  };

  const nextAvatarManifest = [
    ...avatarManifest.filter((entry) => entry?.personaId),
    ...newPersonas.map((persona) => ({
      personaId: persona.id,
      displayName: persona.displayName,
      status: "seal-fallback",
      avatarUrl: null,
      avatarLocal: persona.avatarLocal,
      preferredSource: persona.avatarCredit.sourceUrl,
      suggestedSources: persona.references,
      suggestedSearch: `${persona.latinName || persona.displayName} portrait Wikimedia Commons`,
      avatarCredit: persona.avatarCredit,
      notes: "No verified public portrait is embedded; the local file is a sober seal-style fallback, not a generated face."
    }))
  ];

  for (const persona of newPersonas) writeSealAvatar(persona);

  const resolvedPersonas = resolveVisualCoordinates(allPersonas);
  writeJson("personas.enriched.json", resolvedPersonas);
  writeJson("works-catalog.json", [...worksCatalog, ...newWorksCatalog]);
  writeJson("works.enriched.json", [...worksEnriched, ...newWorksEnriched]);
  writeJson("curation-copy.json", nextCopy);
  writeJson("avatar-manifest.json", nextAvatarManifest);
  writeJson("persona-candidates.500.json", {
    retrievedAt: RETRIEVED_AT,
    source: "Wikidata SPARQL, filtered locally for literary/philosophical/scholarly display",
    batchTargets: BATCH_TARGETS,
    added: newPersonas.map((persona) => ({
      id: persona.id,
      name: persona.displayName,
      latinName: persona.latinName,
      category: persona.category,
      work: persona.works[0],
      sourceUrl: persona.sourceUrl
    }))
  });

  console.log(`added ${newPersonas.length} personas; total ${allPersonas.length}`);
  console.log(`added ${newWorksCatalog.length} catalog works and ${newWorksEnriched.length} enriched work guides`);
}

async function loadCandidates() {
  const cacheFile = path.join(DATA_DIR, "persona-candidates.raw.wikidata.json");
  if (fs.existsSync(cacheFile)) {
    const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    if (cached?.version === CACHE_VERSION && Array.isArray(cached?.candidates) && cached.candidates.length >= 450) {
      console.log(`using cached Wikidata candidates: ${cached.candidates.length}`);
      return cached.candidates;
    }
  }

  const all = [];
  for (const batch of OCCUPATION_BATCHES) {
    console.log(`fetching Wikidata occupation ${batch.id}...`);
    const rows = await queryOccupation(batch);
    all.push(...rows.map((row) => ({ ...row, category: batch.category, occupationQid: batch.id })));
    await delay(900);
  }

  const candidates = dedupeCandidates(all);
  fs.writeFileSync(
    cacheFile,
    `${JSON.stringify({ version: CACHE_VERSION, retrievedAt: RETRIEVED_AT, candidates }, null, 2)}\n`,
    "utf8"
  );
  return candidates;
}

async function queryOccupation(batch) {
  const badValues = Array.from(BAD_OCCUPATIONS)
    .map((id) => `wd:${id}`)
    .join(" ");
  const query = `
SELECT DISTINCT ?person ?personLabel ?personEnLabel ?birth ?death ?placeLabel ?coord ?countryLabel ?work ?workLabel ?articleZh ?articleEn WHERE {
  ?person wdt:P31 wd:Q5;
          wdt:P106 wd:${batch.id};
          wdt:P19 ?place;
          wdt:P569 ?birth;
          wdt:P800 ?work.
  ?place wdt:P625 ?coord.
  MINUS { VALUES ?badOccupation { ${badValues} } ?person wdt:P106 ?badOccupation. }
  ?person rdfs:label ?personLabel FILTER(LANG(?personLabel) = "zh")
  OPTIONAL { ?person rdfs:label ?personEnLabel FILTER(LANG(?personEnLabel) = "en") }
  OPTIONAL { ?person wdt:P570 ?death. }
  OPTIONAL { ?person wdt:P27 ?country. }
  OPTIONAL { ?articleZh schema:about ?person; schema:isPartOf <https://zh.wikipedia.org/>. }
  OPTIONAL { ?articleEn schema:about ?person; schema:isPartOf <https://en.wikipedia.org/>. }
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "zh,en".
    ?place rdfs:label ?placeLabel.
    ?country rdfs:label ?countryLabel.
    ?work rdfs:label ?workLabel.
  }
}
LIMIT ${batch.limit}`;
  const url = `${WIKIDATA_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const json = await getJsonWithRetry(url);
  return json.results.bindings.map((binding) => normalizeBinding(binding));
}

async function getJsonWithRetry(url, attempts = 4) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await getJson(url);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const waitMs = 1200 * attempt;
      console.warn(`Wikidata request failed (${error.message}); retrying in ${waitMs}ms...`);
      await delay(waitMs);
    }
  }
  throw lastError;
}

function normalizeBinding(binding) {
  const coord = parsePoint(binding.coord?.value);
  return {
    wikidataId: binding.person?.value?.split("/").pop(),
    wikidataUrl: binding.person?.value,
    nameZh: cleanLabel(binding.personLabel?.value),
    nameEn: cleanLabel(binding.personEnLabel?.value),
    birthYear: parseYear(binding.birth?.value),
    deathYear: parseYear(binding.death?.value),
    birthplace: cleanLabel(binding.placeLabel?.value),
    birthLat: coord?.lat,
    birthLng: coord?.lng,
    country: cleanLabel(binding.countryLabel?.value),
    workTitle: cleanLabel(binding.workLabel?.value),
    workUrl: binding.work?.value,
    articleZh: binding.articleZh?.value,
    articleEn: binding.articleEn?.value
  };
}

function dedupeCandidates(rows) {
  const byPerson = new Map();
  for (const row of rows) {
    if (!row.wikidataId || !row.nameZh || !row.workTitle) continue;
    const current = byPerson.get(row.wikidataId);
    if (!current) {
      byPerson.set(row.wikidataId, row);
      continue;
    }
    const currentScore = candidateSourceScore(current);
    const nextScore = candidateSourceScore(row);
    if (nextScore > currentScore) byPerson.set(row.wikidataId, { ...current, ...row });
  }
  return Array.from(byPerson.values()).sort((a, b) => candidateSortScore(b) - candidateSortScore(a));
}

function candidateSortScore(candidate) {
  const source = candidateSourceScore(candidate);
  const categoryWeight = { 小说家: 7, 诗人: 7, 哲学家: 7, 剧作家: 6, 文学家: 5, 学者: 4 }[candidate.category] || 3;
  const eraWeight = candidate.birthYear && candidate.birthYear < 1980 ? 2 : 0;
  return source + categoryWeight + eraWeight;
}

function candidateSourceScore(candidate) {
  return (candidate.articleZh ? 4 : 0) + (candidate.articleEn ? 2 : 0) + (candidate.country ? 1 : 0);
}

function isUsableCandidate(candidate) {
  if (!candidate.nameZh || !candidate.workTitle || !candidate.birthplace) return false;
  if (!Number.isFinite(candidate.birthLat) || !Number.isFinite(candidate.birthLng)) return false;
  if (!candidate.birthYear && candidate.birthYear !== 0) return false;
  if (candidate.nameEn && /^[QS]\d+$/i.test(candidate.nameEn)) return false;
  if (candidate.nameZh && /^[QS]\d+$/i.test(candidate.nameZh)) return false;
  if (/电视剧|电影|专辑|歌曲|角色|虚构|神话|漫画/.test(candidate.workTitle)) return false;
  if (
    /YouTuber|网红|主播|主持|歌手|演员|音乐家|作曲家|建筑师|工程师|程序|计算机|企业家|政治家|政治人物|模特|运动员|足球|篮球|设计师|摄影师|导演|漫画家|画家|雕塑家|记者|新聞/.test(
      [candidate.nameZh, candidate.nameEn, candidate.country, candidate.workTitle].join(" ")
    )
  ) {
    return false;
  }
  return true;
}

function buildPersona(candidate, existingPersonas, index) {
  const category = candidate.category;
  const country = candidate.country || inferCountry(candidate.birthplace) || "资料未详";
  const era = chooseEra(candidate.birthYear, country);
  const workTitle = candidate.workTitle;
  const id = candidate.id;
  const sourceUrl = candidate.articleZh || candidate.articleEn || candidate.wikidataUrl;
  const relatedPersonas = pickRelated(existingPersonas, category, country);
  const keywords = uniqueValues([
    ...(CATEGORY_KEYWORDS[category] || CATEGORY_KEYWORDS.文学家),
    country,
    era,
    movementFor(category, era)
  ]).slice(0, 6);
  const identity = `${country}${era}${CATEGORY_IDENTITY[category] || category}`;
  const birthLabel = `${candidate.birthplace}${country && !candidate.birthplace.includes(country) ? `，${country}` : ""}`;
  const avatarLocal = `/assets/avatars/${id}.svg`;
  const primaryWorkId = `${id}-${slugify(workTitle).slice(0, 34) || "work"}`;
  const biography = limitChineseText(buildBiography(candidate, category, era, country, workTitle, birthLabel), 218);
  const lifeSummary = limitChineseText(buildLifeSummary(candidate, category, era, country, workTitle, birthLabel), 300);
  const personaSummary = limitChineseText(buildPersonaSummary(candidate, category, era, workTitle), 176);

  return {
    id,
    name: candidate.nameZh,
    nameZh: candidate.nameZh,
    nameOriginal: candidate.nameEn || candidate.nameZh,
    nameEn: candidate.nameEn || candidate.nameZh,
    displayName: candidate.nameZh,
    latinName: candidate.nameEn || candidate.nameZh,
    category,
    primaryCategory: category,
    categories: uniqueValues([category, category === "哲学家" ? "思想家" : null].filter(Boolean)),
    identity,
    nationality: country,
    birthYear: candidate.birthYear,
    deathYear: candidate.deathYear ?? null,
    birthplace: birthLabel,
    birthPlace: birthLabel,
    birthCountry: country,
    birthLat: round(candidate.birthLat),
    birthLng: round(candidate.birthLng),
    visualLat: round(candidate.birthLat),
    visualLng: round(candidate.birthLng),
    geoConfidence: "medium",
    era,
    school: schoolFor(category, era),
    movement: movementFor(category, era),
    shortRole: identity,
    avatarUrl: null,
    avatarLocal,
    avatarSource: "文渊印章式占位头像",
    avatarLicense: "Local fallback seal; not a real portrait.",
    summary: `${candidate.nameZh}是${identity}，可从《${workTitle}》进入其作品与思想脉络。`,
    biography,
    bio: biography,
    lifeSummary,
    works: [workTitle],
    representativeWorks: [workTitle],
    primaryWorkId,
    personaSummary,
    whisper: buildEditorialWhisper(candidate, index),
    whisperSub: `从《${workTitle}》回望其精神来路`,
    keywords,
    relatedPersonas,
    references: uniqueValues([sourceUrl, candidate.wikidataUrl, candidate.workUrl].filter(Boolean)),
    sourceRefs: [
      {
        name: "Wikidata",
        url: candidate.wikidataUrl,
        type: "wikidata",
        retrievedAt: RETRIEVED_AT
      },
      ...(sourceUrl && sourceUrl !== candidate.wikidataUrl
        ? [{ name: sourceUrl.includes("wikipedia") ? "Wikipedia" : "Reference", url: sourceUrl, type: "encyclopedia", retrievedAt: RETRIEVED_AT }]
        : [])
    ],
    sourceUrl,
    dataQuality: {
      level: "partial",
      biography: "partial",
      works: "partial",
      avatar: "fallback",
      birthplace: "partial",
      notes: "新增条目由 Wikidata 基础元数据生成，出生地、代表作和身份分类需后续人工抽检。"
    },
    avatarCredit: {
      sourceName: "文渊印章式占位头像",
      sourceUrl: `local://wenyuan/avatar-fallback/${id}`,
      license: "Local fallback seal; not a real portrait.",
      needsReview: false
    },
    importBatch: expansionBatch(existingPersonas.length + index + 1),
    wikidataId: candidate.wikidataId
  };
}

function buildBiography(candidate, category, era, country, workTitle, birthLabel) {
  return `${candidate.nameZh}出生于${birthLabel}，是${country}${era}的${CATEGORY_IDENTITY[category] || category}。条目以其公开可核查的出生地、身份和代表作《${workTitle}》为基础，保留较克制的生平说明：他或她的意义主要体现在文本、概念或叙事方式如何进入同代文化，并在后来的阅读中持续改变人们理解自我、社会与历史的角度。`;
}

function buildLifeSummary(candidate, category, era, country, workTitle, birthLabel) {
  return `${candidate.nameZh}的档案从${birthLabel}展开，放入${country}${era}的文学和思想语境中理解。当前版本优先呈现出生地、年代、代表作与阅读入口，不展开未经复核的轶事。围绕《${workTitle}》，读者可以先把握其写作或思考的基本方向，再通过来源链接继续核对版本、传记和作品目录。`;
}

function buildPersonaSummary(candidate, category, era, workTitle) {
  const mode =
    category === "哲学家"
      ? "以概念辨析和持续追问维持判断的锋利"
      : category === "诗人"
        ? "以凝练意象保存情感、时间与声音的细部"
        : category === "剧作家"
          ? "把人物关系放进舞台冲突，让选择显露伦理重量"
          : "在叙事、形式和时代经验之间寻找可靠的表达位置";
  return `${candidate.nameZh}的精神气质适合从《${workTitle}》进入：${mode}。在人物档案中，不宜把其简化为单一标签，而应观察作品怎样处理个人处境、公共经验和语言秩序。这样的阅读方式能让${era}的背景不只是年代说明，而成为理解其人格结构与创作姿态的线索。`;
}

function buildWorkCatalog(persona) {
  return {
    workId: persona.primaryWorkId,
    personaId: persona.id,
    title: persona.works[0],
    author: persona.displayName,
    copyrightStatus: "unknown",
    availability: "summary-only",
    contentPath: null,
    sourceUrl: persona.references.find((url) => url.includes("wikidata.org")) || persona.sourceUrl,
    sourceName: "Wikidata",
    license: "Metadata only; full text is not embedded.",
    language: inferLanguage(persona),
    summary: buildWorkIntro(persona),
    excerpt: buildWorkReadingGuide(persona)
  };
}

function buildEnrichedWork(persona, catalogEntry, allPersonas) {
  const sourceUrl = catalogEntry.sourceUrl;
  const relatedPersonas = uniqueValues([persona.id, ...(persona.relatedPersonas || [])]).filter((id) =>
    allPersonas.some((item) => item.id === id)
  );
  const themes = uniqueValues([...persona.keywords, persona.category, persona.school, persona.movement]).filter(Boolean).slice(0, 8);
  return {
    id: catalogEntry.workId,
    workId: catalogEntry.workId,
    title: catalogEntry.title,
    authorId: persona.id,
    authorName: persona.displayName,
    originalTitle: catalogEntry.title,
    era: persona.era,
    genre: genreFor(persona.category),
    language: catalogEntry.language,
    firstPublished: null,
    compositionPeriod: null,
    copyrightStatus: "copyright_unknown_or_restricted",
    license: "Metadata and original guide only",
    licenseNote: "This project embeds only an original reading guide and source pointers for this entry.",
    sourceConfidence: "medium",
    tags: themes.slice(0, 5),
    summary: buildWorkIntro(persona),
    shortIntro: buildWorkIntro(persona),
    workEpigraph: buildWorkEpigraph(persona),
    background: buildWorkBackground(persona),
    themes,
    readingGuide: buildWorkReadingGuide(persona),
    whyItMatters: buildWhyItMatters(persona),
    personaConnection: buildPersonaConnection(persona),
    relatedTopics: themes,
    furtherReadingNote: buildFurtherReading(persona),
    relatedPersonas,
    legalFullTextSources: [],
    catalogSources: [source("Wikidata", sourceUrl, "metadata_or_catalog", "Metadata and authority-control reference for manual review.")],
    references: [source("Wikidata", sourceUrl, "metadata_or_catalog", "Metadata and authority-control reference for manual review.")],
    excerpts: [],
    dataQuality: {
      metadata: "partial",
      summary: "partial",
      copyright: "needsReview",
      fullText: "unavailable",
      notes: "Guide text is original project copy; bibliographic metadata should be manually sampled before publication."
    },
    displayMode: "ai_guide"
  };
}

function buildWorkIntro(persona) {
  const title = persona.works[0];
  return `《${title}》是进入${persona.displayName}作品与思想世界的一处入口。当前导读以作品题名、作者身份、时代背景和关键词为基础，帮助读者先辨认其问题意识：文本如何组织人物、概念、情感或历史经验，又如何把个人处境放回更宽的文化结构中。阅读时可把它看作一张索引图，而不是代替原书的摘要。`;
}

function buildWorkBackground(persona) {
  return `这部作品应放在${persona.era}与${persona.nationality}文学思想语境中理解。${persona.displayName}的写作或思考并非孤立发生，而是与语言传统、社会变化、知识制度和读者期待相互牵连。背景阅读的重点，不在堆叠年代材料，而在观察作品为什么会在某个历史环境中变得尖锐，并怎样被后来的读者不断重新解释。`;
}

function buildWorkReadingGuide(persona) {
  const title = persona.works[0];
  return `阅读《${title}》时，可以先抓住${persona.keywords.slice(0, 3).join("、")}这些线索，再回到作者生平和时代处境。不要急于用一句话概括作品价值，宜观察它的叙述方式、概念安排、情感节奏或论证路径如何逐步展开。若要继续深入，应优先核对可靠版本、图书馆目录和学术导读。`;
}

function buildWhyItMatters(persona) {
  return `《${persona.works[0]}》的重要性在于，它为理解${persona.displayName}的精神位置提供了相对集中的入口。作品不只呈现主题，也呈现一种面对世界的方式：怎样选择语言，怎样安排经验，怎样在个人生命与公共问题之间建立联系。由此进入，可以把单个作者放回文学史、思想史和跨文化阅读的长线之中。`;
}

function buildPersonaConnection(persona) {
  return `这部作品与${persona.displayName}作为${persona.identity}的形象紧密相连。它让档案中的关键词不再只是标签，而成为可阅读的精神纹理：${persona.keywords.slice(0, 4).join("、")}在作品中获得具体形态。读者可借此观察作者如何把自身时代、表达方式和人格姿态组织成一套可继续追问的文本经验。`;
}

function buildFurtherReading(persona) {
  return `后续阅读可从${persona.displayName}的其他作品、传记资料、图书馆目录和相关文学思想史章节展开。对现代或当代作品，应只使用合法版本与可靠书目信息；对古典作品，也需要区分原文、公版版本、现代整理本和译本之间的权利差异。`;
}

function buildWorkEpigraph(persona) {
  const token = persona.keywords[0] || "文字";
  return `沿着${token}的微光，进入《${persona.works[0]}》的精神现场。`;
}

function buildEditorial(persona) {
  return {
    oneLine: `以${shortToken(persona.keywords[0])}照见时代心纹`,
    whisper: persona.whisper || buildEditorialWhisper({ workTitle: persona.works[0], nameZh: persona.displayName }, 0)
  };
}

function buildEditorialWhisper(candidate, index) {
  const token = shortToken(candidate.workTitle || candidate.nameZh || "文字");
  const patterns = [
    `以${token}微光，照见幽深来路。`,
    `在${token}深处，听见时代回声。`,
    `把${token}留给清醒而沉静的人。`,
    `循${token}而行，抵达人心暗处。`,
    `由${token}入夜，见时代微明。`
  ];
  return patterns[index % patterns.length];
}

function writeSealAvatar(persona) {
  const initials = shortToken(persona.displayName).slice(0, 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="320" viewBox="0 0 256 320" role="img" aria-label="${escapeXml(persona.displayName)} seal avatar">
  <defs>
    <radialGradient id="g" cx="50%" cy="28%" r="72%">
      <stop offset="0" stop-color="#e8dfc8" stop-opacity=".42"/>
      <stop offset=".46" stop-color="#123a35" stop-opacity=".86"/>
      <stop offset="1" stop-color="#050b0a"/>
    </radialGradient>
  </defs>
  <rect width="256" height="320" fill="#06100f"/>
  <rect x="18" y="18" width="220" height="284" rx="16" fill="url(#g)" stroke="#b6843f" stroke-opacity=".62" stroke-width="2"/>
  <rect x="34" y="36" width="188" height="248" rx="10" fill="none" stroke="#e7dfc9" stroke-opacity=".18"/>
  <text x="128" y="168" text-anchor="middle" dominant-baseline="middle" fill="#efe6cf" font-size="72" font-family="KaiTi, STKaiti, serif">${escapeXml(initials)}</text>
  <text x="128" y="244" text-anchor="middle" fill="#d5b16b" fill-opacity=".72" font-size="18" letter-spacing="4" font-family="Microsoft YaHei, sans-serif">文渊</text>
</svg>`;
  fs.writeFileSync(path.join(AVATAR_DIR, `${persona.id}.svg`), svg, "utf8");
}

function pickRelated(personas, category, country) {
  const sameCountry = personas.find((persona) => persona.nationality === country)?.id;
  const sameCategory = personas.find((persona) => persona.category === category)?.id;
  return uniqueValues([sameCountry, sameCategory, personas[0]?.id].filter(Boolean)).slice(0, 3);
}

function source(name, url, type, notes) {
  return { name, sourceName: name, url, sourceUrl: url, type, notes, retrievedAt: RETRIEVED_AT };
}

function chooseEra(year, country = "") {
  if (country.includes("中国") || country.includes("中华") || country.includes("清朝") || country.includes("明朝")) {
    if (year < -475) return "春秋";
    if (year < -221) return "战国";
    if (year < 220) return "秦汉";
    if (year < 589) return "魏晋南北朝";
    if (year < 907) return "唐代";
    if (year < 1279) return "宋代";
    if (year < 1368) return "元代";
    if (year < 1644) return "明代";
    if (year < 1912) return "清代";
    if (year < 1949) return "现代中国";
    return "当代中国";
  }
  if (country.includes("希腊") && year < 300) return "古希腊";
  if ((country.includes("罗马") || country.includes("意大利")) && year < 600) return "古罗马晚期";
  if (country.includes("日本") && year < 1185) return "平安时代";
  if (year < 500) return "古罗马晚期";
  if (year < 1400) return "中世纪";
  if (year < 1650) return "文艺复兴";
  if (year < 1700) return "17世纪";
  if (year < 1800) return "启蒙时代";
  if (year < 1900) return "19世纪";
  if (year < 1945) return "现代主义时期";
  if (year < 2000) return "20世纪文学";
  return "20世纪思想";
}

function schoolFor(category, era) {
  if (category === "哲学家") return era.includes("20世纪") ? "现代思想" : "哲学传统";
  if (category === "学者") return "人文学术";
  if (category === "诗人") return "诗歌传统";
  if (category === "剧作家") return "戏剧传统";
  return "世界文学";
}

function movementFor(category, era) {
  if (era === "现代主义时期") return "现代主义";
  if (era === "启蒙时代") return "启蒙思想";
  if (era === "文艺复兴") return "文艺复兴";
  if (category === "哲学家") return "思想史";
  return "文学史";
}

function expansionBatch(countAfterInsert) {
  return BATCH_TARGETS.find((target) => countAfterInsert <= target) || TARGET_TOTAL;
}

function genreFor(category) {
  return {
    文学家: "文学作品",
    诗人: "诗歌",
    小说家: "小说",
    剧作家: "戏剧",
    哲学家: "哲学著作",
    思想家: "思想著作",
    学者: "学术著作"
  }[category] || "作品";
}

function inferLanguage(persona) {
  if (persona.nationality.includes("中国") || persona.nationality.includes("中华")) return "zh";
  if (persona.nationality.includes("日本")) return "ja";
  if (persona.nationality.includes("法国")) return "fr";
  if (persona.nationality.includes("德国") || persona.nationality.includes("奥地利") || persona.nationality.includes("瑞士")) return "de";
  if (persona.nationality.includes("俄罗斯")) return "ru";
  if (persona.nationality.includes("西班牙") || persona.nationality.includes("阿根廷") || persona.nationality.includes("哥伦比亚")) return "es";
  return "unknown";
}

function inferCountry(place) {
  if (/北京|上海|山东|浙江|江苏|河南|四川|湖南|湖北|广东|福建|陕西|山西/.test(place)) return "中国";
  if (/东京|京都|大阪/.test(place)) return "日本";
  return null;
}

function uniquePersonaId(candidate, existingNames, selected) {
  const base = slugify(candidate.nameEn || candidate.nameZh || candidate.wikidataId).replace(/^q\d+$/i, "") || candidate.wikidataId.toLowerCase();
  const used = new Set([...Array.from(existingNames), ...selected.map((item) => item.id)]);
  let id = base;
  let counter = 2;
  while (used.has(normalizeKey(id))) {
    id = `${base}-${counter}`;
    counter += 1;
  }
  return id;
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          Accept: "application/sparql-results+json",
          "User-Agent": "codex-shop-data-expansion/0.1 (local static atlas)"
        },
        timeout: 90000
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`Wikidata request failed ${response.statusCode}: ${body.slice(0, 500)}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.on("timeout", () => {
      request.destroy(new Error("Wikidata request timed out"));
    });
    request.on("error", reject);
  });
}

function parsePoint(value) {
  const match = String(value || "").match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
  if (!match) return null;
  return { lng: Number(match[1]), lat: Number(match[2]) };
}

function parseYear(value) {
  const match = String(value || "").match(/^(-?\d{1,6})/);
  return match ? Number(match[1]) : null;
}

function cleanLabel(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function shortToken(value) {
  const clean = String(value || "文字").replace(/[《》〈〉“”"'\s]/g, "");
  return Array.from(clean).slice(0, 4).join("") || "文字";
}

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/[\u4e00-\u9fff]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54);
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function limitChineseText(value, maxLength) {
  const chars = Array.from(String(value || "").trim());
  if (chars.length <= maxLength) return chars.join("");
  const clipped = chars.slice(0, maxLength - 1).join("");
  const sentenceEnd = Math.max(clipped.lastIndexOf("。"), clipped.lastIndexOf("；"));
  if (sentenceEnd >= Math.floor(maxLength * 0.62)) return clipped.slice(0, sentenceEnd + 1);
  return `${clipped.replace(/[，、；：,.:\s]+$/g, "")}。`;
}

function round(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(path.join(DATA_DIR, file), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

if (!ERA_THEMES.length) {
  throw new Error("Era themes are required.");
}
