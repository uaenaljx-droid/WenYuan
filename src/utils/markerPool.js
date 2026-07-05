export function rebuildPickableMarkers(records, visibleIds) {
  const pickable = [];
  for (const record of records) {
    if (!visibleIds.has(record.persona.id)) continue;
    if (!record.hitArea.visible && !record.marker.visible && !record.surfaceDot.visible) continue;
    pickable.push(record.hitArea, record.surfaceDot, record.marker);
  }
  return pickable;
}
