import { resolveVisualCoordinates } from "./utils/geoLayout.js";
import { normalizePersonaTaxonomy } from "./utils/filterPersonas.js";

const dataModules = {
  "personas.index.json": () => import("./data/personas.index.json"),
  "personas.details.json": () => import("./data/personas.details.json"),
  "excluded-personas.json": () => import("./data/excluded-personas.json"),
  "routes.json": () => import("./data/routes.json"),
  "relations.json": () => import("./data/relations.json"),
  "curation-copy.json": () => import("./data/curation-copy.json"),
  "visual-themes.json": () => import("./data/visual-themes.json"),
  "works.index.json": () => import("./data/works.index.json"),
  "works.details.json": () => import("./data/works.details.json"),
  "search-index.json": () => import("./data/search-index.json"),
  "route-sequences.json": () => import("./data/route-sequences.json"),
  "persona-stats.json": () => import("./data/persona-stats.json")
};
const jsonCache = new Map();
const personaDetailCache = new Map();
const workDetailCache = new Map();

export async function loadAtlas() {
  const [
    personasIndex,
    excludedPersonas,
    routesData,
    relationsData,
    copyData,
    themesData,
    worksIndex,
    searchIndex,
    routeSequences,
    personaStats
  ] = await Promise.all([
    loadDataJson("personas.index.json"),
    loadDataJson("excluded-personas.json"),
    loadDataJson("routes.json"),
    loadDataJson("relations.json"),
    loadDataJson("curation-copy.json"),
    loadDataJson("visual-themes.json"),
    loadDataJson("works.index.json"),
    loadDataJson("search-index.json"),
    loadDataJson("route-sequences.json"),
    loadDataJson("persona-stats.json")
  ]);

  const personas = resolveVisualCoordinates(personasIndex).map(normalizePersonaTaxonomy).sort((a, b) => {
    const categoryOrder = categoryRank(a.category) - categoryRank(b.category);
    return categoryOrder || a.displayName.localeCompare(b.displayName, "zh-Hans-CN");
  });

  const personaIds = new Set(personas.map((persona) => persona.id));
  const routes = routesData
    .map((route) => ({
      ...route,
      personaIds: route.personaIds.filter((id) => personaIds.has(id))
    }))
    .filter((route) => route.personaIds.length >= 3);

  const relations = relationsData.filter(
    (relation) => personaIds.has(relation.from) && personaIds.has(relation.to)
  );

  return {
    personas,
    excludedPersonas,
    routes,
    relations,
    worksCatalog: worksIndex,
    worksIndex,
    worksEnriched: [],
    searchIndex,
    routeSequences,
    personaStats,
    copy: copyData,
    themes: themesData,
    loadPersonaDetail,
    loadWorkDetail,
    meta: {
      source: "curated-local",
      repository: "momozi1996/awesome-ai-persona-skills",
      personaCount: personas.length,
      routeCount: routes.length,
      excludedCount: excludedPersonas.length,
      refreshedAt: new Date().toISOString(),
      errors: []
    }
  };
}

export async function loadPersonas() {
  const atlas = await loadAtlas();
  return { personas: atlas.personas, meta: atlas.meta };
}

async function loadDataJson(file) {
  if (jsonCache.has(file)) return jsonCache.get(file);
  const loader = dataModules[file];
  if (!loader) throw new Error(`Missing data module: ${file}`);
  const promise = loader().then((module) => module.default);
  jsonCache.set(file, promise);
  return promise;
}

export async function loadPersonaDetail(personaId) {
  if (personaDetailCache.has(personaId)) return personaDetailCache.get(personaId);
  const promise = loadDataJson("personas.details.json").then((details) => {
    const detail = details?.[personaId];
    if (!detail) throw new Error(`Missing persona detail: ${personaId}`);
    return detail;
  });
  personaDetailCache.set(personaId, promise);
  try {
    const detail = await promise;
    personaDetailCache.set(personaId, detail);
    return detail;
  } catch (error) {
    personaDetailCache.delete(personaId);
    throw error;
  }
}

export async function loadWorkDetail(workId) {
  if (workDetailCache.has(workId)) return workDetailCache.get(workId);
  const promise = loadDataJson("works.details.json").then((details) => {
    const detail = details?.[workId];
    if (!detail) throw new Error(`Missing work detail: ${workId}`);
    return detail;
  });
  workDetailCache.set(workId, promise);
  try {
    const detail = await promise;
    workDetailCache.set(workId, detail);
    return detail;
  } catch (error) {
    workDetailCache.delete(workId);
    throw error;
  }
}

function categoryRank(category) {
  return {
    "文学家": 1,
    "诗人": 2,
    "小说家": 3,
    "剧作家": 4,
    "哲学家": 5,
    "思想家": 6,
    "学者": 7
  }[category] || 99;
}
