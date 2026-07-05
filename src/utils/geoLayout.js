import { geoToSphere } from "./earthProjection.js";

const REGION_ANCHORS = {
  "east-asia-china": { lat: 34, lng: 108, latRadius: 13, lngRadius: 24 },
  "east-asia-japan": { lat: 36, lng: 138, latRadius: 7, lngRadius: 10 },
  "ancient-greece": { lat: 38, lng: 23, latRadius: 5, lngRadius: 8 },
  "western-europe": { lat: 47, lng: 2, latRadius: 9, lngRadius: 14 },
  "central-europe": { lat: 50, lng: 10, latRadius: 9, lngRadius: 15 },
  "eastern-europe-russia": { lat: 55, lng: 37, latRadius: 10, lngRadius: 22 },
  "british-isles": { lat: 52, lng: -2, latRadius: 7, lngRadius: 10 },
  "north-america": { lat: 41, lng: -74, latRadius: 7, lngRadius: 14 },
  "latin-america": { lat: -15, lng: -60, latRadius: 13, lngRadius: 18 },
  "middle-east-persia": { lat: 32, lng: 53, latRadius: 9, lngRadius: 15 },
  "south-asia": { lat: 25, lng: 78, latRadius: 8, lngRadius: 13 },
  mediterranean: { lat: 41, lng: 15, latRadius: 8, lngRadius: 13 },
  "global-modern": { lat: 20, lng: 0, latRadius: 22, lngRadius: 45 }
};

const ERA_OFFSETS = {
  春秋: { lat: 1.8, lng: -2.5 },
  战国: { lat: -2.1, lng: 3.2 },
  秦汉: { lat: -3.4, lng: -1.6 },
  楚辞时代: { lat: -5.6, lng: 5.5 },
  魏晋南北朝: { lat: -5.2, lng: -2.8 },
  东晋: { lat: -4.8, lng: -3.5 },
  唐代: { lat: 3.6, lng: 5.2 },
  宋代: { lat: -3.2, lng: -5.4 },
  元代: { lat: 1.8, lng: -4.8 },
  明代: { lat: -2.6, lng: 4.8 },
  清代: { lat: 2.8, lng: -6.4 },
  现代中国: { lat: 1.2, lng: 5.8 },
  当代中国: { lat: -2.4, lng: 7.5 },
  古希腊: { lat: 2.2, lng: -1.2 },
  古罗马晚期: { lat: -3.8, lng: -2.2 },
  中世纪经院哲学: { lat: 2.4, lng: 3.6 },
  文艺复兴: { lat: -1.8, lng: 4.8 },
  启蒙时代: { lat: -2.8, lng: -3.8 },
  "17世纪": { lat: -2.6, lng: -4.2 },
  德国古典哲学: { lat: 3.6, lng: 4.8 },
  "19世纪": { lat: -3.8, lng: 5.8 },
  "20世纪思想": { lat: 2.8, lng: -5.4 },
  现代主义时期: { lat: -4.6, lng: -5.8 }
};

const SCHOOL_OFFSETS = {
  儒家: { lat: 2.2, lng: -3.2 },
  道家: { lat: -2.6, lng: 3.8 },
  法家: { lat: 0.6, lng: 6.2 },
  心学: { lat: -3.6, lng: 4.8 },
  关学理学: { lat: 3.4, lng: -4.6 },
  考据与经世: { lat: 0.8, lng: -7.2 },
  古希腊哲学: { lat: 2.6, lng: -2.4 },
  柏拉图主义: { lat: 0.6, lng: 2.6 },
  经院哲学: { lat: 2.2, lng: 3.2 },
  理性主义: { lat: -2.4, lng: -4.8 },
  经验主义: { lat: 2.6, lng: -3.8 },
  批判哲学: { lat: 3.2, lng: -2.8 },
  德国观念论: { lat: 2.8, lng: 4.2 },
  意志哲学: { lat: -3.2, lng: 5.4 },
  存在主义: { lat: -4.2, lng: -5.6 },
  分析哲学: { lat: 4.4, lng: -4.8 },
  后结构主义: { lat: -4.8, lng: -6.4 },
  政治思想: { lat: 2.4, lng: -6.8 },
  精神分析: { lat: -2.8, lng: 6.2 }
};

const DEFAULT_COORDINATE_MODE = "birthplace-first";
const ORDINARY_BIRTH_OFFSET_LIMIT = 0.6;
const SAME_PLACE_OFFSET_LIMIT = 1.2;

export function toSpherePosition(lat, lng, radius) {
  const position = geoToSphere(lat, lng, radius);
  return { x: position.x, y: position.y, z: position.z };
}

export function stableHashOffset(id) {
  const hashA = fnv1a(`${id}:lat`);
  const hashB = fnv1a(`${id}:lng`);
  const hashC = fnv1a(`${id}:phase`);
  const angle = ((hashA % 3600) / 3600) * Math.PI * 2;
  const radius = 0.35 + (hashC % 100) / 100;

  return {
    lat: round(Math.sin(angle) * radius),
    lng: round(Math.cos(angle) * radius * 1.25 + ((hashB % 100) - 50) / 100)
  };
}

export function getCulturalRegion(persona) {
  const nationality = String(persona.nationality || "");
  const era = String(persona.era || "");
  const birthplace = String(persona.birthplace || "");

  if (nationality.includes("中国")) return "east-asia-china";
  if (nationality.includes("日本")) return "east-asia-japan";
  if (nationality.includes("古希腊") || era.includes("古希腊")) return "ancient-greece";
  if (nationality.includes("罗马") || era.includes("古罗马")) return "mediterranean";
  if (nationality.includes("意大利") || nationality.includes("西班牙") || nationality.includes("黎巴嫩")) {
    return "mediterranean";
  }
  if (nationality.includes("法国")) return "western-europe";
  if (
    nationality.includes("荷兰") ||
    nationality.includes("瑞士") ||
    nationality.includes("比利时") ||
    nationality.includes("丹麦")
  ) {
    return "western-europe";
  }
  if (nationality.includes("德国") || nationality.includes("普鲁士") || nationality.includes("奥地利")) {
    return "central-europe";
  }
  if (nationality.includes("俄国") || nationality.includes("俄罗斯") || nationality.includes("波兰")) {
    return "eastern-europe-russia";
  }
  if (nationality.includes("英国") || nationality.includes("爱尔兰")) return "british-isles";
  if (nationality.includes("美国")) return "north-america";
  if (nationality.includes("阿根廷") || nationality.includes("哥伦比亚")) return "latin-america";
  if (nationality.includes("印度")) return "south-asia";
  if (nationality.includes("波斯") || nationality.includes("伊朗") || nationality.includes("土耳其")) {
    return "middle-east-persia";
  }
  if (birthplace.includes("阿尔及利亚") || birthplace.includes("北非")) return "mediterranean";
  return "global-modern";
}

export function getRegionAnchor(persona) {
  return REGION_ANCHORS[getCulturalRegion(persona)] || REGION_ANCHORS["global-modern"];
}

export function normalizeBirthplaceCoordinate(persona) {
  const birthLat = Number(persona.birthLat);
  const birthLng = Number(persona.birthLng);
  if (Number.isFinite(birthLat) && Number.isFinite(birthLng)) {
    return { lat: clampLat(birthLat), lng: normalizeLng(birthLng) };
  }

  const anchor = getRegionAnchor(persona);
  return { lat: anchor.lat, lng: anchor.lng };
}

export function applyRegionalSpread(persona, index = 0, group = []) {
  const region = getCulturalRegion(persona);
  const anchor = REGION_ANCHORS[region] || REGION_ANCHORS["global-modern"];
  const base = normalizeBirthplaceCoordinate(persona);
  const count = Math.max(group.length, 1);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const angle = index * golden + ((fnv1a(`${persona.id}:regional`) % 100) / 100) * Math.PI;
  const rank = count <= 1 ? 0 : index / Math.max(count - 1, 1);
  const radial = 0.24 + Math.sqrt(rank) * 0.78;
  const hash = stableHashOffset(persona.id);

  const birthWeight = hasBirthCoordinate(persona) ? 0.72 : 0;
  const regionWeight = 1 - birthWeight;
  const mixedLat = base.lat * birthWeight + anchor.lat * regionWeight;
  const mixedLng = blendLng(base.lng, anchor.lng, birthWeight);

  const era = ERA_OFFSETS[persona.era] || { lat: 0, lng: 0 };
  const school = SCHOOL_OFFSETS[persona.school] || SCHOOL_OFFSETS[persona.movement] || { lat: 0, lng: 0 };
  const latOffset = Math.sin(angle) * anchor.latRadius * radial + hash.lat + era.lat * 0.55 + school.lat * 0.35;
  const lngOffset = Math.cos(angle) * anchor.lngRadius * radial + hash.lng + era.lng * 0.55 + school.lng * 0.35;

  return {
    ...persona,
    culturalRegion: region,
    visualLat: clampLat(mixedLat + latOffset),
    visualLng: normalizeLng(mixedLng + lngOffset)
  };
}

export function applyEraSchoolOffset(persona, allPersonas = []) {
  const region = getCulturalRegion(persona);
  const group = allPersonas.filter((item) => getCulturalRegion(item) === region);
  const index = Math.max(0, group.findIndex((item) => item.id === persona.id));
  return applyRegionalSpread(persona, index, group);
}

export function avoidMarkerOverlap(personas) {
  const resolved = personas.map((persona) => ({ ...persona }));
  const minDistance = 3.2;

  for (let pass = 0; pass < 5; pass += 1) {
    for (let index = 0; index < resolved.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < resolved.length; otherIndex += 1) {
        const a = resolved[index];
        const b = resolved[otherIndex];
        const dLat = a.visualLat - b.visualLat;
        const dLng = normalizedSignedDeltaLng(a.visualLng, b.visualLng);
        const distance = Math.sqrt(dLat * dLat + dLng * dLng);
        if (distance >= minDistance) continue;

        const angle = distance === 0 ? ((fnv1a(`${a.id}:${b.id}`) % 360) * Math.PI) / 180 : Math.atan2(dLat, dLng);
        const push = (minDistance - Math.max(distance, 0.001)) * 0.48;
        const latPush = Math.sin(angle) * push;
        const lngPush = Math.cos(angle) * push;
        a.visualLat = clampLat(a.visualLat + latPush);
        a.visualLng = normalizeLng(a.visualLng + lngPush);
        b.visualLat = clampLat(b.visualLat - latPush);
        b.visualLng = normalizeLng(b.visualLng - lngPush);
      }
    }
  }

  return resolved;
}

export function resolveVisualCoordinates(personas, { mode = DEFAULT_COORDINATE_MODE } = {}) {
  if (mode === "birthplace-first") return resolveBirthplaceFirstCoordinates(personas);

  const groups = new Map();
  for (const persona of personas) {
    const region = getCulturalRegion(persona);
    const group = groups.get(region) || [];
    group.push(persona);
    groups.set(region, group);
  }

  const spread = personas.map((persona) => {
    const hasVisual =
      persona.visualLat !== null &&
      persona.visualLat !== undefined &&
      persona.visualLat !== "" &&
      persona.visualLng !== null &&
      persona.visualLng !== undefined &&
      persona.visualLng !== "" &&
      Number.isFinite(Number(persona.visualLat)) &&
      Number.isFinite(Number(persona.visualLng));
    if (hasVisual) {
      return constrainVisualToBirth({
        ...persona,
        culturalRegion: getCulturalRegion(persona),
        visualLat: clampLat(Number(persona.visualLat)),
        visualLng: normalizeLng(Number(persona.visualLng))
      });
    }

    const group = groups.get(getCulturalRegion(persona)) || [persona];
    const index = group.findIndex((item) => item.id === persona.id);
    return constrainVisualToBirth(applyRegionalSpread(persona, Math.max(index, 0), group));
  });

  return avoidMarkerOverlap(spread)
    .map((persona) => constrainVisualToBirth(persona))
    .map((persona) => ({
      ...persona,
      visualLat: clampLat(persona.visualLat),
      visualLng: normalizeLng(persona.visualLng),
      lat: clampLat(persona.visualLat),
      lng: normalizeLng(persona.visualLng),
      importance: importanceForPersona(persona)
    }));
}

function resolveBirthplaceFirstCoordinates(personas) {
  const birthGroups = new Map();
  for (const persona of personas) {
    if (!hasBirthCoordinate(persona)) continue;
    const key = birthCoordinateKey(persona);
    const group = birthGroups.get(key) || [];
    group.push(persona);
    birthGroups.set(key, group);
  }

  return personas.map((persona) => {
    const region = getCulturalRegion(persona);
    const hasBirth = hasBirthCoordinate(persona);
    const base = hasBirth ? normalizeBirthplaceCoordinate(persona) : getRegionAnchor(persona);
    const group = hasBirth ? birthGroups.get(birthCoordinateKey(persona)) || [persona] : [persona];
    const index = Math.max(0, group.findIndex((item) => item.id === persona.id));
    const offset = hasBirth ? samePlaceOffset(persona, index, group.length) : stableHashOffset(persona.id);
    const limit = hasBirth && group.length > 1 ? SAME_PLACE_OFFSET_LIMIT : ORDINARY_BIRTH_OFFSET_LIMIT;
    const visualLat = hasBirth ? clampLat(base.lat + offset.lat) : clampLat(base.lat + offset.lat * 2.2);
    const visualLng = hasBirth ? normalizeLng(base.lng + offset.lng) : normalizeLng(base.lng + offset.lng * 2.8);

    return {
      ...persona,
      culturalRegion: region,
      visualLat,
      visualLng,
      lat: visualLat,
      lng: visualLng,
      anchorMode: coordinateAnchorMode(persona),
      visualOffsetLimitDeg: hasBirth ? limit : visualOffsetLimit(persona),
      duplicateBirthplaceCount: hasBirth ? group.length : 0,
      importance: importanceForPersona(persona)
    };
  });
}

export function validateCoordinateSpread(personas, radius = 2.57) {
  const errors = [];
  const grid = new Map();
  const smallArea = new Map();
  const positions = [];
  const maxInGrid = Math.max(1, Math.floor(personas.length * 0.25));
  const maxSmallArea = Math.max(1, Math.floor(personas.length * 0.35));

  for (const persona of personas) {
    const lat = Number(persona.visualLat ?? persona.lat);
    const lng = Number(persona.visualLng ?? persona.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      errors.push(`${persona.id} missing visual coordinates.`);
      continue;
    }
    if (lat < -75 || lat > 75 || lng < -180 || lng > 180) {
      errors.push(`${persona.id} visual coordinates out of range: ${lat}, ${lng}.`);
    }
    if (hasBirthCoordinate(persona)) {
      const distance = coordinateDistanceDegrees(persona.birthLat, persona.birthLng, lat, lng);
      const limit = visualOffsetLimit(persona);
      if (distance > limit + 0.02) {
        errors.push(`${persona.id} visual coordinate is ${distance.toFixed(2)}deg from birthplace, over ${limit}deg.`);
      }
    }

    const gridKey = `${Math.floor(lat / 8) * 8}:${Math.floor(lng / 8) * 8}`;
    pushMap(grid, gridKey, persona.id);

    const smallKey = `${getCulturalRegion(persona)}:${Math.floor(lat / 16) * 16}:${Math.floor(lng / 16) * 16}`;
    pushMap(smallArea, smallKey, persona.id);

    const position = toSpherePosition(lat, lng, radius);
    positions.push({ id: persona.id, position });
  }

  for (const [key, ids] of grid) {
    if (ids.length > maxInGrid) {
      errors.push(`visual coordinate grid ${key} contains ${ids.length} personas, over 25% threshold: ${ids.join(", ")}.`);
    }
  }

  for (const [key, ids] of smallArea) {
    if (ids.length > maxSmallArea) {
      errors.push(`small cultural area ${key} contains ${ids.length} personas: ${ids.join(", ")}.`);
    }
  }

  let closePairs = 0;
  for (let index = 0; index < positions.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < positions.length; otherIndex += 1) {
      const a = positions[index];
      const b = positions[otherIndex];
      const distance = sphereDistance(a.position, b.position);
      if (distance < 0.006) closePairs += 1;
    }
  }
  if (closePairs > Math.max(4, Math.floor(personas.length * 0.08))) {
    errors.push(`sphere positions have too many repeated anchors: ${closePairs}.`);
  }

  return {
    ok: errors.length === 0,
    errors,
    cells: grid.size,
    maxCellCount: Math.max(0, ...Array.from(grid.values(), (ids) => ids.length)),
    closePairs
  };
}

export function coordinateDistanceDegrees(aLat, aLng, bLat, bLng) {
  const latDelta = Number(aLat) - Number(bLat);
  const lngDelta = normalizedSignedDeltaLng(Number(aLng), Number(bLng));
  if (!Number.isFinite(latDelta) || !Number.isFinite(lngDelta)) return Infinity;
  return Math.sqrt(latDelta * latDelta + lngDelta * lngDelta);
}

export function visualOffsetLimit(persona) {
  if (Number.isFinite(Number(persona.visualOffsetLimitDeg))) return Number(persona.visualOffsetLimitDeg);
  if (hasBirthCoordinate(persona)) {
    return Number(persona.duplicateBirthplaceCount) > 1 ? SAME_PLACE_OFFSET_LIMIT : ORDINARY_BIRTH_OFFSET_LIMIT;
  }
  return 7;
}

export function constrainVisualToBirth(persona) {
  if (!hasBirthCoordinate(persona)) return persona;
  const birthLat = clampLat(Number(persona.birthLat));
  const birthLng = normalizeLng(Number(persona.birthLng));
  const visualLat = clampLat(Number(persona.visualLat));
  const visualLng = normalizeLng(Number(persona.visualLng));
  const distance = coordinateDistanceDegrees(birthLat, birthLng, visualLat, visualLng);
  const limit = visualOffsetLimit(persona);
  if (!Number.isFinite(distance) || distance <= limit) {
    return { ...persona, visualLat, visualLng };
  }

  const ratio = limit / distance;
  const lat = birthLat + (visualLat - birthLat) * ratio;
  const lng = birthLng + normalizedSignedDeltaLng(visualLng, birthLng) * ratio;
  return {
    ...persona,
    visualLat: clampLat(lat),
    visualLng: normalizeLng(lng)
  };
}

function hasBirthCoordinate(persona) {
  return Number.isFinite(Number(persona.birthLat)) && Number.isFinite(Number(persona.birthLng));
}

export function coordinateAnchorMode(persona) {
  if (!hasBirthCoordinate(persona)) return "fallbackRegion";
  const text = [persona.birthplace, persona.dataQuality?.notes].filter(Boolean).join(" ");
  if (/争议|说法并存|传统说法|不详/.test(text)) return "disputedBirthplace";
  return "birthplace";
}

function birthCoordinateKey(persona) {
  return `${Math.round(Number(persona.birthLat) * 20) / 20}:${Math.round(Number(persona.birthLng) * 20) / 20}`;
}

function samePlaceOffset(persona, index, count) {
  if (count <= 1) return { lat: 0, lng: 0 };
  const angle = index * Math.PI * (3 - Math.sqrt(5)) + ((fnv1a(`${persona.id}:birth-ring`) % 100) / 100) * 0.24;
  const ring = Math.min(SAME_PLACE_OFFSET_LIMIT, 0.34 + Math.floor(index / 6) * 0.22 + Math.min(count, 6) * 0.035);
  return {
    lat: round(Math.sin(angle) * ring),
    lng: round(Math.cos(angle) * ring)
  };
}

function blendLng(a, b, weightA) {
  const delta = normalizeLng(a - b);
  return normalizeLng(b + delta * weightA);
}

function importanceForPersona(persona) {
  const workScore = Array.isArray(persona.works) ? Math.min(persona.works.length, 4) * 0.035 : 0;
  const categoryScore = persona.category === "哲学家" || persona.category === "思想家" ? 0.04 : 0.02;
  const idNoise = (fnv1a(persona.id) % 12) / 100;
  return round(Math.min(0.96, 0.62 + workScore + categoryScore + idNoise));
}

function pushMap(map, key, value) {
  const list = map.get(key) || [];
  list.push(value);
  map.set(key, list);
}

function sphereDistance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function fnv1a(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clampLat(value) {
  return Math.max(-75, Math.min(75, round(value)));
}

function normalizeLng(value) {
  let lng = round(value);
  while (lng > 180) lng -= 360;
  while (lng < -180) lng += 360;
  return round(lng);
}

function normalizedSignedDeltaLng(a, b) {
  return normalizeLng(a - b);
}

function round(value) {
  return Math.round(value * 100) / 100;
}
