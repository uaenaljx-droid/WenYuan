import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  AVATAR_DIR,
  DEBUG_DIR,
  MARKER_DIR,
  SOURCE_FILE,
  THUMB_DIR,
  ensureAvatarDirs,
  isAuthenticSource,
  readDataJson,
  readJsonFile,
  writeJsonFile
} from "./avatar-pipeline-utils.mjs";

ensureAvatarDirs();

const personas = readDataJson("personas.enriched.json");
const sources = fs.existsSync(SOURCE_FILE) ? readJsonFile(SOURCE_FILE).entries || [] : [];
const byId = new Map(sources.map((entry) => [entry.personaId, entry]));
const outputs = [
  { key: "modal", dir: AVATAR_DIR, size: 256, quality: 82 },
  { key: "thumb", dir: THUMB_DIR, size: 96, quality: 78 },
  { key: "marker", dir: MARKER_DIR, size: 64, quality: 72 }
];

const report = [];

for (const persona of personas) {
  const source = byId.get(persona.id);
  const authentic = isAuthenticSource(source);
  const result = {
    personaId: persona.id,
    status: authentic ? "generated" : "pending-skeleton",
    files: {}
  };

  for (const output of outputs) {
    const target = path.join(output.dir, `${persona.id}.webp`);
    if (authentic) {
      await sharp(source.originalFile)
        .rotate()
        .resize(output.size, output.size, {
          fit: "cover",
          position: sharp.strategy.attention,
          withoutEnlargement: false
        })
        .webp({ quality: output.quality, effort: 5 })
        .toFile(target);
    } else {
      await createPendingSkeleton(output.size)
        .webp({ quality: output.quality, effort: 4 })
        .toFile(target);
    }
    result.files[output.key] = {
      path: target,
      bytes: fs.statSync(target).size
    };
  }
  report.push(result);
}

writeJsonFile(path.join(DEBUG_DIR, "avatar-size-report.json"), {
  generatedAt: new Date().toISOString(),
  total: report.length,
  generated: report.filter((entry) => entry.status === "generated").length,
  pendingSkeletons: report.filter((entry) => entry.status === "pending-skeleton").length,
  entries: report
});

console.log(
  `avatar sizes: ${report.filter((entry) => entry.status === "generated").length}/${report.length} authentic, ${report.filter((entry) => entry.status === "pending-skeleton").length} pending skeletons`
);

function createPendingSkeleton(size) {
  const labelSize = Math.max(10, Math.round(size * 0.16));
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2b3435"/>
      <stop offset="1" stop-color="#111817"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <circle cx="${size / 2}" cy="${size * 0.42}" r="${size * 0.18}" fill="none" stroke="#8d9a93" stroke-width="${Math.max(1, size * 0.025)}" opacity="0.72"/>
  <path d="M ${size * 0.26} ${size * 0.75} C ${size * 0.34} ${size * 0.58}, ${size * 0.66} ${size * 0.58}, ${size * 0.74} ${size * 0.75}" fill="none" stroke="#8d9a93" stroke-width="${Math.max(1, size * 0.025)}" stroke-linecap="round" opacity="0.72"/>
  ${size >= 90 ? `<text x="50%" y="${size * 0.9}" text-anchor="middle" fill="#c7d0c9" font-family="system-ui, sans-serif" font-size="${labelSize}">图像待核验</text>` : ""}
</svg>`;
  return sharp(Buffer.from(svg));
}
