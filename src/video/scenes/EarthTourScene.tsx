import React from "react";
import { PoeticSubtitle } from "../components/PoeticSubtitle";
import { SceneFrame } from "../components/SceneFrame";

export const EarthTourScene: React.FC<{ from: number; duration: number; subtitle: string }> = ({ from, duration, subtitle }) => (
  <SceneFrame source="promo/frames/scene-03-earth-tour/poster.png" from={from} duration={duration} zoom={[1.015, 1.08]} pan={[18, -22]} dim={0.08}>
    <PoeticSubtitle text={subtitle} start={from} duration={duration} />
  </SceneFrame>
);
