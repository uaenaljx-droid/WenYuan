import React from "react";
import { AbsoluteFill } from "remotion";

export const Vignette: React.FC<{ opacity?: number }> = ({ opacity = 0.3 }) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      opacity,
      background:
        "radial-gradient(circle at 50% 45%, transparent 0 48%, rgba(0,0,0,0.42) 78%, rgba(0,0,0,0.76) 100%)",
    }}
  />
);
