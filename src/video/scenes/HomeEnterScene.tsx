import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { PoeticSubtitle } from "../components/PoeticSubtitle";
import { SceneFrame } from "../components/SceneFrame";

export const HomeEnterScene: React.FC<{ from: number; duration: number; subtitle: string }> = ({ from, duration, subtitle }) => {
  const frame = useCurrentFrame();
  const local = frame - from;
  const loadingOpacity = interpolate(local, [52, 72, 110, 130], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const earthOpacity = interpolate(local, [118, 150], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <SceneFrame source="promo/frames/scene-02-enter/poster.png" from={from} duration={duration} zoom={[1.01, 1.055]} pan={[0, 12]} dim={0.1}>
      <AbsoluteFill style={{ opacity: loadingOpacity }}>
        <Img src={staticFile("promo/frames/scene-02-enter/frame-001-loading.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: earthOpacity }}>
        <Img src={staticFile("promo/frames/scene-02-enter/frame-002-earth.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <PoeticSubtitle text={subtitle} start={from} duration={duration} />
    </SceneFrame>
  );
};
