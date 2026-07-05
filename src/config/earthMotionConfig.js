export const EARTH_MOTION_CONFIG = {
  // Current visual spin uses earthGroup.rotation.y += speed, so the canonical direction is positive.
  spinDirection: 1,
  calmSpinSpeed: 0.00022,
  autoTourSpinSpeed: 0.00068,
  preferSpinAlignedTour: true,
  reversePenalty: 2.2,
  maxPreferredLngStep: 45,
  maxPreferredDistanceKm: 1500,
  maxExtraRotationDeg: 80,
  syncCarouselWithFrontHemisphereOnEnter: true,
  dragEndSyncDelayMs: 250
};
