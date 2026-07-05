import { EARTH_MOTION_CONFIG } from "../config/earthMotionConfig.js";
import { haversineKm, pointOf } from "./surfaceRouteSort.js";
import { isSpinAligned, normalizedLngDelta } from "./earthOrientation.js";

const routeCache = new Map();

export function buildSpinAlignedSurfaceRoute(
  personas = [],
  {
    startPersonaId = "",
    startPoint = null,
    spinDirection = EARTH_MOTION_CONFIG.spinDirection,
    currentFrontLng = null,
    filterPresetId = "",
    cacheKey = ""
  } = {}
) {
  if (!personas.length) return [];
  const key = cacheKey || createSpinRouteCacheKey(personas, { startPersonaId, startPoint, spinDirection, currentFrontLng, filterPresetId });
  if (routeCache.has(key)) return routeCache.get(key).slice();

  const remaining = personas.filter(hasValidPoint).slice();
  const invalid = personas.filter((persona) => !hasValidPoint(persona));
  if (!remaining.length) return personas.slice();

  const route = [];
  const firstIndex = findStartIndex(remaining, startPersonaId, startPoint, currentFrontLng);
  route.push(...remaining.splice(firstIndex, 1));
  const recentRegions = [];

  while (remaining.length) {
    const current = route[route.length - 1];
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const score = scoreNextPersona(current, candidate, {
        spinDirection,
        recentRegions,
        filterPresetId
      });
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    const [next] = remaining.splice(bestIndex, 1);
    route.push(next);
    recentRegions.push(regionOf(next));
    if (recentRegions.length > 5) recentRegions.shift();
  }

  const sorted = [...route, ...invalid];
  routeCache.set(key, sorted);
  if (routeCache.size > 100) routeCache.delete(routeCache.keys().next().value);
  return sorted.slice();
}

export function createSpinRouteCacheKey(personas = [], options = {}) {
  const first = personas[0]?.id || "";
  const last = personas[personas.length - 1]?.id || "";
  const point = options.startPoint ? `${round(options.startPoint.lat)},${round(options.startPoint.lng)}` : "";
  return [
    options.filterPresetId || "",
    personas.length,
    first,
    last,
    options.startPersonaId || "",
    point,
    Math.sign(options.spinDirection || 1),
    round(options.currentFrontLng || 0)
  ].join(":");
}

export function spinRouteMetrics(personas = [], spinDirection = EARTH_MOTION_CONFIG.spinDirection) {
  let reverse = 0;
  let far = 0;
  let total = 0;
  let max = 0;
  for (let index = 1; index < personas.length; index += 1) {
    const previous = pointOf(personas[index - 1]);
    const next = pointOf(personas[index]);
    const distance = haversineKm(previous, next);
    total += distance;
    max = Math.max(max, distance);
    if (!isSpinAligned(previous.lng, next.lng, spinDirection)) reverse += 1;
    if (distance > 3000) far += 1;
  }
  const steps = Math.max(1, personas.length - 1);
  return {
    averageAdjacentKm: personas.length > 1 ? total / steps : 0,
    maxAdjacentKm: max,
    reverseTrendRatio: reverse / steps,
    farJumpRatio: far / steps
  };
}

function scoreNextPersona(current, candidate, context) {
  const currentPoint = pointOf(current);
  const candidatePoint = pointOf(candidate);
  const distanceKm = haversineKm(currentPoint, candidatePoint);
  const lngDelta = normalizedLngDelta(currentPoint.lng, candidatePoint.lng);
  const aligned = Math.abs(lngDelta) < 0.5 || Math.sign(lngDelta) === Math.sign(context.spinDirection || 1);
  const reversePenalty = aligned ? 0 : EARTH_MOTION_CONFIG.reversePenalty * 800;
  const tooFarPenalty =
    distanceKm > 3000
      ? 2000
      : distanceKm > EARTH_MOTION_CONFIG.maxPreferredDistanceKm
        ? 420
        : 0;
  const lngStepPenalty = Math.abs(lngDelta) > EARTH_MOTION_CONFIG.maxPreferredLngStep ? 220 : 0;
  const sameCityPenalty = sameCity(current, candidate) ? 120 : 0;
  const sameRegionPenalty = context.recentRegions.includes(regionOf(candidate)) ? 180 : 0;
  const categoryBonus = current.primaryCategory && current.primaryCategory !== candidate.primaryCategory ? 28 : 0;
  const eraBonus = current.era && current.era !== candidate.era ? 12 : 0;
  return distanceKm + reversePenalty + tooFarPenalty + lngStepPenalty + sameCityPenalty + sameRegionPenalty - categoryBonus - eraBonus;
}

function findStartIndex(items, startPersonaId, startPoint, currentFrontLng) {
  const exact = startPersonaId ? items.findIndex((persona) => persona.id === startPersonaId) : -1;
  if (exact >= 0) return exact;
  if (startPoint) return nearestIndex(items, startPoint);
  if (Number.isFinite(Number(currentFrontLng))) {
    return nearestIndex(items, { lat: 20, lng: Number(currentFrontLng) });
  }
  return 0;
}

function nearestIndex(items, point) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < items.length; index += 1) {
    const distance = haversineKm(point, pointOf(items[index]));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function hasValidPoint(persona) {
  const point = pointOf(persona);
  return Number.isFinite(point.lat) && Number.isFinite(point.lng);
}

function sameCity(a, b) {
  const pa = pointOf(a);
  const pb = pointOf(b);
  return Math.abs(pa.lat - pb.lat) < 0.22 && Math.abs(pa.lng - pb.lng) < 0.22;
}

function regionOf(persona) {
  return persona?.cultureRegion || persona?.civilizationRegion || persona?.birthCountry || persona?.nationality || "";
}

function round(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}
