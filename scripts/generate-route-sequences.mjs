import fs from "node:fs";
import path from "node:path";
import { buildSpinAlignedSurfaceRoute } from "../src/utils/spinAlignedRoute.js";
import { applyFilterPreset, normalizePersonaTaxonomy } from "../src/utils/filterPersonas.js";
import { EARTH_MOTION_CONFIG } from "../src/config/earthMotionConfig.js";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "src", "data");

const personas = readJson("personas.enriched.json").map(normalizePersonaTaxonomy);
const byId = new Map(personas.map((persona) => [persona.id, persona]));
const globalTour = buildSpinRoute(personas).map((persona) => persona.id);

const routeSequences = {
  globalTour,
  globalTourNearestSurface: buildNearestSurfaceSequence(),
  chinaLiterature: buildSpinRoute(applyFilterPreset(personas, "中国文学"), "中国文学").map((persona) => persona.id),
  westernPhilosophy: buildSpinRoute(applyFilterPreset(personas, "西方哲学"), "西方哲学").map((persona) => persona.id),
  poetsAcrossWorld: buildSpinRoute(personas.filter((persona) => persona.category === "诗人"), "poets").map((persona) => persona.id),
  novelistsAcrossWorld: buildSpinRoute(personas.filter((persona) => persona.category === "小说家"), "novelists").map((persona) => persona.id),
  ancientToModern: personas
    .slice()
    .sort((a, b) => Number(a.birthYear ?? 9999) - Number(b.birthYear ?? 9999))
    .map((persona) => persona.id),
  eastWestDialogue: buildEastWestDialogue()
};

writeJson("route-sequences.json", routeSequences);
console.log(`generated route-sequences.json with ${Object.keys(routeSequences).length} sequences`);

function buildEastWestDialogue() {
  const east = personas.filter((persona) => isEast(persona));
  const west = personas.filter((persona) => !isEast(persona));
  const sequence = [];
  const max = Math.max(east.length, west.length);
  for (let index = 0; index < max; index += 1) {
    if (east[index]) sequence.push(east[index].id);
    if (west[index]) sequence.push(west[index].id);
  }
  return sequence;
}

function pick(predicate) {
  return interleaveByRegion(personas.filter(predicate));
}

function buildNearestSurfaceSequence() {
  const ready = personas.filter((persona) => persona.avatarKind !== "pending_authentic_image" && persona.avatarIsAuthentic === true);
  const pending = personas.filter((persona) => persona.avatarKind === "pending_authentic_image" || persona.avatarIsAuthentic !== true);
  return [...buildSpinRoute(ready, "ready"), ...buildSpinRoute(pending, "pending")].map((persona) => persona.id);
}

function buildSpinRoute(items, filterPresetId = "all") {
  return buildSpinAlignedSurfaceRoute(items, {
    filterPresetId,
    spinDirection: EARTH_MOTION_CONFIG.spinDirection,
    cacheKey: `route-sequence:${filterPresetId}:${items.length}`
  });
}

function nearestSurfaceOrder(items) {
  if (!items.length) return [];
  const remaining = items.slice().sort((a, b) => Number(a.visualLng ?? a.birthLng ?? 0) - Number(b.visualLng ?? b.birthLng ?? 0));
  const sequence = [remaining.shift()];
  let lastRegion = regionOf(sequence[0]);
  let regionRun = 1;

  while (remaining.length) {
    const current = sequence[sequence.length - 1];
    let bestIndex = -1;
    let bestScore = Number.POSITIVE_INFINITY;
    const mustChangeRegion = regionRun >= 18 && remaining.some((item) => regionOf(item) !== lastRegion);

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const candidateRegion = regionOf(candidate);
      if (mustChangeRegion && candidateRegion === lastRegion) continue;
      let score = surfaceDistanceKm(current, candidate);
      if (candidateRegion === lastRegion && regionRun >= 14) score += 3500 + regionRun * 400;
      if (candidateRegion !== lastRegion && regionRun >= 12) score -= 1200;
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    const [next] = remaining.splice(bestIndex >= 0 ? bestIndex : 0, 1);
    const nextRegion = regionOf(next);
    regionRun = nextRegion === lastRegion ? regionRun + 1 : 1;
    lastRegion = nextRegion;
    sequence.push(next);
  }

  return sequence;
}

function interleaveByRegion(items) {
  const buckets = new Map();
  for (const item of items) {
    const region = regionOf(item);
    const bucket = buckets.get(region) || [];
    bucket.push(item);
    buckets.set(region, bucket);
  }

  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => Number(a.birthYear ?? 9999) - Number(b.birthYear ?? 9999));
  }

  const orderedRegions = Array.from(buckets.keys()).sort((a, b) => buckets.get(b).length - buckets.get(a).length);
  const sequence = [];
  let added = true;
  while (added) {
    added = false;
    for (const region of orderedRegions) {
      const item = buckets.get(region)?.shift();
      if (item && byId.has(item.id)) {
        sequence.push(item.id);
        added = true;
      }
    }
  }
  return sequence;
}

function isChina(persona) {
  return String(persona.nationality || persona.birthCountry || "").includes("中国");
}

function isEast(persona) {
  const text = [persona.nationality, persona.birthCountry, persona.culturalRegion].join(" ");
  return /中国|日本|韩国|印度|东亚|南亚/.test(text);
}

function regionOf(persona) {
  if (persona.culturalRegion && persona.culturalRegion !== "global-modern") return persona.culturalRegion;
  const lng = Number(persona.birthLng);
  if (Number.isFinite(lng)) {
    if (lng > 70 && lng < 150) return "east-asia";
    if (lng > 45 && lng <= 70) return "central-asia";
    if (lng > 15 && lng <= 45) return "east-europe-africa";
    if (lng > 5 && lng <= 15) return Number(persona.birthLat) >= 50 ? "north-central-europe" : "central-west-europe";
    if (lng > -5 && lng <= 5) return Number(persona.birthLat) >= 48 ? "france-benelux" : "west-mediterranean";
    if (lng > -20 && lng <= -5) return "atlantic-europe-africa";
    if (lng > -80 && lng <= -20) return "atlantic-americas";
    if (lng < -30) return "americas";
  }
  return persona.nationality || "global";
}

function surfaceDistanceKm(a, b) {
  const lat1 = toRadians(Number(a.visualLat ?? a.birthLat ?? 0));
  const lng1 = toRadians(Number(a.visualLng ?? a.birthLng ?? 0));
  const lat2 = toRadians(Number(b.visualLat ?? b.birthLat ?? 0));
  const lng2 = toRadians(Number(b.visualLng ?? b.birthLng ?? 0));
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(path.join(DATA_DIR, file), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
