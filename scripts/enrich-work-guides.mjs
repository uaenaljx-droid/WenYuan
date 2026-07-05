import fs from "node:fs";
import path from "node:path";
import { normalizeWorkGuide } from "../src/utils/workGuideGenerator.js";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "src", "data");
const WORKS_ENRICHED = path.join(DATA, "works.enriched.json");
const WORKS_CATALOG = path.join(DATA, "works-catalog.json");
const PERSONAS = path.join(DATA, "personas.enriched.json");

const enrichedWorks = readJson(WORKS_ENRICHED);
const catalogWorks = readJson(WORKS_CATALOG);
const personas = readJson(PERSONAS);
const personaById = new Map(personas.map((persona) => [persona.id, persona]));
const enrichedByCatalogId = new Map();

const nextEnriched = enrichedWorks.map((work) => {
  const persona = personaById.get(work.authorId);
  const normalized = normalizeWorkGuide(work, persona, personas);
  const next = {
    ...normalized,
    licenseNote: normalized.licenseNote || "作品页以原创导读、阅读提示和思想脉络为主；权利状态仅用于内部校验。",
    dataQuality: cleanDataQuality(normalized.dataQuality)
  };

  if (next.displayMode === "ai_guide") {
    delete next.fullText;
    delete next.longExcerpt;
    delete next.contentPath;
    next.legalFullTextSources = [];
  }

  enrichedByCatalogId.set(next.workId || next.id, next);
  return next;
});

const nextCatalog = catalogWorks.map((work) => {
  const enriched = enrichedByCatalogId.get(work.workId);
  if (!enriched) return work;
  return {
    ...work,
    summary: enriched.shortIntro,
    excerpt: enriched.readingGuide
  };
});

fs.writeFileSync(WORKS_ENRICHED, `${JSON.stringify(nextEnriched, null, 2)}\n`, "utf8");
fs.writeFileSync(WORKS_CATALOG, `${JSON.stringify(nextCatalog, null, 2)}\n`, "utf8");
console.log(`enriched guide fields for ${nextEnriched.length} works`);

function cleanDataQuality(dataQuality = {}) {
  if (!dataQuality || typeof dataQuality !== "object") return dataQuality;
  return {
    ...dataQuality,
    notes: "作品目录生成后已补入原创导读字段；版本、来源与权利状态仍保留为内部校验信息。"
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
