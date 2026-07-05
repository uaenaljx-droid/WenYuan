const DEFAULT_MESSAGE = "文脉入卷中";
const LONG_WAIT_MESSAGE = "文脉仍在铺展，请稍候";
const FALLBACK_MESSAGE = "先入文渊，余卷稍后展开";
const LEAVE_DURATION_MS = 560;
const LONG_WAIT_MS = 8000;
const FALLBACK_MS = 15000;

export function createAppLoadingScreen({
  element = document.querySelector("#appLoadingScreen"),
  textElement = document.querySelector("#appLoadingText")
} = {}) {
  let longWaitTimer = null;
  let fallbackTimer = null;
  let hideTimer = null;
  let fallbackHideTimer = null;
  let isVisible = Boolean(element && !element.classList.contains("is-hidden"));

  function clearTimers() {
    window.clearTimeout(longWaitTimer);
    window.clearTimeout(fallbackTimer);
    window.clearTimeout(fallbackHideTimer);
    longWaitTimer = null;
    fallbackTimer = null;
    fallbackHideTimer = null;
  }

  function clearHideTimer() {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }

  function setMessage(message = DEFAULT_MESSAGE) {
    if (textElement) textElement.textContent = message;
    window.__wenyuanLoadingGuard?.setMessage?.(message);
  }

  function startTimers() {
    clearTimers();
    longWaitTimer = window.setTimeout(() => {
      setMessage(LONG_WAIT_MESSAGE);
    }, LONG_WAIT_MS);
    fallbackTimer = window.setTimeout(() => {
      setMessage(FALLBACK_MESSAGE);
      fallbackHideTimer = window.setTimeout(() => hide(), 1200);
    }, FALLBACK_MS);
  }

  function show(message = DEFAULT_MESSAGE, { timers = true } = {}) {
    if (!element) return;
    clearHideTimer();
    element.classList.remove("is-hidden", "is-leaving");
    element.setAttribute("aria-busy", "true");
    setMessage(message);
    isVisible = true;
    if (timers) startTimers();
  }

  function hide({ delay = 0 } = {}) {
    if (!element || !isVisible) return;
    clearTimers();
    window.__wenyuanLoadingGuard?.clear?.();
    clearHideTimer();
    hideTimer = window.setTimeout(() => {
      element.setAttribute("aria-busy", "false");
      element.classList.add("is-leaving");
      isVisible = false;
      hideTimer = window.setTimeout(() => {
        element.classList.add("is-hidden");
        hideTimer = null;
      }, LEAVE_DURATION_MS);
    }, Math.max(0, delay));
  }

  function dispose() {
    clearTimers();
    clearHideTimer();
  }

  return {
    show,
    hide,
    setMessage,
    dispose
  };
}
