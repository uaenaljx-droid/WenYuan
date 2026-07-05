import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import opening from "../assets/generated/opening-wenyuan-atlas.png";
import { FilmGrain } from "../components/FilmGrain";
import { PoeticSubtitle } from "../components/PoeticSubtitle";
import { Vignette } from "../components/Vignette";
import { theme } from "../theme";

export const OpeningScene: React.FC<{ from: number; duration: number; subtitle: string }> = ({ from, duration, subtitle }) => {
  const frame = useCurrentFrame();
  const local = frame - from;
  const scale = interpolate(local, [0, duration], [1.02, 1.09], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleOpacity = interpolate(local, [24, 58], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...theme.easing.out),
  });
  const titleY = interpolate(local, [24, 58], [18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...theme.easing.out),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.void, overflow: "hidden" }}>
      <Img src={opening} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }} />
      <Img
        src={staticFile("promo/generated/gold-dust-overlay.png")}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.18, mixBlendMode: "screen" }}
      />
      <div
        style={{
          position: "absolute",
          top: 320,
          left: 0,
          width: "100%",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          textAlign: "center",
          color: theme.colors.paper,
          textShadow: "0 12px 36px rgba(0,0,0,0.56)",
          fontFamily: theme.fonts.serif,
        }}
      >
        <div style={{ fontSize: 112, lineHeight: 1.05, letterSpacing: 0, color: theme.colors.paper }}>文渊舆图</div>
        <div style={{ marginTop: 22, color: theme.colors.bronze, fontFamily: theme.fonts.sans, fontSize: 24, letterSpacing: "0.24em" }}>
          WENYUAN ATLAS
        </div>
      </div>
      <PoeticSubtitle text={subtitle} start={from} duration={duration} align="center" />
      <Vignette opacity={0.32} />
      <FilmGrain opacity={0.045} />
    </AbsoluteFill>
  );
};
