export const VIDEO_WIDTH = 1920;
export const VIDEO_HEIGHT = 1080;
export const VIDEO_FPS = 30;
export const VIDEO_DURATION_FRAMES = 1860;

export const theme = {
  colors: {
    void: "#020407",
    deepTeal: "#061311",
    panel: "rgba(5, 14, 13, 0.72)",
    paper: "rgba(238, 232, 214, 0.95)",
    paperMuted: "rgba(232, 223, 200, 0.72)",
    bronze: "rgba(196, 157, 89, 0.95)",
    bronzeSoft: "rgba(196, 157, 89, 0.34)",
    inkShadow: "rgba(0, 0, 0, 0.45)",
  },
  fonts: {
    serif: '"Songti SC", "Noto Serif SC", "Source Han Serif SC", "STSong", "SimSun", serif',
    sans: '"Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  },
  easing: {
    out: [0.16, 1, 0.3, 1] as const,
    inOut: [0.65, 0, 0.35, 1] as const,
  },
};
