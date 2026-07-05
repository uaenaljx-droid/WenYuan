import React from "react";
import { PoeticSubtitle } from "../components/PoeticSubtitle";
import { SceneFrame } from "../components/SceneFrame";

export const WorkGuideScene: React.FC<{ from: number; duration: number; subtitle: string }> = ({ from, duration, subtitle }) => (
  <SceneFrame source="promo/frames/scene-06-work-guide/poster.png" from={from} duration={duration} zoom={[1, 1.04]} pan={[0, -14]} dim={0.04}>
    <PoeticSubtitle text={subtitle} start={from} duration={duration} />
  </SceneFrame>
);
