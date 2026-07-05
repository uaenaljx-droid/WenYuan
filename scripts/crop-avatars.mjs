import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  DEBUG_DIR,
  SOURCE_FILE,
  ensureAvatarDirs,
  isAuthenticSource,
  readJsonFile,
  writeJsonFile
} from "./avatar-pipeline-utils.mjs";

ensureAvatarDirs();

const sources = fs.existsSync(SOURCE_FILE) ? readJsonFile(SOURCE_FILE).entries || [] : [];
const report = [];

for (const entry of sources) {
  if (!isAuthenticSource(entry)) {
    report.push({
      personaId: entry.personaId,
      status: "pending",
      action: "manual-source-needed",
      note: entry.error || "No reliable source localized."
    });
    continue;
  }

  try {
    const metadata = await sharp(entry.originalFile).metadata();
    const minSide = Math.min(metadata.width || 0, metadata.height || 0);
    report.push({
      personaId: entry.personaId,
      status: minSide >= 128 ? "auto-crop-ready" : "manual-review",
      action: "smart-square-cover",
      width: metadata.width || null,
      height: metadata.height || null,
      note: minSide >= 128
        ? "Sharp attention crop will be used for square avatar sizes."
        : "Original is too small; review source or crop manually."
    });
  } catch (error) {
    report.push({
      personaId: entry.personaId,
      status: "manual-review",
      action: "source-read-failed",
      note: error.message || String(error)
    });
  }
}

writeJsonFile(path.join(DEBUG_DIR, "avatar-crop-report.json"), {
  generatedAt: new Date().toISOString(),
  strategy: "Square cover crop with sharp.position.attention; no beautification or AI reconstruction.",
  total: report.length,
  manualReview: report.filter((item) => item.status !== "auto-crop-ready").length,
  entries: report
});

console.log(`avatar crop report: ${report.length} entries, ${report.filter((item) => item.status !== "auto-crop-ready").length} need review`);
