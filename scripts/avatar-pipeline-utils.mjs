import fs from "node:fs";
import path from "node:path";

export const ROOT = process.cwd();
export const DATA_DIR = path.join(ROOT, "src", "data");
export const PUBLIC_DIR = path.join(ROOT, "public");
export const AVATAR_DIR = path.join(PUBLIC_DIR, "assets", "avatars");
export const ORIGINAL_DIR = path.join(AVATAR_DIR, "originals");
export const THUMB_DIR = path.join(AVATAR_DIR, "thumbs");
export const MARKER_DIR = path.join(AVATAR_DIR, "markers");
export const DEBUG_DIR = path.join(PUBLIC_DIR, "debug");
export const SOURCE_FILE = path.join(DEBUG_DIR, "avatar-sources.json");

export const AUTHENTIC_KINDS = new Set([
  "photo",
  "historical_portrait",
  "sculpture",
  "engraving",
  "museum_image"
]);

export const ALL_AVATAR_KINDS = new Set([...AUTHENTIC_KINDS, "pending_authentic_image"]);
export const CONFIDENCE_LEVELS = new Set(["high", "medium", "low", "pending"]);

export function ensureAvatarDirs() {
  for (const dir of [AVATAR_DIR, ORIGINAL_DIR, THUMB_DIR, MARKER_DIR, DEBUG_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function readJsonFile(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function readDataJson(file) {
  return readJsonFile(path.join(DATA_DIR, file));
}

export function writeJsonFile(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeDataJson(file, value) {
  writeJsonFile(path.join(DATA_DIR, file), value);
}

export function localAvatarPath(personaId, size = "modal") {
  if (size === "thumb") return `/assets/avatars/thumbs/${personaId}.webp`;
  if (size === "marker") return `/assets/avatars/markers/${personaId}.webp`;
  return `/assets/avatars/${personaId}.webp`;
}

export function publicPathFromLocal(localPath) {
  return path.join(PUBLIC_DIR, String(localPath || "").replace(/^\//, ""));
}

export function normalizeTitle(value) {
  return decodeURIComponent(String(value || ""))
    .replace(/^https?:\/\/commons\.wikimedia\.org\/wiki\//i, "")
    .replace(/^Special:FilePath\//i, "File:")
    .replace(/_/g, " ")
    .trim();
}

export function fileTitleFromCommonsUrl(url) {
  const input = String(url || "");
  if (!/commons\.wikimedia\.org|upload\.wikimedia\.org|wikimedia\.org\/wiki\/Special:FilePath/i.test(input)) {
    return "";
  }
  const fileMatch = input.match(/\/wiki\/(File:[^?#]+)/i);
  if (fileMatch) return normalizeTitle(fileMatch[1]);
  const specialMatch = input.match(/Special:FilePath\/([^?#]+)/i);
  if (specialMatch) return `File:${normalizeTitle(specialMatch[1])}`;
  const uploadMatch = input.match(/\/([^/?#]+\.(?:jpe?g|png|webp|tiff?|gif))([?#]|$)/i);
  if (uploadMatch) return `File:${normalizeTitle(uploadMatch[1])}`;
  return "";
}

export function wikipediaPageFromUrl(url) {
  const match = String(url || "").match(/^https?:\/\/([a-z-]+)\.wikipedia\.org\/wiki\/([^?#]+)/i);
  if (!match) return null;
  return {
    lang: match[1],
    title: decodeURIComponent(match[2]).replace(/_/g, " ")
  };
}

export function qidFromText(text) {
  const match = String(text || "").match(/wikidata\.org\/entity\/(Q\d+)/i);
  return match?.[1] || "";
}

export function extensionFromMimeOrUrl(mime = "", url = "") {
  const lowerMime = String(mime).toLowerCase();
  if (lowerMime.includes("png")) return ".png";
  if (lowerMime.includes("webp")) return ".webp";
  if (lowerMime.includes("tif")) return ".tif";
  if (lowerMime.includes("gif")) return ".gif";
  const clean = String(url).split("?")[0].split("#")[0];
  const ext = path.extname(clean).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".gif"].includes(ext)) return ext;
  return ".jpg";
}

export function inferAvatarKind(persona, source = {}) {
  const birthYear = Number(persona.birthYear);
  const text = [
    source.fileTitle,
    source.sourceUrl,
    source.description,
    source.attribution,
    persona.avatarCredit?.previousSourceUrl
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("bust") || text.includes("statue") || text.includes("sculpture") || text.includes("louvre")) {
    return "sculpture";
  }
  if (text.includes("engraving") || text.includes("etching") || text.includes("woodcut") || text.includes("lithograph")) {
    return "engraving";
  }
  if (text.includes("museum") || text.includes("gallery") || text.includes("archive") || text.includes("library")) {
    return "museum_image";
  }
  if (Number.isFinite(birthYear) && birthYear >= 1840) return "photo";
  return "historical_portrait";
}

export function isAuthenticSource(entry) {
  return Boolean(entry?.status === "localized" && entry?.sourceUrl && entry?.originalFile);
}

export function sourceToPersonaAvatarFields(persona, entry) {
  const authentic = isAuthenticSource(entry);
  const kind = authentic ? inferAvatarKind(persona, entry) : "pending_authentic_image";
  const sourceName = authentic ? entry.sourceName || "Wikimedia Commons" : "Pending authentic image";
  const sourceUrl = authentic ? entry.sourceUrl : `local://pending-authentic-image/${persona.id}`;
  const license = authentic ? entry.license || "Needs Review" : "Needs Review";
  const attribution = authentic ? entry.attribution || entry.artist || sourceName : "No reliable portrait localized yet";
  const confidence = authentic ? entry.confidence || "medium" : "pending";
  const note = authentic
    ? "Localized from a traceable Wikimedia/Wikidata source; review license and crop if needed."
    : "No reliable portrait was localized in the automated pass; keep as pending, not a final avatar.";

  return {
    avatarUrl: null,
    avatarLocal: localAvatarPath(persona.id),
    avatarThumbLocal: localAvatarPath(persona.id, "thumb"),
    avatarMarkerLocal: localAvatarPath(persona.id, "marker"),
    avatarKind: kind,
    avatarIsAuthentic: authentic,
    avatarSourceName: sourceName,
    avatarSourceUrl: sourceUrl,
    avatarLicense: license,
    avatarAttribution: attribution,
    avatarConfidence: confidence,
    avatarReviewNote: note,
    avatarCredit: {
      sourceName,
      sourceUrl,
      license,
      attribution,
      needsReview: !authentic || confidence !== "high",
      previousSourceUrl: persona.avatarCredit?.previousSourceUrl || persona.avatarSourceUrl || null,
      note
    },
    dataQuality: {
      ...(persona.dataQuality || {}),
      avatar: authentic ? "verified" : "missing"
    }
  };
}

export function compactSourceEntry(entry) {
  return {
    personaId: entry.personaId,
    displayName: entry.displayName,
    qid: entry.qid || null,
    status: entry.status,
    sourceName: entry.sourceName || null,
    sourceUrl: entry.sourceUrl || null,
    fileTitle: entry.fileTitle || null,
    license: entry.license || null,
    attribution: entry.attribution || null,
    artist: entry.artist || null,
    mime: entry.mime || null,
    originalFile: entry.originalFile || null,
    avatarKind: entry.avatarKind || null,
    confidence: entry.confidence || "pending",
    needsReview: entry.needsReview ?? entry.confidence !== "high",
    error: entry.error || null
  };
}
