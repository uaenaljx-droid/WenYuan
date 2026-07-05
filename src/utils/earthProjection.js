import * as THREE from "three";

export const TEXTURE_LNG_OFFSET = 90;
export const DEBUG_GEO_ALIGNMENT = false;

export const LANDMARKS = [
  { name: "北京", lat: 39.9042, lng: 116.4074, region: "china" },
  { name: "西安", lat: 34.3416, lng: 108.9398, region: "china" },
  { name: "曲阜", lat: 35.5807, lng: 116.9865, region: "china" },
  { name: "洛阳", lat: 34.6197, lng: 112.454, region: "china" },
  { name: "杭州", lat: 30.2741, lng: 120.1551, region: "china" },
  { name: "雅典", lat: 37.9838, lng: 23.7275, region: "greece" },
  { name: "巴黎", lat: 48.8566, lng: 2.3522, region: "western-europe" },
  { name: "伦敦", lat: 51.5072, lng: -0.1276, region: "british-isles" },
  { name: "柯尼斯堡", lat: 54.7104, lng: 20.4522, region: "central-europe" },
  { name: "莫斯科", lat: 55.7558, lng: 37.6173, region: "eastern-europe" },
  { name: "都柏林", lat: 53.3498, lng: -6.2603, region: "british-isles" },
  { name: "布宜诺斯艾利斯", lat: -34.6037, lng: -58.3816, region: "latin-america" }
];

const REGION_BOUNDS = {
  china: { latMin: 18, latMax: 54, lngMin: 73, lngMax: 135 },
  greece: { latMin: 34, latMax: 42, lngMin: 18, lngMax: 30 },
  "western-europe": { latMin: 41, latMax: 56, lngMin: -7, lngMax: 12 },
  "british-isles": { latMin: 49, latMax: 56, lngMin: -11, lngMax: 3 },
  "central-europe": { latMin: 45, latMax: 56, lngMin: 5, lngMax: 25 },
  "eastern-europe": { latMin: 48, latMax: 61, lngMin: 25, lngMax: 45 },
  "latin-america": { latMin: -56, latMax: 13, lngMin: -82, lngMax: -34 }
};

export function applyTextureLongitudeOffset(lng) {
  return normalizeLng(Number(lng) + TEXTURE_LNG_OFFSET);
}

export function calibrateLongitudeForTexture(lng) {
  return normalizeLng(Number(lng) - TEXTURE_LNG_OFFSET);
}

export function geoToSphere(lat, lng, radius) {
  const safeLat = Number(lat);
  const safeLng = Number(lng);
  if (!Number.isFinite(safeLat) || !Number.isFinite(safeLng)) {
    return new THREE.Vector3(0, 0, radius);
  }

  const correctedLng = applyTextureLongitudeOffset(safeLng);
  const latRad = THREE.MathUtils.degToRad(safeLat);
  const lngRad = THREE.MathUtils.degToRad(correctedLng);

  return new THREE.Vector3(
    radius * Math.cos(latRad) * Math.sin(lngRad),
    radius * Math.sin(latRad),
    radius * Math.cos(latRad) * Math.cos(lngRad)
  );
}

export function getEarthRotationForLatLng(lat, lng, options = {}) {
  const safeLat = Number(lat);
  const safeLng = Number(lng);
  if (!Number.isFinite(safeLat) || !Number.isFinite(safeLng)) return null;

  const currentRotation = options.currentRotation || { x: 0, y: 0, z: 0 };
  const screenOffsetX = options.screenOffsetX ?? 0;
  const screenOffsetY = options.screenOffsetY ?? 0.02;
  const latRad = THREE.MathUtils.degToRad(safeLat);
  const correctedLng = applyTextureLongitudeOffset(safeLng);
  const lngRad = THREE.MathUtils.degToRad(correctedLng);
  const targetX = THREE.MathUtils.clamp(latRad - screenOffsetY, -0.78, 0.78);
  const targetY = -lngRad + screenOffsetX;

  return {
    x: nearestAngle(currentRotation.x || 0, targetX),
    y: nearestAngle(currentRotation.y || 0, targetY),
    z: nearestAngle(currentRotation.z || 0, 0)
  };
}

export function debugLandmarkPins(radius = 2.5) {
  return LANDMARKS.map((landmark) => ({
    ...landmark,
    position: geoToSphere(landmark.lat, landmark.lng, radius)
  }));
}

export function validateLandmarkAlignment() {
  const samples = LANDMARKS.map((landmark) => {
    const bounds = REGION_BOUNDS[landmark.region];
    const withinBounds = bounds ? isWithinBounds(landmark.lat, landmark.lng, bounds) : true;
    const position = geoToSphere(landmark.lat, landmark.lng, 1);
    return {
      name: landmark.name,
      lat: landmark.lat,
      lng: landmark.lng,
      correctedLng: applyTextureLongitudeOffset(landmark.lng),
      region: landmark.region,
      spherePosition: {
        x: roundVector(position.x),
        y: roundVector(position.y),
        z: roundVector(position.z)
      },
      hemisphereHint: hemisphereHint(position),
      withinBounds
    };
  });
  return {
    ok: samples.every((sample) => sample.withinBounds),
    textureLongitudeOffset: TEXTURE_LNG_OFFSET,
    samples
  };
}

function hemisphereHint(position) {
  const eastWest = position.x >= 0 ? "+X" : "-X";
  const frontBack = position.z >= 0 ? "+Z" : "-Z";
  const northSouth = position.y >= 0 ? "+Y" : "-Y";
  return `${eastWest}/${frontBack}/${northSouth}`;
}

function roundVector(value) {
  return Math.round(value * 1000) / 1000;
}

export function normalizeLng(value) {
  let lng = Number(value);
  if (!Number.isFinite(lng)) return 0;
  while (lng > 180) lng -= 360;
  while (lng < -180) lng += 360;
  return Math.round(lng * 1000000) / 1000000;
}

function isWithinBounds(lat, lng, bounds) {
  return lat >= bounds.latMin && lat <= bounds.latMax && lng >= bounds.lngMin && lng <= bounds.lngMax;
}

function nearestAngle(current, target) {
  const twoPi = Math.PI * 2;
  return current + ((((target - current) % twoPi) + Math.PI * 3) % twoPi) - Math.PI;
}
