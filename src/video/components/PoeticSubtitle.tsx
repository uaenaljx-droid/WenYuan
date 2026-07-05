import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";

export const PoeticSubtitle: React.FC<{
  text: string;
  start: number;
  duration: number;
  align?: "left" | "center";
  variant?: "normal" | "finale";
}> = ({ text, start, duration, align = "left", variant = "normal" }) => {
  const frame = useCurrentFrame();
  const local = frame - start;
  const opacity = interpolate(local, [8, 32, duration - 34, duration - 8], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...theme.easing.out),
  });
  const translateY = interpolate(local, [8, 32], [18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...theme.easing.out),
  });
  const lines = text.split("\n");

  return (
    <div
      style={{
        position: "absolute",
        left: align === "left" ? 126 : 0,
        right: align === "center" ? 0 : "auto",
        bottom: variant === "finale" ? 172 : 118,
        width: align === "center" ? "100%" : 760,
        opacity,
        transform: `translateY(${translateY}px)`,
        textAlign: align,
        color: theme.colors.paper,
        textShadow: `0 2px 18px ${theme.colors.inkShadow}`,
        fontFamily: theme.fonts.serif,
        fontSize: variant === "finale" ? 40 : 38,
        lineHeight: 1.65,
        letterSpacing: 0,
        whiteSpace: "pre-line",
      }}
    >
      {lines.map((line, index) =>
        index === 0 && line === "文渊舆图" ? (
          <div key={`${line}-${index}`} style={{ color: theme.colors.bronze, fontSize: 76, lineHeight: 1.1, marginBottom: 22 }}>
            {line}
          </div>
        ) : (
          <div key={`${line}-${index}`}>{line}</div>
        )
      )}
    </div>
  );
};
