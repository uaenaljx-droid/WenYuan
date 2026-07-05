import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";

export const SoftMask: React.FC<{ opacity?: number }> = ({ opacity = 0.12 }) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 1860], [-28, 28], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity, mixBlendMode: "multiply" }}>
      <Img
        src={staticFile("promo/generated/ink-soft-mask.png")}
        style={{
          width: "104%",
          height: "104%",
          objectFit: "cover",
          transform: `translate(${drift}px, ${-drift * 0.35}px) scale(1.03)`,
        }}
      />
    </AbsoluteFill>
  );
};
