const REPORT_INTERVAL_MS = 5000;
const FRAME_WINDOW = 90;

export function createPerfStats({ earthScene, ui, atlas, getRouteIndex, bootStartedAt } = {}) {
  if (!import.meta.env?.DEV) {
    return { report() {}, dispose() {} };
  }

  let disposed = false;
  let frameId = 0;
  let lastFrameAt = performance.now();
  let lastReportAt = 0;
  let firstReport = true;
  let longTaskCount = 0;
  let lastLongTaskDuration = 0;
  const frameTimes = [];

  const observer = createLongTaskObserver((entry) => {
    longTaskCount += 1;
    lastLongTaskDuration = Math.max(lastLongTaskDuration, entry.duration || 0);
  });

  function sampleFrame(now) {
    if (disposed) return;
    const delta = now - lastFrameAt;
    lastFrameAt = now;
    if (delta > 0 && delta < 1000) {
      frameTimes.push(delta);
      if (frameTimes.length > FRAME_WINDOW) frameTimes.shift();
    }
    frameId = window.requestAnimationFrame(sampleFrame);
  }

  frameId = window.requestAnimationFrame(sampleFrame);

  function snapshot(reason) {
    const scene = earthScene?.getPerfSnapshot?.() || {};
    const avgFrameTime = average(frameTimes);
    return {
      reason,
      personaCount: atlas?.personas?.length ?? 0,
      filteredPersonaCount: ui?.filtered?.length ?? 0,
      visibleMarkerCount: scene.visibleMarkerCount ?? 0,
      renderedNameplateCount: scene.renderedNameplateCount ?? 0,
      activeCardDomCount: ui?.getRenderedCardCount?.() ?? 0,
      avatarTextureCacheSize: scene.avatarTextureCacheSize ?? 0,
      fpsEstimate: avgFrameTime ? Math.round(1000 / avgFrameTime) : 0,
      avgFrameTimeMs: round(avgFrameTime),
      longTaskCount,
      lastLongTaskMs: round(lastLongTaskDuration),
      searchMs: round(ui?.lastSearchDuration ?? 0),
      personaDetailMs: round(ui?.lastPersonaDetailDuration ?? 0),
      workDetailMs: round(ui?.lastWorkDetailDuration ?? 0),
      firstCriticalLoadMs: bootStartedAt ? round(performance.now() - bootStartedAt) : 0,
      routeSequenceIndex: getRouteIndex?.() ?? 0,
      searchIndexSize: atlas?.searchIndex?.length ?? 0
    };
  }

  return {
    report(reason = "update") {
      const now = performance.now();
      if (!firstReport && now - lastReportAt < REPORT_INTERVAL_MS) return;
      firstReport = false;
      lastReportAt = now;
      console.table(snapshot(reason));
    },
    dispose() {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      observer?.disconnect?.();
    }
  };
}

function createLongTaskObserver(onEntry) {
  if (typeof PerformanceObserver === "undefined") return null;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) onEntry(entry);
    });
    observer.observe({ entryTypes: ["longtask"] });
    return observer;
  } catch {
    return null;
  }
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}
