import * as THREE from "three";
import {
  applyTextureLongitudeOffset,
  calibrateLongitudeForTexture,
  geoToSphere,
  getEarthRotationForLatLng,
  normalizeLng
} from "./earthProjection.js";
import { haversineKm, pointOf } from "./surfaceRouteSort.js";

const TWO_PI = Math.PI * 2;

export function latLngToSphereVector(lat, lng, radius = 1) {
  return geoToSphere(lat, lng, radius);
}

export function rotationForLatLng(lat, lng, options = {}) {
  return getEarthRotationForLatLng(lat, lng, options);
}

export function getFrontCenterFromRotation(rotation = {}) {
  const lat = THREE.MathUtils.radToDeg(Number(rotation.x || 0));
  const correctedLng = THREE.MathUtils.radToDeg(-Number(rotation.y || 0));
  return {
    lat: clamp(lat, -85, 85),
    lng: normalizeLng(calibrateLongitudeForTexture(correctedLng))
  };
}

export function isPointOnFrontHemisphere(point, frontCenter, maxDistanceKm = 10007) {
  if (!point || !frontCenter) return false;
  return haversineKm(point, frontCenter) <= maxDistanceKm;
}

export function isPersonaOnFrontHemisphere(persona, frontCenter, maxDistanceKm) {
  return isPointOnFrontHemisphere(pointOf(persona), frontCenter, maxDistanceKm);
}

export function normalizedLngDelta(fromLng, toLng) {
  let delta = Number(toLng) - Number(fromLng);
  if (!Number.isFinite(delta)) return 0;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

export function isSpinAligned(fromLng, toLng, spinDirection = 1) {
  const delta = normalizedLngDelta(fromLng, toLng);
  if (Math.abs(delta) < 0.5) return true;
  return Math.sign(delta) === Math.sign(spinDirection || 1);
}

export function spinAlignedRotationY(currentY, targetY, { spinDirection = 1, maxExtraRotationDeg = 80 } = {}) {
  const shortest = nearestAngle(currentY, targetY);
  const direction = Math.sign(spinDirection || 1);
  let spinTarget = shortest;
  const delta = spinTarget - currentY;

  if (direction > 0 && delta < 0) spinTarget += TWO_PI;
  if (direction < 0 && delta > 0) spinTarget -= TWO_PI;

  const extra = Math.abs(spinTarget - currentY) - Math.abs(shortest - currentY);
  const maxExtra = THREE.MathUtils.degToRad(maxExtraRotationDeg);
  return extra <= maxExtra ? spinTarget : shortest;
}

export function alignRotationToSpin(currentRotation, targetRotation, options = {}) {
  if (!targetRotation) return null;
  return {
    x: targetRotation.x,
    y: spinAlignedRotationY(currentRotation.y || 0, targetRotation.y, options),
    z: targetRotation.z
  };
}

export function textureCorrectedLng(lng) {
  return applyTextureLongitudeOffset(lng);
}

function nearestAngle(current, target) {
  return current + ((((target - current) % TWO_PI) + Math.PI * 3) % TWO_PI) - Math.PI;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}
