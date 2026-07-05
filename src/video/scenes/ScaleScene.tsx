import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { PoeticSubtitle } from "../components/PoeticSubtitle";
import { SceneFrame } from "../components/SceneFrame";
import { keywords } from "../timeline";
import { theme } from "../theme";

export const ScaleScene: React.FC<{ from: number; duration: number; subtitle: string }> = ({ from, duration, subtitle }) => {
  const frame = useCurrentFrame();
  const local = frame - from;

  return (
    <SceneFrame source="promo/frames/scene-07-finale-earth/poster.png" from={from} duration={duration} zoom={[1.02, 1.07]} pan={[12, -12]} dim={0.16}>
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <div style={{ position: "absolute", right: 104, top: 156, display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 12, width: 560 }}>
          {keywords.map((item, index) => {
            const opacity = interpolate(local, [index * 8 + 14, index * 8 + 34, duration - 28], [0, 1, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(...theme.easing.out),
            });
            const y = interpolate(local, [index * 8 + 14, index * 8 + 34], [16, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(...theme.easing.out),
            });
            return (
              <div
                key={item}
                style={{
                  opacity,
                  transform: `translateY(${y}px)`,
                  minHeight: 42,
                  padding: "8px 16px",
                  border: `1px solid ${theme.colors.bronzeSoft}`,
                  borderRadius: 999,
                  background: "rgba(5, 18, 16, 0.68)",
                  color: index === 0 ? theme.colors.bronze : theme.colors.paper,
                  fontFamily: theme.fonts.serif,
                  fontSize: index === 0 ? 28 : 22,
                  boxShadow: "inset 0 1px 0 rgba(238,232,214,0.06)",
                }}
              >
                {item}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <PoeticSubtitle text={subtitle} start={from} duration={duration} />
    </SceneFrame>
  );
};
