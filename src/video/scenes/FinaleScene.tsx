import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import finale from "../assets/generated/finale-wenyuan-atlas.png";
import { FilmGrain } from "../components/FilmGrain";
import { PoeticSubtitle } from "../components/PoeticSubtitle";
import { Vignette } from "../components/Vignette";
import { theme } from "../theme";

export const FinaleScene: React.FC<{ from: number; duration: number; subtitle: string }> = ({ from, duration, subtitle }) => {
  const frame = useCurrentFrame();
  const local = frame - from;
  const scale = interpolate(local, [0, duration], [1.02, 1.055], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeToBlack = interpolate(local, [duration - 30, duration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.void, overflow: "hidden" }}>
      <Img src={finale} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }} />
      <Img
        src={staticFile("promo/generated/gold-dust-overlay.png")}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.16, mixBlendMode: "screen" }}
      />
      <PoeticSubtitle text={subtitle} start={from} duration={duration} align="center" variant="finale" />
      <Vignette opacity={0.34} />
      <FilmGrain opacity={0.04} />
      <AbsoluteFill style={{ background: `rgba(0,0,0,${fadeToBlack})` }} />
    </AbsoluteFill>
  );
};
