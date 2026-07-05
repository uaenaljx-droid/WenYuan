import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PERSONAS_PATH = path.join(ROOT, "src", "data", "personas.enriched.json");
const MANIFEST_PATH = path.join(ROOT, "src", "data", "avatar-manifest.json");

const personas = JSON.parse(fs.readFileSync(PERSONAS_PATH, "utf8"));
const manifest = personas.map((persona) => {
  const suggestedSources = [persona.sourceUrl, ...(persona.references || [])].filter(Boolean);
  return {
    personaId: persona.id,
    displayName: persona.displayName,
    status: persona.avatarUrl || persona.avatarLocal ? "remote-review" : "pending",
    avatarUrl: persona.avatarUrl || null,
    avatarLocal: persona.avatarLocal || null,
    preferredSource: suggestedSources[0] || null,
    suggestedSources,
    suggestedSearch: `${persona.latinName || persona.displayName} portrait Wikimedia Commons`,
    avatarCredit: persona.avatarCredit || {
      sourceName: null,
      sourceUrl: null,
      license: null,
      needsReview: true
    },
    notes: "Only use a real, attributable portrait after manual verification. Do not use generated or placeholder portraits."
  };
});

for (const persona of personas) {
  persona.avatarUrl = persona.avatarUrl || null;
  persona.avatarLocal = persona.avatarLocal || null;
  persona.avatarCredit = persona.avatarCredit || {
    sourceName: null,
    sourceUrl: null,
    license: null,
    needsReview: true
  };
  persona.dataQuality = {
    ...persona.dataQuality,
    avatar: persona.avatarUrl || persona.avatarLocal ? "partial" : "missing"
  };
}

fs.writeFileSync(PERSONAS_PATH, `${JSON.stringify(personas, null, 2)}\n`, "utf8");
fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Avatar manifest wrote ${manifest.length} manually reviewable entries.`);
