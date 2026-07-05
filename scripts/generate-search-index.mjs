import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "src", "data");

const personas = readJson("personas.enriched.json");
const works = readJson("works-catalog.json");
const worksByPersona = groupBy(works, "personaId");

const index = personas.map((persona) => {
  const personaWorks = worksByPersona.get(persona.id) || [];
  const aliases = uniqueValues([
    persona.name,
    persona.displayName,
    persona.latinName,
    persona.nameZh,
    persona.nameEn,
    persona.nameOriginal
  ]).filter((value) => value !== persona.displayName);
  const worksText = uniqueValues([...(persona.works || []), ...personaWorks.map((work) => work.title)]);
  const text = uniqueValues([
    persona.id,
    persona.displayName,
    persona.name,
    persona.latinName,
    persona.identity,
    persona.nationality,
    persona.birthplace,
    persona.category,
    persona.primaryCategory,
    persona.era,
    persona.school,
    persona.movement,
    ...(persona.keywords || []),
    ...aliases,
    ...worksText
  ])
    .join(" ")
    .toLowerCase();

  return {
    personaId: persona.id,
    nameZh: persona.displayName || persona.name || "",
    nameEn: persona.latinName || persona.nameEn || "",
    nameOriginal: persona.nameOriginal || persona.latinName || persona.displayName || "",
    aliases,
    works: worksText,
    keywords: persona.keywords || [],
    category: persona.category,
    primaryCategory: persona.primaryCategory || persona.category,
    era: persona.era,
    country: persona.nationality || persona.birthCountry || "",
    birthplace: persona.birthplace || persona.birthPlace || "",
    school: persona.school || persona.movement || "",
    text
  };
});

writeJson("search-index.json", index);
console.log(`generated search-index.json with ${index.length} entries`);

function groupBy(items, key) {
  const map = new Map();
  for (const item of items) {
    const groupKey = item[key];
    const group = map.get(groupKey) || [];
    group.push(item);
    map.set(groupKey, group);
  }
  return map;
}

function uniqueValues(values) {
  return Array.from(new Set((values || []).filter(Boolean).map((value) => String(value).trim()).filter(Boolean)));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(path.join(DATA_DIR, file), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
