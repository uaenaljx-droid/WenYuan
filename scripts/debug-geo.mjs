import fs from "node:fs";
import path from "node:path";
import {
  coordinateDistanceDegrees,
  getCulturalRegion,
  resolveVisualCoordinates,
  visualOffsetLimit
} from "../src/utils/geoLayout.js";
import {
  TEXTURE_LNG_OFFSET,
  validateLandmarkAlignment
} from "../src/utils/earthProjection.js";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "src", "data");
const CHINA_BOUNDS = { latMin: 18, latMax: 54, lngMin: 73, lngMax: 135 };

const personas = resolveVisualCoordinates(readJson("personas.enriched.json"));
const rows = personas.map((persona) => {
  const region = getCulturalRegion(persona);
  const distanceDeg = coordinateDistanceDegrees(
    Number(persona.birthLat),
    Number(persona.birthLng),
    Number(persona.visualLat),
    Number(persona.visualLng)
  );
  const distanceKm = haversineKm(
    Number(persona.birthLat),
    Number(persona.birthLng),
    Number(persona.visualLat),
    Number(persona.visualLng)
  );
  const inExpectedRegion = region === "east-asia-china"
    ? inBounds(Number(persona.visualLat), Number(persona.visualLng), CHINA_BOUNDS)
    : true;

  return {
    id: persona.id,
    name: persona.displayName || persona.name,
    birthplace: persona.birthplace,
    birth: formatPair(persona.birthLat, persona.birthLng),
    visual: formatPair(persona.visualLat, persona.visualLng),
    anchorMode: persona.anchorMode || "unknown",
    region,
    offsetKm: Math.round(distanceKm),
    offsetDeg: Number(distanceDeg.toFixed(2)),
    limitDeg: visualOffsetLimit(persona),
    overLimit: distanceDeg > visualOffsetLimit(persona) + 0.02,
    inExpectedRegion
  };
});

const suspicious = rows.filter((row) => !row.inExpectedRegion || row.overLimit);
const landmarks = validateLandmarkAlignment();

console.log(`TEXTURE_LNG_OFFSET=${TEXTURE_LNG_OFFSET}`);
console.log(`personas=${rows.length}`);
console.table(rows);
console.log("Landmark projection samples:");
console.table(landmarks.samples);

if (suspicious.length) {
  console.warn("Suspicious geo rows:");
  console.table(suspicious);
  process.exitCode = 1;
} else {
  console.log("All persona visual coordinates are inside their configured regional limits.");
}

if (!landmarks.ok) {
  console.warn("Landmark alignment warnings:");
  console.table(landmarks.samples);
  process.exitCode = 1;
} else {
  console.log(`Landmark projection alignment passed for ${landmarks.samples.length} reference pins.`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA, file), "utf8"));
}

function formatPair(lat, lng) {
  return `${Number(lat).toFixed(2)}, ${Number(lng).toFixed(2)}`;
}

function inBounds(lat, lng, bounds) {
  return lat >= bounds.latMin && lat <= bounds.latMax && lng >= bounds.lngMin && lng <= bounds.lngMax;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return 0;
  const radiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(a));
}

function toRad(value) {
  return (value * Math.PI) / 180;
}
