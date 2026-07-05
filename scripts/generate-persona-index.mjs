import { readDataJson, writeDataJson } from "./avatar-pipeline-utils.mjs";
import { normalizePersonaTaxonomy } from "../src/utils/filterPersonas.js";

const personas = readDataJson("personas.enriched.json");
const worksCatalog = readDataJson("works-catalog.json");
const worksEnriched = readDataJson("works.enriched.json");
const curationCopy = readDataJson("curation-copy.json");

const personasIndex = personas.map((persona) => {
  const normalized = normalizePersonaTaxonomy(persona);
  return {
    id: persona.id,
    nameZh: persona.nameZh || persona.displayName || persona.name || "",
    nameEn: persona.nameEn || persona.latinName || "",
    nameOriginal: persona.nameOriginal || persona.latinName || "",
    displayName: persona.displayName || persona.name || persona.id,
    primaryCategory: normalized.primaryCategory,
    category: normalized.category,
    categoryList: normalized.categoryList,
    identity: persona.identity || "",
    shortRole: persona.shortRole || persona.identity || persona.summary || "",
    summary: persona.summary || "",
    birthYear: persona.birthYear ?? null,
    deathYear: persona.deathYear ?? null,
    birthCountry: normalized.birthCountry,
    birthLat: persona.birthLat ?? null,
    birthLng: persona.birthLng ?? null,
    visualLat: persona.visualLat ?? persona.birthLat ?? null,
    visualLng: persona.visualLng ?? persona.birthLng ?? null,
    culturalRegion: persona.culturalRegion || "",
    cultureRegion: normalized.cultureRegion,
    civilizationRegion: normalized.civilizationRegion,
    domain: normalized.domain,
    era: persona.era || "",
    avatarThumbLocal: persona.avatarThumbLocal || persona.avatarLocal || "",
    avatarMarkerLocal: persona.avatarMarkerLocal || persona.avatarThumbLocal || persona.avatarLocal || "",
    avatarKind: persona.avatarKind || "pending_authentic_image",
    avatarIsAuthentic: persona.avatarIsAuthentic === true,
    whisper: editorialFor(persona.id).whisper || editorialFor(persona.id).oneLine || persona.summary || "",
    whisperSub: persona.whisperSub || [persona.displayName, persona.identity].filter(Boolean).join(" · "),
    primaryWorkId: primaryWorkIdFor(persona.id)
  };
});

const personasDetails = Object.fromEntries(
  personas.map((persona) => [
    persona.id,
    {
      ...persona,
      avatarLocal: persona.avatarLocal || "",
      avatarThumbLocal: persona.avatarThumbLocal || persona.avatarLocal || "",
      avatarMarkerLocal: persona.avatarMarkerLocal || persona.avatarThumbLocal || persona.avatarLocal || ""
    }
  ])
);

const worksIndex = worksCatalog.map((work) => ({
  workId: work.workId,
  personaId: work.personaId,
  title: work.title,
  author: work.author,
  copyrightStatus: work.copyrightStatus,
  availability: work.availability,
  sourceName: work.sourceName,
  sourceUrl: work.sourceUrl,
  license: work.license
}));

const worksDetails = Object.fromEntries(
  worksEnriched.map((work) => [
    work.id,
    work
  ])
);

writeDataJson("personas.index.json", personasIndex);
writeDataJson("personas.details.json", personasDetails);
writeDataJson("works.index.json", worksIndex);
writeDataJson("works.details.json", worksDetails);

console.log(`generated personas.index.json with ${personasIndex.length} entries`);
console.log(`generated personas.details.json with ${Object.keys(personasDetails).length} entries`);
console.log(`generated works.index.json with ${worksIndex.length} entries`);
console.log(`generated works.details.json with ${Object.keys(worksDetails).length} entries`);

function primaryWorkIdFor(personaId) {
  return worksCatalog.find((work) => work.personaId === personaId)?.workId || null;
}

function editorialFor(personaId) {
  return curationCopy.personaEditorial?.[personaId] || {};
}
