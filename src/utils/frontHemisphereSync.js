import { EARTH_MOTION_CONFIG } from "../config/earthMotionConfig.js";
import { haversineKm, pointOf } from "./surfaceRouteSort.js";
import { isPersonaOnFrontHemisphere } from "./earthOrientation.js";

export function findNearestFrontPersona({ personas = [], frontCenter = null, currentPersonaId = "" } = {}) {
  if (!frontCenter || !personas.length) return null;
  let best = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const persona of personas) {
    const point = pointOf(persona);
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) continue;
    const distance = haversineKm(frontCenter, point);
    const frontBonus = isPersonaOnFrontHemisphere(persona, frontCenter) ? -320 : 0;
    const currentPenalty = persona.id === currentPersonaId ? 60 : 0;
    const score = distance + frontBonus + currentPenalty;
    if (score < bestScore) {
      bestScore = score;
      best = persona;
    }
  }
  return best;
}

export function frontHemispherePersonas(personas = [], frontCenter = null) {
  if (!frontCenter) return [];
  return personas
    .filter((persona) => isPersonaOnFrontHemisphere(persona, frontCenter))
    .sort((a, b) => haversineKm(frontCenter, pointOf(a)) - haversineKm(frontCenter, pointOf(b)));
}

export function shouldSyncFrontHemisphere({ isSearching = false, isHovering = false, isModalOpen = false } = {}) {
  return EARTH_MOTION_CONFIG.syncCarouselWithFrontHemisphereOnEnter && !isSearching && !isHovering && !isModalOpen;
}
