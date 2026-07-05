import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "src", "data");

const personas = readJson("personas.enriched.json");
const works = readJson("works.enriched.json");

const stats = {
  generatedAt: new Date().toISOString(),
  total: personas.length,
  categories: countBy(personas, (persona) => persona.category || "未分类"),
  regions: countBy(personas, (persona) => persona.culturalRegion || persona.birthCountry || persona.nationality || "未分区"),
  eras: countBy(personas, (persona) => persona.era || "未分期"),
  avatar: {
    total: personas.length,
    local: personas.filter((persona) => Boolean(persona.avatarLocal)).length,
    remote: personas.filter((persona) => Boolean(persona.avatarUrl)).length,
    fallback: personas.filter((persona) => persona.avatarKind === "fallback_seal" || persona.dataQuality?.avatar === "fallback").length,
    authentic: personas.filter((persona) => persona.avatarIsAuthentic === true).length,
    pending: personas.filter((persona) => persona.avatarKind === "pending_authentic_image").length,
    verified: personas.filter((persona) => persona.dataQuality?.avatar === "verified").length,
    missing: personas.filter((persona) => !persona.avatarLocal && !persona.avatarUrl).length,
    kinds: countBy(personas, (persona) => persona.avatarKind || "unknown"),
    confidence: countBy(personas, (persona) => persona.avatarConfidence || "unknown"),
    needsReview: personas.filter((persona) => persona.avatarCredit?.needsReview).length
  },
  coordinates: {
    total: personas.length,
    numericBirthplace: personas.filter((persona) => Number.isFinite(Number(persona.birthLat)) && Number.isFinite(Number(persona.birthLng))).length,
    mediumOrBetter: personas.filter((persona) => ["high", "medium", undefined].includes(persona.geoConfidence)).length,
    needsReview: personas.filter((persona) => persona.geoConfidence === "low" || persona.dataQuality?.birthplace === "needsReview").length
  },
  works: {
    enrichedGuides: works.length,
    personasWithWorks: personas.filter((persona) => Array.isArray(persona.works) && persona.works.length > 0).length
  },
  reviewScope: {
    generatedExpansion: personas.filter((persona) => persona.importBatch).length,
    biographyPartial: personas.filter((persona) => persona.dataQuality?.biography === "partial").length,
    worksPartial: personas.filter((persona) => persona.dataQuality?.works === "partial").length
  }
};

writeJson("persona-stats.json", stats);
console.log(`generated persona-stats.json for ${stats.total} personas`);

function countBy(items, keyFn) {
  return Object.fromEntries(
    Array.from(
      items.reduce((map, item) => {
        const key = keyFn(item);
        map.set(key, (map.get(key) || 0) + 1);
        return map;
      }, new Map())
    ).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "zh-Hans-CN"))
  );
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(path.join(DATA_DIR, file), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
