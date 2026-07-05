import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

export const FilmGrain: React.FC<{ opacity?: number }> = ({ opacity = 0.045 }) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame % 12, [0, 11], [0, 36], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        opacity,
        mixBlendMode: "screen",
        backgroundImage:
          "radial-gradient(circle at 15% 20%, rgba(255,255,255,0.85) 0 0.7px, transparent 1px), radial-gradient(circle at 75% 70%, rgba(255,255,255,0.45) 0 0.6px, transparent 1px)",
        backgroundSize: "42px 42px, 57px 57px",
        backgroundPosition: `${drift}px ${-drift}px, ${-drift * 0.7}px ${drift * 0.5}px`,
      }}
    />
  );
};
