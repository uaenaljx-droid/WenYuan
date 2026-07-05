import React from "react";
import { PoeticSubtitle } from "../components/PoeticSubtitle";
import { SceneFrame } from "../components/SceneFrame";

export const FilterSearchScene: React.FC<{ from: number; duration: number; subtitle: string }> = ({ from, duration, subtitle }) => (
  <SceneFrame source="promo/frames/scene-04-filter-search/poster.png" from={from} duration={duration} zoom={[1.02, 1.065]} pan={[-14, 8]} dim={0.08}>
    <PoeticSubtitle text={subtitle} start={from} duration={duration} />
  </SceneFrame>
);
