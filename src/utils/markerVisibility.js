import * as THREE from "three";

export function markerFacingOpacity({
  facing,
  selected = false,
  preview = false,
  hovered = false,
  onRoute = false
}) {
  const frontOpacity = selected ? 1 : preview || hovered ? 0.96 : onRoute ? 0.7 : 0.16;
  const hiddenOpacity = onRoute ? 0.02 : 0;
  const edgeFade = THREE.MathUtils.clamp((facing + 0.02) / 0.68, 0, 1);
  return edgeFade * frontOpacity + hiddenOpacity;
}

export function shouldHydrateMarkerAvatar({ facing, selected = false, preview = false, hovered = false, onRoute = false }) {
  return selected || preview || hovered || (onRoute && facing > 0.18) || facing > 0.48;
}

export function shouldShowMarker({ opacity, selected = false, preview = false, hovered = false }) {
  return selected || preview || hovered || opacity > 0.045;
}
