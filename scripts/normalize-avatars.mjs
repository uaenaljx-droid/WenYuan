import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "src", "data");
const AVATAR_DIR = path.join(ROOT, "public", "assets", "avatars");
const PERSONAS_FILE = path.join(DATA_DIR, "personas.enriched.json");
const MANIFEST_FILE = path.join(DATA_DIR, "avatar-manifest.json");

const personas = readJson(PERSONAS_FILE);
const previousManifest = new Map(readJson(MANIFEST_FILE).map((entry) => [entry.personaId, entry]));

let fallbackCount = 0;
const manifest = [];

for (const persona of personas) {
  const localPath = `/assets/avatars/${persona.id}.webp`;
  const fullPath = path.join(AVATAR_DIR, `${persona.id}.webp`);
  const existing = previousManifest.get(persona.id);
  const previousCredit = persona.avatarCredit || existing?.avatarCredit || {};
  const previousSourceUrl = persona.avatarSourceUrl || previousCredit.sourceUrl || existing?.avatarUrl || persona.avatarUrl || "";

  if (!fs.existsSync(fullPath)) {
    throw new Error(`${persona.id} missing generated avatar file: ${localPath}`);
  }

  const sourceName = "Wenyuan local fallback seal";
  const sourceUrl = "local://wenyuan-fallback-seal";
  const license = "Project-generated placeholder; not a real portrait";
  const attribution = "Wenyuan Atlas local seal placeholder";
  const reviewNote = previousSourceUrl
    ? "Fallback seal used until the linked portrait can be manually verified and localized."
    : "No reliable portrait is confirmed; using the local Wenyuan seal placeholder.";

  persona.avatarLocal = localPath;
  persona.avatarUrl = null;
  persona.avatarKind = "fallback_seal";
  persona.avatarIsAuthentic = false;
  persona.avatarSourceName = sourceName;
  persona.avatarSourceUrl = sourceUrl;
  persona.avatarLicense = license;
  persona.avatarAttribution = attribution;
  persona.avatarConfidence = "fallback";
  persona.avatarReviewNote = reviewNote;
  persona.avatarCredit = {
    sourceName,
    sourceUrl,
    license,
    attribution,
    needsReview: Boolean(previousSourceUrl),
    previousSourceUrl: previousSourceUrl || null,
    note: reviewNote
  };
  persona.dataQuality = {
    ...(persona.dataQuality || {}),
    avatar: "fallback"
  };
  fallbackCount += 1;

  manifest.push({
    personaId: persona.id,
    displayName: persona.displayName || persona.name || persona.id,
    avatarLocal: localPath,
    avatarKind: persona.avatarKind,
    avatarIsAuthentic: persona.avatarIsAuthentic,
    sourceName,
    sourceUrl,
    license,
    attribution,
    confidence: persona.avatarConfidence,
    needsReview: Boolean(previousSourceUrl),
    previousSourceUrl: previousSourceUrl || null,
    status: "fallback-seal",
    notes: reviewNote
  });
}

writeJson(PERSONAS_FILE, personas);
writeJson(MANIFEST_FILE, manifest);

console.log(`normalized avatars for ${personas.length} personas`);
console.log(`fallback_seal: ${fallbackCount}`);
console.log(`manifest: src/data/avatar-manifest.json`);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
