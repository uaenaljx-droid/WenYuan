import path from "node:path";
import {
  DATA_DIR,
  DEBUG_DIR,
  GENERATED_DIR,
  PERSONA_PROFILE_FIELDS,
  WORK_GUIDE_FIELDS,
  ensureDir,
  generatedEntriesOf,
  readJson,
  withoutPrivateMetadata,
  writeJson
} from "./gpt-content-utils.mjs";

const PERSONA_OUTPUT = path.join(GENERATED_DIR, "persona-profiles.gpt.json");
const WORK_OUTPUT = path.join(GENERATED_DIR, "work-guides.gpt.json");
const PERSONA_DETAILS = path.join(DATA_DIR, "personas.details.json");
const WORK_DETAILS = path.join(DATA_DIR, "works.details.json");
const PERSONA_ENRICHED = path.join(DATA_DIR, "personas.enriched.json");
const WORK_ENRICHED = path.join(DATA_DIR, "works.enriched.json");

async function main() {
  const personaGenerated = await readJson(PERSONA_OUTPUT, {});
  const workGenerated = await readJson(WORK_OUTPUT, {});
  const personaEntries = generatedEntriesOf(personaGenerated);
  const workEntries = generatedEntriesOf(workGenerated);

  if (!personaEntries.length && !workEntries.length) {
    console.log("No generated content found. Nothing was merged.");
    return;
  }

  const timestamp = compactTimestamp(new Date());
  const backupDir = path.join(DEBUG_DIR, "content-backups");
  await ensureDir(backupDir);

  let mergedPersonas = 0;
  let mergedWorks = 0;

  if (personaEntries.length) {
    const details = await readJson(PERSONA_DETAILS);
    await writeJson(path.join(backupDir, `personas.details.${timestamp}.json`), details);
    mergedPersonas += mergePersonaEntries(details, personaEntries);
    await writeJson(PERSONA_DETAILS, details);

    const enriched = await readJson(PERSONA_ENRICHED, []);
    await writeJson(path.join(backupDir, `personas.enriched.${timestamp}.json`), enriched);
    mergePersonaEntries(enriched, personaEntries);
    await writeJson(PERSONA_ENRICHED, enriched);
  }

  if (workEntries.length) {
    const details = await readJson(WORK_DETAILS);
    await writeJson(path.join(backupDir, `works.details.${timestamp}.json`), details);
    mergedWorks += mergeWorkEntries(details, workEntries);
    await writeJson(WORK_DETAILS, details);

    const enriched = await readJson(WORK_ENRICHED, []);
    await writeJson(path.join(backupDir, `works.enriched.${timestamp}.json`), enriched);
    mergeWorkEntries(enriched, workEntries);
    await writeJson(WORK_ENRICHED, enriched);
  }

  console.log(`Merged persona profiles: ${mergedPersonas}`);
  console.log(`Merged work guides: ${mergedWorks}`);
  console.log(`Backups written to ${path.relative(process.cwd(), backupDir)}`);
}

function compactTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

function getMutableRecord(collection, id) {
  if (Array.isArray(collection)) {
    return collection.find((item) => item?.id === id || item?.workId === id) || null;
  }
  return collection?.[id] || null;
}

function mergePersonaEntries(collection, entries) {
  let merged = 0;
  for (const [personaId, entry] of entries) {
    const target = getMutableRecord(collection, personaId);
    if (!target) continue;
    const clean = withoutPrivateMetadata(entry);
    for (const field of PERSONA_PROFILE_FIELDS) {
      if (typeof clean[field] === "string" && clean[field].trim()) {
        target[field] = clean[field].trim();
      }
    }
    target.contentQuality = {
      ...(target.contentQuality || {}),
      profileGuide: entry._meta?.source || "generated",
      profileGuideUpdatedAt: entry._meta?.generatedAt || new Date().toISOString()
    };
    merged += 1;
  }
  return merged;
}

function mergeWorkEntries(collection, entries) {
  let merged = 0;
  for (const [workId, entry] of entries) {
    const target = getMutableRecord(collection, workId);
    if (!target) continue;
    const clean = withoutPrivateMetadata(entry);
    for (const field of WORK_GUIDE_FIELDS) {
      if (field === "themes") {
        if (Array.isArray(clean.themes) && clean.themes.length) target.themes = clean.themes;
      } else if (typeof clean[field] === "string" && clean[field].trim()) {
        target[field] = clean[field].trim();
      }
    }
    if (target.shortIntro) target.summary = target.shortIntro;
    if (target.furtherReadingPath) target.furtherReadingNote = target.furtherReadingPath;
    target.contentQuality = {
      ...(target.contentQuality || {}),
      workGuide: entry._meta?.source || "generated",
      workGuideUpdatedAt: entry._meta?.generatedAt || new Date().toISOString()
    };
    merged += 1;
  }
  return merged;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
