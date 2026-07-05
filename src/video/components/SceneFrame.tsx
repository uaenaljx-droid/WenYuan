import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FilmGrain } from "./FilmGrain";
import { SoftMask } from "./SoftMask";
import { Vignette } from "./Vignette";

export const SceneFrame: React.FC<{
  source: string;
  from: number;
  duration: number;
  publicAsset?: boolean;
  zoom?: [number, number];
  pan?: [number, number];
  dim?: number;
  children?: React.ReactNode;
}> = ({ source, from, duration, publicAsset = true, zoom = [1.02, 1.075], pan = [0, -18], dim = 0.12, children }) => {
  const frame = useCurrentFrame();
  const local = frame - from;
  const scale = interpolate(local, [0, duration], zoom, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const x = interpolate(local, [0, duration], pan, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fade = interpolate(local, [0, 18, duration - 18, duration], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#020407", opacity: fade, overflow: "hidden" }}>
      <Img
        src={publicAsset ? staticFile(source) : source}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `translateX(${x}px) scale(${scale})`,
          transformOrigin: "50% 50%",
          filter: "saturate(0.95) contrast(1.04)",
        }}
      />
      <AbsoluteFill style={{ background: `rgba(0, 0, 0, ${dim})` }} />
      <SoftMask opacity={0.07} />
      <Vignette opacity={0.28} />
      <FilmGrain opacity={0.04} />
      {children}
    </AbsoluteFill>
  );
};
