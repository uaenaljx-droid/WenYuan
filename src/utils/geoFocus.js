const PRESET_FOCUS = {
  "中国文学": { lat: 34, lng: 108 },
  "中国思想": { lat: 34, lng: 108 },
  "西方文学": { lat: 48, lng: 8 },
  "西方哲学": { lat: 42, lng: 13 },
  "世界文学": null,
  "世界思想": null,
  "全部": null
};

export function focusPointForFilter(filterId, personas = []) {
  if (PRESET_FOCUS[filterId]) return PRESET_FOCUS[filterId];
  return centroidOfPersonas(personas);
}

export function centroidOfPersonas(personas = []) {
  let x = 0;
  let y = 0;
  let z = 0;
  let count = 0;
  for (const persona of personas) {
    const lat = Number(persona.visualLat ?? persona.birthLat);
    const lng = Number(persona.visualLng ?? persona.birthLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const phi = (lat * Math.PI) / 180;
    const theta = (lng * Math.PI) / 180;
    x += Math.cos(phi) * Math.cos(theta);
    y += Math.cos(phi) * Math.sin(theta);
    z += Math.sin(phi);
    count += 1;
  }
  if (!count) return null;
  x /= count;
  y /= count;
  z /= count;
  return {
    lat: (Math.atan2(z, Math.sqrt(x * x + y * y)) * 180) / Math.PI,
    lng: (Math.atan2(y, x) * 180) / Math.PI
  };
}
