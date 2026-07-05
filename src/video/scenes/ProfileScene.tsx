import React from "react";
import { PoeticSubtitle } from "../components/PoeticSubtitle";
import { SceneFrame } from "../components/SceneFrame";

export const ProfileScene: React.FC<{ from: number; duration: number; subtitle: string }> = ({ from, duration, subtitle }) => (
  <SceneFrame source="promo/frames/scene-05-profile/frame-004.png" from={from} duration={duration} zoom={[1, 1.045]} pan={[0, -10]} dim={0.04}>
    <PoeticSubtitle text={subtitle} start={from} duration={duration} />
  </SceneFrame>
);
