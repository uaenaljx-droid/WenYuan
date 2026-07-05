import React from "react";
import { AbsoluteFill, Audio, Img, Loop, Sequence, staticFile } from "remotion";
import { FinaleScene } from "./scenes/FinaleScene";
import { FilterSearchScene } from "./scenes/FilterSearchScene";
import { HomeEnterScene } from "./scenes/HomeEnterScene";
import { EarthTourScene } from "./scenes/EarthTourScene";
import { OpeningScene } from "./scenes/OpeningScene";
import { ProfileScene } from "./scenes/ProfileScene";
import { ScaleScene } from "./scenes/ScaleScene";
import { WorkGuideScene } from "./scenes/WorkGuideScene";
import { scenes } from "./timeline";
import { VIDEO_DURATION_FRAMES } from "./theme";

const sceneMap = {
  opening: OpeningScene,
  "home-enter": HomeEnterScene,
  "earth-tour": EarthTourScene,
  "filter-search": FilterSearchScene,
  profile: ProfileScene,
  "work-guide": WorkGuideScene,
  scale: ScaleScene,
  finale: FinaleScene,
};

export const PromoVideo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#020407" }}>
    <Loop durationInFrames={VIDEO_DURATION_FRAMES}>
      <Audio
        src={staticFile("assets/audio/wenyuan-bgm.mp3")}
        volume={(frame) => {
          const fadeIn = Math.min(1, frame / 90);
          const fadeOut = Math.min(1, (VIDEO_DURATION_FRAMES - frame) / 90);
          return 0.22 * Math.max(0, Math.min(fadeIn, fadeOut));
        }}
      />
    </Loop>
    {scenes.map((scene) => {
      const Component = sceneMap[scene.id];
      return (
        <Sequence key={scene.id} from={scene.start} durationInFrames={scene.end - scene.start}>
          <Component from={0} duration={scene.end - scene.start} subtitle={scene.subtitle} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);

export const PromoVideoVertical: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#020407", overflow: "hidden" }}>
    <Img
      src={staticFile("promo/generated/title-backdrop.png")}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        opacity: 0.34,
        filter: "saturate(0.82) blur(10px)",
        transform: "scale(1.08)",
      }}
    />
    <div
      style={{
        width: 1920,
        height: 1080,
        transform: "translate(0px, 320px) scale(0.74)",
        transformOrigin: "0 0",
        boxShadow: "0 30px 110px rgba(0, 0, 0, 0.42)",
      }}
    >
      <PromoVideo />
    </div>
  </AbsoluteFill>
);
