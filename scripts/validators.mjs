import fs from "node:fs";
import path from "node:path";
import {
  coordinateDistanceDegrees,
  getCulturalRegion,
  resolveVisualCoordinates,
  validateCoordinateSpread,
  visualOffsetLimit
} from "../src/utils/geoLayout.js";
import { FILTER_PRESETS, applyFilterPreset, isChineseLiteraturePersona, normalizePersonaTaxonomy } from "../src/utils/filterPersonas.js";
import { buildSpinAlignedSurfaceRoute, spinRouteMetrics } from "../src/utils/spinAlignedRoute.js";
import { EARTH_MOTION_CONFIG } from "../src/config/earthMotionConfig.js";
import { DEFAULT_EARTH_VIEW } from "../src/config/defaultEarthView.js";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "src", "data");
const TARGET_PERSONA_COUNT = 500;
const ALLOWED_CATEGORIES = new Set(["文学家", "诗人", "小说家", "剧作家", "哲学家", "思想家", "学者"]);
const REQUIRED_PERSONA_FIELDS = [
  "id",
  "name",
  "displayName",
  "category",
  "identity",
  "summary",
  "biography",
  "works",
  "personaSummary",
  "keywords",
  "references",
  "birthLat",
  "birthLng",
  "visualLat",
  "visualLng",
  "culturalRegion",
  "avatarCredit",
  "dataQuality"
];
const QUALITY_LEVELS = new Set(["complete", "partial", "needsReview"]);
const QUALITY_STATUSES = new Set(["verified", "partial", "missing", "fallback"]);
const RELATION_TYPES = new Set(["influence", "dialogue", "contrast", "inheritance", "rebellion", "contemporary"]);
const RELATION_CONFIDENCE = new Set(["high", "medium", "needsReview"]);
const WORK_COPYRIGHT_STATUSES = new Set(["public-domain", "open-license", "protected", "unknown"]);
const WORK_AVAILABILITY = new Set(["embedded-full-text", "external-link", "summary-only", "pending"]);
const ENRICHED_WORK_COPYRIGHT_STATUSES = new Set([
  "public_domain",
  "licensed_or_open",
  "copyright_unknown_or_restricted"
]);
const ENRICHED_WORK_DISPLAY_MODES = new Set(["ai_guide", "guide_with_public_text", "public_domain_reference"]);
const ENRICHED_WORK_SOURCE_TYPES = new Set([
  "public_domain_or_open",
  "metadata_or_catalog",
  "catalog",
  "encyclopedia",
  "publisher",
  "official",
  "library",
  "public_domain",
  "open_license"
]);
const WORK_BANNED_SOURCE_TERMS = ["z-" + "library", "z" + "library", "shadow" + " library"];
const COPY_BANNED = ["GitHub live", "sourcePath", "README 路径", "README路径", "Agent", "框架", "模块", "自媒体", "爆款", "流量", "变现", "营销"];
const PERSONA_BANNED = ["自媒体", "大 V", "Agent", "EQ", "GitHub live", "sourcePath", "README"];
const WHISPER_BANNED = ["AI", "Agent", "Skill", "模块", "GitHub", "自媒体", "框架", "训练", "爆款", "流量", "变现", "营销"];
const GUIDE_PLACEHOLDER_TERMS = [
  "可" + "结合",
  "后续" + "将",
  "后续" + "补" + "充",
  "继续" + "补" + "充",
  "可靠资料" + "继续" + "补" + "充",
  "本条目先" + "保留基础作品说明",
  "暂无" + "简介",
  "待" + "补" + "充",
  "待" + "完善",
  "更多资料" + "后续补全",
  "暂不" + "内嵌正文",
  "授权" + "待复核",
  "全文授权" + "状态",
  "版权状态" + "尚未确认"
];
const AI_TRACE_TERMS = [
  "A" + "I" + " 导读",
  "A" + "I" + "生成",
  "A" + "I " + "生成",
  "本页由 " + "A" + "I" + " 生成",
  "模型" + "生成",
  "机器" + "生成"
];
const UI_TEXT_BANNED = [
  "GitHub live",
  "sourcePath",
  "README 路径",
  "README路径",
  "AI dashboard",
  "待" + "补" + "充",
  "授权" + "待复核",
  "全文授权" + "状态",
  "暂不" + "内嵌正文",
  "版权说明",
  "版权状态",
  "未确认授权",
  "不展示正文",
  "查看合法来源",
  "复制来源",
  "搜索作品导读",
  ...AI_TRACE_TERMS
];
const AVATAR_BANNED_HOSTS = ["randomuser.me", "dicebear.com", "thispersondoesnotexist.com", "generated.photos", "persondoesnotexist"];
const AVATAR_KINDS = new Set([
  "photo",
  "historical_portrait",
  "sculpture",
  "engraving",
  "museum_image",
  "pending_authentic_image"
]);
const AUTHENTIC_AVATAR_KINDS = new Set(["photo", "historical_portrait", "sculpture", "engraving", "museum_image"]);
const AVATAR_CONFIDENCE = new Set(["high", "medium", "low", "pending"]);
const TOUR_FAR_JUMP_KM = 6000;
const CHINA_BOUNDS = { latMin: 18, latMax: 54, lngMin: 73, lngMax: 135 };
const DISPUTED_CHINESE_IDS = new Set(["laozi", "zhuangzi", "xunzi", "li-bai", "guan-hanqing", "cao-xueqin", "zhu-xi"]);

export function validatePersonas() {
  const personas = readJson("personas.enriched.json");
  const excluded = readJson("excluded-personas.json");
  const errors = [];
  const ids = new Set();
  const resolvedPersonas = resolveVisualCoordinates(personas);
  const resolvedById = new Map(resolvedPersonas.map((persona) => [persona.id, persona]));
  const spread = validateCoordinateSpread(resolvedPersonas);

  if (!Array.isArray(personas) || personas.length !== TARGET_PERSONA_COUNT) {
    errors.push(`personas.enriched.json must contain exactly ${TARGET_PERSONA_COUNT} personas.`);
  }

  if (!Array.isArray(excluded) || excluded.length === 0) {
    errors.push("excluded-personas.json must contain excluded entries.");
  }

  for (const persona of personas) {
    for (const field of REQUIRED_PERSONA_FIELDS) {
      if (!(field in persona)) errors.push(`${persona.id || "unknown"} missing field: ${field}`);
    }

    if (!persona.id || ids.has(persona.id)) errors.push(`duplicate or empty persona id: ${persona.id}`);
    ids.add(persona.id);

    if (!ALLOWED_CATEGORIES.has(persona.category)) {
      errors.push(`${persona.id} has invalid category: ${persona.category}`);
    }

    const expectedRegion = getCulturalRegion(persona);
    if (persona.culturalRegion !== expectedRegion) {
      errors.push(`${persona.id} culturalRegion should be ${expectedRegion}, got ${persona.culturalRegion}.`);
    }
    if (expectedRegion === "east-asia-china") {
      validateChinaCoordinateBounds(persona, resolvedById.get(persona.id) || persona, errors);
      if (DISPUTED_CHINESE_IDS.has(persona.id) && !persona.dataQuality?.notes) {
        errors.push(`${persona.id} disputed birthplace requires dataQuality.notes.`);
      }
    }

    if (!Array.isArray(persona.works) || persona.works.length === 0) {
      errors.push(`${persona.id} works must be a non-empty array.`);
    }
    if (!Array.isArray(persona.keywords) || persona.keywords.length === 0) {
      errors.push(`${persona.id} keywords must be a non-empty array.`);
    }
    if ((persona.importBatch || personas.length === TARGET_PERSONA_COUNT) && (!Array.isArray(persona.keywords) || persona.keywords.length < 4)) {
      errors.push(`${persona.id} keywords must contain at least 4 items for the 500-person atlas.`);
    }
    if (!Array.isArray(persona.references) || persona.references.length === 0) {
      errors.push(`${persona.id} references must be a non-empty array.`);
    }
    if (persona.importBatch && (!Array.isArray(persona.relatedPersonas) || persona.relatedPersonas.length === 0)) {
      errors.push(`${persona.id} generated persona must include relatedPersonas.`);
    }

    checkCoordinate(persona.birthLat, "birthLat", persona.id, errors, true, true);
    checkCoordinate(persona.birthLng, "birthLng", persona.id, errors, false, true);
    if (!persona.birthplace) errors.push(`${persona.id} birthplace is required.`);
    if ((!Number.isFinite(Number(persona.birthLat)) || !Number.isFinite(Number(persona.birthLng))) && !persona.fallbackRegion) {
      errors.push(`${persona.id} missing fallbackRegion for uncertain birthplace.`);
    }
    const resolved = resolvedById.get(persona.id);
    checkCoordinate(resolved?.visualLat, "visualLat", persona.id, errors, true, true);
    checkCoordinate(resolved?.visualLng, "visualLng", persona.id, errors, false, true);
    validateVisualBirthOffset(persona, resolved, errors);

    const bioLength = charLength(persona.biography);
    if (bioLength < 55 || bioLength > 230) {
      errors.push(`${persona.id} biography should be concise, got ${bioLength} chars.`);
    }

    const personaLength = charLength(persona.personaSummary);
    if (personaLength < 34 || personaLength > 180) {
      errors.push(`${persona.id} personaSummary should be concise, got ${personaLength} chars.`);
    }

    const joined = [
      persona.name,
      persona.displayName,
      persona.category,
      persona.identity,
      persona.summary,
      persona.biography,
      persona.personaSummary
    ].join(" ");
    for (const banned of PERSONA_BANNED) {
      if (joined.includes(banned)) errors.push(`${persona.id} includes banned visible persona term: ${banned}`);
    }

    validateDataQuality(persona, errors);
    validateAvatar(persona, errors);
  }

  if (!spread.ok) errors.push(...spread.errors);

  report("personas", errors);
}

export function validateRoutes() {
  const personas = readJson("personas.enriched.json");
  const routes = readJson("routes.json");
  const excluded = readJson("excluded-personas.json");
  const errors = [];
  const personaIds = new Set(personas.map((persona) => persona.id));
  const excludedIds = new Set(excluded.map((entry) => entry.id));

  if (!Array.isArray(routes) || routes.length < 7) errors.push("routes.json must contain the seven curated routes.");
  if (!routes.some((route) => route.default)) errors.push("routes.json must mark one default route.");

  for (const route of routes) {
    if (!route.id || !route.name || !Array.isArray(route.personaIds)) {
      errors.push(`route ${route.id || "unknown"} missing id, name, or personaIds.`);
      continue;
    }
    if (route.personaIds.length < 5) errors.push(`${route.id} must contain at least 5 personas.`);
    for (const id of route.personaIds) {
      if (!personaIds.has(id)) errors.push(`${route.id} references missing persona: ${id}`);
      if (excludedIds.has(id)) errors.push(`${route.id} references excluded entry: ${id}`);
    }
    if (route.id === "east-west-dialogue") validateEastWestRoute(route, personas, errors);
  }

  report("routes", errors);
}

export function validateRelations() {
  const personas = readJson("personas.enriched.json");
  const relations = readJson("relations.json");
  const personaIds = new Set(personas.map((persona) => persona.id));
  const errors = [];

  if (!Array.isArray(relations) || relations.length === 0) errors.push("relations.json must contain relations.");

  for (const relation of relations) {
    if (!relation.id || !relation.from || !relation.to) errors.push("relation missing id, from, or to.");
    if (!personaIds.has(relation.from)) errors.push(`${relation.id} missing from persona: ${relation.from}`);
    if (!personaIds.has(relation.to)) errors.push(`${relation.id} missing to persona: ${relation.to}`);
    if (!RELATION_TYPES.has(relation.type)) errors.push(`${relation.id} invalid relation type: ${relation.type}`);
    if (!RELATION_CONFIDENCE.has(relation.confidence)) errors.push(`${relation.id} invalid confidence: ${relation.confidence}`);
    if (!Array.isArray(relation.references) || relation.references.length === 0) {
      errors.push(`${relation.id} references must be a non-empty array.`);
    }
  }

  report("relations", errors);
}

export function validateThemes() {
  const personas = readJson("personas.enriched.json");
  const routes = readJson("routes.json");
  const themes = readJson("visual-themes.json");
  const errors = [];
  const routeIds = new Set(routes.map((route) => route.id));

  for (const routeId of routeIds) {
    if (!themes.routes?.[routeId]) errors.push(`visual-themes missing route theme: ${routeId}`);
  }

  for (const persona of personas) {
    if (!themes.eras?.[persona.era]) errors.push(`visual-themes missing era theme: ${persona.era}`);
  }

  for (const [id, theme] of Object.entries({ ...themes.eras, ...themes.routes })) {
    if (!isHex(theme.accent)) errors.push(`${id} accent is not a hex color.`);
    if (!isRgba(theme.overlay)) errors.push(`${id} overlay must be rgba(...).`);
  }

  report("themes", errors);
}

export function validateWorks() {
  const personas = readJson("personas.enriched.json");
  const works = readJson("works-catalog.json");
  const enrichedWorks = readJson("works.enriched.json");
  const errors = [];
  const warnings = [];
  const personaIds = new Set(personas.map((persona) => persona.id));
  const byPersonaTitle = new Map();
  const enrichedByPersonaTitle = new Map();
  const workIds = new Set();
  const enrichedIds = new Set();

  if (!Array.isArray(works) || works.length === 0) errors.push("works-catalog.json must contain works.");
  if (!Array.isArray(enrichedWorks) || enrichedWorks.length === 0) {
    errors.push("works.enriched.json must contain enriched works.");
  }

  for (const work of works) {
    if (!work.workId || workIds.has(work.workId)) errors.push(`duplicate or empty workId: ${work.workId}`);
    workIds.add(work.workId);
    if (!personaIds.has(work.personaId)) errors.push(`${work.workId} references missing persona: ${work.personaId}`);
    if (!work.title || !work.author) errors.push(`${work.workId} missing title or author.`);
    if (!WORK_COPYRIGHT_STATUSES.has(work.copyrightStatus)) errors.push(`${work.workId} invalid copyrightStatus.`);
    if (!WORK_AVAILABILITY.has(work.availability)) errors.push(`${work.workId} invalid availability.`);
    if (!work.sourceUrl || !work.sourceName || !work.license) {
      errors.push(`${work.workId} missing sourceUrl, sourceName, or license.`);
    }
    const key = `${work.personaId}::${work.title}`;
    if (byPersonaTitle.has(key)) errors.push(`duplicate work mapping: ${key}`);
    byPersonaTitle.set(key, work);

    if (work.contentPath) {
      if (!["public-domain", "open-license"].includes(work.copyrightStatus)) {
        errors.push(`${work.workId} has contentPath but copyrightStatus is ${work.copyrightStatus}.`);
      }
      if (work.availability !== "embedded-full-text") {
        errors.push(`${work.workId} has contentPath but availability is ${work.availability}.`);
      }
      const contentFullPath = path.join(ROOT, "public", work.contentPath);
      if (!fs.existsSync(contentFullPath)) {
        errors.push(`${work.workId} contentPath does not exist: ${work.contentPath}`);
      } else {
        validateWorkContent(work, contentFullPath, errors);
      }
    }

    if (["protected", "unknown"].includes(work.copyrightStatus) && work.contentPath) {
      errors.push(`${work.workId} protected/unknown work must not have embedded full text.`);
    }
    if (["protected", "unknown"].includes(work.copyrightStatus) && charLength(work.excerpt) > 260) {
      errors.push(`${work.workId} protected/unknown excerpt too long.`);
    }
    validateVisibleGuideText(work.workId, [work.summary, work.excerpt], errors);
  }

  for (const work of enrichedWorks) {
    if (!work.id || enrichedIds.has(work.id)) errors.push(`duplicate or empty enriched work id: ${work.id}`);
    enrichedIds.add(work.id);
    if (!work.title || !work.authorName) errors.push(`${work.id || "unknown"} missing title or authorName.`);
    if (!ENRICHED_WORK_COPYRIGHT_STATUSES.has(work.copyrightStatus)) {
      errors.push(`${work.id} invalid enriched copyrightStatus: ${work.copyrightStatus}`);
    }
    if (!work.license || !work.licenseNote || !work.sourceConfidence) {
      errors.push(`${work.id} missing license, licenseNote, or sourceConfidence.`);
    }
    validateWorkGuideCopy(work, errors, warnings);
    if (!ENRICHED_WORK_DISPLAY_MODES.has(work.displayMode)) {
      errors.push(`${work.id} invalid displayMode: ${work.displayMode}.`);
    }
    if (!Array.isArray(work.themes) || !Array.isArray(work.relatedPersonas)) {
      errors.push(`${work.id} themes and relatedPersonas must be arrays.`);
    }
    if (!work.dataQuality || !work.dataQuality.metadata || !work.dataQuality.summary || !work.dataQuality.copyright || !work.dataQuality.fullText) {
      errors.push(`${work.id} missing dataQuality fields.`);
    }
    if (work.authorId && personaIds.has(work.authorId)) {
      enrichedByPersonaTitle.set(`${work.authorId}::${work.title}`, work);
    }
    for (const personaId of work.relatedPersonas || []) {
      if (personaId && !personaIds.has(personaId)) errors.push(`${work.id} references missing related persona: ${personaId}`);
    }
    validateEnrichedSources(work, errors);
    validateEnrichedCopyright(work, errors);
  }

  for (const persona of personas) {
    for (const title of persona.works || []) {
      if (!byPersonaTitle.has(`${persona.id}::${title}`)) {
        errors.push(`${persona.id} work missing from catalog: ${title}`);
      }
      if (!enrichedByPersonaTitle.has(`${persona.id}::${title}`)) {
        errors.push(`${persona.id} work missing from enriched works: ${title}`);
      }
    }
  }

  for (const warning of warnings) console.warn(`[works warning] ${warning}`);
  report("works", errors);
}

export function validateCopy() {
  const personas = readJson("personas.enriched.json");
  const routes = readJson("routes.json");
  const copy = readJson("curation-copy.json");
  const errors = [];
  const personaIds = new Set(personas.map((persona) => persona.id));
  const routeIds = new Set(routes.map((route) => route.id));

  if (!copy.global?.title || !copy.global?.searchPlaceholder) {
    errors.push("curation-copy global title and searchPlaceholder are required.");
  }

  for (const [routeId, captions] of Object.entries(copy.routeCaptions || {})) {
    if (!routeIds.has(routeId)) errors.push(`copy references missing route: ${routeId}`);
    for (const personaId of Object.keys(captions)) {
      if (!personaIds.has(personaId)) errors.push(`copy references missing persona: ${personaId}`);
      if (charLength(captions[personaId]) > 72) errors.push(`caption too long: ${routeId}.${personaId}`);
    }
  }

  const editorial = copy.personaEditorial || {};
  for (const persona of personas) {
    const entry = editorial[persona.id];
    if (!entry) {
      errors.push(`personaEditorial missing ${persona.id}`);
      continue;
    }
    if (!entry.oneLine || charLength(entry.oneLine) > 32) {
      errors.push(`personaEditorial.${persona.id}.oneLine missing or too long.`);
    }
    const whisperLength = charLength(entry.whisper);
    if (whisperLength < 12 || whisperLength > 28) {
      errors.push(`personaEditorial.${persona.id}.whisper length ${whisperLength}, expected 12-28.`);
    }
    for (const banned of WHISPER_BANNED) {
      if (String(entry.whisper).includes(banned) || String(entry.oneLine).includes(banned)) {
        errors.push(`personaEditorial.${persona.id} includes banned term: ${banned}`);
      }
    }
  }

  const copyText = JSON.stringify(copy);
  for (const banned of COPY_BANNED) {
    if (copyText.includes(banned)) errors.push(`curation copy includes banned term: ${banned}`);
  }

  report("copy", errors);
}

export function validateUiText() {
  const errors = [];
  const files = ["index.html", path.join("src", "ui.js"), path.join("src", "main.js"), path.join("src", "styles.css")];
  for (const file of files) {
    const fullPath = path.join(ROOT, file);
    if (!fs.existsSync(fullPath)) {
      errors.push(`missing UI file: ${file}`);
      continue;
    }
    const text = fs.readFileSync(fullPath, "utf8");
    for (const banned of UI_TEXT_BANNED) {
      if (text.includes(banned)) errors.push(`${file} includes banned production UI term: ${banned}`);
    }
  }
  report("ui-text", errors);
}

export function validateSearchIndex() {
  const personas = readJson("personas.enriched.json");
  const index = readJson("search-index.json");
  const errors = [];
  const personaIds = new Set(personas.map((persona) => persona.id));
  const indexedIds = new Set();

  if (!Array.isArray(index)) errors.push("search-index.json must be an array.");
  for (const entry of Array.isArray(index) ? index : []) {
    if (!entry.personaId || indexedIds.has(entry.personaId)) errors.push(`duplicate or empty search index personaId: ${entry.personaId}`);
    indexedIds.add(entry.personaId);
    if (!personaIds.has(entry.personaId)) errors.push(`search-index references missing persona: ${entry.personaId}`);
    if (!entry.text || charLength(entry.text) < 12) errors.push(`search-index.${entry.personaId} missing searchable text.`);
    if (!Array.isArray(entry.works) || entry.works.length === 0) errors.push(`search-index.${entry.personaId} missing works.`);
    if (!Array.isArray(entry.keywords) || entry.keywords.length === 0) errors.push(`search-index.${entry.personaId} missing keywords.`);
  }

  for (const persona of personas) {
    if (!indexedIds.has(persona.id)) errors.push(`search-index missing persona: ${persona.id}`);
  }

  report("search-index", errors);
}

export function validateAvatarManifest() {
  const personas = readJson("personas.enriched.json");
  const manifest = readJson("avatar-manifest.json");
  const routeSequences = readJson("route-sequences.json");
  const errors = [];
  const personaIds = new Set(personas.map((persona) => persona.id));
  const manifestIds = new Set();
  const pendingIds = new Set();

  if (!Array.isArray(manifest)) errors.push("avatar-manifest.json must be an array.");
  for (const entry of Array.isArray(manifest) ? manifest : []) {
    if (!entry.personaId || manifestIds.has(entry.personaId)) {
      errors.push(`avatar-manifest duplicate or empty personaId: ${entry.personaId}`);
    }
    manifestIds.add(entry.personaId);
    if (!personaIds.has(entry.personaId)) errors.push(`avatar-manifest references missing persona: ${entry.personaId}`);
    if (!entry.avatarLocal || !String(entry.avatarLocal).endsWith(".webp")) {
      errors.push(`avatar-manifest.${entry.personaId} missing local webp avatar.`);
    }
    if (!entry.avatarThumbLocal || !String(entry.avatarThumbLocal).endsWith(".webp")) {
      errors.push(`avatar-manifest.${entry.personaId} missing thumb webp avatar.`);
    }
    if (!entry.avatarMarkerLocal || !String(entry.avatarMarkerLocal).endsWith(".webp")) {
      errors.push(`avatar-manifest.${entry.personaId} missing marker webp avatar.`);
    }
    if (!AVATAR_KINDS.has(entry.avatarKind)) errors.push(`avatar-manifest.${entry.personaId} invalid avatarKind.`);
    if (!AVATAR_CONFIDENCE.has(entry.confidence)) errors.push(`avatar-manifest.${entry.personaId} invalid confidence.`);
    if (!entry.sourceName) errors.push(`avatar-manifest.${entry.personaId} missing sourceName.`);
    if (!entry.sourceUrl) errors.push(`avatar-manifest.${entry.personaId} missing sourceUrl.`);
    if (!entry.license) errors.push(`avatar-manifest.${entry.personaId} missing license.`);
    if (entry.avatarKind === "pending_authentic_image") pendingIds.add(entry.personaId);
    if (AUTHENTIC_AVATAR_KINDS.has(entry.avatarKind) && entry.avatarIsAuthentic !== true) {
      errors.push(`avatar-manifest.${entry.personaId} authentic avatar must set avatarIsAuthentic=true.`);
    }
    if (entry.avatarKind === "pending_authentic_image" && entry.avatarIsAuthentic !== false) {
      errors.push(`avatar-manifest.${entry.personaId} pending avatar must set avatarIsAuthentic=false.`);
    }
  }

  for (const persona of personas) {
    if (!manifestIds.has(persona.id)) errors.push(`avatar-manifest missing persona: ${persona.id}`);
  }
  if (pendingIds.size > 30) errors.push(`pending_authentic_image count ${pendingIds.size} exceeds 30.`);
  const first100Pending = (routeSequences.globalTourNearestSurface || [])
    .slice(0, 100)
    .filter((id) => pendingIds.has(id));
  if (first100Pending.length > 0) {
    errors.push(`globalTourNearestSurface first 100 pending avatars: ${first100Pending.join(", ")}`);
  }

  report("avatar-manifest", errors);
}

export function validateDataSplits() {
  const requiredFiles = [
    "personas.index.json",
    "personas.details.json",
    "works.index.json",
    "works.details.json",
    "search-index.json",
    "route-sequences.json",
    "avatar-manifest.json"
  ];
  const missingFiles = requiredFiles.filter((file) => !fs.existsSync(path.join(DATA, file)));
  if (missingFiles.length) report("data-splits", missingFiles.map((file) => `${file} does not exist.`));

  const personas = readJson("personas.enriched.json");
  const works = readJson("works-catalog.json");
  const personaIndex = readJson("personas.index.json");
  const personaDetails = readJson("personas.details.json");
  const worksIndex = readJson("works.index.json");
  const worksDetails = readJson("works.details.json");
  const searchIndex = readJson("search-index.json");
  const routeSequences = readJson("route-sequences.json");
  const avatarManifest = readJson("avatar-manifest.json");
  const errors = [];

  if (!Array.isArray(personaIndex)) errors.push("personas.index.json must be an array.");
  if (!personaDetails || typeof personaDetails !== "object" || Array.isArray(personaDetails)) {
    errors.push("personas.details.json must be an object keyed by persona id.");
  }
  if (!Array.isArray(worksIndex)) errors.push("works.index.json must be an array.");
  if (!worksDetails || typeof worksDetails !== "object" || Array.isArray(worksDetails)) {
    errors.push("works.details.json must be an object keyed by work id.");
  }
  if ((personaIndex || []).length !== personas.length) errors.push("personas.index.json must cover every persona.");
  if (Object.keys(personaDetails || {}).length !== personas.length) errors.push("personas.details.json must cover every persona.");
  if ((worksIndex || []).length !== works.length) errors.push("works.index.json must cover works-catalog.");
  if (!Array.isArray(searchIndex) || searchIndex.length !== personas.length) errors.push("search-index.json must cover every persona.");
  if (!Array.isArray(routeSequences?.globalTourNearestSurface) || routeSequences.globalTourNearestSurface.length !== personas.length) {
    errors.push("route-sequences.globalTourNearestSurface must cover every persona.");
  }
  if (!Array.isArray(avatarManifest) || avatarManifest.length !== personas.length) errors.push("avatar-manifest.json must cover every persona.");

  const indexIds = new Set((personaIndex || []).map((entry) => entry.id));
  const disallowedIndexFields = [
    "biography",
    "personaSummary",
    "references",
    "avatarCredit",
    "dataQuality",
    "relatedPersonas"
  ];
  const placeholderTerms = ["待补充", "后续补充", "GitHub", "Agent", "Skill", "Z-Library", "z-library"];
  for (const persona of personas) {
    if (!indexIds.has(persona.id)) errors.push(`personas.index missing ${persona.id}`);
    if (!personaDetails?.[persona.id]) errors.push(`personas.details missing ${persona.id}`);
  }
  for (const entry of personaIndex || []) {
    if (!entry.avatarThumbLocal || !entry.avatarMarkerLocal) errors.push(`personas.index.${entry.id} missing layered avatar paths.`);
    for (const field of disallowedIndexFields) {
      if (field in entry) errors.push(`personas.index.${entry.id} must not include heavy detail field: ${field}`);
    }
    if (Array.isArray(entry.works) && entry.works.length > 1) errors.push(`personas.index.${entry.id} must not include long works arrays.`);
    if (charLength(entry.whisper) > 160) errors.push(`personas.index.${entry.id} whisper is too long for first-screen index.`);
    const visibleCopy = JSON.stringify(entry);
    for (const term of placeholderTerms) {
      if (visibleCopy.includes(term)) errors.push(`personas.index.${entry.id} contains banned placeholder or engineering term: ${term}`);
    }
  }
  for (const work of works) {
    if (!worksIndex.find((entry) => entry.workId === work.workId)) errors.push(`works.index missing ${work.workId}`);
  }
  const manifestById = new Map((avatarManifest || []).map((entry) => [entry.personaId, entry]));
  for (const persona of personas) {
    const avatar = manifestById.get(persona.id);
    if (!avatar) continue;
    if (!String(avatar.avatarMarkerLocal || "").startsWith("/assets/avatars/markers/")) {
      errors.push(`avatar-manifest.${persona.id} marker path must use /assets/avatars/markers/.`);
    }
    if (!String(avatar.avatarThumbLocal || "").startsWith("/assets/avatars/thumbs/")) {
      errors.push(`avatar-manifest.${persona.id} thumb path must use /assets/avatars/thumbs/.`);
    }
    if (
      !String(avatar.avatarLocal || "").startsWith("/assets/avatars/") ||
      String(avatar.avatarLocal || "").includes("/thumbs/") ||
      String(avatar.avatarLocal || "").includes("/markers/")
    ) {
      errors.push(`avatar-manifest.${persona.id} modal path must use /assets/avatars/ root images.`);
    }
    for (const [field, webPath] of [
      ["avatarMarkerLocal", avatar.avatarMarkerLocal],
      ["avatarThumbLocal", avatar.avatarThumbLocal],
      ["avatarLocal", avatar.avatarLocal]
    ]) {
      if (!publicAssetExists(webPath)) errors.push(`avatar-manifest.${persona.id}.${field} file does not exist: ${webPath}`);
    }
  }

  const indexSize = fs.statSync(path.join(DATA, "personas.index.json")).size;
  if (indexSize > 360 * 1024) {
    console.warn(`validate:data-splits warning - personas.index.json is ${Math.round(indexSize / 1024)}KB; keep first-screen index lightweight.`);
  }

  report("data-splits", errors);
}

export function validateRouteSequences() {
  const personas = readJson("personas.enriched.json");
  const routeSequences = readJson("route-sequences.json");
  const errors = [];
  const personaIds = new Set(personas.map((persona) => persona.id));
  const required = [
    "globalTour",
    "globalTourNearestSurface",
    "chinaLiterature",
    "westernPhilosophy",
    "poetsAcrossWorld",
    "novelistsAcrossWorld",
    "ancientToModern",
    "eastWestDialogue"
  ];

  for (const key of required) {
    const sequence = routeSequences?.[key];
    if (!Array.isArray(sequence) || sequence.length === 0) {
      errors.push(`route-sequences.${key} must be a non-empty array.`);
      continue;
    }
    const seen = new Set();
    for (const id of sequence) {
      if (!personaIds.has(id)) errors.push(`route-sequences.${key} references missing persona: ${id}`);
      if (seen.has(id)) errors.push(`route-sequences.${key} contains duplicate persona: ${id}`);
      seen.add(id);
    }
  }

  if ((routeSequences?.globalTour || []).length !== personas.length) {
    errors.push("route-sequences.globalTour must cover every persona exactly once.");
  }
  if ((routeSequences?.globalTourNearestSurface || []).length !== personas.length) {
    errors.push("route-sequences.globalTourNearestSurface must cover every persona exactly once.");
  }
  validateTourStats(routeSequences?.globalTourNearestSurface || [], personas, errors);
  validateSpinTrendStats(routeSequences?.globalTourNearestSurface || [], personas, errors, "globalTourNearestSurface");

  report("route-sequences", errors);
}

export function validateFilterPresets() {
  const personas = readJson("personas.index.json").map(normalizePersonaTaxonomy);
  const errors = [];
  const reports = [];

  for (const presetId of Object.keys(FILTER_PRESETS)) {
    const filtered = applyFilterPreset(personas, presetId);
    const routeOrdered = buildSpinAlignedSurfaceRoute(filtered, {
      filterPresetId: presetId,
      spinDirection: EARTH_MOTION_CONFIG.spinDirection,
      cacheKey: `validate:${presetId}:spin`
    });
    const routeIds = new Set(routeOrdered.map((persona) => persona.id));
    const metrics = spinRouteMetrics(routeOrdered, EARTH_MOTION_CONFIG.spinDirection);
    const outsiders = routeOrdered.filter((persona) => !filtered.some((item) => item.id === persona.id));

    if (presetId !== "全部" && filtered.length === 0) errors.push(`filter preset ${presetId} produced no personas.`);
    if (outsiders.length) errors.push(`filter preset ${presetId} route includes outsiders: ${outsiders.map((persona) => persona.id).join(", ")}`);
    if (routeIds.size !== routeOrdered.length) errors.push(`filter preset ${presetId} route contains duplicate personas.`);

    if (presetId === "中国文学") {
      const invalid = filtered.filter((persona) => !isChineseLiteraturePersona(persona));
      if (invalid.length) {
        errors.push(`中国文学 contains non-Chinese-literature personas: ${invalid.map((persona) => `${persona.id}:${persona.displayName}`).join(", ")}`);
      }
      const nonChinese = filtered.filter((persona) => persona.cultureRegion !== "中国");
      if (nonChinese.length) {
        errors.push(`中国文学 contains non-China cultureRegion personas: ${nonChinese.map((persona) => `${persona.id}:${persona.cultureRegion}`).join(", ")}`);
      }
      const nonLiterature = filtered.filter((persona) => !persona.domain?.includes("文学"));
      if (nonLiterature.length) {
        errors.push(`中国文学 contains non-literature personas: ${nonLiterature.map((persona) => persona.id).join(", ")}`);
      }
    }

    if (metrics.farJumpRatio > 0.08) errors.push(`filter preset ${presetId} farJumpRatio too high: ${metrics.farJumpRatio.toFixed(4)}`);

    reports.push(
      `${presetId}=${filtered.length}, avgKm=${Math.round(metrics.averageAdjacentKm)}, maxKm=${Math.round(metrics.maxAdjacentKm)}, reverse=${metrics.reverseTrendRatio.toFixed(3)}, far=${metrics.farJumpRatio.toFixed(3)}`
    );
  }

  const defaultFiltered = applyFilterPreset(personas, DEFAULT_EARTH_VIEW.category);
  const defaultRoute = buildSpinAlignedSurfaceRoute(defaultFiltered, {
    filterPresetId: DEFAULT_EARTH_VIEW.category,
    startPersonaId: DEFAULT_EARTH_VIEW.focusPersonaId,
    spinDirection: EARTH_MOTION_CONFIG.spinDirection,
    cacheKey: "validate:default-earth-view"
  });
  const defaultIndex = defaultRoute.findIndex((persona) => persona.id === DEFAULT_EARTH_VIEW.focusPersonaId);
  if (!defaultFiltered.some((persona) => persona.id === DEFAULT_EARTH_VIEW.focusPersonaId)) {
    errors.push(`default currentPersona ${DEFAULT_EARTH_VIEW.focusPersonaId} is outside default filter ${DEFAULT_EARTH_VIEW.category}.`);
  }
  if (defaultIndex < 0) {
    errors.push(`default currentPersona ${DEFAULT_EARTH_VIEW.focusPersonaId} is missing from default route.`);
  }
  console.log(`validate:default-earth-view currentPersona=${DEFAULT_EARTH_VIEW.focusPersonaId} bottomIndex=${defaultIndex}`);

  console.log(`validate:filter-presets report ${reports.join(" | ")}`);
  report("filter-presets", errors);
}

function validateSpinTrendStats(sequence, personas, errors, label) {
  const byId = new Map(personas.map((persona) => [persona.id, normalizePersonaTaxonomy(persona)]));
  const route = sequence.map((id) => byId.get(id)).filter(Boolean);
  const metrics = spinRouteMetrics(route, EARTH_MOTION_CONFIG.spinDirection);
  console.log(
    `validate:spin-trend ${label} reverseTrendRatio=${metrics.reverseTrendRatio.toFixed(4)} farJumpRatio=${metrics.farJumpRatio.toFixed(4)}`
  );
  if (metrics.farJumpRatio > 0.08) errors.push(`${label} far jump ratio too high: ${metrics.farJumpRatio.toFixed(4)}`);
}

function validateTourStats(sequence, personas, errors) {
  if (!sequence.length) return;
  const byId = new Map(personas.map((persona) => [persona.id, persona]));
  let total = 0;
  let max = 0;
  let far = 0;
  for (let index = 1; index < sequence.length; index += 1) {
    const previous = byId.get(sequence[index - 1]);
    const next = byId.get(sequence[index]);
    if (!previous || !next) continue;
    const distance = haversineKm(
      Number(previous.visualLat ?? previous.birthLat),
      Number(previous.visualLng ?? previous.birthLng),
      Number(next.visualLat ?? next.birthLat),
      Number(next.visualLng ?? next.birthLng)
    );
    total += distance;
    max = Math.max(max, distance);
    if (distance > TOUR_FAR_JUMP_KM) far += 1;
  }
  const average = total / Math.max(1, sequence.length - 1);
  const farRatio = far / Math.max(1, sequence.length - 1);
  console.log(
    `validate:tour-stats averageAdjacentKm=${Math.round(average)} maxAdjacentKm=${Math.round(max)} farJumpRatio=${farRatio.toFixed(4)}`
  );
  if (farRatio >= 0.05) errors.push(`globalTourNearestSurface far jump ratio too high: ${farRatio.toFixed(4)}`);
  if (!Number.isFinite(average) || average <= 0) errors.push("globalTourNearestSurface average distance is invalid.");
}

function tourRegion(persona) {
  if (!persona) return "unknown";
  if (persona.culturalRegion && persona.culturalRegion !== "global-modern") return persona.culturalRegion;
  const lng = Number(persona.birthLng);
  if (Number.isFinite(lng)) {
    if (lng > 70 && lng < 150) return "east-asia";
    if (lng > 45 && lng <= 70) return "central-asia";
    if (lng > 15 && lng <= 45) return "east-europe-africa";
    if (lng > 5 && lng <= 15) return Number(persona.birthLat) >= 50 ? "north-central-europe" : "central-west-europe";
    if (lng > -5 && lng <= 5) return Number(persona.birthLat) >= 48 ? "france-benelux" : "west-mediterranean";
    if (lng > -20 && lng <= -5) return "atlantic-europe-africa";
    if (lng > -80 && lng <= -20) return "atlantic-americas";
    if (lng <= -80) return "americas";
  }
  return persona.nationality || "global";
}

export function validatePersonaStats() {
  const personas = readJson("personas.enriched.json");
  const stats = readJson("persona-stats.json");
  const errors = [];

  if (stats.total !== personas.length) errors.push(`persona-stats total ${stats.total} does not match personas ${personas.length}.`);
  if (!stats.categories || !stats.regions || !stats.eras) errors.push("persona-stats missing category, region, or era stats.");
  if (stats.avatar?.missing !== 0) errors.push(`persona-stats reports missing avatars: ${stats.avatar?.missing}`);
  if ((stats.avatar?.fallback || 0) !== 0) errors.push(`persona-stats reports fallback avatars: ${stats.avatar?.fallback}`);
  if ((stats.avatar?.kinds?.pending_authentic_image || 0) > 30) {
    errors.push(`persona-stats pending_authentic_image exceeds 30: ${stats.avatar.kinds.pending_authentic_image}`);
  }
  if (stats.works?.personasWithWorks !== personas.length) errors.push("persona-stats works.personasWithWorks must match persona count.");

  report("persona-stats", errors);
}

export function validateAll() {
  validatePersonas();
  validateRoutes();
  validateRelations();
  validateThemes();
  validateWorks();
  validateCopy();
  validateUiText();
  validateSearchIndex();
  validateAvatarManifest();
  validateDataSplits();
  validateFilterPresets();
  validateRouteSequences();
  validatePersonaStats();
}

function validateWorkContent(work, fullPath, errors) {
  let content;
  try {
    content = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch {
    errors.push(`${work.workId} content is not valid JSON.`);
    return;
  }
  if (content.workId !== work.workId) errors.push(`${work.workId} content workId mismatch.`);
  if (!Array.isArray(content.sections) || content.sections.length === 0) {
    errors.push(`${work.workId} content sections must be non-empty.`);
    return;
  }
  const textLength = content.sections.reduce((sum, section) => sum + charLength(section.text), 0);
  if (textLength < 20) errors.push(`${work.workId} content text is too short.`);
  for (const section of content.sections) {
    if (!section.heading || !section.text) errors.push(`${work.workId} content section missing heading or text.`);
  }
}

function validateWorkGuideCopy(work, errors, warnings) {
  const required = [
    ["shortIntro", 120],
    ["background", 120],
    ["readingGuide", 100],
    ["whyItMatters", 100],
    ["personaConnection", 100],
    ["furtherReadingNote", 80]
  ];
  for (const [field, minLength] of required) {
    const value = work[field];
    if (!value) {
      errors.push(`${work.id} missing ${field}.`);
      continue;
    }
    if (charLength(value) < minLength) {
      errors.push(`${work.id} ${field} too short: ${charLength(value)}, expected at least ${minLength}.`);
    }
  }
  if (!work.workEpigraph || charLength(work.workEpigraph) < 12) {
    errors.push(`${work.id} workEpigraph missing or too short.`);
  }
  if (!Array.isArray(work.themes) || work.themes.length < 5) {
    errors.push(`${work.id} themes must contain at least 5 items.`);
  }
  if (!Array.isArray(work.relatedTopics) || work.relatedTopics.length < 4) {
    warnings.push(`${work.id} relatedTopics has fewer than 4 items.`);
  }
  validateVisibleGuideText(
    work.id,
    [
      work.workEpigraph,
      work.shortIntro,
      work.summary,
      work.background,
      work.readingGuide,
      work.whyItMatters,
      work.personaConnection,
      work.furtherReadingNote,
      ...(work.themes || []),
      ...(work.relatedTopics || [])
    ],
    errors
  );
}

function validateVisibleGuideText(id, values, errors) {
  const text = values.filter(Boolean).join(" ");
  for (const banned of GUIDE_PLACEHOLDER_TERMS) {
    if (text.includes(banned)) errors.push(`${id} includes placeholder guide term: ${banned}`);
  }
  for (const banned of AI_TRACE_TERMS) {
    if (text.includes(banned)) errors.push(`${id} includes visible AI trace: ${banned}`);
  }
}

function validateEnrichedSources(work, errors) {
  const allSources = [
    ...(work.legalFullTextSources || []),
    ...(work.catalogSources || []),
    ...(work.references || [])
  ];
  if (allSources.length === 0) errors.push(`${work.id} must include at least one source.`);
  for (const source of allSources) {
    if (!source.sourceName && !source.name) errors.push(`${work.id} source missing sourceName/name.`);
    if (!source.url && !source.sourceUrl) errors.push(`${work.id} source missing url.`);
    if (!source.type || !ENRICHED_WORK_SOURCE_TYPES.has(source.type)) {
      errors.push(`${work.id} source has invalid type: ${source.type}`);
    }
    if (!source.retrievedAt) errors.push(`${work.id} source missing retrievedAt.`);
    const sourceText = JSON.stringify(source).toLowerCase();
    for (const banned of WORK_BANNED_SOURCE_TERMS) {
      if (sourceText.includes(banned)) errors.push(`${work.id} source includes banned source term.`);
    }
  }
}

function validateEnrichedCopyright(work, errors) {
  const text = JSON.stringify(work).toLowerCase();
  for (const banned of WORK_BANNED_SOURCE_TERMS) {
    if (text.includes(banned)) errors.push(`${work.id} includes banned source term.`);
  }
  if (work.copyrightStatus === "copyright_unknown_or_restricted") {
    for (const field of ["fullText", "longExcerpt", "contentPath"]) {
      if (field in work) errors.push(`${work.id} restricted/unknown work must not include ${field}.`);
    }
    if (Array.isArray(work.legalFullTextSources) && work.legalFullTextSources.length > 0) {
      errors.push(`${work.id} restricted/unknown work must not include legalFullTextSources.`);
    }
    if (Array.isArray(work.excerpts)) {
      for (const excerpt of work.excerpts) {
        if (charLength(excerpt?.text) > 120) errors.push(`${work.id} restricted/unknown excerpt too long.`);
      }
    }
    if (String(work.license).toLowerCase().includes("public domain")) {
      errors.push(`${work.id} restricted/unknown work cannot use Public Domain license.`);
    }
  }
  if (work.displayMode === "ai_guide") {
    for (const field of ["fullText", "longExcerpt", "contentPath"]) {
      if (field in work) errors.push(`${work.id} ai_guide work must not include ${field}.`);
    }
    if (Array.isArray(work.legalFullTextSources) && work.legalFullTextSources.length > 0) {
      errors.push(`${work.id} ai_guide work must not include legalFullTextSources.`);
    }
  }
  if (["guide_with_public_text", "public_domain_reference"].includes(work.displayMode) && work.copyrightStatus === "copyright_unknown_or_restricted") {
    errors.push(`${work.id} cannot use ${work.displayMode} with restricted/unknown copyrightStatus.`);
  }
  if (work.copyrightStatus === "public_domain" && Array.isArray(work.excerpts)) {
    for (const excerpt of work.excerpts) {
      if (!excerpt.source || !excerpt.license) errors.push(`${work.id} public-domain excerpt missing source or license.`);
    }
  }
}

function validateDataQuality(persona, errors) {
  const quality = persona.dataQuality || {};
  if (!QUALITY_LEVELS.has(quality.level)) errors.push(`${persona.id} invalid dataQuality.level.`);
  for (const field of ["biography", "works", "avatar", "birthplace"]) {
    if (!QUALITY_STATUSES.has(quality[field])) errors.push(`${persona.id} invalid dataQuality.${field}.`);
  }
  if (quality.level === "complete") {
    for (const field of ["biography", "works", "avatar", "birthplace"]) {
      if (quality[field] === "missing" && !(field === "avatar" && persona.avatarKind === "pending_authentic_image")) {
        errors.push(`${persona.id} complete quality cannot have missing ${field}.`);
      }
    }
  }
  if ((persona.avatarUrl || persona.avatarLocal) && quality.avatar === "missing" && persona.avatarKind !== "pending_authentic_image") {
    errors.push(`${persona.id} has avatar but dataQuality.avatar is missing.`);
  }
  if (!persona.avatarUrl && !persona.avatarLocal && quality.avatar === "verified") {
    errors.push(`${persona.id} cannot have verified avatar without avatarUrl or avatarLocal.`);
  }
  if (!persona.references?.length && quality.level === "complete") {
    errors.push(`${persona.id} cannot be complete without references.`);
  }
}

function validateAvatar(persona, errors) {
  const credit = persona.avatarCredit;
  if (!credit || typeof credit !== "object") {
    errors.push(`${persona.id} missing avatarCredit object.`);
    return;
  }

  for (const field of ["sourceName", "sourceUrl", "license", "needsReview"]) {
    if (!(field in credit)) errors.push(`${persona.id} avatarCredit missing ${field}.`);
  }

  if ((persona.avatarUrl || persona.avatarLocal) && !credit.sourceUrl) {
    errors.push(`${persona.id} has avatar but avatarCredit.sourceUrl is missing.`);
  }

  const avatarText = [
    persona.avatarUrl,
    persona.avatarLocal,
    persona.avatarThumbLocal,
    persona.avatarMarkerLocal,
    persona.avatarSourceName,
    persona.avatarSourceUrl,
    persona.avatarLicense,
    credit.sourceName,
    credit.sourceUrl,
    credit.license
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  for (const banned of AVATAR_BANNED_HOSTS) {
    if (avatarText.includes(banned)) errors.push(`${persona.id} avatar appears generated or random: ${banned}.`);
  }
  if (avatarText.includes("ai-generated") || avatarText.includes("synthetic portrait")) {
    errors.push(`${persona.id} avatar credit suggests a generated portrait.`);
  }

  for (const [field, local] of [
    ["avatarLocal", persona.avatarLocal],
    ["avatarThumbLocal", persona.avatarThumbLocal],
    ["avatarMarkerLocal", persona.avatarMarkerLocal]
  ]) {
    if (local) {
      const normalized = String(local).replace(/^\//, "");
      const candidates = [path.join(ROOT, normalized), path.join(ROOT, "public", normalized)];
      if (!candidates.some((candidate) => fs.existsSync(candidate))) {
        errors.push(`${persona.id} ${field} does not exist: ${local}`);
      }
    }
  }

  if (!persona.avatarLocal) errors.push(`${persona.id} missing avatarLocal.`);
  if (!persona.avatarThumbLocal) errors.push(`${persona.id} missing avatarThumbLocal.`);
  if (!persona.avatarMarkerLocal) errors.push(`${persona.id} missing avatarMarkerLocal.`);
  if (!AVATAR_KINDS.has(persona.avatarKind)) errors.push(`${persona.id} invalid avatarKind: ${persona.avatarKind}`);
  if (!AVATAR_CONFIDENCE.has(persona.avatarConfidence)) {
    errors.push(`${persona.id} invalid avatarConfidence: ${persona.avatarConfidence}`);
  }
  if (!persona.avatarSourceName) errors.push(`${persona.id} missing avatarSourceName.`);
  if (!persona.avatarSourceUrl) {
    errors.push(`${persona.id} missing avatarSourceUrl.`);
  }
  if (!persona.avatarLicense) errors.push(`${persona.id} missing avatarLicense.`);
  if (AUTHENTIC_AVATAR_KINDS.has(persona.avatarKind) && persona.avatarIsAuthentic !== true) {
    errors.push(`${persona.id} authentic avatar must set avatarIsAuthentic=true.`);
  }
  if (persona.avatarKind === "pending_authentic_image" && persona.avatarIsAuthentic !== false) {
    errors.push(`${persona.id} pending avatar must set avatarIsAuthentic=false.`);
  }
  if (persona.avatarKind !== "pending_authentic_image" && String(persona.avatarSourceUrl).startsWith("local://")) {
    errors.push(`${persona.id} authentic avatar cannot use a local placeholder source.`);
  }
  if (avatarText.includes("fallback_seal") || avatarText.includes("fallback-seal") || avatarText.includes("single_character")) {
    errors.push(`${persona.id} still references a forbidden final avatar strategy.`);
  }
  if (persona.avatarLocal && !String(persona.avatarLocal).endsWith(".webp")) {
    errors.push(`${persona.id} avatarLocal must point to a local .webp file.`);
  }
  if (persona.avatarThumbLocal && !String(persona.avatarThumbLocal).endsWith(".webp")) {
    errors.push(`${persona.id} avatarThumbLocal must point to a local .webp file.`);
  }
  if (persona.avatarMarkerLocal && !String(persona.avatarMarkerLocal).endsWith(".webp")) {
    errors.push(`${persona.id} avatarMarkerLocal must point to a local .webp file.`);
  }
  if (persona.avatarUrl) {
    errors.push(`${persona.id} still has remote avatarUrl hotlink.`);
  }
}

function validateVisualBirthOffset(persona, resolved, errors) {
  if (!resolved) return;
  const birthLat = Number(persona.birthLat);
  const birthLng = Number(persona.birthLng);
  const visualLat = Number(resolved.visualLat);
  const visualLng = Number(resolved.visualLng);
  if (![birthLat, birthLng, visualLat, visualLng].every(Number.isFinite)) return;
  const distance = coordinateDistanceDegrees(birthLat, birthLng, visualLat, visualLng);
  const limit = visualOffsetLimit(resolved);
  if (distance > limit + 0.15) {
    errors.push(`${persona.id} visual coordinates too far from birthplace: ${distance.toFixed(1)}deg over ${limit}deg.`);
  }
}

function validateChinaCoordinateBounds(persona, resolved, errors) {
  for (const [fieldLat, fieldLng, label] of [
    ["birthLat", "birthLng", "birth"],
    ["visualLat", "visualLng", "visual"]
  ]) {
    const lat = Number(label === "birth" ? persona[fieldLat] : resolved[fieldLat]);
    const lng = Number(label === "birth" ? persona[fieldLng] : resolved[fieldLng]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const inChinaBounds =
      lat >= CHINA_BOUNDS.latMin &&
      lat <= CHINA_BOUNDS.latMax &&
      lng >= CHINA_BOUNDS.lngMin &&
      lng <= CHINA_BOUNDS.lngMax;
    if (!inChinaBounds && !persona.explicitCoordinateException) {
      errors.push(`${persona.id} ${label} coordinate outside China bounds: ${lat}, ${lng}.`);
    }
  }
}

function validateEastWestRoute(route, personas, errors) {
  const byId = new Map(personas.map((persona) => [persona.id, persona]));
  let lastRegion = null;
  let run = 0;
  for (const id of route.personaIds) {
    const persona = byId.get(id);
    const region = persona?.nationality === "中国" ? "east" : "west";
    run = region === lastRegion ? run + 1 : 1;
    lastRegion = region;
    if (run > 3) errors.push("east-west-dialogue has too many consecutive personas from one region.");
  }
}

function haversineKm(latA, lngA, latB, lngB) {
  if (![latA, lngA, latB, lngB].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const radius = 6371;
  const lat1 = toRad(latA);
  const lat2 = toRad(latB);
  const dLat = toRad(latB - latA);
  const dLng = toRad(lngB - lngA);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRad(value) {
  return (Number(value) * Math.PI) / 180;
}

function checkCoordinate(value, field, id, errors, isLat, required = false) {
  if (value === null || value === undefined || value === "") {
    if (required) errors.push(`${id} ${field} is required.`);
    return;
  }
  if (!Number.isFinite(Number(value))) {
    errors.push(`${id} ${field} must be a number or null.`);
    return;
  }
  const number = Number(value);
  const valid = isLat ? number >= -90 && number <= 90 : number >= -180 && number <= 180;
  if (!valid) errors.push(`${id} ${field} is out of range.`);
}

function readJson(file) {
  const fullPath = path.join(DATA, file);
  if (!fs.existsSync(fullPath)) throw new Error(`${file} does not exist.`);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function publicAssetExists(webPath) {
  if (!webPath || typeof webPath !== "string" || !webPath.startsWith("/")) return false;
  const cleanPath = webPath.split("?")[0].replace(/^\/+/, "");
  return fs.existsSync(path.join(ROOT, "public", cleanPath));
}

function charLength(value) {
  return Array.from(String(value || "")).length;
}

function isHex(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ""));
}

function isRgba(value) {
  return /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(0|1|0?\.\d+)\s*\)$/i.test(String(value || ""));
}

function report(name, errors) {
  if (errors.length) {
    console.error(`validate:${name} failed`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`validate:${name} passed`);
}
