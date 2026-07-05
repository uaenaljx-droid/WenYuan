import fs from "node:fs/promises";
import path from "node:path";
import {
  DATA_DIR,
  DEBUG_DIR,
  GENERATED_DIR,
  PERSONA_PROFILE_FIELDS,
  WORK_GUIDE_FIELDS,
  BANNED_CONTENT_TERMS,
  charCount,
  generatedEntriesOf,
  hasBannedTerm,
  readJson,
  stringifyForAudit,
  withoutPrivateMetadata,
  writeJson
} from "./gpt-content-utils.mjs";

const PERSONA_OUTPUT = path.join(GENERATED_DIR, "persona-profiles.gpt.json");
const WORK_OUTPUT = path.join(GENERATED_DIR, "work-guides.gpt.json");
const REPORT_JSON = path.join(DEBUG_DIR, "content-audit.json");
const REPORT_MD = path.join(DEBUG_DIR, "content-audit-report.md");

const PROFILE_LENGTHS = {
  profileEpigraph: [1, 32],
  whoHeIs: [90, 230],
  lifeArc: [130, 320],
  whyMatters: [120, 300],
  styleAndTemperament: [120, 300],
  howToRead: [90, 240],
  historicalRelation: [120, 300],
  relatedPath: [60, 210]
};

const WORK_LENGTHS = {
  workEpigraph: [1, 36],
  shortIntro: [120, 300],
  background: [120, 330],
  readingGuide: [120, 300],
  whyItMatters: [120, 300],
  personaConnection: [90, 240],
  furtherReadingPath: [60, 210]
};

async function main() {
  const personaGenerated = await readJson(PERSONA_OUTPUT, {});
  const workGenerated = await readJson(WORK_OUTPUT, {});
  const personasIndex = await readJson(path.join(DATA_DIR, "personas.index.json"));
  const worksIndex = await readJson(path.join(DATA_DIR, "works.index.json"));
  const personaDetails = await readJson(path.join(DATA_DIR, "personas.details.json"), {});
  const workDetails = await readJson(path.join(DATA_DIR, "works.details.json"), {});
  const personasById = new Map(personasIndex.map((persona) => [persona.id, persona]));
  const worksById = new Map(worksIndex.map((work) => [work.workId, work]));

  const errors = [];
  const warnings = [];
  const personaEntries = generatedEntriesOf(personaGenerated);
  const workEntries = generatedEntriesOf(workGenerated);

  if (!personaEntries.length && !workEntries.length) {
    errors.push({
      scope: "generated",
      message: "No generated content found. Run generate:gpt-profiles or generate:gpt-works before auditing."
    });
  }

  for (const [personaId, entry] of personaEntries) {
    const persona = { ...(personasById.get(personaId) || {}), ...(personaDetails[personaId] || {}) };
    auditPersona(personaId, entry, persona, errors, warnings);
    const merged = personaDetails[personaId] || {};
    for (const field of PERSONA_PROFILE_FIELDS) {
      if (!String(merged[field] || "").trim()) {
        warnings.push({ scope: "persona", id: personaId, field, message: "Generated field has not been merged yet." });
      }
    }
  }

  for (const [workId, entry] of workEntries) {
    const work = worksById.get(workId) || workDetails[workId] || {};
    auditWork(workId, entry, work, errors, warnings);
    const merged = workDetails[workId] || {};
    for (const field of WORK_GUIDE_FIELDS) {
      if (field === "themes") continue;
      if (!String(merged[field] || "").trim()) {
        warnings.push({ scope: "work", id: workId, field, message: "Generated field has not been merged yet." });
      }
    }
  }

  auditSimilarity(personaEntries, "whoHeIs", "persona", errors, warnings);
  auditSimilarity(workEntries, "shortIntro", "work", errors, warnings);

  const report = {
    ok: errors.length === 0,
    generatedPersonaProfiles: personaEntries.length,
    generatedWorkGuides: workEntries.length,
    bannedTerms: BANNED_CONTENT_TERMS,
    errors,
    warnings,
    checkedAt: new Date().toISOString()
  };

  await writeJson(REPORT_JSON, report);
  await writeMarkdownReport(REPORT_MD, report);
  console.log(`Content audit ${report.ok ? "passed" : "failed"}.`);
  console.log(`Persona profiles checked: ${personaEntries.length}`);
  console.log(`Work guides checked: ${workEntries.length}`);
  console.log(`Report: ${path.relative(process.cwd(), REPORT_JSON)}`);
  if (!report.ok) process.exitCode = 1;
}

function auditPersona(id, entry, persona, errors, warnings) {
  const clean = withoutPrivateMetadata(entry);
  for (const field of PERSONA_PROFILE_FIELDS) {
    const value = clean[field];
    if (!String(value || "").trim()) {
      errors.push({ scope: "persona", id, field, message: "Missing required profile field." });
      continue;
    }
    auditLength("persona", id, field, value, PROFILE_LENGTHS[field], warnings);
  }
  auditBanned("persona", id, clean, errors);
  auditConcretePersona(id, clean, persona, warnings);
}

function auditWork(id, entry, work, errors, warnings) {
  const clean = withoutPrivateMetadata(entry);
  for (const field of WORK_GUIDE_FIELDS) {
    const value = clean[field];
    if (field === "themes") {
      if (!Array.isArray(value) || value.length < 5 || value.length > 8) {
        errors.push({ scope: "work", id, field, message: "themes must contain 5 to 8 items." });
      }
      continue;
    }
    if (!String(value || "").trim()) {
      errors.push({ scope: "work", id, field, message: "Missing required work guide field." });
      continue;
    }
    auditLength("work", id, field, value, WORK_LENGTHS[field], warnings);
  }
  auditBanned("work", id, clean, errors);
  const title = String(work?.title || "").replace(/^《|》$/g, "");
  const normalizedTitle = title.replace(/\s*[\(（][^)）]+[\)）]\s*/g, "").trim();
  const intro = String(clean.shortIntro || "");
  if (title && !intro.includes(title) && (!normalizedTitle || !intro.includes(normalizedTitle))) {
    errors.push({ scope: "work", id, field: "shortIntro", message: "shortIntro does not mention the work title." });
  }
}

function auditLength(scope, id, field, value, range, warnings) {
  if (!range) return;
  const count = charCount(value);
  const [min, max] = range;
  if (count < min) warnings.push({ scope, id, field, message: `Text is short: ${count} chars, expected around ${min}+.` });
  if (count > max) warnings.push({ scope, id, field, message: `Text is long: ${count} chars, expected below ${max}.` });
}

function auditBanned(scope, id, entry, errors) {
  const banned = hasBannedTerm(entry);
  if (banned) {
    errors.push({ scope, id, message: `Banned phrase found: ${banned}` });
  }
}

function auditConcretePersona(id, entry, persona, warnings) {
  const text = stringifyForAudit(entry);
  const concreteTerms = [
    persona?.era,
    persona?.identity,
    persona?.school,
    persona?.movement,
    ...(persona?.works || []),
    ...(persona?.representativeWorks || []),
    ...(persona?.keywords || [])
  ].filter(Boolean);
  if (!concreteTerms.some((term) => text.includes(String(term).replace(/^《|》$/g, "")))) {
    warnings.push({
      scope: "persona",
      id,
      message: "Profile may lack a concrete work, school, era, or keyword from the existing data."
    });
  }
}

function auditSimilarity(entries, field, scope, errors, warnings) {
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const [idA, entryA] = entries[i];
      const [idB, entryB] = entries[j];
      const similarity = ngramSimilarity(entryA[field], entryB[field]);
      if (similarity > 0.92) {
        errors.push({ scope, id: `${idA} / ${idB}`, field, message: `Highly similar text: ${similarity.toFixed(2)}.` });
      } else if (similarity > 0.82) {
        warnings.push({ scope, id: `${idA} / ${idB}`, field, message: `Possibly similar text: ${similarity.toFixed(2)}.` });
      }
    }
  }
}

function ngramSimilarity(a, b) {
  const left = ngrams(a);
  const right = ngrams(b);
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const gram of left) {
    if (right.has(gram)) overlap += 1;
  }
  return overlap / Math.max(left.size, right.size);
}

function ngrams(value, size = 3) {
  const chars = Array.from(String(value || "").replace(/\s+/g, ""));
  const result = new Set();
  for (let index = 0; index <= chars.length - size; index += 1) {
    result.add(chars.slice(index, index + size).join(""));
  }
  return result;
}

async function writeMarkdownReport(filePath, report) {
  const lines = [
    "# Content Audit Report",
    "",
    `- Status: ${report.ok ? "passed" : "failed"}`,
    `- Generated persona profiles: ${report.generatedPersonaProfiles}`,
    `- Generated work guides: ${report.generatedWorkGuides}`,
    `- Checked at: ${report.checkedAt}`,
    "",
    "## Errors",
    ""
  ];
  if (!report.errors.length) lines.push("- None");
  for (const item of report.errors) {
    lines.push(`- [${item.scope}] ${item.id || ""} ${item.field || ""}: ${item.message}`);
  }
  lines.push("", "## Warnings", "");
  if (!report.warnings.length) lines.push("- None");
  for (const item of report.warnings) {
    lines.push(`- [${item.scope}] ${item.id || ""} ${item.field || ""}: ${item.message}`);
  }
  await fs.writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
