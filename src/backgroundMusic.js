const AUDIO_SRC = "/assets/audio/wenyuan-bgm.mp3";
const STORAGE_KEY = "wenyuan:bgm-enabled";
const VOLUME_KEY = "wenyuan:bgm-volume";
const DEFAULT_VOLUME = 0.22;
const DUCKED_VOLUME = 0.14;
const HIDDEN_VOLUME = 0.08;
const MAX_VOLUME = 0.45;

let sharedAudio = null;

function clampVolume(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_VOLUME;
  return Math.min(Math.max(numeric, 0), MAX_VOLUME);
}

function readStorage(key, fallback) {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private or embedded contexts.
  }
}

function isAudioResponse(response) {
  if (!response.ok) return false;
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType) return true;
  return contentType.startsWith("audio/") || contentType.includes("octet-stream");
}

export class BackgroundMusicController {
  constructor({ buttons = [] } = {}) {
    this.buttons = buttons.filter(Boolean);
    this.enabled = readStorage(STORAGE_KEY, "true") !== "false";
    this.userVolume = clampVolume(readStorage(VOLUME_KEY, String(DEFAULT_VOLUME)));
    this.available = null;
    this.isPlaying = false;
    this.hasUserInteracted = false;
    this.isDucked = false;
    this.fadeFrame = null;
    this.warnedMissing = false;
    this.gesturePlaybackArmed = false;

    this.handleToggle = () => this.toggleFromUser();
    this.handleVisibilityChange = () => this.updateContextVolume({ fade: true });
    this.handleFirstGesture = () => {
      this.hasUserInteracted = true;
      if (document.body.classList.contains("is-entered")) this.playFromGesture();
    };
    this.handleDeferredGesture = () => {
      this.disarmFirstGesturePlayback();
      this.hasUserInteracted = true;
      if (this.enabled) this.play({ fadeMs: 1600 });
    };

    this.bindButtons();
    this.bindDocument();
    this.checkAvailability();
    this.updateButtons();
  }

  bindButtons() {
    for (const button of this.buttons) {
      button.addEventListener("click", this.handleToggle);
    }
  }

  bindDocument() {
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("pointerdown", this.handleFirstGesture, { once: true, capture: true });
    window.addEventListener("keydown", this.handleFirstGesture, { once: true, capture: true });
    window.addEventListener("touchstart", this.handleFirstGesture, { once: true, capture: true });
  }

  async checkAvailability() {
    try {
      const response = await fetch(AUDIO_SRC, { method: "HEAD", cache: "no-store" });
      if (!isAudioResponse(response)) {
        this.setUnavailable();
        return false;
      }
      this.available = true;
      this.initAudio();
      this.updateButtons();
      return true;
    } catch {
      this.setUnavailable();
      return false;
    }
  }

  setUnavailable() {
    this.available = false;
    if (!this.warnedMissing) {
      console.warn(`[Audio] Background music file not found: ${AUDIO_SRC}`);
      this.warnedMissing = true;
    }
    this.updateButtons();
  }

  initAudio() {
    if (!sharedAudio) {
      sharedAudio = new Audio(AUDIO_SRC);
      sharedAudio.loop = true;
      sharedAudio.preload = "auto";
      sharedAudio.volume = 0;
      sharedAudio.addEventListener("ended", () => {
        if (this.enabled) sharedAudio.play().catch(() => {});
      });
    }
    return sharedAudio;
  }

  targetVolume() {
    if (document.hidden) return Math.min(this.userVolume, HIDDEN_VOLUME);
    if (this.isDucked) return Math.min(this.userVolume, DUCKED_VOLUME);
    return this.userVolume;
  }

  async playFromEnter() {
    this.hasUserInteracted = true;
    if (!this.enabled) return;
    await this.play({ fadeMs: 1800 });
  }

  async playFromEarthEnter() {
    if (!this.enabled) return;
    await this.play({ fadeMs: 1800 });
  }

  async playFromGesture() {
    if (!this.enabled) return;
    await this.play({ fadeMs: 1200 });
  }

  async play({ fadeMs = 1400 } = {}) {
    if (this.available === false) return;
    if (this.available === null) {
      const available = await this.checkAvailability();
      if (!available) return;
    }
    const audio = this.initAudio();
    try {
      if (audio.paused) audio.volume = 0;
      await audio.play();
      this.isPlaying = true;
      this.fadeTo(this.targetVolume(), fadeMs);
      this.updateButtons();
    } catch (error) {
      this.isPlaying = false;
      this.updateButtons();
      console.info("[Audio] Background music playback deferred by browser policy.", error?.message || error);
      this.armFirstGesturePlayback();
    }
  }

  armFirstGesturePlayback() {
    if (this.gesturePlaybackArmed) return;
    this.gesturePlaybackArmed = true;
    window.addEventListener("pointerdown", this.handleDeferredGesture, { once: true, capture: true });
    window.addEventListener("click", this.handleDeferredGesture, { once: true, capture: true });
    window.addEventListener("keydown", this.handleDeferredGesture, { once: true, capture: true });
    window.addEventListener("touchstart", this.handleDeferredGesture, { once: true, capture: true });
  }

  disarmFirstGesturePlayback() {
    if (!this.gesturePlaybackArmed) return;
    this.gesturePlaybackArmed = false;
    window.removeEventListener("pointerdown", this.handleDeferredGesture, { capture: true });
    window.removeEventListener("click", this.handleDeferredGesture, { capture: true });
    window.removeEventListener("keydown", this.handleDeferredGesture, { capture: true });
    window.removeEventListener("touchstart", this.handleDeferredGesture, { capture: true });
  }

  pause({ fadeMs = 700 } = {}) {
    const audio = sharedAudio;
    if (!audio) return;
    this.fadeTo(0, fadeMs, () => {
      audio.pause();
      this.isPlaying = false;
      this.updateButtons();
    });
  }

  toggleFromUser() {
    this.hasUserInteracted = true;
    if (this.available === false) return;
    this.enabled = !this.enabled;
    writeStorage(STORAGE_KEY, String(this.enabled));
    if (this.enabled) this.play({ fadeMs: 1200 });
    else this.pause({ fadeMs: 700 });
    this.updateButtons();
  }

  setContextDucked(ducked) {
    this.isDucked = Boolean(ducked);
    this.updateContextVolume({ fade: true });
  }

  updateContextVolume({ fade = false } = {}) {
    if (!sharedAudio || !this.isPlaying || !this.enabled) return;
    if (fade) this.fadeTo(this.targetVolume(), 420);
    else sharedAudio.volume = clampVolume(this.targetVolume());
  }

  fadeTo(targetVolume, duration, onComplete) {
    const audio = sharedAudio;
    if (!audio) return;
    if (this.fadeFrame) cancelAnimationFrame(this.fadeFrame);
    const from = clampVolume(audio.volume);
    const to = clampVolume(targetVolume);
    const start = performance.now();

    const step = (now) => {
      const progress = duration <= 0 ? 1 : Math.max(0, Math.min((now - start) / duration, 1));
      const eased = 1 - Math.pow(1 - progress, 3);
      audio.volume = clampVolume(from + (to - from) * eased);
      if (progress < 1) {
        this.fadeFrame = requestAnimationFrame(step);
        return;
      }
      this.fadeFrame = null;
      onComplete?.();
    };

    this.fadeFrame = requestAnimationFrame(step);
  }

  updateButtons() {
    for (const button of this.buttons) {
      const unavailable = this.available === false;
      button.disabled = unavailable;
      button.hidden = false;
      button.classList.toggle("is-playing", this.enabled && this.isPlaying && !unavailable);
      button.classList.toggle("is-muted", !this.enabled && !unavailable);
      button.classList.toggle("is-unavailable", unavailable);
      button.setAttribute("aria-pressed", String(this.enabled && !unavailable));
      button.setAttribute(
        "aria-label",
        unavailable ? "背景音乐文件缺失" : this.enabled ? "关闭背景音乐" : "开启背景音乐"
      );
      const label = button.querySelector("[data-music-label]");
      if (label) label.textContent = unavailable ? "无乐" : this.enabled ? "乐声" : "静音";
    }
  }

  dispose() {
    for (const button of this.buttons) {
      button.removeEventListener("click", this.handleToggle);
    }
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.disarmFirstGesturePlayback();
    if (this.fadeFrame) cancelAnimationFrame(this.fadeFrame);
    if (sharedAudio) {
      sharedAudio.pause();
      sharedAudio = null;
    }
  }
}
