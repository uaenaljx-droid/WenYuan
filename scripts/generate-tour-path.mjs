import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "src", "data");
const PUBLIC_DEBUG_DIR = path.join(ROOT, "public", "debug");
const START_ID = "qu-yuan";
const FAR_JUMP_KM = 6000;

const personas = readJson("personas.enriched.json").filter(hasCoordinate);
const allPersonas = readJson("personas.enriched.json");
const existing = fs.existsSync(path.join(DATA_DIR, "route-sequences.json")) ? readJson("route-sequences.json") : {};
const byId = new Map(personas.map((persona) => [persona.id, persona]));
const missingCoordinates = allPersonas.filter((persona) => !hasCoordinate(persona)).map((persona) => persona.id);

if (missingCoordinates.length) {
  console.error(`Cannot generate tour path; missing coordinates: ${missingCoordinates.join(", ")}`);
  process.exit(1);
}

const avatarReadyPersonas = personas.filter((persona) => persona.avatarKind !== "pending_authentic_image");
const pendingAvatarPersonas = personas.filter((persona) => persona.avatarKind === "pending_authentic_image");
const avatarReadySequence = buildNearestSurfaceTour(avatarReadyPersonas);
const sequence = [
  ...avatarReadySequence,
  ...buildNearestContinuation(pendingAvatarPersonas, avatarReadySequence.at(-1))
];
const stats = computeStats(sequence);

const routeSequences = {
  ...existing,
  globalTour: sequence,
  globalTourNearestSurface: sequence
};

writeJson(path.join(DATA_DIR, "route-sequences.json"), routeSequences);
fs.mkdirSync(PUBLIC_DEBUG_DIR, { recursive: true });
writeJson(path.join(PUBLIC_DEBUG_DIR, "tour-stats.json"), stats);

console.log(`generated globalTourNearestSurface with ${sequence.length} personas`);
console.log(`averageAdjacentKm=${stats.averageAdjacentKm}`);
console.log(`maxAdjacentKm=${stats.maxAdjacentKm}`);
console.log(`farJumpRatio=${stats.farJumpRatio}`);

function buildNearestSurfaceTour(candidates) {
  if (!candidates.length) return [];
  const candidateIds = new Set(candidates.map((persona) => persona.id));
  const start = candidateIds.has(START_ID) ? byId.get(START_ID) : candidates[0];
  const unvisited = new Set(candidates.map((persona) => persona.id));
  const sequence = [start.id];
  unvisited.delete(start.id);

  let current = start;
  while (unvisited.size > 0) {
    const next = chooseNext(current, unvisited, sequence);
    sequence.push(next.id);
    unvisited.delete(next.id);
    current = next;
  }
  return sequence;
}

function buildNearestContinuation(candidates, previousId) {
  if (!candidates.length) return [];
  const unvisited = new Set(candidates.map((persona) => persona.id));
  const sequence = [];
  let current = byId.get(previousId) || candidates[0];

  while (unvisited.size > 0) {
    const next = chooseNext(current, unvisited, sequence);
    sequence.push(next.id);
    unvisited.delete(next.id);
    current = next;
  }

  return sequence;
}

function chooseNext(current, unvisited, sequence) {
  const recentRegions = sequence.slice(-8).map((id) => regionOf(byId.get(id)));
  const recentCountries = sequence.slice(-10).map((id) => countryOf(byId.get(id)));
  const currentRegionRun = countTailRun(recentRegions, regionOf(current));
  const currentCountryRun = countTailRun(recentCountries, countryOf(current));
  let best = null;

  for (const id of unvisited) {
    const candidate = byId.get(id);
    const distance = haversineKm(pointOf(current), pointOf(candidate));
    const sameRegionRun = countTailRun(recentRegions, regionOf(candidate));
    const sameCountryRun = countTailRun(recentCountries, countryOf(candidate));
    const bridgeRegionBonus = currentRegionRun >= 7 && regionOf(candidate) !== regionOf(current) && distance < 3600 ? 1600 : 0;
    const bridgeCountryBonus = currentCountryRun >= 9 && countryOf(candidate) !== countryOf(current) && distance < 2400 ? 900 : 0;
    const score =
      distance +
      Math.max(0, sameRegionRun - 5) * 820 +
      Math.max(0, sameCountryRun - 7) * 720 -
      bridgeRegionBonus -
      bridgeCountryBonus -
      (candidate.category !== current.category ? 55 : 0) -
      (candidate.era !== current.era ? 35 : 0);

    if (!best || score < best.score) best = { candidate, score, distance };
  }

  return best.candidate;
}

function computeStats(sequence) {
  const distances = [];
  let max = 0;
  let farJumps = 0;
  let maxSameCountryRun = 0;
  let maxSameRegionRun = 0;
  let countryRun = 0;
  let regionRun = 0;
  let lastCountry = null;
  let lastRegion = null;
  const repeated = sequence.length - new Set(sequence).size;

  for (let index = 0; index < sequence.length; index += 1) {
    const persona = byId.get(sequence[index]);
    const country = countryOf(persona);
    const region = regionOf(persona);
    countryRun = country === lastCountry ? countryRun + 1 : 1;
    regionRun = region === lastRegion ? regionRun + 1 : 1;
    lastCountry = country;
    lastRegion = region;
    maxSameCountryRun = Math.max(maxSameCountryRun, countryRun);
    maxSameRegionRun = Math.max(maxSameRegionRun, regionRun);

    if (index === 0) continue;
    const previous = byId.get(sequence[index - 1]);
    const distance = haversineKm(pointOf(previous), pointOf(persona));
    distances.push(distance);
    max = Math.max(max, distance);
    if (distance > FAR_JUMP_KM) farJumps += 1;
  }

  const average = distances.reduce((sum, distance) => sum + distance, 0) / Math.max(1, distances.length);
  return {
    generatedAt: new Date().toISOString(),
    routeId: "globalTourNearestSurface",
    totalPersonas: sequence.length,
    uniquePersonas: new Set(sequence).size,
    repeatedPersonas: repeated,
    missingCoordinates: missingCoordinates.length,
    averageAdjacentKm: Math.round(average),
    maxAdjacentKm: Math.round(max),
    farJumpThresholdKm: FAR_JUMP_KM,
    farJumpCount: farJumps,
    farJumpRatio: Number((farJumps / Math.max(1, distances.length)).toFixed(4)),
    maxSameCountryRun,
    maxSameRegionRun,
    startsAt: sequence[0],
    endsAt: sequence.at(-1),
    randomBaselineAverageKm: Math.round(randomBaselineAverage()),
    sequence
  };
}

function randomBaselineAverage() {
  const sorted = personas.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
  let total = 0;
  let count = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    total += haversineKm(pointOf(sorted[index - 1]), pointOf(sorted[index]));
    count += 1;
  }
  return total / Math.max(1, count);
}

function hasCoordinate(persona) {
  return Number.isFinite(Number(persona.visualLat ?? persona.birthLat)) && Number.isFinite(Number(persona.visualLng ?? persona.birthLng));
}

function pointOf(persona) {
  return {
    lat: Number(persona.visualLat ?? persona.birthLat),
    lng: Number(persona.visualLng ?? persona.birthLng)
  };
}

function haversineKm(a, b) {
  const radius = 6371;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRad(value) {
  return (Number(value) * Math.PI) / 180;
}

function regionOf(persona) {
  if (!persona) return "unknown";
  if (persona.culturalRegion && persona.culturalRegion !== "global-modern") return persona.culturalRegion;
  const lng = Number(persona.visualLng ?? persona.birthLng);
  if (Number.isFinite(lng)) {
    if (lng > 70 && lng < 150) return "east-asia";
    if (lng > 45 && lng <= 70) return "central-asia";
    if (lng > 15 && lng <= 45) return "east-europe-africa";
    if (lng > 5 && lng <= 15) return Number(persona.visualLat ?? persona.birthLat) >= 50 ? "north-central-europe" : "central-west-europe";
    if (lng > -5 && lng <= 5) return Number(persona.visualLat ?? persona.birthLat) >= 48 ? "france-benelux" : "west-mediterranean";
    if (lng > -20 && lng <= -5) return "atlantic-europe-africa";
    if (lng > -80 && lng <= -20) return "atlantic-americas";
    if (lng <= -80) return "americas";
  }
  return "global";
}

function countryOf(persona) {
  return String(persona?.birthCountry || persona?.nationality || regionOf(persona) || "unknown");
}

function countTailRun(values, nextValue) {
  let count = 0;
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] !== nextValue) break;
    count += 1;
  }
  return count;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
