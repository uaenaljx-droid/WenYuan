import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  DATA_DIR,
  DEBUG_DIR,
  ORIGINAL_DIR,
  SOURCE_FILE,
  compactSourceEntry,
  ensureAvatarDirs,
  extensionFromMimeOrUrl,
  fileTitleFromCommonsUrl,
  inferAvatarKind,
  qidFromText,
  readDataJson,
  readJsonFile,
  wikipediaPageFromUrl,
  writeJsonFile
} from "./avatar-pipeline-utils.mjs";

const USER_AGENT = "WenyuanAvatarPipeline/1.0 (local static atlas; Wikimedia/Wikidata portrait localization)";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const FORCE = process.argv.includes("--force");
const CONCURRENCY = Number(process.env.AVATAR_CONCURRENCY || 8);
const REQUEST_TIMEOUT_MS = Number(process.env.AVATAR_TIMEOUT_MS || 20000);
const REQUEST_DELAY_MS = Number(process.env.AVATAR_REQUEST_DELAY_MS || 0);
const BATCH_START = Number(process.env.AVATAR_BATCH_START || 0);
const BATCH_LIMIT = Number(process.env.AVATAR_BATCH_LIMIT || 0);
const FETCH_WIKIPEDIA_LEAD = process.env.AVATAR_FETCH_WIKIPEDIA === "1";
const SEARCH_MISSING_QIDS = process.env.AVATAR_SEARCH_QIDS === "1";
let lastRequestAt = 0;

ensureAvatarDirs();

const personas = readDataJson("personas.enriched.json");
const previousEntries = fs.existsSync(SOURCE_FILE) ? readJsonFile(SOURCE_FILE).entries || [] : [];
const entryById = new Map(previousEntries.map((entry) => [entry.personaId, entry]));
const rawCandidatesPath = path.join(DATA_DIR, "persona-candidates.raw.wikidata.json");
const rawCandidates = fs.existsSync(rawCandidatesPath)
  ? readJsonFile(rawCandidatesPath).candidates || []
  : [];
const rawByEnglishName = new Map(
  rawCandidates
    .filter((entry) => entry.nameEn && entry.wikidataId)
    .map((entry) => [normalizeKey(entry.nameEn), entry])
);

const directCommonsById = new Map();
const qidById = new Map();
const wikipediaById = new Map();

for (const persona of personas) {
  const directCommons = directCommonsFileTitle(persona);
  if (directCommons) directCommonsById.set(persona.id, directCommons);
  const qid = inferQid(persona);
  if (qid) qidById.set(persona.id, qid);
  const wiki = firstWikipediaPage(persona);
  if (wiki) wikipediaById.set(persona.id, wiki);
}

const targetPersonas = BATCH_LIMIT > 0 ? personas.slice(BATCH_START, BATCH_START + BATCH_LIMIT) : personas.slice(BATCH_START);
if (SEARCH_MISSING_QIDS) await fillMissingQidsFromWikidataSearch(targetPersonas);
const p18ByQid = await fetchP18ForQids(Array.from(new Set(qidById.values())));
const articleImagesById = FETCH_WIKIPEDIA_LEAD ? await fetchWikipediaLeadImages(wikipediaById) : new Map();

const allJobs = personas.map((persona) => {
  const qid = qidById.get(persona.id) || "";
  const commonsTitle = directCommonsById.get(persona.id) || (qid ? p18ByQid.get(qid) : "");
  const articleImage = articleImagesById.get(persona.id);
  return { persona, qid, commonsTitle, articleImage };
});

const jobs = BATCH_LIMIT > 0 ? allJobs.slice(BATCH_START, BATCH_START + BATCH_LIMIT) : allJobs.slice(BATCH_START);
console.log(`avatar fetch batch: start=${BATCH_START} count=${jobs.length} total=${allJobs.length}`);
const touchedEntries = await mapLimit(jobs, CONCURRENCY, async (job, index) => {
  const entry = await localizeAvatar(job);
  entryById.set(entry.personaId, entry);
  if ((index + 1) % 10 === 0) persistSources();
  return entry;
});
persistSources();

const entries = allJobs.map((job) => entryById.get(job.persona.id) || pendingEntry(job.persona, job.qid, "not processed in this batch"));
const stats = entries.reduce(
  (acc, entry) => {
    acc.total += 1;
    acc[entry.status] = (acc[entry.status] || 0) + 1;
    if (entry.avatarKind) acc.kinds[entry.avatarKind] = (acc.kinds[entry.avatarKind] || 0) + 1;
    return acc;
  },
  { total: 0, localized: 0, pending: 0, kinds: {} }
);

console.log(`avatar sources: ${stats.localized}/${stats.total} localized, ${stats.pending || 0} pending`);
console.log(`batch localized: ${touchedEntries.filter((entry) => entry.status === "localized").length}/${touchedEntries.length}`);
console.log(`wrote ${SOURCE_FILE}`);

function persistSources() {
  const currentEntries = allJobs.map((job) => entryById.get(job.persona.id) || pendingEntry(job.persona, job.qid, "not processed yet"));
  const currentStats = currentEntries.reduce(
    (acc, entry) => {
      acc.total += 1;
      acc[entry.status] = (acc[entry.status] || 0) + 1;
      if (entry.avatarKind) acc.kinds[entry.avatarKind] = (acc.kinds[entry.avatarKind] || 0) + 1;
      return acc;
    },
    { total: 0, localized: 0, pending: 0, kinds: {} }
  );
  writeJsonFile(SOURCE_FILE, {
    generatedAt: new Date().toISOString(),
    sourcePolicy: "Prefer Wikimedia Commons and Wikidata P18. Wikipedia lead-image fallback is opt-in with AVATAR_FETCH_WIKIPEDIA=1. No AI, random avatar, Pinterest, Baidu, social-media, or search-cache images.",
    qidCoverage: qidById.size,
    directCommons: directCommonsById.size,
    articleImageCoverage: articleImagesById.size,
    batch: {
      start: BATCH_START,
      limit: BATCH_LIMIT || null,
      processed: jobs.length
    },
    stats: currentStats,
    entries: currentEntries
  });
  writeJsonFile(path.join(DEBUG_DIR, "avatar-pending.json"), currentEntries.filter((entry) => entry.status !== "localized"));
}

async function localizeAvatar({ persona, qid, commonsTitle, articleImage }) {
  try {
    if (commonsTitle) {
      const entry = await downloadSourceImage(persona, sourceFromCommonsTitle(commonsTitle, qid));
      return compactSourceEntry(entry);
    }

    if (articleImage?.downloadUrl) {
      const entry = await downloadSourceImage(persona, {
        qid,
        downloadUrl: articleImage.downloadUrl,
        sourceName: articleImage.sourceName,
        sourceUrl: articleImage.sourceUrl,
        fileTitle: articleImage.fileTitle || null,
        license: "Needs Review",
        attribution: "Wikipedia article lead image; verify Commons metadata manually",
        mime: articleImage.mime || ""
      });
      entry.confidence = "low";
      entry.needsReview = true;
      return compactSourceEntry(entry);
    }

    return pendingEntry(persona, qid, "no Commons/Wikidata/Wikipedia lead image found");
  } catch (error) {
    const source = commonsTitle ? sourceFromCommonsTitle(commonsTitle, qid) : articleImage || null;
    return pendingEntry(persona, qid, error.message || String(error), source);
  }
}

async function downloadSourceImage(persona, source) {
  const ext = extensionFromMimeOrUrl(source.mime, source.downloadUrl);
  const originalFile = path.join(ORIGINAL_DIR, `${persona.id}${ext}`);
  if (FORCE || !fs.existsSync(originalFile)) await downloadFile(source.downloadUrl, originalFile);
  return {
    personaId: persona.id,
    displayName: persona.displayName || persona.name || persona.id,
    qid: source.qid || null,
    status: "localized",
    sourceName: source.sourceName,
    sourceUrl: source.sourceUrl,
    fileTitle: source.fileTitle || null,
    license: source.license || "Needs Review",
    attribution: source.attribution || source.artist || source.sourceName,
    artist: source.artist || "",
    description: source.description || "",
    mime: source.mime || "",
    originalFile,
    avatarKind: inferAvatarKind(persona, source),
    confidence: confidenceFor(persona, source),
    needsReview: false
  };
}

function sourceFromCommonsTitle(commonsTitle, qid) {
  const normalized = commonsTitle.startsWith("File:") ? commonsTitle : `File:${commonsTitle}`;
  const fileName = normalized.replace(/^File:/i, "");
  return {
    qid,
    downloadUrl: commonsThumbUrl(fileName, 500),
    sourceName: "Wikimedia Commons",
    sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(normalized.replace(/ /g, "_"))}`,
    fileTitle: normalized,
    license: "Needs Review",
    attribution: "Wikimedia Commons file page; verify license metadata manually",
    mime: ""
  };
}

function commonsThumbUrl(fileName, width) {
  const normalized = fileName.replace(/ /g, "_");
  const hash = crypto.createHash("md5").update(normalized).digest("hex");
  const encoded = encodeURIComponent(normalized);
  const lower = normalized.toLowerCase();
  const thumbName = lower.endsWith(".svg") || lower.endsWith(".tif") || lower.endsWith(".tiff")
    ? `${width}px-${encoded}.jpg`
    : `${width}px-${encoded}`;
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${hash[0]}/${hash.slice(0, 2)}/${encoded}/${thumbName}`;
}

function inferQid(persona) {
  const text = [
    persona.avatarCredit?.previousSourceUrl,
    persona.avatarSourceUrl,
    ...(persona.references || [])
  ]
    .filter(Boolean)
    .join(" ");
  const direct = qidFromText(text);
  if (direct) return direct;
  const raw = rawByEnglishName.get(normalizeKey(persona.latinName || persona.nameEn || persona.displayName));
  return raw?.wikidataId || "";
}

function directCommonsFileTitle(persona) {
  for (const value of [persona.avatarCredit?.previousSourceUrl, persona.avatarSourceUrl, ...(persona.references || [])]) {
    const title = fileTitleFromCommonsUrl(value);
    if (title) return title.startsWith("File:") ? title : `File:${title}`;
  }
  return "";
}

function firstWikipediaPage(persona) {
  for (const value of [persona.avatarCredit?.previousSourceUrl, ...(persona.references || [])]) {
    const page = wikipediaPageFromUrl(value);
    if (page) return page;
  }
  return null;
}

async function fillMissingQidsFromWikidataSearch(candidates) {
  const missing = candidates.filter((persona) => !qidById.get(persona.id) && !directCommonsById.has(persona.id));
  for (const persona of missing) {
    const query = persona.latinName || persona.nameEn || persona.displayName || persona.name;
    if (!query) continue;
    try {
      const qid = await fetchWikidataSearchQid(query);
      if (qid) qidById.set(persona.id, qid);
    } catch (error) {
      console.warn(`Wikidata search failed for ${persona.id}: ${error.message || error}`);
    }
  }
}

async function fetchWikidataSearchQid(search) {
  const url = new URL(WIKIDATA_API);
  url.search = new URLSearchParams({
    action: "wbsearchentities",
    language: "en",
    uselang: "en",
    type: "item",
    limit: "1",
    search,
    format: "json",
    origin: "*"
  }).toString();
  const data = await fetchJson(url);
  return data.search?.[0]?.id || "";
}

async function fetchP18ForQids(qids) {
  const map = new Map();
  const unique = Array.from(new Set(qids));
  for (let index = 0; index < unique.length; index += 180) {
    const batch = unique.slice(index, index + 180);
    const values = batch.map((qid) => `wd:${qid}`).join(" ");
    const query = `SELECT ?person ?image WHERE { VALUES ?person { ${values} } ?person wdt:P18 ?image. }`;
    const url = new URL("https://query.wikidata.org/sparql");
    url.search = new URLSearchParams({ query, format: "json" }).toString();
    try {
      const data = await fetchJson(url);
      for (const binding of data.results?.bindings || []) {
        const qid = binding.person?.value?.match(/Q\d+$/)?.[0];
        const title = fileTitleFromCommonsUrl(binding.image?.value || "");
        if (qid && title) map.set(qid, title);
      }
    } catch (error) {
      console.warn(`P18 SPARQL batch failed: ${error.message || error}`);
    }
  }
  return map;
}

async function fetchWikipediaLeadImages(wikiById) {
  const result = new Map();
  const groups = new Map();
  for (const [personaId, page] of wikiById) {
    const group = groups.get(page.lang) || [];
    group.push({ personaId, title: page.title });
    groups.set(page.lang, group);
  }

  for (const [lang, pages] of groups) {
    for (let index = 0; index < pages.length; index += 45) {
      const batch = pages.slice(index, index + 45);
      const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
      url.search = new URLSearchParams({
        action: "query",
        titles: batch.map((page) => page.title).join("|"),
        prop: "pageimages|pageprops",
        piprop: "thumbnail|original|name",
        pithumbsize: "900",
        format: "json",
        origin: "*"
      }).toString();
      let data;
      try {
        data = await fetchJson(url);
      } catch (error) {
        console.warn(`Wikipedia pageimage batch failed (${lang} ${index}-${index + batch.length}): ${error.message || error}`);
        continue;
      }
      const pagesByTitle = new Map(Object.values(data.query?.pages || {}).map((page) => [normalizeKey(page.title), page]));
      for (const requested of batch) {
        const page = pagesByTitle.get(normalizeKey(requested.title));
        const downloadUrl = page?.original?.source || page?.thumbnail?.source || "";
        if (!downloadUrl) continue;
        result.set(requested.personaId, {
          downloadUrl,
          sourceName: `${lang}.wikipedia.org`,
          sourceUrl: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(requested.title.replace(/ /g, "_"))}`,
          fileTitle: page?.pageimage ? `File:${page.pageimage}` : null,
          mime: ""
        });
      }
    }
  }
  return result;
}

async function fetchCommonsImageInfo(fileTitle) {
  const title = fileTitle.startsWith("File:") ? fileTitle : `File:${fileTitle}`;
  const url = new URL(COMMONS_API);
  url.search = new URLSearchParams({
    action: "query",
    titles: title,
    prop: "imageinfo",
    iiprop: "url|mime|size|extmetadata",
    iiurlwidth: "900",
    format: "json",
    origin: "*"
  }).toString();
  const data = await fetchJson(url);
  const page = Object.values(data.query?.pages || {})[0];
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata || {};
  return {
    downloadUrl: info.thumburl || info.url,
    sourceUrl: info.url,
    descriptionUrl: info.descriptionurl,
    mime: info.mime,
    license: cleanMeta(meta.LicenseShortName?.value || meta.License?.value || meta.UsageTerms?.value),
    attribution: cleanMeta(meta.Attribution?.value || meta.Credit?.value),
    artist: cleanMeta(meta.Artist?.value),
    description: cleanMeta(meta.ImageDescription?.value || meta.ObjectName?.value)
  };
}

async function fetchJson(url) {
  const response = await fetchWithRetry(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.json();
}

async function downloadFile(url, file) {
  const response = await fetchWithRetry(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} while downloading ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buffer);
}

async function fetchWithRetry(url, options = {}) {
  const delays = (process.env.AVATAR_RETRY_DELAYS || "0,1200")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value >= 0);
  let lastError = null;
  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);
    try {
      const response = await fetchWithTimeout(url, options);
      if (![429, 500, 502, 503, 504].includes(response.status)) return response;
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`fetch failed for ${url}`);
}

async function fetchWithTimeout(url, options = {}) {
  await throttleRequest();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function throttleRequest() {
  if (!REQUEST_DELAY_MS) return;
  const now = Date.now();
  const wait = Math.max(0, lastRequestAt + REQUEST_DELAY_MS - now);
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
      if ((index + 1) % 25 === 0) console.log(`localized ${index + 1}/${items.length}`);
    }
  });
  await Promise.all(workers);
  return results;
}

function pendingEntry(persona, qid, error, source = null) {
  return compactSourceEntry({
    personaId: persona.id,
    displayName: persona.displayName || persona.name || persona.id,
    qid: qid || null,
    status: "pending",
    sourceName: source?.sourceName || null,
    sourceUrl: source?.sourceUrl || null,
    fileTitle: source?.fileTitle || null,
    license: source?.license || null,
    attribution: source?.attribution || null,
    confidence: "pending",
    error
  });
}

function confidenceFor(persona, source) {
  const kind = inferAvatarKind(persona, source);
  if (source.sourceName === "Wikimedia Commons" && kind === "photo" && Number(persona.birthYear) >= 1840) return "high";
  if (source.sourceName === "Wikimedia Commons") return "medium";
  return "low";
}

function cleanMeta(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
