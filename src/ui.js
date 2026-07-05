import { gsap } from "gsap";
import { normalizeWorkGuide } from "./utils/workGuideGenerator.js";
import { FILTER_ORDER, FILTER_PRESETS, applyFilterPreset, personaSearchText } from "./utils/filterPersonas.js";
import { focusPointForFilter } from "./utils/geoFocus.js";
import { createSpinRouteCacheKey, buildSpinAlignedSurfaceRoute } from "./utils/spinAlignedRoute.js";
import { EARTH_MOTION_CONFIG } from "./config/earthMotionConfig.js";

const CATEGORIES = FILTER_ORDER;
const LEGACY_CATEGORY_MAP = {
  "文学家": "世界文学",
  "诗人": "世界文学",
  "小说家": "世界文学",
  "剧作家": "世界文学",
  "哲学家": "世界思想",
  "思想家": "世界思想",
  "学者": "世界思想"
};
const SEARCH_DEBOUNCE_MS = 150;
const SEARCH_RESULT_LIMIT = 50;
const VIRTUAL_CARD_WIDTH = 250;
const VIRTUAL_CARD_BUFFER = 10;

export class PersonaUI {
  constructor({
    elements,
    onEnter,
    onSelect,
    onFilterChange,
    onRouteChange,
    onAutoChange,
    onRefresh,
    onCloseProfile,
    onOpenSource,
    onRouteStep,
    onRelatedSelect,
    onPreview,
    onWorkReaderOpen,
    onWorkReaderClose
  }) {
    this.elements = elements;
    this.onEnter = onEnter;
    this.onSelect = onSelect;
    this.onFilterChange = onFilterChange;
    this.onRouteChange = onRouteChange;
    this.onAutoChange = onAutoChange;
    this.onRefresh = onRefresh;
    this.onCloseProfile = onCloseProfile;
    this.onOpenSource = onOpenSource;
    this.onRouteStep = onRouteStep;
    this.onRelatedSelect = onRelatedSelect;
    this.onPreview = onPreview;
    this.onWorkReaderOpen = onWorkReaderOpen;
    this.onWorkReaderClose = onWorkReaderClose;
    this.atlas = null;
    this.personas = [];
    this.filtered = [];
    this.baseFiltered = [];
    this.routeOrderedPersonas = [];
    this.activeId = null;
    this.category = "全部";
    this.query = "";
    this.activeRouteId = "";
    this.noticeTimer = null;
    this.profileOpen = false;
    this.sourceOpen = false;
    this.workOpen = false;
    this.currentWork = null;
    this.currentWorkContent = null;
    this.workContentCache = new Map();
    this.searchIndex = new Map();
    this.cardRenderToken = 0;
    this.cardScrollRaf = null;
    this.cardVirtualList = null;
    this.searchTimer = null;
    this.workScrollObserver = null;
    this.workScrollRaf = null;
    this.workProgrammaticScroll = false;
    this.workProgrammaticSectionId = null;
    this.workProgrammaticTimer = null;
    this.workScrollHandler = null;
    this.workScrollEndHandler = null;
    this.workSectionIds = [];
    this.copy = {};
    this.personaById = new Map();
    this.workIndexById = new Map();
    this.workIndexByPersonaTitle = new Map();
    this.personaDetailCache = new Map();
    this.workDetailCache = new Map();
    this.activeProfileLoadToken = 0;
    this.lastSearchDuration = 0;
    this.lastPersonaDetailDuration = 0;
    this.lastWorkDetailDuration = 0;
    this.whisperTimeline = null;
    this.lastWhisperId = null;
    this.lastWhisperDim = false;

    this.renderFilters();
    this.bindEvents();
  }

  setAtlas(atlas) {
    this.atlas = atlas;
    this.personas = atlas.personas;
    this.filtered = atlas.personas;
    this.baseFiltered = atlas.personas;
    this.routeOrderedPersonas = atlas.personas;
    this.personaById = new Map(atlas.personas.map((persona) => [persona.id, persona]));
    this.searchIndex = new Map((atlas.searchIndex || []).map((entry) => [entry.personaId, entry]));
    this.workIndexById = new Map();
    this.workIndexByPersonaTitle = new Map();
    for (const work of atlas.worksIndex || atlas.worksCatalog || []) {
      this.workIndexById.set(work.workId, work);
      this.workIndexByPersonaTitle.set(`${work.personaId}::${work.title}`, work);
    }
    this.activeRouteId = atlas.routes.find((route) => route.default)?.id || atlas.routes[0]?.id || "";
    this.applyCopy(atlas.copy);
    this.renderRoutes();
    this.applyFilters();
  }

  applyCopy(copy) {
    this.copy = copy || {};
    const global = copy?.global || {};
    setText(this.elements.introTitle, global.introTitle);
    setText(this.elements.introSubtitle, global.introSubtitle);
    setText(this.elements.introStatus, global.introLoading);
    if (this.elements.enterButton && global.enterButton) {
      this.elements.enterButton.setAttribute("aria-label", global.enterButton);
      this.elements.enterButton.dataset.label = global.enterButton;
    }
    setText(this.elements.brandEyebrow, global.eyebrow);
    setText(this.elements.brandTitle, global.title);
    setText(this.elements.brandSubtitle, global.subtitle);
    setText(this.elements.sourceButton, global.sourceButton);
    setText(this.elements.refreshButton, global.refreshButton);
    setText(this.elements.autoButton, global.autoButton);
    setText(this.elements.manualButton, global.manualButton);
    setText(this.elements.sourceTitle, global.sourceDialogTitle);
    setText(this.elements.sourceIntro, global.sourceDialogIntro);
    if (global.searchPlaceholder) {
      this.elements.searchInput.placeholder = global.searchPlaceholder;
      this.elements.searchInput.setAttribute("aria-label", global.searchPlaceholder);
    }
  }

  setIntroLoading(isLoading, text) {
    if (text) this.elements.introStatus.textContent = text;
    this.elements.enterButton.disabled = isLoading;
    this.elements.introScreen.classList.toggle("is-ready", !isLoading);
  }

  setEntered(entered) {
    document.body.classList.toggle("is-entered", entered);
  }

  setCategory(category, { emit = true } = {}) {
    this.category = normalizePresetId(category);
    this.renderFilters();
    this.applyFilters({ emit });
  }

  setSearchQuery(query = "", { emit = true } = {}) {
    this.query = String(query).trim().toLowerCase();
    if (this.elements.searchInput) this.elements.searchInput.value = query;
    this.applyFilters({ emit });
  }

  renderFilters() {
    this.elements.filterBar.innerHTML = "";
    for (const category of CATEGORIES) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = category;
      button.className = category === this.category ? "filter-button is-active" : "filter-button";
      button.dataset.category = category;
      this.elements.filterBar.appendChild(button);
    }
  }

  renderRoutes() {
    this.elements.routeSelect.innerHTML = "";
    for (const route of this.atlas.routes) {
      const option = document.createElement("option");
      option.value = route.id;
      option.textContent = route.name;
      option.selected = route.id === this.activeRouteId;
      this.elements.routeSelect.appendChild(option);
    }
  }

  bindEvents() {
    this.elements.enterButton.addEventListener("click", () => this.onEnter?.());
    this.elements.introSearchButton?.addEventListener("click", () => this.submitIntroSearch());
    this.elements.introSearchInput?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      this.submitIntroSearch();
    });
    this.elements.introGuideCategories?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-category]");
      if (!button) return;
      this.setCategory(button.dataset.category);
      this.onEnter?.();
    });
    this.elements.filterBar.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-category]");
      if (!button) return;
      this.category = normalizePresetId(button.dataset.category);
      this.renderFilters();
      this.applyFilters();
    });

    this.elements.routeSelect.addEventListener("change", (event) => {
      this.activeRouteId = event.target.value;
      this.onRouteChange?.(this.activeRouteId);
    });

    this.elements.searchInput.addEventListener("input", (event) => {
      this.query = event.target.value.trim().toLowerCase();
      this.scheduleApplyFilters();
    });
    this.elements.searchInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      const persona = this.getSearchFocusPersona({ firstAllowed: true });
      if (!persona) return;
      event.preventDefault();
      this.onPreview?.(persona, { source: "search-enter" });
    });
    this.elements.cardTrack.addEventListener("scroll", () => this.scheduleVirtualCards());

    this.elements.autoButton.addEventListener("click", () => this.onAutoChange?.(true));
    this.elements.manualButton.addEventListener("click", () => this.onAutoChange?.(false));
    this.elements.refreshButton.addEventListener("click", () => this.onRefresh?.());
    this.elements.sourceButton.addEventListener("click", () => this.openSourceDialog(this.getActivePersona()));
    this.elements.profileSourceButton.addEventListener("click", () => this.onOpenSource?.(this.getActivePersona()));
    this.elements.closeModalButton.addEventListener("click", () => this.closeProfile());
    this.elements.closeSourceButton.addEventListener("click", () => this.closeSourceDialog());
    this.elements.closeWorkButton.addEventListener("click", () => this.closeWorkReader());
    this.elements.modalBackdrop.addEventListener("click", () => {
      if (this.workOpen) {
        this.closeWorkReader();
      } else if (this.sourceOpen) {
        this.closeSourceDialog();
      } else {
        this.closeProfile();
      }
    });
    this.elements.workSearchInput.addEventListener("input", () => {
      if (this.currentWork) this.renderWorkBody(this.currentWork, this.currentWorkContent);
    });
    this.elements.workSourceLink.addEventListener("click", () => this.scrollToWorkSources());
    this.elements.copyWorkSourceButton.addEventListener("click", () => this.copyWorkSource());

    this.elements.prevRouteButton.addEventListener("click", () => this.onRouteStep?.(-1));
    this.elements.nextRouteButton.addEventListener("click", () => this.onRouteStep?.(1));
    this.elements.continueRouteButton.addEventListener("click", () => {
      this.closeProfile(true);
      this.onAutoChange?.(true);
    });

    this.onKeydown = (event) => this.handleKeydown(event);
    window.addEventListener("keydown", this.onKeydown);
  }

  scheduleApplyFilters() {
    window.clearTimeout(this.searchTimer);
    this.searchTimer = window.setTimeout(() => {
      this.applyFilters();
    }, SEARCH_DEBOUNCE_MS);
  }

  submitIntroSearch() {
    const query = this.elements.introSearchInput?.value.trim() || "";
    if (query) {
      this.elements.searchInput.value = query;
      this.query = query.toLowerCase();
      this.applyFilters();
    }
    this.onEnter?.();
  }

  handleKeydown(event) {
    if (event.key === "/" && document.activeElement !== this.elements.searchInput) {
      event.preventDefault();
      this.elements.searchInput.focus();
      return;
    }

    if (event.key === "Escape") {
      if (this.workOpen) {
        this.closeWorkReader();
      } else if (this.sourceOpen) {
        this.closeSourceDialog();
      } else if (this.profileOpen) {
        this.closeProfile();
      }
      return;
    }

    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (document.activeElement === this.elements.searchInput) return;
    event.preventDefault();
    this.onRouteStep?.(event.key === "ArrowRight" ? 1 : -1);
  }

  applyFilters({ emit = true } = {}) {
    const startedAt = performance.now();
    const query = this.query;
    const filterPresetId = normalizePresetId(this.category);
    this.category = filterPresetId;
    const baseFiltered = applyFilterPreset(this.personas, filterPresetId);
    const activeInBase = baseFiltered.some((persona) => persona.id === this.activeId);
    const focusPoint = activeInBase ? null : focusPointForFilter(filterPresetId, baseFiltered);
    const routeCacheKey = createSpinRouteCacheKey(baseFiltered, {
      filterPresetId,
      startPersonaId: activeInBase ? this.activeId : "",
      startPoint: focusPoint,
      spinDirection: EARTH_MOTION_CONFIG.spinDirection
    });
    const routeOrdered = buildSpinAlignedSurfaceRoute(baseFiltered, {
      filterPresetId,
      startPersonaId: activeInBase ? this.activeId : "",
      startPoint: focusPoint,
      spinDirection: EARTH_MOTION_CONFIG.spinDirection,
      cacheKey: routeCacheKey
    });
    const matches = query
      ? routeOrdered.filter((persona) => personaSearchText(persona, this.searchIndex.get(persona.id)).includes(query))
      : routeOrdered;
    this.baseFiltered = routeOrdered;
    this.filtered = query ? matches.slice(0, SEARCH_RESULT_LIMIT) : routeOrdered;
    this.routeOrderedPersonas = this.filtered;
    this.lastSearchDuration = performance.now() - startedAt;

    this.elements.resultStats.textContent = query
      ? `${this.filtered.length} / ${baseFiltered.length} 个结果`
      : `${routeOrdered.length} / ${this.personas.length} 位人物`;
    this.renderCards();
    const searchFocus = this.getSearchFocusPersona();
    if (query && searchFocus) this.onPreview?.(searchFocus, { source: "search-auto" });
    if (emit) {
      const focusPersona =
        (this.activeId && this.filtered.find((persona) => persona.id === this.activeId)) ||
        searchFocus ||
        this.filtered[0] ||
        null;
      this.onFilterChange?.({
        derivedVisiblePersonas: this.filtered,
        routeOrderedPersonas: this.routeOrderedPersonas,
        baseFilteredPersonas: this.baseFiltered,
        filterPresetId,
        query,
        focusPersona,
        totalCount: this.personas.length,
        filterCount: baseFiltered.length,
        displayCount: this.filtered.length
      });
    }
  }

  getSearchFocusPersona({ firstAllowed = false } = {}) {
    if (!this.query) return null;
    if (this.filtered.length === 0) return null;
    const exact = this.filtered.find((persona) => {
      const fields = [persona.displayName, persona.name, persona.latinName]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      return fields.some((value) => value === this.query || value.startsWith(this.query));
    });
    if (exact) return exact;
    if (this.filtered.length === 1 || firstAllowed) return this.filtered[0];
    return null;
  }

  renderCards() {
    this.cardRenderToken += 1;
    this.cardVirtualList = null;
    this.elements.cardTrack.innerHTML = "";
    if (this.filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-card";
      empty.textContent = this.atlas?.copy?.global?.emptyState || "没有匹配的人物";
      this.elements.cardTrack.appendChild(empty);
      return;
    }

    if (this.filtered.length > 18) {
      this.cardVirtualList = this.filtered;
      this.renderVirtualCards();
      return;
    }

    for (const persona of this.filtered) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = persona.id === this.activeId ? "person-card is-active" : "person-card";
      card.dataset.id = persona.id;

      const avatar = document.createElement("span");
      avatar.className = "card-avatar";
      renderAvatar(avatar, persona, { size: "thumb" });

      const body = document.createElement("span");
      body.className = "card-body";

      const title = document.createElement("strong");
      title.textContent = persona.displayName;

      const identity = document.createElement("span");
      identity.className = "card-identity";
      identity.textContent = persona.identity;

      const summary = document.createElement("span");
      summary.className = "card-summary";
      summary.textContent = persona.works?.[0] ? `《${persona.works[0]}》` : persona.summary;

      body.append(title, identity, summary);
      card.append(avatar, body);
      card.addEventListener("click", () => this.onSelect?.(persona));
      card.addEventListener("pointerenter", () => this.onPreview?.(persona, { source: "card-hover" }));
      card.addEventListener("focus", () => this.onPreview?.(persona, { source: "card-focus" }));
      this.elements.cardTrack.appendChild(card);
    }
  }

  scheduleVirtualCards() {
    if (!this.cardVirtualList) return;
    if (this.cardScrollRaf) return;
    this.cardScrollRaf = window.requestAnimationFrame(() => {
      this.cardScrollRaf = null;
      this.renderVirtualCards();
    });
  }

  renderVirtualCards() {
    if (!this.cardVirtualList?.length) return;
    const list = this.cardVirtualList;
    const track = this.elements.cardTrack;
    const viewport = track.clientWidth || window.innerWidth || 1024;
    const start = Math.max(0, Math.floor(track.scrollLeft / VIRTUAL_CARD_WIDTH) - VIRTUAL_CARD_BUFFER);
    const visibleCount = Math.ceil(viewport / VIRTUAL_CARD_WIDTH) + VIRTUAL_CARD_BUFFER * 2;
    const end = Math.min(list.length, start + visibleCount);
    const fragment = document.createDocumentFragment();

    track.innerHTML = "";
    if (start > 0) fragment.appendChild(createCardSpacer(start * VIRTUAL_CARD_WIDTH));
    for (let index = start; index < end; index += 1) {
      fragment.appendChild(this.createPersonaCard(list[index]));
    }
    if (end < list.length) fragment.appendChild(createCardSpacer((list.length - end) * VIRTUAL_CARD_WIDTH));
    track.appendChild(fragment);
    this.updateActiveCardState(null, this.activeId);
  }

  createPersonaCard(persona) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = persona.id === this.activeId ? "person-card is-active" : "person-card";
    card.dataset.id = persona.id;

    const avatar = document.createElement("span");
    avatar.className = "card-avatar";
    renderAvatar(avatar, persona, { size: "thumb" });

    const body = document.createElement("span");
    body.className = "card-body";

    const title = document.createElement("strong");
    title.textContent = persona.displayName;

    const identity = document.createElement("span");
    identity.className = "card-identity";
    identity.textContent = persona.identity;

    const summary = document.createElement("span");
    summary.className = "card-summary";
    summary.textContent = persona.works?.[0] ? `《${persona.works[0]}》` : persona.summary;

    body.append(title, identity, summary);
    card.append(avatar, body);
    card.addEventListener("click", () => this.onSelect?.(persona));
    card.addEventListener("pointerenter", () => this.onPreview?.(persona, { source: "card-hover" }));
    card.addEventListener("focus", () => this.onPreview?.(persona, { source: "card-focus" }));
    return card;
  }

  selectById(id, { emit = true, scroll = true, openModal = false, scrollBehavior = "smooth" } = {}) {
    const persona = this.personas.find((item) => item.id === id);
    if (!persona) return;

    const previousId = this.activeId;
    this.activeId = id;
    this.updateActiveCardState(previousId, id);
    if (scroll) {
      const card = this.elements.cardTrack.querySelector(`[data-id="${CSS.escape(id)}"]`);
      if (card) {
        card.scrollIntoView({ behavior: scrollBehavior, inline: "center", block: "nearest" });
      } else if (this.cardVirtualList) {
        const index = this.cardVirtualList.findIndex((item) => item.id === id);
        if (index >= 0) {
          const viewport = this.elements.cardTrack.clientWidth || window.innerWidth || VIRTUAL_CARD_WIDTH * 4;
          const targetLeft = index * VIRTUAL_CARD_WIDTH - viewport / 2 + VIRTUAL_CARD_WIDTH / 2;
          this.elements.cardTrack.scrollTo({ left: Math.max(0, targetLeft), behavior: scrollBehavior });
          this.renderVirtualCards();
        }
      }
    }

    if (openModal) this.openProfile(persona);
    if (emit) this.onSelect?.(persona);
  }

  updateActiveCardState(previousId, nextId) {
    if (previousId && previousId !== nextId) {
      this.elements.cardTrack
        .querySelector(`[data-id="${CSS.escape(previousId)}"]`)
        ?.classList.remove("is-active");
    }
    if (nextId) {
      this.elements.cardTrack
        .querySelector(`[data-id="${CSS.escape(nextId)}"]`)
        ?.classList.add("is-active");
    }
  }

  openProfile(persona) {
    this.profileOpen = true;
    const token = ++this.activeProfileLoadToken;
    this.dimWhisper(true);
    this.elements.modalBackdrop.hidden = false;
    this.elements.profileModal.hidden = false;
    this.renderProfileLoading(persona);

    gsap.fromTo(
      this.elements.modalBackdrop,
      { opacity: 0 },
      { opacity: 1, duration: 0.28, ease: "power2.out" }
    );
    gsap.fromTo(
      this.elements.profileModal,
      { opacity: 0, y: 24, scale: 0.985, filter: "blur(8px)" },
      { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.42, ease: "power3.out" }
    );
    const detailStartedAt = performance.now();
    this.loadPersonaDetail(persona.id)
      .then((detail) => {
        this.lastPersonaDetailDuration = performance.now() - detailStartedAt;
        if (!this.profileOpen || token !== this.activeProfileLoadToken || this.activeId !== persona.id) return;
        const merged = { ...persona, ...detail };
        this.personaById.set(persona.id, merged);
        this.renderProfile(merged);
      })
      .catch(() => {
        if (!this.profileOpen || token !== this.activeProfileLoadToken) return;
        this.renderProfile(persona);
        this.showNotice("error", "人物档案暂时无法载入");
      });
  }

  async loadPersonaDetail(personaId) {
    if (this.personaDetailCache.has(personaId)) return this.personaDetailCache.get(personaId);
    const promise = this.atlas?.loadPersonaDetail
      ? this.atlas.loadPersonaDetail(personaId)
      : Promise.resolve(this.personaById.get(personaId));
    this.personaDetailCache.set(personaId, promise);
    try {
      const detail = await promise;
      if (detail) this.personaDetailCache.set(personaId, detail);
      return detail;
    } catch (error) {
      this.personaDetailCache.delete(personaId);
      throw error;
    }
  }

  renderProfileLoading(persona) {
    renderAvatar(this.elements.profileAvatar, persona, { mode: "background", size: "modal" });
    this.elements.profileCategory.textContent = persona.category;
    this.elements.profileName.textContent = persona.displayName;
    this.elements.profileLatin.textContent = persona.latinName || persona.nameEn || "";
    this.elements.profileIdentity.textContent = persona.identity || persona.shortRole || "资料未详";
    this.elements.profileEra.textContent = persona.era || "资料未详";
    this.elements.profileBirthplace.textContent = "档案调阅中";
    this.elements.profileSchool.textContent = "文脉归档中";
    this.elements.profileEpigraph.textContent = "文脉显影中。";
    this.elements.profileWhoHeIs.textContent = persona.summary || "人物身份正在归档。";
    this.elements.profileBio.textContent = "人物生平正在展开。";
    this.elements.profileWhyMatters.textContent = "正在辨认这位人物在文学与思想史中的位置。";
    this.elements.profilePersona.textContent = persona.summary || persona.whisper || "精神纹理正在显影。";
    this.elements.profileHowToRead.textContent = "作品入口正在整理。";
    this.elements.profileHistoricalRelation.textContent = "时代线索正在归档。";
    this.elements.profileRelatedPath.textContent = "相关人物与思想路径正在生成。";
    this.renderWorkChips(persona);
    renderChips(this.elements.profileKeywords, persona.keywords || []);
  }

  renderProfile(persona) {
    renderAvatar(this.elements.profileAvatar, persona, { mode: "background", size: "modal" });
    this.elements.profileCategory.textContent = persona.category;
    this.elements.profileName.textContent = persona.displayName;
    this.elements.profileLatin.textContent = persona.latinName || "";
    this.elements.profileIdentity.textContent = persona.identity || "资料未详";
    this.elements.profileEra.textContent = persona.era || "资料未详";
    this.elements.profileBirthplace.textContent = persona.birthplace || "资料未详";
    this.elements.profileSchool.textContent = persona.school || persona.movement || "资料未详";
    this.elements.profileEpigraph.textContent = chooseProfileText(persona, ["profileEpigraph", "whisper"], buildProfileEpigraph(persona));
    this.elements.profileWhoHeIs.textContent = chooseProfileText(persona, ["whoHeIs", "summary"], buildWhoHeIsFallback(persona));
    this.elements.profileBio.textContent = chooseProfileText(persona, ["lifeArc", "lifeSummary", "biography", "bio"], "资料未详");
    this.elements.profileWhyMatters.textContent = chooseProfileText(persona, ["whyMatters", "personaSummary", "summary"], buildWhyMattersFallback(persona));
    this.elements.profilePersona.textContent = chooseProfileText(
      persona,
      ["styleAndTemperament", "personaSummary", "summary"],
      buildTemperamentFallback(persona)
    );
    this.elements.profileHowToRead.textContent = chooseProfileText(persona, ["howToRead", "lifeSummary"], buildHowToReadFallback(persona));
    this.elements.profileHistoricalRelation.textContent = chooseProfileText(
      persona,
      ["historicalRelation", "lifeSummary", "biography"],
      buildHistoricalRelationFallback(persona)
    );
    this.elements.profileRelatedPath.textContent = chooseProfileText(persona, ["relatedPath"], buildRelatedPathFallback(persona, this.personas));
    this.renderWorkChips(persona);
    renderChips(this.elements.profileKeywords, persona.keywords);
  }

  renderWorkChips(persona) {
    this.elements.profileWorks.innerHTML = "";
    const indexedWorks = Array.from(this.workIndexByPersonaTitle.values()).filter((work) => work.personaId === persona.id);
    const works = persona.works?.length
      ? persona.works.map((title) => this.getWorkEntry(persona.id, title) || { title })
      : indexedWorks.length
        ? indexedWorks
        : [{ title: "资料未详" }];
    for (const workItem of works) {
      const work = workItem.workId ? this.getWorkEntry(persona.id, workItem.workId) : this.getWorkEntry(persona.id, workItem.title);
      const chip = document.createElement("button");
      chip.type = "button";
      const displayMode = workDisplayMode(work);
      const hasPublicText = displayMode === "guide_with_public_text" || displayMode === "public_domain_reference";
      chip.className = `text-chip work-chip ${hasPublicText ? "has-full-text" : "is-limited"}`;
      chip.textContent = work?.title || workItem.title;
      chip.title = "打开作品导读档案";
      chip.addEventListener("click", () => this.openWorkReader(persona.id, work?.workId || workItem.workId || workItem.title));
      this.elements.profileWorks.appendChild(chip);
    }
  }

  getWorkEntry(personaId, titleOrId) {
    const base =
      this.workIndexById.get(titleOrId) ||
      this.workIndexByPersonaTitle.get(`${personaId}::${titleOrId}`) ||
      null;
    const rich = base ? this.workDetailCache.get(base.workId) : this.workDetailCache.get(titleOrId) || null;
    if (!base && !rich) return null;
    return mergeWorkEntry(base, rich);
  }

  async openWorkReader(personaId, titleOrId) {
    const baseWork = this.getWorkEntry(personaId, titleOrId);
    const persona = this.personaById.get(personaId) || this.personas.find((item) => item.id === personaId);
    if (!baseWork) {
      this.showNotice("error", "未找到作品资料");
      return;
    }

    this.workOpen = true;
    this.onWorkReaderOpen?.();
    this.currentWork = baseWork;
    this.currentWorkContent = null;
    this.elements.modalBackdrop.hidden = false;
    this.elements.workReader.hidden = false;
    this.elements.workSearchInput.value = "";
    this.elements.workSearchInput.placeholder = "寻章问义";
    this.elements.workTitle.textContent = baseWork.title;
    this.elements.workStatus.textContent = "作品";
    this.elements.workMeta.textContent = workMetaText(baseWork, persona);
    this.elements.workSummary.textContent = "作品导读正在入卷。";
    this.elements.workSourceLink.hidden = false;
    this.elements.workSourceLink.textContent = "延伸阅读";
    this.elements.copyWorkSourceButton.textContent = "复制书目";
    this.teardownWorkScrollSpy();
    this.workSectionIds = [];
    this.elements.workToc.innerHTML = "";
    this.elements.workBody.innerHTML = `<p class="work-loading">正在准备作品内容...</p>`;
    this.elements.workBody.scrollTo({ top: 0, behavior: "auto" });

    gsap.fromTo(
      this.elements.workReader,
      { opacity: 0, y: 18, scale: 0.985 },
      { opacity: 1, y: 0, scale: 1, duration: 0.32, ease: "power3.out" }
    );

    try {
      const detailStartedAt = performance.now();
      const richWork = await this.loadWorkDetail(baseWork.workId || titleOrId);
      this.lastWorkDetailDuration = performance.now() - detailStartedAt;
      const work = mergeWorkEntry(baseWork, richWork);
      const guideWork = normalizeWorkGuide(work, persona, this.personas);
      if (!this.workOpen || this.currentWork?.workId !== baseWork.workId) return;
      this.currentWork = guideWork;
      this.elements.workTitle.textContent = guideWork.title;
      this.elements.workStatus.textContent = workStatusBadgeText(guideWork);
      this.elements.workMeta.textContent = workMetaText(guideWork, persona);
      this.elements.workSummary.textContent = guideWork.workEpigraph || guideWork.poeticLead || "从作品进入人物的精神纹理。";
      if (!shouldLoadEmbeddedContent(guideWork)) {
        this.renderWorkBody(guideWork, null);
        return;
      }
      const content = await this.loadWorkContent(guideWork);
      if (this.currentWork?.workId !== guideWork.workId) return;
      this.currentWorkContent = content;
      this.renderWorkBody(guideWork, content);
    } catch {
      this.currentWorkContent = null;
      this.elements.workBody.innerHTML = `<p class="work-warning">作品全文缓存暂时无法载入。请通过来源链接继续阅读。</p>`;
    }
  }

  async loadWorkDetail(workId) {
    if (this.workDetailCache.has(workId)) return this.workDetailCache.get(workId);
    const promise = this.atlas?.loadWorkDetail ? this.atlas.loadWorkDetail(workId) : Promise.resolve(null);
    this.workDetailCache.set(workId, promise);
    try {
      const detail = await promise;
      if (detail) this.workDetailCache.set(workId, detail);
      return detail;
    } catch (error) {
      this.workDetailCache.delete(workId);
      throw error;
    }
  }

  async loadWorkContent(work) {
    if (!work.contentPath) throw new Error("Missing contentPath");
    if (this.workContentCache.has(work.contentPath)) return this.workContentCache.get(work.contentPath);
    const response = await fetch(`/${work.contentPath}`);
    if (!response.ok) throw new Error(`Failed to load work content: ${work.contentPath}`);
    const content = await response.json();
    this.workContentCache.set(work.contentPath, content);
    return content;
  }

  renderWorkBody(work, content) {
    const query = this.elements.workSearchInput.value.trim().toLowerCase();
    this.teardownWorkScrollSpy();
    this.elements.workToc.innerHTML = "";
    this.elements.workBody.innerHTML = "";
    this.elements.workToc.setAttribute("aria-label", "作品导读目录");

    const guideSections = buildWorkGuideSections(work, this.personas);
    const textSections = shouldRenderEmbeddedContent(work, content) ? buildEmbeddedTextSections(content) : [];
    const allSections = [...guideSections, ...textSections];
    const matchedSections = query
      ? allSections.filter((section) => `${section.heading}\n${section.searchText || ""}`.toLowerCase().includes(query))
      : allSections;

    if (matchedSections.length === 0) {
      const empty = document.createElement("p");
      empty.className = "work-warning";
      empty.textContent = "当前作品导读中没有匹配内容。";
      this.elements.workBody.appendChild(empty);
      this.workSectionIds = [];
      return;
    }

    this.workSectionIds = matchedSections.map((section, index) => section.id || `work-section-${index}`);

    matchedSections.forEach((section, index) => {
      const sectionId = section.id || `work-section-${index}`;
      const headingId = `${sectionId}-heading`;
      const tocButton = document.createElement("button");
      tocButton.type = "button";
      tocButton.className = "work-toc-item";
      tocButton.textContent = section.heading || `条目 ${index + 1}`;
      tocButton.dataset.sectionId = sectionId;
      tocButton.setAttribute("aria-controls", sectionId);
      if (index === 0) {
        tocButton.classList.add("is-active");
        tocButton.setAttribute("aria-current", "true");
      }
      tocButton.addEventListener("click", () => this.scrollToWorkSection(sectionId));
      this.elements.workToc.appendChild(tocButton);

      const articleSection = document.createElement("section");
      articleSection.className = `work-section ${section.kind === "text" ? "" : "is-commentary"}`.trim();
      articleSection.id = sectionId;
      articleSection.dataset.sectionId = sectionId;
      articleSection.setAttribute("aria-labelledby", headingId);
      const heading = document.createElement("h3");
      heading.id = headingId;
      heading.textContent = section.heading || `条目 ${index + 1}`;
      articleSection.appendChild(heading);
      section.render(articleSection);
      this.elements.workBody.appendChild(articleSection);
    });

    this.resetWorkScrollPosition();
    this.setupWorkScrollSpy();
  }

  scrollToWorkSources() {
    if (!this.currentWork) return;
    if (this.elements.workBody.querySelector("#work-further-reading")) {
      this.scrollToWorkSection("work-further-reading");
      return;
    }
    this.renderWorkBody(this.currentWork, this.currentWorkContent);
    this.scrollToWorkSection("work-further-reading");
  }

  setActiveWorkToc(sectionId) {
    if (!sectionId) return;
    this.elements.workToc.querySelectorAll("button[data-section-id]").forEach((button) => {
      const active = button.dataset.sectionId === sectionId;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
  }

  resetWorkScrollPosition() {
    const firstSectionId = this.workSectionIds[0];
    if (this.elements.workBody) this.elements.workBody.scrollTo({ top: 0, behavior: "auto" });
    this.setActiveWorkToc(firstSectionId);
  }

  scrollToWorkSection(sectionId) {
    const root = this.elements.workBody;
    const target = root?.querySelector(`#${CSS.escape(sectionId)}`);
    if (!root || !target) return;

    this.workProgrammaticScroll = true;
    this.workProgrammaticSectionId = sectionId;
    this.setActiveWorkToc(sectionId);

    const rootTop = root.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;
    const offset = 24;

    root.scrollTo({
      top: root.scrollTop + targetTop - rootTop - offset,
      behavior: "smooth"
    });

    window.clearTimeout(this.workProgrammaticTimer);
    this.workProgrammaticTimer = window.setTimeout(() => {
      this.releaseWorkProgrammaticScroll();
    }, 740);
  }

  setupWorkScrollSpy() {
    const root = this.elements.workBody;
    const sections = this.getWorkSections();
    if (!root || sections.length === 0) return;

    const scheduleUpdate = () => {
      if (this.workProgrammaticScroll) return;
      if (this.workScrollRaf) cancelAnimationFrame(this.workScrollRaf);
      this.workScrollRaf = requestAnimationFrame(() => this.updateActiveWorkSectionByScroll());
    };

    if ("IntersectionObserver" in window) {
      this.workScrollObserver = new IntersectionObserver(scheduleUpdate, {
        root,
        rootMargin: "-18% 0px -62% 0px",
        threshold: [0, 0.15, 0.3, 0.6]
      });
      sections.forEach((section) => this.workScrollObserver.observe(section));
    }

    root.addEventListener("scroll", scheduleUpdate, { passive: true });
    this.workScrollEndHandler = () => this.releaseWorkProgrammaticScroll();
    root.addEventListener("scrollend", this.workScrollEndHandler);
    this.workScrollHandler = scheduleUpdate;
    this.updateActiveWorkSectionByScroll();
  }

  teardownWorkScrollSpy() {
    const root = this.elements.workBody;
    if (this.workScrollObserver) {
      this.workScrollObserver.disconnect();
      this.workScrollObserver = null;
    }
    if (root && this.workScrollHandler) {
      root.removeEventListener("scroll", this.workScrollHandler);
      this.workScrollHandler = null;
    }
    if (root && this.workScrollEndHandler) {
      root.removeEventListener("scrollend", this.workScrollEndHandler);
      this.workScrollEndHandler = null;
    }
    if (this.workScrollRaf) {
      cancelAnimationFrame(this.workScrollRaf);
      this.workScrollRaf = null;
    }
    window.clearTimeout(this.workProgrammaticTimer);
    this.workProgrammaticTimer = null;
    this.workProgrammaticScroll = false;
    this.workProgrammaticSectionId = null;
  }

  releaseWorkProgrammaticScroll() {
    if (!this.workProgrammaticScroll) return;
    const pendingSectionId = this.workProgrammaticSectionId;
    this.workProgrammaticScroll = false;
    this.workProgrammaticSectionId = null;
    window.clearTimeout(this.workProgrammaticTimer);
    this.workProgrammaticTimer = null;
    if (pendingSectionId) this.setActiveWorkToc(pendingSectionId);
    else this.updateActiveWorkSectionByScroll();
  }

  getWorkSections() {
    return this.workSectionIds
      .map((sectionId) => this.elements.workBody.querySelector(`#${CSS.escape(sectionId)}`))
      .filter(Boolean);
  }

  updateActiveWorkSectionByScroll() {
    const root = this.elements.workBody;
    const sections = this.getWorkSections();
    if (!root || sections.length === 0) return;

    if (root.scrollTop <= 8) {
      this.setActiveWorkToc(sections[0].dataset.sectionId);
      return;
    }

    if (root.scrollTop + root.clientHeight >= root.scrollHeight - 12) {
      this.setActiveWorkToc(sections[sections.length - 1].dataset.sectionId);
      return;
    }

    const rootRect = root.getBoundingClientRect();
    const readingLine = rootRect.top + rootRect.height * 0.28;
    const candidates = sections
      .map((section) => {
        const rect = section.getBoundingClientRect();
        const isVisible =
          rect.bottom >= rootRect.top + rootRect.height * 0.12 &&
          rect.top <= rootRect.bottom - rootRect.height * 0.18;
        return {
          id: section.dataset.sectionId,
          distance: Math.abs(rect.top - readingLine),
          isVisible
        };
      })
      .filter((item) => item.id && item.isVisible)
      .sort((a, b) => a.distance - b.distance);

    if (candidates[0]?.id) this.setActiveWorkToc(candidates[0].id);
  }

  closeWorkReader() {
    if (!this.workOpen) return;
    this.teardownWorkScrollSpy();
    this.workOpen = false;
    this.onWorkReaderClose?.();
    this.currentWork = null;
    this.currentWorkContent = null;
    this.elements.workReader.hidden = true;
    if (!this.sourceOpen && !this.profileOpen) this.elements.modalBackdrop.hidden = true;
  }

  async copyWorkSource() {
    const work = this.currentWork;
    if (!work) return;
    const sources = getWorkSources(work);
    const bibliography = [
      `《${work.title || "作品"}》`,
      work.authorName || work.author || "作者未详",
      [work.era, work.genre].filter(Boolean).join(" / ") || "作品导读",
      "导读来源：文渊作品导读",
      `资料入口：${sources.length ? sources.map((source) => source.url || source.sourceUrl).filter(Boolean).join("；") : "可从作者生平、同代思想论争与相关文学史脉络继续阅读"}`
    ].join("｜");
    try {
      await navigator.clipboard?.writeText(bibliography);
      this.showNotice("success", "书目信息已复制");
    } catch {
      this.showNotice("error", "复制失败，请手动查看延伸阅读");
    }
  }

  renderRelated(personaId, relations) {
    if (!this.atlas) return;
    this.elements.relatedList.innerHTML = "";
    const related = relations
      .map((relation) => {
        const targetId = relation.from === personaId ? relation.to : relation.from;
        const persona = this.personas.find((item) => item.id === targetId);
        return persona ? { persona, relation } : null;
      })
      .filter(Boolean)
      .slice(0, 3);

    this.elements.relatedSection.hidden = related.length === 0;
    for (const item of related) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "related-person";
      const avatar = document.createElement("span");
      avatar.className = "related-avatar";
      renderAvatar(avatar, item.persona);
      const copy = document.createElement("span");
      const name = document.createElement("strong");
      name.textContent = item.persona.displayName;
      const label = document.createElement("em");
      label.textContent = item.relation.label;
      copy.append(name, label);
      button.append(avatar, copy);
      button.addEventListener("click", () => this.onRelatedSelect?.(item.persona));
      this.elements.relatedList.appendChild(button);
    }
  }

  closeProfile(notify = true) {
    if (!this.profileOpen) return;
    this.closeWorkReader();
    this.profileOpen = false;
    this.dimWhisper(false);
    this.elements.profileModal.hidden = true;
    if (!this.sourceOpen) this.elements.modalBackdrop.hidden = true;
    if (notify) this.onCloseProfile?.();
  }

  openSourceDialog(persona) {
    if (this.workOpen) this.closeWorkReader();
    this.sourceOpen = true;
    this.elements.modalBackdrop.hidden = false;
    this.elements.sourceDialog.hidden = false;
    this.renderSource(persona);
    gsap.fromTo(
      this.elements.sourceDialog,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.32, ease: "power3.out" }
    );
  }

  renderSource(persona) {
    const lines = [];
    lines.push(`<p><strong>策展说明</strong><span>本页以公开资料整理文学、哲学与思想人物档案，支持静态部署和断网浏览。</span></p>`);

    if (persona) {
      lines.push(`<p><strong>当前人物</strong><span>${escapeHtml(persona.displayName)} · ${escapeHtml(persona.identity)}</span></p>`);
      lines.push(`<p><strong>资料可靠性</strong><span>${qualityText(persona.dataQuality)}</span></p>`);
      lines.push(`<p><strong>头像状态</strong><span>${avatarText(persona)}</span></p>`);
      lines.push(`<p><strong>头像来源</strong>${avatarCreditLinks(persona.avatarCredit)}</p>`);
      lines.push(`<p><strong>参考链接</strong>${sourceLinks(persona.references)}</p>`);
      if (persona.sourceUrl) {
        lines.push(`<p><strong>人物页面</strong><a href="${escapeAttribute(persona.sourceUrl)}" target="_blank" rel="noreferrer">打开参考页面</a></p>`);
      }
    } else {
      lines.push(`<p><strong>头像说明</strong><span>未确认版权或来源的肖像不进入界面。缺失头像使用低饱和文字占位。</span></p>`);
    }

    this.elements.sourceContent.innerHTML = lines.join("");
  }

  closeSourceDialog() {
    if (!this.sourceOpen) return;
    this.sourceOpen = false;
    this.elements.sourceDialog.hidden = true;
    if (!this.profileOpen) this.elements.modalBackdrop.hidden = true;
  }

  setAutoMode(enabled) {
    this.elements.autoButton.classList.toggle("is-active", enabled);
    this.elements.manualButton.classList.toggle("is-active", !enabled);
    this.elements.autoButton.hidden = enabled;
    this.elements.manualButton.hidden = !enabled;
  }

  setActiveRoute(routeId) {
    this.activeRouteId = routeId;
    this.elements.routeSelect.value = routeId;
  }

  setRouteCaption(text) {
    this.elements.routeCaptionText.textContent = text;
  }

  showWhisper(persona, { dim = false } = {}) {
    if (!persona || !this.elements.personaWhisper) return;
    const editorial = this.getEditorial(persona);
    const whisper = editorial?.whisper || persona.summary || "资料未详";
    const oneLine = editorial?.oneLine || `${persona.displayName}，${persona.identity}`;
    const samePersona = this.lastWhisperId === persona.id;
    const sameDim = this.lastWhisperDim === dim;

    if (samePersona && sameDim && this.elements.personaWhisper.classList.contains("is-visible")) return;

    this.whisperTimeline?.kill();
    this.lastWhisperId = persona.id;
    this.lastWhisperDim = dim;
    this.elements.whisperText.textContent = whisper;
    this.elements.whisperName.textContent = `${persona.displayName} · ${oneLine}`;
    this.elements.personaWhisper.classList.toggle("is-dimmed", dim);
    this.elements.personaWhisper.classList.add("is-visible");
    gsap.set(this.elements.personaWhisper, { filter: "none", scale: 1 });
    this.whisperTimeline = gsap.timeline({ defaults: { ease: "power2.out", overwrite: true } });
    this.whisperTimeline.fromTo(
      this.elements.personaWhisper,
      { opacity: dim ? 0.38 : 0.72, y: 8 },
      { opacity: dim ? 0.44 : 1, y: 0, duration: dim ? 0.22 : 0.42 }
    );
  }

  dimWhisper(dimmed = true) {
    this.elements.personaWhisper?.classList.toggle("is-dimmed", dimmed);
  }

  getEditorial(persona) {
    return this.copy?.personaEditorial?.[persona.id] || null;
  }

  getActiveId() {
    return this.activeId;
  }

  getActivePersona() {
    return this.personas.find((persona) => persona.id === this.activeId) || null;
  }

  isProfileOpen() {
    return this.profileOpen;
  }

  showNotice(type, message) {
    window.clearTimeout(this.noticeTimer);
    this.elements.notice.textContent = message;
    this.elements.notice.className = `notice is-visible ${type}`;
    this.noticeTimer = window.setTimeout(() => {
      this.elements.notice.classList.remove("is-visible");
    }, type === "error" ? 6200 : 3200);
  }

  getRenderedCardCount() {
    return this.elements.cardTrack.querySelectorAll(".person-card").length;
  }

  dispose() {
    window.removeEventListener("keydown", this.onKeydown);
    window.clearTimeout(this.noticeTimer);
    this.whisperTimeline?.kill();
  }
}

const PROFILE_TEMPLATE_TERMS = [
  "公开可核查",
  "较克制",
  "后续" + "补充",
  "待" + "补充",
  "暂" + "未",
  "其意义主要体现在",
  "文本、概念或叙事方式",
  "具有重要影响",
  "提供了新的视角",
  "值得关注",
  "阅读时可以留意作者如何选择材料",
  "安排叙事节奏",
  "事实、评价与文学表达之间",
  "当前版本优先呈现",
  "未经复核的轶事"
];

function chooseProfileText(persona, fieldNames, fallback = "资料未详") {
  for (const field of fieldNames) {
    const value = persona?.[field];
    if (isReadableProfileText(value)) return value.trim();
  }
  return fallback;
}

function isReadableProfileText(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  return !PROFILE_TEMPLATE_TERMS.some((term) => text.includes(term));
}

function buildProfileEpigraph(persona) {
  const work = firstWork(persona);
  if (persona?.displayName && work) return `从《${stripBookMarks(work)}》进入他的精神坐标。`;
  if (persona?.displayName) return `在时代深处辨认${persona.displayName}。`;
  return "在人物的来路中辨认精神线索。";
}

function buildWhoHeIsFallback(persona) {
  const identity = persona?.identity || persona?.shortRole || persona?.category || "文学与思想人物";
  const era = persona?.era ? `${persona.era}的` : "";
  const region = persona?.birthCountry || persona?.cultureRegion || persona?.nationality || "";
  const work = firstWork(persona);
  const workText = work ? `，可从《${stripBookMarks(work)}》进入他的作品世界` : "";
  return `${persona?.displayName || "这位人物"}是${region}${era}${identity}${workText}。`;
}

function buildWhyMattersFallback(persona) {
  const work = firstWork(persona);
  const keywords = (persona?.keywords || []).slice(0, 3).join("、");
  const core = work ? `《${stripBookMarks(work)}》` : persona?.school || persona?.movement || keywords || "他的作品";
  return `${persona?.displayName || "这位人物"}的价值，首先要从${core}所呈现的时代经验与表达方式进入。读他不是只记住一个文学史标签，而是看见一个人如何把自身处境、语言选择和公共问题组织成可持续阅读的精神现场。`;
}

function buildTemperamentFallback(persona) {
  const keywords = (persona?.keywords || []).slice(0, 4).join("、") || persona?.school || persona?.movement || "作品线索";
  return `${persona?.displayName || "这位人物"}的写作或思想气质可从${keywords}进入。更适合把他放在具体作品、时代压力和语言风格之间观察，而不是只用单一身份概括。`;
}

function buildHowToReadFallback(persona) {
  const works = workNames(persona).slice(0, 3);
  if (works.length) {
    return `初读${persona?.displayName || "这位人物"}，可以先从${works.map((work) => `《${stripBookMarks(work)}》`).join("、")}进入，再回到他的时代、流派和关键词中辨认作品的方向。`;
  }
  return `初读${persona?.displayName || "这位人物"}，先看他的时代、身份和关键词，再从来源中选择可靠版本进入原作或思想文本。`;
}

function buildHistoricalRelationFallback(persona) {
  const era = persona?.era || "其所处时代";
  const region = persona?.birthCountry || persona?.cultureRegion || persona?.nationality || "";
  const movement = persona?.movement || persona?.school || persona?.category || "文学与思想传统";
  return `${persona?.displayName || "这位人物"}需要放回${region}${era}的历史环境中理解。他的作品与${movement}相互牵连，既回应当时的语言、制度和精神问题，也为后来的读者留下重新进入那个时代的入口。`;
}

function buildRelatedPathFallback(persona, personas = []) {
  const names = (persona?.relatedPersonas || [])
    .map((id) => personas.find((item) => item.id === id)?.displayName)
    .filter(Boolean)
    .slice(0, 4);
  if (names.length) return `可以沿着${names.join("、")}等人物形成的阅读路径，观察相近主题在不同传统中的回声。`;
  const topics = (persona?.keywords || []).slice(0, 3).join("、") || persona?.school || persona?.movement || "相关传统";
  return `可沿着${topics}继续追索他的作品位置。`;
}

function firstWork(persona) {
  return workNames(persona)[0] || "";
}

function workNames(persona) {
  return [...(persona?.representativeWorks || []), ...(persona?.works || [])].filter(Boolean);
}

function stripBookMarks(value) {
  return String(value || "").replace(/^《|》$/g, "");
}

function renderChips(container, values = []) {
  container.innerHTML = "";
  const items = values.length > 0 ? values : ["资料未详"];
  for (const value of items) {
    const chip = document.createElement("span");
    chip.className = "text-chip";
    chip.textContent = value;
    container.appendChild(chip);
  }
}

function renderAvatar(element, persona, { mode = "image", size = "thumb" } = {}) {
  const url = avatarFor(persona, size);
  element.textContent = "";
  element.setAttribute("aria-label", avatarPendingText(persona));
  element.classList.remove("has-image", "is-pending-avatar");
  element.style.backgroundImage = "";

  if (!url) {
    element.classList.add("is-pending-avatar");
    if (mode === "background") element.textContent = "图像待核验";
    return;
  }

  if (mode === "background") {
    const image = new Image();
    image.decoding = "async";
    element.classList.add("is-pending-avatar");
    image.onload = () => {
      element.style.backgroundImage = `url("${url}")`;
      element.classList.remove("is-pending-avatar");
      element.classList.add("has-image");
    };
    image.onerror = () => {
      element.style.backgroundImage = "";
      element.classList.remove("has-image");
      element.classList.add("is-pending-avatar");
      element.textContent = "图像待核验";
      if (import.meta.env?.DEV) console.warn(`avatar failed: ${persona?.id || "unknown"}`);
    };
    image.src = url;
    return;
  }

  const image = document.createElement("img");
  image.src = url;
  image.alt = "";
  image.loading = "lazy";
  image.decoding = "async";
  const dimensions = size === "marker" ? 64 : size === "modal" ? 256 : 96;
  image.width = dimensions;
  image.height = dimensions;
  image.addEventListener("load", () => {
    element.classList.remove("is-pending-avatar");
    element.classList.add("has-image");
  });
  image.addEventListener("error", () => {
    image.remove();
    element.classList.remove("has-image");
    element.classList.add("is-pending-avatar");
    if (import.meta.env?.DEV) console.warn(`avatar failed: ${persona?.id || "unknown"}`);
  });
  element.classList.add("is-pending-avatar");
  element.appendChild(image);
}

function qualityText(dataQuality = {}) {
  const level = {
    complete: "较完整",
    partial: "部分整理",
    needsReview: "需要复核"
  }[dataQuality.level] || "待复核";
  return `${level}，生平：${statusText(dataQuality.biography)}，作品：${statusText(dataQuality.works)}，出生地：${statusText(dataQuality.birthplace)}`;
}

function statusText(status) {
  return {
    verified: "已核对",
    partial: "部分可信",
    missing: "资料未详"
  }[status] || "资料未详";
}

function legacyAvatarText(persona) {
  if (persona.avatarLocal || persona.avatarUrl) return "已提供公开来源肖像，请继续人工复核授权。";
  return "头像来源未详，当前使用文字占位头像。";
}

function avatarFor(persona, size = "thumb") {
  if (!persona || persona.avatarIsAuthentic !== true) return "";
  if (size === "marker") return persona.avatarMarkerLocal || persona.avatarThumbLocal || persona.avatarLocal || "";
  if (size === "modal") return persona.avatarLocal || persona.avatarThumbLocal || "";
  return persona.avatarThumbLocal || persona.avatarLocal || "";
}

function avatarPendingText(persona) {
  return persona?.avatarIsAuthentic ? `${persona.displayName || persona.name || "人物"} 肖像` : "图像待核验";
}

function avatarText(persona) {
  if (persona?.avatarIsAuthentic) return "已本地化可追溯肖像，仍保留来源与授权复核信息。";
  return "图像待核验；不使用单字印章或生成头像作为最终肖像。";
}

function mergeWorkEntry(base, rich) {
  if (!base) return rich;
  if (!rich) return base;
  return {
    ...base,
    ...rich,
    workId: rich.workId || base.workId,
    id: rich.id || base.workId,
    title: rich.title || base.title,
    authorName: rich.authorName || base.author,
    author: base.author,
    sourceUrl: base.sourceUrl,
    sourceName: base.sourceName,
    availability: base.availability,
    contentPath: base.contentPath,
    oldCopyrightStatus: base.copyrightStatus
  };
}

function normalizedCopyrightStatus(work) {
  const status = work?.copyrightStatus || work?.oldCopyrightStatus;
  if (status === "public-domain") return "public_domain";
  if (status === "open-license") return "licensed_or_open";
  if (status === "protected" || status === "unknown") return "copyright_unknown_or_restricted";
  return status || "copyright_unknown_or_restricted";
}

function workDisplayMode(work) {
  if (work?.displayMode) return work.displayMode;
  const status = normalizedCopyrightStatus(work);
  if (shouldLoadEmbeddedContent(work)) return "guide_with_public_text";
  if (status === "public_domain" || status === "licensed_or_open") return "public_domain_reference";
  return "ai_guide";
}

function workStatusBadgeText(work) {
  return workDisplayMode(work) === "guide_with_public_text" ? "导读与原典" : "作品导读";
}

function workMetaText(work, persona) {
  return persona?.displayName || work?.authorName || work?.author || "作者未详";
}

function shouldLoadEmbeddedContent(work) {
  const status = normalizedCopyrightStatus(work);
  return (status === "public_domain" || status === "licensed_or_open") && work?.availability === "embedded-full-text" && work?.contentPath;
}

function shouldRenderEmbeddedContent(work, content) {
  return shouldLoadEmbeddedContent(work) && Array.isArray(content?.sections) && content.sections.length > 0;
}

function buildWorkGuideSections(work, personas = []) {
  const persona = personas.find((item) => item.id === work?.authorId) || null;
  const guideWork = normalizeWorkGuide(work, persona, personas);
  const tags = uniqueValues([...(guideWork.themes || []), ...(guideWork.tags || []), ...(guideWork.relatedTopics || [])]).slice(0, 8);
  const related = (guideWork.relatedPersonas || [])
    .map((id) => personas.find((persona) => persona.id === id)?.displayName || id)
    .filter(Boolean);
  const intro = guideWork.shortIntro;
  const background = guideWork.background;
  const guide = guideWork.readingGuide;
  const value = guideWork.whyItMatters;
  const connection = guideWork.personaConnection;
  const furtherReadingPath = guideWork.furtherReadingPath || guideWork.furtherReadingNote;
  const sections = [
    {
      id: "work-summary-section",
      heading: "作品简介",
      searchText: intro,
      render: (container) => appendParagraphs(container, [intro])
    },
    {
      id: "work-background-section",
      heading: "创作背景",
      searchText: background,
      render: (container) => appendParagraphs(container, [background])
    },
    {
      id: "work-themes-section",
      heading: "主题关键词",
      searchText: tags.join(" "),
      render: (container) => appendInlineList(container, tags.length ? tags : ["作品脉络", "人物精神", "时代经验"], "work-keyword-list")
    },
    {
      id: "work-guide-section",
      heading: "阅读入口",
      searchText: guide,
      render: (container) => appendParagraphs(container, [guide])
    },
    {
      id: "work-value-section",
      heading: "为什么重要",
      searchText: value,
      render: (container) => appendParagraphs(container, [value])
    },
    {
      id: "work-related-section",
      heading: "与作者的关系",
      searchText: [connection, related.join(" "), (guideWork.relatedTopics || []).join(" ")].join("\n"),
      render: (container) => {
        appendParagraphs(container, [connection]);
        const relatedItems = uniqueValues([...related, ...(guideWork.relatedTopics || [])]).slice(0, 8);
        appendInlineList(container, relatedItems, "work-related-list");
      }
    },
    {
      id: "work-further-reading",
      heading: "延伸路径",
      searchText: [furtherReadingPath, related.join(" "), (guideWork.relatedTopics || []).join(" ")].join("\n"),
      render: (container) => {
        appendParagraphs(container, [furtherReadingPath], "work-source-note");
      }
    }
  ];

  if (normalizedCopyrightStatus(guideWork) !== "copyright_unknown_or_restricted" && Array.isArray(guideWork.excerpts) && guideWork.excerpts.length > 0) {
    sections.splice(5, 0, {
      id: "work-excerpts-section",
      heading: "短摘录",
      searchText: guideWork.excerpts.map((excerpt) => excerpt.text).join("\n"),
      render: (container) => renderExcerpts(container, guideWork.excerpts)
    });
  }

  return sections;
}

function buildEmbeddedTextSections(content) {
  return (content?.sections || []).map((section, index) => ({
    id: `work-text-section-${index}`,
    heading: section.heading || `公版文本 ${index + 1}`,
    kind: "text",
    searchText: section.text,
    render: (container) => {
      for (const paragraph of String(section.text || "").split(/\n{2,}/).filter(Boolean)) {
        const p = document.createElement("p");
        p.textContent = paragraph.trim();
        container.appendChild(p);
      }
    }
  }));
}

function getWorkSources(work) {
  return uniqueSources([
    ...(work?.legalFullTextSources || []),
    ...(work?.catalogSources || []),
    ...(work?.references || [])
  ]);
}

function groupWorkSources(work) {
  const groups = new Map([
    ["public", { label: "公版 / 开放文本", items: [] }],
    ["library", { label: "图书馆目录", items: [] }],
    ["publisher", { label: "出版社 / 官方", items: [] }],
    ["reference", { label: "百科 / 参考资料", items: [] }]
  ]);

  for (const source of getWorkSources(work)) {
    const type = String(source.type || "").toLowerCase();
    const bucket =
      type.includes("public") || type.includes("open")
        ? "public"
        : type.includes("library") || type.includes("catalog")
          ? "library"
          : type.includes("publisher") || type.includes("official")
            ? "publisher"
            : "reference";
    groups.get(bucket)?.items.push(source);
  }

  return Array.from(groups.values()).filter((group) => group.items.length > 0);
}

function appendParagraphs(container, paragraphs, className = "") {
  for (const paragraph of paragraphs.filter(Boolean)) {
    const p = document.createElement("p");
    if (className) p.className = className;
    p.textContent = paragraph;
    container.appendChild(p);
  }
}

function appendInlineList(container, values, className) {
  const list = document.createElement("ul");
  list.className = className;
  for (const value of values) {
    const item = document.createElement("li");
    item.textContent = value;
    list.appendChild(item);
  }
  container.appendChild(list);
}

function createCardSpacer(width) {
  const spacer = document.createElement("span");
  spacer.className = "card-virtual-spacer";
  spacer.style.flex = `0 0 ${Math.max(0, Math.round(width))}px`;
  spacer.setAttribute("aria-hidden", "true");
  return spacer;
}

function normalizePresetId(value) {
  const preset = LEGACY_CATEGORY_MAP[value] || value || "全部";
  return FILTER_PRESETS[preset] ? preset : "全部";
}

function renderSourceGroups(container, groups) {
  if (!groups.length) {
    return;
  }
  for (const group of groups) {
    const block = document.createElement("div");
    block.className = "work-source-group";
    const title = document.createElement("h4");
    title.textContent = group.label;
    block.appendChild(title);
    const list = document.createElement("ul");
    for (const source of group.items) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = source.url || source.sourceUrl || "#";
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = source.name || source.sourceName || compactUrl(link.href);
      const meta = document.createElement("span");
      meta.textContent = [source.type ? sourceTypeLabel(source.type) : "资料入口", source.retrievedAt ? `检索日期：${source.retrievedAt}` : ""]
        .filter(Boolean)
        .join(" · ");
      item.append(link, meta);
      list.appendChild(item);
    }
    block.appendChild(list);
    container.appendChild(block);
  }
}

function renderExcerpts(container, excerpts) {
  for (const excerpt of excerpts) {
    const quote = document.createElement("blockquote");
    quote.className = "work-excerpt";
    quote.textContent = excerpt.text || "";
    const meta = document.createElement("cite");
    meta.textContent = excerpt.source || "作品资料";
    quote.appendChild(meta);
    container.appendChild(quote);
  }
}

function sourceTypeLabel(type) {
  const value = String(type || "").toLowerCase();
  if (value.includes("public") || value.includes("open")) return "公开文本";
  if (value.includes("library") || value.includes("catalog")) return "书目线索";
  if (value.includes("publisher") || value.includes("official")) return "出版资料";
  if (value.includes("encyclopedia") || value.includes("reference") || value.includes("metadata")) return "参考资料";
  return "资料入口";
}

function uniqueSources(sources) {
  const seen = new Set();
  return sources.filter((source) => {
    const url = source?.url || source?.sourceUrl;
    if (!url) return false;
    const key = `${source.name || source.sourceName || ""}::${url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function avatarCreditLinks(credit) {
  if (!credit?.sourceUrl) return "<span>来源未详</span>";
  const license = credit.license || "待复核";
  const review = credit.needsReview ? "，需人工复核" : "";
  return `<a href="${escapeAttribute(credit.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(credit.sourceName || compactUrl(credit.sourceUrl))}</a><span>${escapeHtml(license)}${review}</span>`;
}

function sourceLinks(references = []) {
  if (!references.length) return "<span>来源未详</span>";
  return references
    .map((url) => `<a href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">${escapeHtml(compactUrl(url))}</a>`)
    .join("");
}

function compactUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${decodeURIComponent(parsed.pathname).slice(0, 44)}`;
  } catch {
    return url;
  }
}

function setText(element, value) {
  if (element && value) element.textContent = value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
