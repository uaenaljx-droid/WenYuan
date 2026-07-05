import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const sourceDir = path.resolve(rootDir, "dist");
const targetDir = path.resolve(rootDir, process.env.CLOUDFLARE_DIST_DIR || "cloudflare-dist");
const maxCloudflareFileBytes = 25 * 1024 * 1024;

const excludedRootDirs = new Set(["video", "promo", "debug"]);
const excludedNestedDirs = new Set([path.join("assets", "avatars", "originals")]);

const stats = {
  copiedFiles: 0,
  copiedBytes: 0,
  skippedFiles: 0,
  skippedBytes: 0,
  skipped: []
};

function normalizeRelative(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function shouldSkip(relativePath, entry) {
  const parts = relativePath.split(path.sep);
  const normalized = normalizeRelative(relativePath);
  if (entry.isDirectory()) {
    if (parts.length === 1 && excludedRootDirs.has(parts[0])) return "non-runtime directory";
    if (excludedNestedDirs.has(relativePath)) return "avatar originals are not used by runtime";
  }
  if (entry.isFile() && entry.size >= maxCloudflareFileBytes) return "Cloudflare Pages 25MB file limit";
  if (entry.isFile() && parts.some((part, index) => index === 0 && excludedRootDirs.has(part))) {
    return "non-runtime asset";
  }
  if (entry.isFile() && normalized.startsWith("assets/avatars/originals/")) {
    return "avatar originals are not used by runtime";
  }
  return "";
}

async function ensureSource() {
  try {
    const stat = await fs.stat(sourceDir);
    if (!stat.isDirectory()) throw new Error();
  } catch {
    throw new Error("Missing dist directory. Run npm run build first.");
  }
}

async function copyDirectory(fromDir, toDir, relativeBase = "") {
  await fs.mkdir(toDir, { recursive: true });
  const entries = await fs.readdir(fromDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(fromDir, entry.name);
    const targetPath = path.join(toDir, entry.name);
    const relativePath = relativeBase ? path.join(relativeBase, entry.name) : entry.name;
    const fileStat = entry.isFile() ? await fs.stat(sourcePath) : null;
    const entryWithSize = fileStat ? Object.assign(entry, { size: fileStat.size }) : entry;
    const skipReason = shouldSkip(relativePath, entryWithSize);

    if (skipReason) {
      const skippedBytes = fileStat?.size || (await directorySize(sourcePath));
      stats.skippedFiles += entry.isFile() ? 1 : await countFiles(sourcePath);
      stats.skippedBytes += skippedBytes;
      stats.skipped.push(`${normalizeRelative(relativePath)} (${skipReason})`);
      continue;
    }

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath, relativePath);
      continue;
    }

    if (entry.isFile()) {
      await fs.copyFile(sourcePath, targetPath);
      stats.copiedFiles += 1;
      stats.copiedBytes += fileStat.size;
    }
  }
}

async function countFiles(dir) {
  let count = 0;
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const current = path.join(dir, entry.name);
    if (entry.isDirectory()) count += await countFiles(current);
    if (entry.isFile()) count += 1;
  }
  return count;
}

async function directorySize(dir) {
  let total = 0;
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const current = path.join(dir, entry.name);
    if (entry.isDirectory()) total += await directorySize(current);
    if (entry.isFile()) total += (await fs.stat(current)).size;
  }
  return total;
}

function formatMb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

await ensureSource();
await fs.rm(targetDir, { recursive: true, force: true });
await copyDirectory(sourceDir, targetDir);

console.log(`Prepared ${path.relative(rootDir, targetDir)} for Cloudflare Pages.`);
console.log(`Copied: ${stats.copiedFiles} files, ${formatMb(stats.copiedBytes)}.`);
console.log(`Skipped: ${stats.skippedFiles} files, ${formatMb(stats.skippedBytes)}.`);
if (stats.skipped.length) {
  console.log("Skipped groups:");
  for (const item of stats.skipped.slice(0, 20)) console.log(`- ${item}`);
  if (stats.skipped.length > 20) console.log(`- ...and ${stats.skipped.length - 20} more`);
}
