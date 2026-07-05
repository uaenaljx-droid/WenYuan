const EARTH_RADIUS_KM = 6371;
const routeCache = new Map();

export function sortBySurfaceRoute(personas = [], { startPersonaId = "", startPoint = null, cacheKey = "" } = {}) {
  if (!personas.length) return [];
  const key = cacheKey || createRouteCacheKey(personas, startPersonaId, startPoint);
  if (routeCache.has(key)) return routeCache.get(key).slice();

  const remaining = personas.filter(hasValidPoint).slice();
  const invalid = personas.filter((persona) => !hasValidPoint(persona));
  if (!remaining.length) return personas.slice();

  const route = [];
  let currentIndex = findStartIndex(remaining, startPersonaId, startPoint);
  route.push(...remaining.splice(currentIndex, 1));
  let sameCountryRun = 1;
  let lastCountry = countryOf(route[0]);

  while (remaining.length) {
    const current = route[route.length - 1];
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const candidateCountry = countryOf(candidate);
      const distance = haversineKm(pointOf(current), pointOf(candidate));
      const sameCityPenalty = sameCity(current, candidate) ? 80 + sameCountryRun * 12 : 0;
      const repeatedCountryPenalty = candidateCountry === lastCountry && sameCountryRun > 10 ? sameCountryRun * 85 : 0;
      const categoryBonus = current.primaryCategory && current.primaryCategory !== candidate.primaryCategory ? 24 : 0;
      const eraBonus = current.era && current.era !== candidate.era ? 12 : 0;
      const bridgePenalty = distance > 3000 ? 600 : distance > 1500 ? 180 : 0;
      const score = distance + sameCityPenalty + repeatedCountryPenalty + bridgePenalty - categoryBonus - eraBonus;
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    const [next] = remaining.splice(bestIndex, 1);
    const nextCountry = countryOf(next);
    sameCountryRun = nextCountry === lastCountry ? sameCountryRun + 1 : 1;
    lastCountry = nextCountry;
    route.push(next);
  }

  const sorted = [...route, ...invalid];
  routeCache.set(key, sorted);
  if (routeCache.size > 80) routeCache.delete(routeCache.keys().next().value);
  return sorted.slice();
}

export function createRouteCacheKey(personas = [], startPersonaId = "", startPoint = null) {
  const first = personas[0]?.id || "";
  const last = personas[personas.length - 1]?.id || "";
  const point = startPoint ? `${round(startPoint.lat)},${round(startPoint.lng)}` : "";
  return `${personas.length}:${first}:${last}:${startPersonaId}:${point}`;
}

export function routeMetrics(personas = []) {
  let total = 0;
  let max = 0;
  for (let index = 1; index < personas.length; index += 1) {
    const distance = haversineKm(pointOf(personas[index - 1]), pointOf(personas[index]));
    total += distance;
    max = Math.max(max, distance);
  }
  return {
    averageAdjacentKm: personas.length > 1 ? total / (personas.length - 1) : 0,
    maxAdjacentKm: max
  };
}

export function haversineKm(a, b) {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pointOf(persona) {
  return {
    lat: Number(persona?.visualLat ?? persona?.birthLat),
    lng: Number(persona?.visualLng ?? persona?.birthLng)
  };
}

function findStartIndex(items, startPersonaId, startPoint) {
  const exact = startPersonaId ? items.findIndex((persona) => persona.id === startPersonaId) : -1;
  if (exact >= 0) return exact;
  if (!startPoint) return 0;
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < items.length; index += 1) {
    const distance = haversineKm(startPoint, pointOf(items[index]));
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

function countryOf(persona) {
  return persona?.cultureRegion || persona?.birthCountry || persona?.nationality || persona?.civilizationRegion || "";
}

function sameCity(a, b) {
  const pa = pointOf(a);
  const pb = pointOf(b);
  return Math.abs(pa.lat - pb.lat) < 0.22 && Math.abs(pa.lng - pb.lng) < 0.22;
}

function toRad(value) {
  return (Number(value) * Math.PI) / 180;
}

function round(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}
