import fs from "node:fs";
import path from "node:path";
import {
  DEBUG_DIR,
  SOURCE_FILE,
  compactSourceEntry,
  ensureAvatarDirs,
  inferAvatarKind,
  isAuthenticSource,
  localAvatarPath,
  publicPathFromLocal,
  readDataJson,
  readJsonFile,
  sourceToPersonaAvatarFields,
  writeDataJson,
  writeJsonFile
} from "./avatar-pipeline-utils.mjs";

ensureAvatarDirs();

const personas = readDataJson("personas.enriched.json");
const sources = fs.existsSync(SOURCE_FILE) ? readJsonFile(SOURCE_FILE).entries || [] : [];
const byId = new Map(sources.map((entry) => [entry.personaId, entry]));
const manifest = [];
const pending = [];

for (const persona of personas) {
  const source = byId.get(persona.id) || {
    personaId: persona.id,
    displayName: persona.displayName || persona.name || persona.id,
    status: "pending",
    confidence: "pending",
    error: "missing source entry"
  };
  const authentic = isAuthenticSource(source);
  const avatarKind = authentic ? inferAvatarKind(persona, source) : "pending_authentic_image";
  const fields = sourceToPersonaAvatarFields(persona, {
    ...source,
    avatarKind,
    confidence: authentic ? source.confidence || "medium" : "pending"
  });
  Object.assign(persona, fields);

  for (const local of [persona.avatarLocal, persona.avatarThumbLocal, persona.avatarMarkerLocal]) {
    if (!fs.existsSync(publicPathFromLocal(local))) {
      throw new Error(`${persona.id} missing generated avatar file: ${local}`);
    }
  }

  const entry = {
    personaId: persona.id,
    displayName: persona.displayName || persona.name || persona.id,
    avatarLocal: localAvatarPath(persona.id),
    avatarThumbLocal: localAvatarPath(persona.id, "thumb"),
    avatarMarkerLocal: localAvatarPath(persona.id, "marker"),
    avatarKind: persona.avatarKind,
    avatarIsAuthentic: persona.avatarIsAuthentic,
    sourceName: persona.avatarSourceName,
    sourceUrl: persona.avatarSourceUrl,
    license: persona.avatarLicense,
    attribution: persona.avatarAttribution,
    confidence: persona.avatarConfidence,
    needsReview: persona.avatarCredit?.needsReview === true,
    status: authentic ? "localized-authentic" : "pending-authentic-image",
    source: compactSourceEntry(source)
  };
  manifest.push(entry);
  if (!authentic) pending.push(entry);
}

writeDataJson("personas.enriched.json", personas);
writeDataJson("avatar-manifest.json", manifest);
writeJsonFile(path.join(DEBUG_DIR, "avatar-pending.json"), pending);

const stats = manifest.reduce(
  (acc, entry) => {
    acc.total += 1;
    acc[entry.avatarKind] = (acc[entry.avatarKind] || 0) + 1;
    acc.confidence[entry.confidence] = (acc.confidence[entry.confidence] || 0) + 1;
    if (entry.avatarIsAuthentic) acc.authentic += 1;
    if (entry.needsReview) acc.needsReview += 1;
    return acc;
  },
  { total: 0, authentic: 0, needsReview: 0, confidence: {} }
);

writeJsonFile(path.join(DEBUG_DIR, "avatar-manifest-report.json"), {
  generatedAt: new Date().toISOString(),
  stats,
  pending: pending.map((entry) => ({
    personaId: entry.personaId,
    displayName: entry.displayName,
    reason: entry.source?.error || "No reliable localized image."
  }))
});

console.log(`avatar manifest: ${stats.authentic}/${stats.total} authentic, ${pending.length} pending`);
