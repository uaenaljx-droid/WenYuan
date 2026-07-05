export function markerLod({ selected = false, preview = false, hovered = false, onRoute = false, facing = 0, visibleRank = 0 }) {
  if (selected || preview || hovered) return "focus";
  if (onRoute && facing > 0.34) return "route";
  if (facing > 0.55 && visibleRank < 42) return "avatar";
  if (facing > 0.18 && visibleRank < 96) return "dot";
  return "hidden";
}

export function shouldShowNameplate(lod) {
  return lod === "focus";
}
