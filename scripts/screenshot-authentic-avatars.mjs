import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import {
  DEBUG_DIR,
  ORIGINAL_DIR,
  SOURCE_FILE,
  compactSourceEntry,
  ensureAvatarDirs,
  inferAvatarKind,
  readDataJson,
  readJsonFile,
  writeJsonFile
} from "./avatar-pipeline-utils.mjs";

const CHROME_PATHS = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);

const BATCH_START = Number(process.env.AVATAR_SCREENSHOT_START || 0);
const BATCH_LIMIT = Number(process.env.AVATAR_SCREENSHOT_LIMIT || 80);
const NAV_TIMEOUT_MS = Number(process.env.AVATAR_SCREENSHOT_TIMEOUT_MS || 18000);
const PREFER_ROUTE_FIRST100 = process.env.AVATAR_SCREENSHOT_ROUTE_FIRST100 === "1";
const MANUAL_SOURCE_CANDIDATES = new Map([
  [
    "han-suyin",
    [
      "https://www.npg.org.uk/collections/search/portrait/mw86383/Han-Suyin-ne-Elizabeth-Kuanghu-Chow-later-Comber",
      "https://www.npg.org.uk/collections/search/person/mp71782/han-suyin-nee-elizabeth-kuanghu-chow-later-comber"
    ]
  ],
  ["emily-wu", ["https://www.penguinrandomhouse.com/authors/70359/emily-wu/"]],
  ["sebastian-barry", ["https://www.penguinrandomhouse.com/authors/244507/sebastian-barry/"]],
  ["michio-mado", ["https://www.shinchosha.co.jp/sp/writer/2855/"]],
  ["abu-al-ghazi-bahadur", ["https://en.wikipedia.org/wiki/Abu_al-Ghazi_Bahadur"]]
]);
const TRACEABLE_SOURCE_PATTERN =
  /wikipedia\.org|wikimedia\.org|wikidata\.org|britannica\.com|nobelprize\.org|stanford\.edu|iep\.utm\.edu|npg\.org\.uk|penguinrandomhouse\.com|shinchosha\.co\.jp/i;

ensureAvatarDirs();

const executablePath = CHROME_PATHS.find((candidate) => fs.existsSync(candidate));
if (!executablePath) throw new Error("No local Chrome or Edge executable found for avatar screenshots.");

const personas = readDataJson("personas.enriched.json");
const routes = readDataJson("route-sequences.json");
const sources = fs.existsSync(SOURCE_FILE) ? readJsonFile(SOURCE_FILE) : { entries: [] };
const entries = sources.entries || [];
const byId = new Map(entries.map((entry) => [entry.personaId, entry]));
const personaById = new Map(personas.map((persona) => [persona.id, persona]));

const pendingIds = entries
  .filter((entry) => entry.status !== "localized")
  .map((entry) => entry.personaId);
const orderedIds = PREFER_ROUTE_FIRST100
  ? [
      ...(routes.globalTourNearestSurface || []).slice(0, 100).filter((id) => pendingIds.includes(id)),
      ...pendingIds.filter((id) => !(routes.globalTourNearestSurface || []).slice(0, 100).includes(id))
    ]
  : pendingIds;
const batchIds = orderedIds.slice(BATCH_START, BATCH_LIMIT > 0 ? BATCH_START + BATCH_LIMIT : undefined);

console.log(`avatar screenshots: start=${BATCH_START} count=${batchIds.length} pending=${pendingIds.length}`);

const browser = await puppeteer.launch({
  executablePath,
  headless: "new",
  args: ["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"]
});

let localized = 0;
let failed = 0;

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 1000, deviceScaleFactor: 1 });
  page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
  page.setDefaultTimeout(NAV_TIMEOUT_MS);

  for (let index = 0; index < batchIds.length; index += 1) {
    const persona = personaById.get(batchIds[index]);
    if (!persona) continue;
    const current = byId.get(persona.id) || {};
    const candidates = sourceCandidates(persona, current);
    let entry = null;
    for (const candidate of candidates) {
      try {
        entry = await screenshotCandidate(page, persona, current, candidate);
        if (entry) break;
      } catch (error) {
        current.error = error.message || String(error);
      }
    }

    if (entry) {
      byId.set(persona.id, compactSourceEntry(entry));
      localized += 1;
    } else {
      byId.set(persona.id, compactSourceEntry({
        ...current,
        personaId: persona.id,
        displayName: persona.displayName || persona.name || persona.id,
        status: "pending",
        confidence: "pending",
        error: current.error || "no screenshot source image found"
      }));
      failed += 1;
    }

    if ((index + 1) % 10 === 0) {
      persist();
      console.log(`screenshotted ${index + 1}/${batchIds.length}`);
    }
  }
  persist();
} finally {
  await browser.close();
}

console.log(`avatar screenshots localized=${localized}, failed=${failed}`);

function sourceCandidates(persona, current) {
  const values = [
    ...(MANUAL_SOURCE_CANDIDATES.get(persona.id) || []),
    current.sourceUrl,
    current.fileTitle ? `https://commons.wikimedia.org/wiki/${encodeURIComponent(String(current.fileTitle).replace(/ /g, "_"))}` : "",
    persona.avatarCredit?.previousSourceUrl,
    persona.avatarSourceUrl,
    ...(persona.references || [])
  ]
    .filter(Boolean)
    .filter((url) => /^https?:\/\//i.test(url))
    .filter((url) => TRACEABLE_SOURCE_PATTERN.test(url));
  return Array.from(new Set(values));
}

async function screenshotCandidate(page, persona, current, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForNetworkIdle({ idleTime: 700, timeout: NAV_TIMEOUT_MS }).catch(() => {});
  await page.evaluate(() => window.scrollTo(0, 0));

  const handle = await pickBestImageHandle(page);
  if (!handle) throw new Error(`no usable image element on ${url}`);

  const originalFile = path.join(ORIGINAL_DIR, `${persona.id}.png`);
  await handle.screenshot({ path: originalFile, omitBackground: false });
  await handle.dispose();

  const sourceName = sourceNameFor(url);
  const source = {
    personaId: persona.id,
    displayName: persona.displayName || persona.name || persona.id,
    qid: current.qid || null,
    status: "localized",
    sourceName,
    sourceUrl: url,
    fileTitle: current.fileTitle || null,
    license: current.license || "Needs Review",
    attribution: current.attribution || `${sourceName} rendered page screenshot; verify image file metadata manually`,
    artist: current.artist || "",
    mime: "image/png",
    originalFile,
    avatarKind: inferAvatarKind(persona, { ...current, sourceUrl: url }),
    confidence: confidenceFor(persona, url),
    needsReview: true
  };
  return source;
}

async function pickBestImageHandle(page) {
  const candidates = await page.$$(
    [
      "#file img",
      ".fullImageLink img",
      "a.mw-file-description img",
      "table.infobox img",
      ".infobox img",
      ".mw-parser-output .image img",
      "img.mw-file-element",
      "main img",
      "article img"
    ].join(", ")
  );

  let best = null;
  let bestScore = 0;
  for (const handle of candidates) {
    const box = await handle.boundingBox();
    if (!box || box.width < 80 || box.height < 80) {
      await handle.dispose();
      continue;
    }
    const score = box.width * box.height;
    if (score > bestScore) {
      if (best) await best.dispose();
      best = handle;
      bestScore = score;
    } else {
      await handle.dispose();
    }
  }
  return best;
}

function persist() {
  const merged = personas.map((persona) => byId.get(persona.id) || compactSourceEntry({
    personaId: persona.id,
    displayName: persona.displayName || persona.name || persona.id,
    status: "pending",
    confidence: "pending",
    error: "missing source entry"
  }));
  const stats = merged.reduce(
    (acc, entry) => {
      acc.total += 1;
      acc[entry.status] = (acc[entry.status] || 0) + 1;
      if (entry.avatarKind) acc.kinds[entry.avatarKind] = (acc.kinds[entry.avatarKind] || 0) + 1;
      return acc;
    },
    { total: 0, localized: 0, pending: 0, kinds: {} }
  );
  writeJsonFile(SOURCE_FILE, {
    ...(sources || {}),
    generatedAt: new Date().toISOString(),
    screenshotFallback: {
      sourcePolicy: "Screenshots are only taken from traceable Wikimedia/Wikipedia/encyclopedia pages and marked Needs Review.",
      lastBatch: { start: BATCH_START, limit: BATCH_LIMIT, localized, failed }
    },
    stats,
    entries: merged
  });
  writeJsonFile(path.join(DEBUG_DIR, "avatar-pending.json"), merged.filter((entry) => entry.status !== "localized"));
}

function sourceNameFor(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Traceable web source";
  }
}

function confidenceFor(persona, url) {
  if (/commons\.wikimedia\.org/i.test(url) && Number(persona.birthYear) >= 1840) return "medium";
  if (/commons\.wikimedia\.org/i.test(url)) return "medium";
  return "low";
}
