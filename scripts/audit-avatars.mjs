import fs from "node:fs";
import path from "node:path";
import {
  ALL_AVATAR_KINDS,
  AUTHENTIC_KINDS,
  CONFIDENCE_LEVELS,
  DEBUG_DIR,
  ensureAvatarDirs,
  publicPathFromLocal,
  readDataJson,
  writeJsonFile
} from "./avatar-pipeline-utils.mjs";

ensureAvatarDirs();

const personas = readDataJson("personas.enriched.json");
const manifest = readDataJson("avatar-manifest.json");
const routeSequences = fs.existsSync(path.join(process.cwd(), "src", "data", "route-sequences.json"))
  ? readDataJson("route-sequences.json")
  : {};
const manifestById = new Map(manifest.map((entry) => [entry.personaId, entry]));
const bannedText = [/fallback[_-]?seal/i, /single[_-]?character/i, /ai[_-]?generated/i, /randomuser/i, /dicebear/i, /thispersondoesnotexist/i, /generated\.photos/i, /pinterest/i, /search[_-]?engine[_-]?cache/i];
const localUsage = new Map();
const errors = [];
const warnings = [];
const pending = [];

const stats = {
  total: personas.length,
  authentic: 0,
  pending: 0,
  kinds: {},
  confidence: {},
  needsReview: 0,
  files: {
    modal: 0,
    thumb: 0,
    marker: 0
  }
};

for (const persona of personas) {
  const entry = manifestById.get(persona.id);
  const fields = [
    "avatarLocal",
    "avatarThumbLocal",
    "avatarMarkerLocal",
    "avatarKind",
    "avatarSourceName",
    "avatarSourceUrl",
    "avatarLicense",
    "avatarConfidence"
  ];
  for (const field of fields) {
    if (!persona[field]) errors.push(`${persona.id} missing ${field}.`);
  }

  if (!entry) errors.push(`${persona.id} missing avatar-manifest entry.`);
  if (!ALL_AVATAR_KINDS.has(persona.avatarKind)) errors.push(`${persona.id} invalid avatarKind: ${persona.avatarKind}`);
  if (!CONFIDENCE_LEVELS.has(persona.avatarConfidence)) errors.push(`${persona.id} invalid avatarConfidence: ${persona.avatarConfidence}`);

  const isPending = persona.avatarKind === "pending_authentic_image";
  const isAuthentic = AUTHENTIC_KINDS.has(persona.avatarKind);
  if (isAuthentic && persona.avatarIsAuthentic !== true) errors.push(`${persona.id} authentic avatar must set avatarIsAuthentic=true.`);
  if (isPending && persona.avatarIsAuthentic !== false) errors.push(`${persona.id} pending avatar must set avatarIsAuthentic=false.`);
  if (!isPending && String(persona.avatarSourceUrl || "").startsWith("local://")) {
    errors.push(`${persona.id} authentic avatar cannot use local placeholder source.`);
  }

  for (const [label, local] of [
    ["modal", persona.avatarLocal],
    ["thumb", persona.avatarThumbLocal],
    ["marker", persona.avatarMarkerLocal]
  ]) {
    if (!local || !String(local).endsWith(".webp")) {
      errors.push(`${persona.id} ${label} avatar must be a local .webp file.`);
      continue;
    }
    const file = publicPathFromLocal(local);
    if (!fs.existsSync(file)) errors.push(`${persona.id} ${label} avatar file missing: ${local}`);
    else stats.files[label] += 1;
    localUsage.set(local, (localUsage.get(local) || 0) + 1);
  }

  const sourceText = [
    persona.avatarLocal,
    persona.avatarThumbLocal,
    persona.avatarMarkerLocal,
    persona.avatarSourceName,
    persona.avatarSourceUrl,
    persona.avatarLicense,
    persona.avatarCredit?.sourceUrl,
    persona.avatarCredit?.license
  ]
    .filter(Boolean)
    .join(" ");
  for (const pattern of bannedText) {
    if (pattern.test(sourceText) && !isPending) errors.push(`${persona.id} avatar source includes banned placeholder term: ${pattern}`);
  }

  if (persona.avatarUrl) errors.push(`${persona.id} still has remote avatarUrl hotlink.`);
  if (isPending) pending.push(persona.id);
  if (persona.avatarCredit?.needsReview || entry?.needsReview) stats.needsReview += 1;
  if (persona.avatarIsAuthentic) stats.authentic += 1;
  stats.pending += isPending ? 1 : 0;
  stats.kinds[persona.avatarKind] = (stats.kinds[persona.avatarKind] || 0) + 1;
  stats.confidence[persona.avatarConfidence] = (stats.confidence[persona.avatarConfidence] || 0) + 1;
}

for (const [local, count] of localUsage) {
  if (count > 1) errors.push(`${local} is reused by ${count} avatar slots.`);
}

if (pending.length > 30) errors.push(`pending_authentic_image count ${pending.length} exceeds 30.`);

const first100 = routeSequences.globalTourNearestSurface?.slice(0, 100) || [];
const pendingSet = new Set(pending);
const first100Pending = first100.filter((id) => pendingSet.has(id));
if (first100Pending.length > 0) errors.push(`globalTourNearestSurface first 100 has pending avatars: ${first100Pending.join(", ")}`);

const output = {
  ok: errors.length === 0,
  generatedAt: new Date().toISOString(),
  stats,
  pending,
  first100Pending,
  warnings,
  errors
};

writeJsonFile(path.join(DEBUG_DIR, "avatar-audit.json"), output);
console.log(JSON.stringify(output, null, 2));
if (errors.length) process.exit(1);
