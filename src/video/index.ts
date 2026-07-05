import { Composition, registerRoot } from "remotion";
import { PromoVideo, PromoVideoVertical } from "./PromoVideo";
import { VIDEO_DURATION_FRAMES, VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH } from "./theme";
import React from "react";

const RemotionRoot: React.FC = () =>
  React.createElement(
    React.Fragment,
    null,
    React.createElement(Composition, {
      id: "WenyuanAtlasPromo60s",
      component: PromoVideo,
      durationInFrames: VIDEO_DURATION_FRAMES,
      fps: VIDEO_FPS,
      width: VIDEO_WIDTH,
      height: VIDEO_HEIGHT,
    }),
    React.createElement(Composition, {
      id: "WenyuanAtlasPromoVertical",
      component: PromoVideoVertical,
      durationInFrames: VIDEO_DURATION_FRAMES,
      fps: VIDEO_FPS,
      width: 1080,
      height: 1920,
    })
  );

registerRoot(RemotionRoot);
