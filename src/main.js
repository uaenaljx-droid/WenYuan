import "./styles.css";
import "./styles/intro-qingnang.css";
import { gsap } from "gsap";
import { EarthScene } from "./earthScene.js";
import { BackgroundMusicController } from "./backgroundMusic.js";
import { AUTO_TOUR_CONFIG } from "./config/autoTourConfig.js";
import { DEFAULT_EARTH_VIEW } from "./config/defaultEarthView.js";
import { loadAtlas } from "./dataLoader.js";
import { PersonaUI } from "./ui.js";
import { createAppLoadingScreen } from "./appLoading.js";
import { FILTER_ROUTE_MAP, ROUTE_FILTER_MAP } from "./utils/filterPersonas.js";
import { haversineKm, pointOf } from "./utils/surfaceRouteSort.js";
import { EARTH_MOTION_CONFIG } from "./config/earthMotionConfig.js";
import { findNearestFrontPersona, shouldSyncFrontHemisphere } from "./utils/frontHemisphereSync.js";

const DEFAULT_CATEGORY = DEFAULT_EARTH_VIEW.category;
const DEFAULT_PERSONA_ID = DEFAULT_EARTH_VIEW.focusPersonaId;

const elements = {
  mount: document.querySelector("#sceneMount"),
  tooltip: document.querySelector("#tooltip"),
  introScreen: document.querySelector("#introScreen"),
  enterButton: document.querySelector("#enterButton"),
  introSearchInput: document.querySelector("#introSearchInput"),
  introSearchButton: document.querySelector("#introSearchButton"),
  introGuideCategories: document.querySelector("#introGuideCategories"),
  introTitle: document.querySelector("#introTitle"),
  introSubtitle: document.querySelector("#introSubtitle"),
  introStatus: document.querySelector("#introStatus"),
  brandEyebrow: document.querySelector("#brandEyebrow"),
  brandTitle: document.querySelector("#brandTitle"),
  brandSubtitle: document.querySelector("#brandSubtitle"),
  filterBar: document.querySelector("#filterBar"),
  routeSelect: document.querySelector("#routeSelect"),
  autoButton: document.querySelector("#autoButton"),
  manualButton: document.querySelector("#manualButton"),
  sourceButton: document.querySelector("#sourceButton"),
  refreshButton: document.querySelector("#refreshButton"),
  searchInput: document.querySelector("#searchInput"),
  resultStats: document.querySelector("#resultStats"),
  personaWhisper: document.querySelector("#personaWhisper"),
  whisperText: document.querySelector("#whisperText"),
  whisperName: document.querySelector("#whisperName"),
  routeCaptionText: document.querySelector("#routeCaptionText"),
  cardTrack: document.querySelector("#cardTrack"),
  modalBackdrop: document.querySelector("#modalBackdrop"),
  profileModal: document.querySelector("#profileModal"),
  closeModalButton: document.querySelector("#closeModalButton"),
  profileAvatar: document.querySelector("#profileAvatar"),
  profileCategory: document.querySelector("#profileCategory"),
  profileName: document.querySelector("#profileName"),
  profileLatin: document.querySelector("#profileLatin"),
  profileIdentity: document.querySelector("#profileIdentity"),
  profileEra: document.querySelector("#profileEra"),
  profileBirthplace: document.querySelector("#profileBirthplace"),
  profileSchool: document.querySelector("#profileSchool"),
  profileEpigraph: document.querySelector("#profileEpigraph"),
  profileWhoHeIs: document.querySelector("#profileWhoHeIs"),
  profileBio: document.querySelector("#profileBio"),
  profileWhyMatters: document.querySelector("#profileWhyMatters"),
  profileHowToRead: document.querySelector("#profileHowToRead"),
  profileHistoricalRelation: document.querySelector("#profileHistoricalRelation"),
  profileRelatedPath: document.querySelector("#profileRelatedPath"),
  profileWorks: document.querySelector("#profileWorks"),
  profilePersona: document.querySelector("#profilePersona"),
  profileKeywords: document.querySelector("#profileKeywords"),
  relatedSection: document.querySelector("#relatedSection"),
  relatedList: document.querySelector("#relatedList"),
  prevRouteButton: document.querySelector("#prevRouteButton"),
  continueRouteButton: document.querySelector("#continueRouteButton"),
  nextRouteButton: document.querySelector("#nextRouteButton"),
  profileSourceButton: document.querySelector("#profileSourceButton"),
  sourceDialog: document.querySelector("#sourceDialog"),
  closeSourceButton: document.querySelector("#closeSourceButton"),
  sourceTitle: document.querySelector("#sourceTitle"),
  sourceIntro: document.querySelector("#sourceIntro"),
  sourceContent: document.querySelector("#sourceContent"),
  workReader: document.querySelector("#workReader"),
  closeWorkButton: document.querySelector("#closeWorkButton"),
  workStatus: document.querySelector("#workStatus"),
  workTitle: document.querySelector("#workTitle"),
  workMeta: document.querySelector("#workMeta"),
  workSummary: document.querySelector("#workSummary"),
  workSearchInput: document.querySelector("#workSearchInput"),
  workSourceLink: document.querySelector("#workSourceLink"),
  copyWorkSourceButton: document.querySelector("#copyWorkSourceButton"),
  workToc: document.querySelector("#workToc"),
  workBody: document.querySelector("#workBody"),
  musicToggle: document.querySelector("#musicToggle"),
  notice: document.querySelector("#notice")
};

const state = {
  atlas: null,
  activeRouteId: "east-west-dialogue",
  routeIndex: 0,
  autoTourIndex: 0,
  entered: false,
  autoTour: AUTO_TOUR_CONFIG.enabledByDefault,
  timer: null,
  autoStartTimer: null,
  hoverTimer: null,
  frontSyncTimer: null,
  pauseReason: null,
  userPausedAutoTour: false,
  hoveredPersonaId: null,
  lastUserDragAt: Number.NEGATIVE_INFINITY,
  isUserDragging: false,
  isModalOpen: false,
  isCardHovering: false,
  filterPresetId: "全部",
  derivedVisiblePersonas: [],
  routeOrderedPersonas: [],
  visiblePersonaIds: new Set()
};

const earthScene = new EarthScene({
  mount: elements.mount,
  tooltip: elements.tooltip,
  onSelect: (persona) => {
    openProfileModal(persona.id, "marker");
  },
  onPreview: (persona) => previewPersona(persona.id, { source: "marker" }),
  onUserControl: () => {
    pauseAutoTour("user-drag");
  },
  onUserControlStart: () => {
    state.isUserDragging = true;
    state.lastUserDragAt = performance.now();
    window.clearTimeout(state.frontSyncTimer);
    clearHoverPreview();
  },
  onUserControlEnd: () => {
    state.isUserDragging = false;
    state.lastUserDragAt = performance.now();
    scheduleFrontHemisphereSync("drag-end-front-sync");
  }
});

const backgroundMusic = new BackgroundMusicController({
  buttons: [elements.musicToggle]
});

const appLoading = createAppLoadingScreen();

const ui = new PersonaUI({
  elements,
  onEnter: () => enterExperience(),
  onSelect: (persona) => {
    openProfileModal(persona.id, "card");
  },
  onFilterChange: (payload) => applyDerivedVisiblePersonas(payload),
  onRouteChange: (routeId) => setRoute(routeId, { focusFirst: true, resume: state.entered && state.autoTour }),
  onAutoChange: (enabled) => (enabled ? resumeAutoTour() : pauseAutoTour("manual")),
  onRefresh: () => boot({ refresh: true }),
  onCloseProfile: () => closeProfile(),
  onOpenSource: (persona) => ui.openSourceDialog(persona || ui.getActivePersona()),
  onRouteStep: (direction) => stepRoute(direction, { openModal: ui.isProfileOpen() }),
  onRelatedSelect: (persona) => openProfileModal(persona.id, "related"),
  onPreview: (persona, meta = {}) => previewPersona(persona.id, { source: meta.source || "card" }),
  onWorkReaderOpen: () => backgroundMusic.setContextDucked(true),
  onWorkReaderClose: () => backgroundMusic.setContextDucked(false)
});
let perfStats = null;

async function boot({ refresh = false } = {}) {
  const bootStartedAt = performance.now();
  appLoading.show(refresh ? "文渊重展中" : "文脉入卷中");
  ui.setIntroLoading(true, refresh ? "正在重展文脉舆图..." : "正在铺展文脉舆图...");

  try {
    const atlas = await loadAtlas();
    state.atlas = atlas;
    const defaultRoute = getConfiguredDefaultRoute(atlas.routes);
    state.activeRouteId = defaultRoute?.id || "east-west-dialogue";
    state.routeIndex = getInitialRouteIndex(defaultRoute, DEFAULT_PERSONA_ID);
    state.autoTourIndex = getInitialTourIndex(DEFAULT_PERSONA_ID);
    state.autoTour = AUTO_TOUR_CONFIG.enabledByDefault;
    state.pauseReason = null;
    state.userPausedAutoTour = false;
    clearAutoTourTimers();

    document.documentElement.style.setProperty("--theme-accent", getRouteTheme()?.accent || "#b9c7c4");
    document.documentElement.style.setProperty("--theme-overlay", getRouteTheme()?.overlay || "rgba(7,10,13,0.38)");

    earthScene.setPersonas(atlas.personas);
    ui.setAtlas(atlas);
    perfStats?.dispose?.();
    perfStats = null;
    if (import.meta.env?.DEV) {
      const { createPerfStats } = await import("./utils/perfStats.js");
      perfStats = createPerfStats({
        earthScene,
        ui,
        atlas,
        getRouteIndex: () => state.autoTourIndex,
        bootStartedAt
      });
    }
    ui.setSearchQuery(DEFAULT_EARTH_VIEW.searchQuery, { emit: false });
    ui.setCategory(DEFAULT_CATEGORY);
    setRoute(state.activeRouteId, { focusFirst: false, resume: false });
    applyDefaultEarthView({ focusDuration: 0, resetFilters: true });
    preloadAutoTourWindow(state.autoTourIndex, 8);
    ui.setAutoMode(AUTO_TOUR_CONFIG.enabledByDefault);
    ui.setIntroLoading(false, "群像已在云海深处亮起");
    appLoading.hide({ delay: 180 });
    ui.showNotice("success", "文学与思想人物档案已就绪");
    perfStats?.report("boot");
  } catch (error) {
    ui.setIntroLoading(true, "数据加载失败，请检查本地文件");
    appLoading.setMessage("文脉暂未接上，请稍候");
    appLoading.hide({ delay: 900 });
    ui.showNotice("error", error.message || "数据加载失败");
  }
}

function enterExperience() {
  if (!state.atlas || state.entered) return;
  state.entered = true;
  appLoading.show("星图点亮中");
  elements.introScreen.classList.add("is-leaving");
  ui.setEntered(true);
  backgroundMusic.playFromEnter();
  gsap.to(elements.introScreen, {
    opacity: 0,
    scale: 1.012,
    filter: "blur(7px)",
    duration: 1.08,
    ease: "power3.out",
    onComplete: () => {
      elements.introScreen.hidden = true;
      elements.introScreen.classList.remove("is-leaving");
      enterEarthPage();
      appLoading.hide({ delay: 160 });
    }
  });
}

function enterEarthPage() {
  applyDefaultEarthView({ focusDuration: 0 });
  if (EARTH_MOTION_CONFIG.syncCarouselWithFrontHemisphereOnEnter) {
    scheduleFrontHemisphereSync("home-enter-facing-sync");
  }
  backgroundMusic.playFromEarthEnter();
  setAutoTour(DEFAULT_EARTH_VIEW.autoTourEnabled, {
    startDelayMs: DEFAULT_EARTH_VIEW.autoTourStartDelayMs,
    immediateStep: true,
    reason: DEFAULT_EARTH_VIEW.reason
  });
  debugOrientationState("home-enter-initial-facing");
}

function setRoute(routeId, { focusFirst = false, resume = false } = {}) {
  const route = getRoute(routeId);
  if (!route) return;
  state.activeRouteId = route.id;
  ui.setActiveRoute(route.id);
  applyTheme(getRouteTheme(route.id));
  const presetId = ROUTE_FILTER_MAP[route.id] || "全部";
  ui.setCategory(presetId);
  if (focusFirst) state.routeIndex = 0;
  if (focusFirst || resume) focusCurrentRoutePersona({ openModal: false, focus: true, source: "route" });
  if (resume) setAutoTour(true, { startDelayMs: 0, immediateStep: false, reason: "route-change" });
}

function applyDerivedVisiblePersonas(payload) {
  const derivedVisiblePersonas = Array.isArray(payload) ? payload : payload?.derivedVisiblePersonas || [];
  const routeOrderedPersonas = Array.isArray(payload) ? payload : payload?.routeOrderedPersonas || derivedVisiblePersonas;
  const previousVisibleIds = state.visiblePersonaIds;
  const nextVisibleIds = new Set(derivedVisiblePersonas.map((persona) => persona.id));
  const filterChanged = payload?.filterPresetId && payload.filterPresetId !== state.filterPresetId;
  const wasAutoTouring = state.autoTour && !state.userPausedAutoTour;

  state.filterPresetId = payload?.filterPresetId || state.filterPresetId || "全部";
  state.derivedVisiblePersonas = derivedVisiblePersonas;
  state.routeOrderedPersonas = routeOrderedPersonas;
  state.visiblePersonaIds = nextVisibleIds;
  state.routeIndex = 0;
  earthScene.setVisibleIds(derivedVisiblePersonas.map((persona) => persona.id));
  earthScene.setRouteIds(routeOrderedPersonas.map((persona) => persona.id));
  earthScene.preloadAvatarTextures(routeOrderedPersonas.slice(0, 10).map((persona) => persona.id));

  const mappedRouteId = FILTER_ROUTE_MAP[state.filterPresetId] || state.activeRouteId;
  if (mappedRouteId && getRoute(mappedRouteId)) {
    state.activeRouteId = mappedRouteId;
    ui.setActiveRoute(mappedRouteId);
    applyTheme(getRouteTheme(mappedRouteId));
  }

  const active = ui.getActivePersona?.();
  const activeStillVisible = active && nextVisibleIds.has(active.id);
  const focusPersona = activeStillVisible ? active : payload?.focusPersona || routeOrderedPersonas[0] || null;
  if (focusPersona) {
    const index = routeOrderedPersonas.findIndex((persona) => persona.id === focusPersona.id);
    state.routeIndex = Math.max(0, index);
    state.autoTourIndex = Math.max(0, index);
    const previousPersona = activeStillVisible ? active : null;
    const distanceKm = previousPersona ? haversineKm(pointOf(previousPersona), pointOf(focusPersona)) : 900;
    const shouldFocus =
      state.entered ||
      filterChanged ||
      !previousVisibleIds.has(focusPersona.id) ||
      !activeStillVisible;
    selectPersona(focusPersona.id, payload?.query ? "search-filter" : "filter-change", {
      openModal: false,
      focus: shouldFocus,
      focusDuration: getFocusDurationByDistance(distanceKm),
      scrollBehavior: filterChanged || !activeStillVisible ? "auto" : "smooth"
    });
  }

  if (wasAutoTouring && state.entered) {
    clearAutoTourTimers();
    setAutoTour(true, { startDelayMs: 900, immediateStep: false, reason: "filter-change" });
  }
  debugOrientationState("filter-change");
}

function clearAutoTourTimers() {
  window.clearInterval(state.timer);
  window.clearTimeout(state.autoStartTimer);
  state.timer = null;
  state.autoStartTimer = null;
}

function setAutoTour(enabled, { startDelayMs = 0, immediateStep = false, reason = "auto-tour" } = {}) {
  clearAutoTourTimers();
  state.autoTour = enabled;
  state.pauseReason = enabled ? null : state.pauseReason;
  ui.setAutoMode(enabled);
  earthScene.setInteractionLocks({ isAutoTouring: false });

  if (!enabled || !state.entered) return;

  const start = () => {
    if (!state.autoTour || state.pauseReason || state.userPausedAutoTour) return;
    earthScene.setInteractionLocks({ isAutoTouring: true });
    if (immediateStep) stepRoute(1, { openModal: false, source: "auto-tour" });
    state.timer = window.setInterval(() => {
      stepRoute(1, { openModal: false, source: "auto-tour" });
    }, AUTO_TOUR_CONFIG.intervalMs);
  };

  if (startDelayMs > 0) state.autoStartTimer = window.setTimeout(start, startDelayMs);
  else start();
}

function pauseRoute(updateUi = true) {
  pauseAutoTour("legacy", updateUi);
}

function pauseAutoTour(reason = "manual", updateUi = true) {
  clearAutoTourTimers();
  state.autoTour = false;
  state.pauseReason = reason;
  if (reason === "manual") state.userPausedAutoTour = true;
  earthScene.setInteractionLocks({ isAutoTouring: false });
  if (updateUi) ui.setAutoMode(false);
}

function resumeAutoTour() {
  state.pauseReason = null;
  state.userPausedAutoTour = false;
  setAutoTour(true, { startDelayMs: 0, immediateStep: true, reason: "manual-resume" });
}

function stepRoute(direction, { openModal = false, source = "route" } = {}) {
  if (source === "auto-tour") {
    stepAutoTour(direction, { openModal, source });
    return;
  }
  const sequence = getAutoTourSequence();
  if (!sequence.length) return;
  state.routeIndex = (state.routeIndex + direction + sequence.length) % sequence.length;
  focusCurrentRoutePersona({ openModal, focus: true, source });
}

function stepAutoTour(direction, { openModal = false, source = "auto-tour" } = {}) {
  const sequence = getAutoTourSequence();
  if (!sequence.length) return;
  const previous = getPersonaById(sequence[state.autoTourIndex]) || ui.getActivePersona?.();
  state.autoTourIndex = (state.autoTourIndex + direction + sequence.length) % sequence.length;
  const id = sequence[state.autoTourIndex];
  preloadAutoTourWindow(state.autoTourIndex, 8);
  const next = getPersonaById(id);
  const distanceKm = previous && next ? haversineKm(pointOf(previous), pointOf(next)) : 900;
  selectPersona(id, source, {
    openModal,
    focus: true,
    focusDuration: getFocusDurationByDistance(distanceKm),
    scrollBehavior: "smooth"
  });
  perfStats?.report("auto-tour");
}

function focusCurrentRoutePersona({ openModal = false, focus = true, source = "route" } = {}) {
  const sequence = getAutoTourSequence();
  const id = sequence[state.routeIndex];
  if (!id) return;
  selectPersona(id, source, { openModal, focus });
}

function getPersonaById(personaId) {
  return state.atlas?.personas.find((item) => item.id === personaId) || null;
}

function openProfileModal(personaId, source = "marker") {
  const persona = getPersonaById(personaId);
  if (!persona) return;
  pauseAutoTour(`${source}-click`);
  clearHoverPreview();
  earthScene.clearInteractionTweens?.(`${source}-open`);
  selectPersona(personaId, source, { openModal: true, focus: true, focusDuration: source === "card" ? 0.75 : 0.92 });
}

function focusPersona(id, { openModal = false, focus = true, source = "route", focusDuration } = {}) {
  selectPersona(id, source, { openModal, focus, focusDuration });
}

function selectPersona(id, source = "route", { openModal = false, focus = true, focusDuration, scrollBehavior } = {}) {
  const persona = getPersonaById(id);
  if (!persona) return;
  if (state.visiblePersonaIds.size && !state.visiblePersonaIds.has(id)) return;

  const sequence = getAutoTourSequence();
  const routeIndex = sequence.indexOf(id);
  if (routeIndex >= 0) state.routeIndex = routeIndex;
  const autoIndex = sequence.indexOf(id);
  if (autoIndex >= 0) state.autoTourIndex = autoIndex;

  state.isModalOpen = openModal;
  earthScene.setInteractionLocks({ isModalOpen: openModal, isHoverFocusing: false });
  earthScene.selectPersona(id, {
    focus,
    emit: false,
    duration: focusDuration ?? (source.includes("auto") || source === "route" ? AUTO_TOUR_CONFIG.focusDuration : 1.08),
    reason: source
  });
  earthScene.setControlsEnabled(!openModal);
  ui.selectById(id, {
    emit: false,
    scroll: true,
    openModal,
    scrollBehavior: scrollBehavior || (focusDuration === 0 ? "auto" : "smooth")
  });
  showPersonaWhisper(id, { dim: openModal });
  updateCaption(persona);
  applyTheme(getEraTheme(persona) || getRouteTheme());
  showRelations(persona.id);
  perfStats?.report(source);
}

function previewPersona(id, { source = "hover" } = {}) {
  if (!state.entered || state.isModalOpen || ui.isProfileOpen()) return;
  if (state.isUserDragging || performance.now() - state.lastUserDragAt < 1500) return;
  if (state.visiblePersonaIds.size && !state.visiblePersonaIds.has(id)) return;
  const isCardPreview = source.startsWith("card");
  const isSearchPreview = source.startsWith("search");
  if (state.hoveredPersonaId === id && (isCardPreview || isSearchPreview)) return;

  window.clearTimeout(state.hoverTimer);
  state.hoverTimer = window.setTimeout(() => {
    if (state.isUserDragging || ui.isProfileOpen()) return;
    const persona = getPersonaById(id);
    if (!persona) return;
    state.isCardHovering = isCardPreview;
    state.hoveredPersonaId = id;
    pauseAutoTour(isSearchPreview ? "search" : isCardPreview ? "card-hover" : "marker-hover");
    earthScene.setInteractionLocks({ isHoverFocusing: true, isModalOpen: false });
    const current = ui.getActivePersona?.();
    const distanceKm = current ? haversineKm(pointOf(current), pointOf(persona)) : 900;
    earthScene.focusPersonaOnHover(id, {
      duration: getFocusDurationByDistance(distanceKm),
      reason: isSearchPreview ? "search-focus" : isCardPreview ? "card-hover" : "marker-hover"
    });
    ui.selectById(id, { emit: false, scroll: source === "marker" || isSearchPreview, openModal: false });
    showPersonaWhisper(id);
    updateCaption(persona);
    applyTheme(getEraTheme(persona) || getRouteTheme());
  }, 140);
}

function scheduleFrontHemisphereSync(reason = "front-sync") {
  window.clearTimeout(state.frontSyncTimer);
  state.frontSyncTimer = window.setTimeout(() => {
    if (!state.entered) return;
    if (!shouldSyncFrontHemisphere({
      isSearching: Boolean(ui.query),
      isHovering: state.isCardHovering || Boolean(state.hoveredPersonaId),
      isModalOpen: state.isModalOpen || ui.isProfileOpen()
    })) {
      return;
    }
    const frontCenter = earthScene.getFrontCenterLatLng?.();
    const pool = state.routeOrderedPersonas.length ? state.routeOrderedPersonas : state.derivedVisiblePersonas;
    const nearest =
      earthScene.findNearestFrontPersona?.(pool.map((persona) => persona.id), { currentPersonaId: ui.getActiveId?.() }) ||
      findNearestFrontPersona({
        personas: pool,
        frontCenter,
        currentPersonaId: ui.getActiveId?.()
      });
    if (!nearest || (state.visiblePersonaIds.size && !state.visiblePersonaIds.has(nearest.id))) return;
    const current = ui.getActivePersona?.();
    const distanceKm = current ? haversineKm(pointOf(current), pointOf(nearest)) : 900;
    selectPersona(nearest.id, reason, {
      openModal: false,
      focus: false,
      focusDuration: getFocusDurationByDistance(distanceKm),
      scrollBehavior: "smooth"
    });
    debugOrientationState(reason);
  }, EARTH_MOTION_CONFIG.dragEndSyncDelayMs);
}

function clearHoverPreview() {
  window.clearTimeout(state.hoverTimer);
  state.isCardHovering = false;
  state.hoveredPersonaId = null;
  earthScene.clearHoverPreview();
}

function showPersonaWhisper(id, options = {}) {
  const persona = typeof id === "string" ? state.atlas?.personas.find((item) => item.id === id) : id;
  if (persona) ui.showWhisper(persona, options);
}

function closeProfile() {
  ui.closeProfile();
  state.isModalOpen = false;
  earthScene.setInteractionLocks({ isModalOpen: false });
  earthScene.setControlsEnabled(true);
  earthScene.showRelations([]);
  const persona = ui.getActivePersona();
  if (persona) showPersonaWhisper(persona);
}

function showRelations(personaId) {
  const usableRelations = state.atlas.relations
    .filter((relation) => relation.confidence !== "needsReview")
    .filter((relation) => relation.from === personaId || relation.to === personaId)
    .slice(0, 5);
  earthScene.showRelations(usableRelations);
  ui.renderRelated(personaId, usableRelations);
}

function updateCaptionForCurrent() {
  const id = getAutoTourSequence()[state.routeIndex];
  const persona = state.atlas?.personas.find((item) => item.id === id);
  if (persona) updateCaption(persona);
}

function updateCaption(persona) {
  const route = getRoute();
  const caption =
    state.atlas?.copy?.routeCaptions?.[route?.id]?.[persona.id] ||
    `${persona.displayName}，${persona.identity}`;
  ui.setRouteCaption(caption);
}

function applyTheme(theme) {
  if (!theme) return;
  gsap.to(document.documentElement, {
    "--theme-accent": theme.accent,
    "--theme-overlay": theme.overlay,
    duration: 0.7,
    ease: "power2.out"
  });
  earthScene.setAccent(theme.accent);
}

function getRoute(routeId = state.activeRouteId) {
  return state.atlas?.routes.find((route) => route.id === routeId);
}

function getAutoTourSequence() {
  const ids = state.routeOrderedPersonas?.map((persona) => persona.id).filter((id) => state.visiblePersonaIds.has(id)) || [];
  if (ids.length) return ids;
  return state.atlas?.routeSequences?.globalTourNearestSurface || state.atlas?.routeSequences?.globalTour || [];
}

function getConfiguredDefaultRoute(routes = []) {
  return (
    routes.find((route) => route.name === DEFAULT_EARTH_VIEW.routeMode) ||
    routes.find((route) => route.id === DEFAULT_EARTH_VIEW.routeMode) ||
    routes.find((route) => route.default) ||
    routes[0]
  );
}

function getInitialRouteIndex(route, personaId) {
  const sequence = getAutoTourSequence();
  if (!sequence.length) return 0;
  const index = sequence.indexOf(personaId);
  return index >= 0 ? index : -1;
}

function getInitialTourIndex(personaId) {
  const sequence = getAutoTourSequence();
  const index = sequence.indexOf(personaId);
  return index >= 0 ? index : 0;
}

function preloadAutoTourWindow(centerIndex = state.autoTourIndex, radius = 8) {
  const sequence = getAutoTourSequence();
  if (!sequence.length) return;
  const ids = [];
  for (let offset = -Math.min(2, radius); offset <= radius; offset += 1) {
    const index = (centerIndex + offset + sequence.length) % sequence.length;
    ids.push(sequence[index]);
  }
  earthScene.preloadAvatarTextures(ids);
}

function getFocusDurationByDistance(distanceKm) {
  if (distanceKm < 300) return 0.55;
  if (distanceKm < 800) return 0.82;
  if (distanceKm < 1500) return 1.05;
  if (distanceKm < 3000) return 1.32;
  return 1.68;
}

function applyDefaultEarthView({ focusDuration = 0, resetFilters = false } = {}) {
  if (!state.atlas) return;
  if (resetFilters) {
    elements.searchInput.value = DEFAULT_EARTH_VIEW.searchQuery;
    ui.setSearchQuery(DEFAULT_EARTH_VIEW.searchQuery, { emit: false });
    ui.setCategory(DEFAULT_CATEGORY);
  }

  const activeId = ui.getActiveId?.();
  const sequence = getAutoTourSequence();
  const defaultIsVisible = !state.visiblePersonaIds.size || state.visiblePersonaIds.has(DEFAULT_PERSONA_ID);
  const personaId = resetFilters
    ? defaultIsVisible
      ? DEFAULT_PERSONA_ID
      : sequence[state.routeIndex] || state.routeOrderedPersonas[0]?.id || DEFAULT_PERSONA_ID
    : !activeId || (state.visiblePersonaIds.size && !state.visiblePersonaIds.has(activeId))
      ? sequence[state.routeIndex] || state.routeOrderedPersonas[0]?.id || DEFAULT_PERSONA_ID
      : activeId;
  const persona = getPersonaById(personaId);
  if (!persona) return;

  state.isModalOpen = false;
  earthScene.setInteractionLocks({ isModalOpen: false, isHoverFocusing: false, isAutoTouring: false });
  selectPersona(personaId, DEFAULT_EARTH_VIEW.reason, {
    openModal: false,
    focus: true,
    focusDuration,
    scrollBehavior: "auto"
  });
  const route = getRoute();
  state.routeIndex = getInitialRouteIndex(route, personaId);
}

function debugOrientationState(reason = "orientation") {
  if (!import.meta.env?.DEV) return;
  const front = earthScene.getFrontCenterLatLng?.() || {};
  const currentPersonaId = ui.getActiveId?.() || "";
  const nearest = findNearestFrontPersona({
    personas: state.routeOrderedPersonas,
    frontCenter: front,
    currentPersonaId
  });
  console.table({
    reason,
    filterPresetId: state.filterPresetId,
    visibleCount: state.derivedVisiblePersonas.length,
    routeCount: state.routeOrderedPersonas.length,
    currentPersonaId,
    currentRouteIndex: state.routeIndex,
    frontCenterLat: Math.round((front.lat || 0) * 10) / 10,
    frontCenterLng: Math.round((front.lng || 0) * 10) / 10,
    nearestFrontPersonaId: nearest?.id || "",
    spinDirection: EARTH_MOTION_CONFIG.spinDirection,
    autoTourIndex: state.autoTourIndex
  });
}

function getRouteTheme(routeId = state.activeRouteId) {
  return state.atlas?.themes?.routes?.[routeId] || null;
}

function getEraTheme(persona) {
  return state.atlas?.themes?.eras?.[persona.era] || null;
}

boot();

if (import.meta.env?.DEV) {
  window.__personaAtlasDebug = {
    ...(window.__personaAtlasDebug || {}),
    getPersonaById,
    openProfileModal,
    selectPersona: (personaId, source = "debug") => selectPersona(personaId, source, { openModal: true, focus: true }),
    visibleCardCount: () => elements.cardTrack.querySelectorAll(".person-card").length,
    visiblePersonaIds: () => Array.from(elements.cardTrack.querySelectorAll(".person-card")).map((card) => card.dataset.id)
  };
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => cleanup());
}

window.addEventListener("beforeunload", cleanup);

function cleanup() {
  clearAutoTourTimers();
  window.clearTimeout(state.hoverTimer);
  window.clearTimeout(state.frontSyncTimer);
  perfStats?.dispose?.();
  appLoading.dispose();
  earthScene.dispose();
  backgroundMusic.dispose();
  ui.dispose();
}
