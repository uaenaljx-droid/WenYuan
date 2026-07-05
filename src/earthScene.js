import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { gsap } from "gsap";
import { toSpherePosition, validateCoordinateSpread } from "./utils/geoLayout.js";
import { AUTO_TOUR_CONFIG } from "./config/autoTourConfig.js";
import { EARTH_MOTION_CONFIG } from "./config/earthMotionConfig.js";
import {
  DEBUG_GEO_ALIGNMENT,
  debugLandmarkPins,
  geoToSphere,
  getEarthRotationForLatLng as getProjectionRotationForLatLng,
  validateLandmarkAlignment
} from "./utils/earthProjection.js";
import { alignRotationToSpin, getFrontCenterFromRotation } from "./utils/earthOrientation.js";
import { createAvatarTextureCache } from "./utils/avatarTextureCache.js";
import { markerFacingOpacity, shouldHydrateMarkerAvatar, shouldShowMarker } from "./utils/markerVisibility.js";
import { markerLod } from "./utils/markerLod.js";
import { rebuildPickableMarkers } from "./utils/markerPool.js";

const EARTH_RADIUS = 2.46;
const SURFACE_RADIUS = EARTH_RADIUS + 0.006;
const MARKER_FLOAT_RADIUS = EARTH_RADIUS + 0.17;
const GLOW_RADIUS = MARKER_FLOAT_RADIUS;
const HIT_RADIUS = MARKER_FLOAT_RADIUS + 0.006;
const MARKER_RADIUS = MARKER_FLOAT_RADIUS;
const LABEL_RADIUS = EARTH_RADIUS + 0.255;
const CLICK_DRAG_THRESHOLD = 5;
const DRAG_CLICK_COOLDOWN = 420;
const MARKER_DEFAULT_SCALE = 0.18;
const MARKER_HOVER_SCALE = 0.27;
const MARKER_SELECTED_SCALE = 0.31;
const HALO_DEFAULT_SCALE = 0.34;
const HIT_AREA_SCALE = 0.48;

const EARTH_LIGHTING_PRESET = {
  exposure: 1.06,
  ambient: 0.12,
  sun: 3.38,
  coolFill: 0.08,
  warmFill: 0.045,
  rim: 0.1,
  nightLights: 0.28,
  clouds: 0.28
};

const ATMOSPHERE_PRESET = {
  radius: EARTH_RADIUS * 1.022,
  opacity: 0.07,
  color: "#7aaec4",
  power: 4.6,
  intensity: 0.52
};

const BACKGROUND_FIELD_PRESET = {
  starCount: 2800,
  brightStarCount: 130,
  dustCount: 1700,
  radiusMin: 38,
  radiusMax: 112
};

const MARKER_BLEND_PRESET = {
  markerIdle: 0.48,
  markerActive: 0.9,
  haloIdle: 0.018,
  haloActive: 0.09,
  surfaceIdle: 0.26,
  surfaceActive: 0.58,
  shadowIdle: 0.12,
  shadowActive: 0.18
};

const TEXTURE_URLS = {
  day: "/assets/earth/earth-day-realistic.jpg",
  clouds: "/assets/earth/earth-clouds.png",
  normal: "/assets/earth/earth-normal.jpg",
  night: "/assets/earth/earth-night-lights.jpg"
};

const CATEGORY_COLORS = {
  "文学家": "#c9c1a5",
  "诗人": "#d2c39a",
  "小说家": "#bdc8c7",
  "剧作家": "#c1b38f",
  "哲学家": "#aebfca",
  "思想家": "#b7c4b4",
  "学者": "#c4bab0"
};

export class EarthScene {
  constructor({ mount, tooltip, onSelect, onPreview, onUserControl, onUserControlStart, onUserControlEnd }) {
    this.mount = mount;
    this.tooltip = tooltip;
    this.onSelect = onSelect;
    this.onPreview = onPreview;
    this.onUserControl = onUserControl;
    this.onUserControlStart = onUserControlStart;
    this.onUserControlEnd = onUserControlEnd;
    this.personas = [];
    this.visibleIds = new Set();
    this.routeIds = new Set();
    this.nodeRecords = new Map();
    this.pickableMarkers = [];
    this.relationLines = [];
    this.landmarkRecords = new Map();
    this.selectedId = null;
    this.hoveredId = null;
    this.previewId = null;
    this.selectedPulse = null;
    this.hoverTween = null;
    this.focusTween = null;
    this.rotationTween = null;
    this.frameId = null;
    this.pointerDirty = false;
    this.pointerInside = false;
    this.pointerDown = null;
    this.lastRaycastAt = 0;
    this.lastMarkerVisibilityAt = 0;
    this.lastPickableRefreshAt = 0;
    this.visibleMarkerCount = 0;
    this.renderedNameplateCount = 0;
    this.isUserDragging = false;
    this.isAutoTouring = false;
    this.isHoverFocusing = false;
    this.isModalOpen = false;
    this.lastUserDragAt = Number.NEGATIVE_INFINITY;
    this.accent = new THREE.Color("#b9c7c4");
    this.pointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.clock = new THREE.Clock();
    this.tempVector = new THREE.Vector3();
    this.cameraTarget = new THREE.Vector3();
    this.cameraNormal = new THREE.Vector3();
    this.cameraDestination = new THREE.Vector3();
    this.cameraWorld = new THREE.Vector3();
    this.earthWorld = new THREE.Vector3();
    this.markerWorld = new THREE.Vector3();
    this.normalWorld = new THREE.Vector3();
    this.toCamera = new THREE.Vector3();
    this.cameraRight = new THREE.Vector3();
    this.cameraUp = new THREE.Vector3();
    this.targetNormal = new THREE.Vector3();
    this.baseNormal = new THREE.Vector3();
    this.targetQuaternion = new THREE.Quaternion();
    this.targetEuler = new THREE.Euler();
    this.sunDirection = new THREE.Vector3(-4.2, 2.35, 3.7).normalize();
    this.haloTexture = createGlowTexture();
    this.hitTexture = createHitTexture();
    this.fallbackAvatarTextureCache = new Map();
    this.avatarTextureCache = createAvatarTextureCache({
      load: loadAvatarImage,
      create: createAvatarMarkerTexture,
      fallback: (persona) => this.getFallbackAvatarTexture(persona),
      dispose: (texture) => texture.dispose()
    });
    this.surfaceDotGeometry = new THREE.SphereGeometry(0.017, 12, 12);
    this.surfaceShadowGeometry = new THREE.CircleGeometry(0.054, 28);
    this.atmosphereMeshes = [];

    this.setupScene();
    this.setupEvents();
    this.animate();
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x02070a, 0.021);

    const width = this.mount.clientWidth || window.innerWidth;
    const height = this.mount.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(37, width / height, 0.1, 140);
    this.camera.position.set(0.08, 0.86, 7.25);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(pixelRatioCap());
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = EARTH_LIGHTING_PRESET.exposure;
    this.renderer.setClearColor(0x020406, 0);
    this.mount.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(width, height);
    this.labelRenderer.domElement.className = "scene-label-layer";
    this.labelRenderer.domElement.style.position = "absolute";
    this.labelRenderer.domElement.style.inset = "0";
    this.labelRenderer.domElement.style.pointerEvents = "none";
    this.mount.appendChild(this.labelRenderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.058;
    this.controls.rotateSpeed = 0.56;
    this.controls.zoomSpeed = 0.62;
    this.controls.minDistance = 4.2;
    this.controls.maxDistance = 11.5;
    this.controls.target.set(0.44, 0, 0);
    this.controls.addEventListener("start", () => this.handleControlStart());
    this.controls.addEventListener("end", () => this.handleControlEnd());

    this.earthGroup = new THREE.Group();
    this.earthGroup.position.x = 0.46;
    this.scene.add(this.earthGroup);

    this.nodeGroup = new THREE.Group();
    this.labelGroup = new THREE.Group();
    this.relationGroup = new THREE.Group();
    this.earthGroup.add(this.relationGroup, this.nodeGroup, this.labelGroup);

    this.scene.add(new THREE.AmbientLight(0x6f8f94, EARTH_LIGHTING_PRESET.ambient));

    const sun = new THREE.DirectionalLight(0xfff1d0, EARTH_LIGHTING_PRESET.sun);
    sun.position.copy(this.sunDirection.clone().multiplyScalar(7.5));
    this.scene.add(sun);

    const hemi = new THREE.HemisphereLight(0x9fc8d8, 0x06100d, EARTH_LIGHTING_PRESET.coolFill);
    this.scene.add(hemi);

    const warmFill = new THREE.DirectionalLight(0xb6843f, EARTH_LIGHTING_PRESET.warmFill);
    warmFill.position.set(0.8, -2.4, 5.2);
    this.scene.add(warmFill);

    const rim = new THREE.DirectionalLight(0x7fb6c2, EARTH_LIGHTING_PRESET.rim);
    rim.position.set(-5, 2, -3);
    this.scene.add(rim);

    this.createSpaceBackdrop();
    this.createEarth();
    this.createDebugLandmarks();
    this.resize();
  }

  createDebugLandmarks() {
    if (this.debugLandmarkGroup) return;
    this.debugLandmarkGroup = new THREE.Group();
    this.debugLandmarkGroup.visible = Boolean(DEBUG_GEO_ALIGNMENT);
    const material = new THREE.MeshBasicMaterial({ color: "#ffdf8a", transparent: true, opacity: 0.82 });
    for (const landmark of debugLandmarkPins(SURFACE_RADIUS + 0.01)) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 10), material.clone());
      dot.position.copy(landmark.position);
      dot.userData.landmark = landmark.name;
      const label = new CSS2DObject(createLandmarkLabelElement(landmark.name));
      label.position.copy(landmark.position.clone().normalize().multiplyScalar(LABEL_RADIUS + 0.025));
      this.debugLandmarkGroup.add(dot);
      this.labelGroup.add(label);
      label.element.style.opacity = this.debugLandmarkGroup.visible ? "1" : "0";
      this.landmarkRecords.set(landmark.name, { ...landmark, dot, label });
    }
    this.earthGroup.add(this.debugLandmarkGroup);
  }

  showLandmarkPins(enabled = true) {
    this.createDebugLandmarks();
    const visible = Boolean(enabled);
    this.debugLandmarkGroup.visible = visible;
    for (const record of this.landmarkRecords.values()) {
      record.label.element.style.opacity = visible ? "1" : "0";
    }
    return {
      visible,
      count: this.landmarkRecords.size,
      landmarks: Array.from(this.landmarkRecords.keys())
    };
  }

  focusLandmark(name, { duration = 1.05 } = {}) {
    this.createDebugLandmarks();
    const record = this.landmarkRecords.get(name);
    if (!record) return null;
    this.showLandmarkPins(true);
    this.rotationTween?.kill();
    const targetRotation = this.getEarthRotationForLatLng(record.lat, record.lng, {
      screenOffsetX: -0.08,
      screenOffsetY: -0.18
    });
    if (!targetRotation) return null;
    this.rotationTween = gsap.to(this.earthGroup.rotation, {
      x: targetRotation.x,
      y: targetRotation.y,
      z: targetRotation.z,
      duration,
      ease: "sine.inOut",
      overwrite: true
    });
    return {
      name: record.name,
      lat: record.lat,
      lng: record.lng,
      targetRotation
    };
  }

  createEarth() {
    const earthGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 128, 128);
    const fallbackSurfaceMap = createProceduralEarthTexture();
    const earthMaterial = new THREE.MeshStandardMaterial({
      map: fallbackSurfaceMap,
      emissiveMap: fallbackSurfaceMap,
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: 0.065,
      roughness: 0.86,
      metalness: 0,
      color: new THREE.Color("#fff3df")
    });
    applyLegacyEarthSurfaceGrade(earthMaterial);

    this.earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    this.earthGroup.add(this.earthMesh);

    this.loadTexture(TEXTURE_URLS.day).then((texture) => {
      if (!texture) return;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      earthMaterial.map?.dispose();
      earthMaterial.map = texture;
      earthMaterial.emissiveMap = texture;
      earthMaterial.needsUpdate = true;
    });

    this.loadTexture(TEXTURE_URLS.normal, { colorSpace: THREE.NoColorSpace }).then((texture) => {
      if (!texture) return;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      earthMaterial.normalMap?.dispose();
      earthMaterial.normalMap = texture;
      earthMaterial.normalScale = new THREE.Vector2(0.036, 0.036);
      earthMaterial.needsUpdate = true;
    });

    this.nightLightsMesh = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS * 1.004, 128, 128),
      createNightLightsMaterial(createProceduralNightTexture(), this.sunDirection, EARTH_LIGHTING_PRESET.nightLights)
    );
    this.nightLightsMesh.renderOrder = 1;
    this.earthGroup.add(this.nightLightsMesh);
    this.loadTexture(TEXTURE_URLS.night).then((texture) => {
      if (!texture) return;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      this.nightLightsMesh.material.uniforms.map.value?.dispose();
      this.nightLightsMesh.material.uniforms.map.value = texture;
    });

    this.cloudMesh = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS * 1.009, 128, 128),
      new THREE.MeshLambertMaterial({
        map: createProceduralCloudTexture(),
        color: new THREE.Color("#d8d8ce"),
        transparent: true,
        opacity: EARTH_LIGHTING_PRESET.clouds,
        depthWrite: false,
        alphaTest: 0.025
      })
    );
    this.cloudMesh.renderOrder = 2;
    this.earthGroup.add(this.cloudMesh);
    this.loadTexture(TEXTURE_URLS.clouds).then((texture) => {
      if (!texture) return;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      this.cloudMesh.material.map?.dispose();
      this.cloudMesh.material.map = texture;
      this.cloudMesh.material.needsUpdate = true;
    });

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(ATMOSPHERE_PRESET.radius, 96, 96),
      createAtmosphereMaterial({
        color: ATMOSPHERE_PRESET.color,
        opacity: ATMOSPHERE_PRESET.opacity,
        power: ATMOSPHERE_PRESET.power,
        sunDirection: this.sunDirection,
        intensity: ATMOSPHERE_PRESET.intensity
      })
    );
    atmosphere.renderOrder = 3;
    this.atmosphereMeshes = [atmosphere];
    this.earthGroup.add(atmosphere);
  }

  async loadTexture(url, { colorSpace = THREE.SRGBColorSpace } = {}) {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (texture) => {
          texture.colorSpace = colorSpace;
          texture.anisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy(), 8);
          resolve(texture);
        },
        undefined,
        reject
      );
    }).catch(() => null);
  }

  createSpaceBackdrop() {
    const { starCount, brightStarCount, dustCount, radiusMin, radiusMax } = BACKGROUND_FIELD_PRESET;
    this.nebulaVeils = new THREE.Group();
    const nebulaConfigs = [
      { x: -18, y: 9, z: -48, scale: 34, opacity: 0.32, hue: "blue" },
      { x: 21, y: -8, z: -58, scale: 42, opacity: 0.22, hue: "violet" },
      { x: 8, y: 15, z: -64, scale: 28, opacity: 0.16, hue: "warm" }
    ];
    for (const config of nebulaConfigs) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: createNebulaTexture(config.hue),
          transparent: true,
          opacity: config.opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: true
        })
      );
      sprite.position.set(config.x, config.y, config.z);
      sprite.scale.set(config.scale, config.scale * 0.62, 1);
      sprite.rotation.z = hashScalar(config.hue) * Math.PI;
      this.nebulaVeils.add(sprite);
    }
    this.scene.add(this.nebulaVeils);

    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const color = new THREE.Color();

    for (let index = 0; index < starCount; index += 1) {
      const radius = radiusMin + Math.random() * (radiusMax - radiusMin);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[index * 3 + 1] = radius * Math.cos(phi);
      positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      const warm = Math.random() > 0.86;
      color.setHSL(warm ? 0.1 + Math.random() * 0.05 : 0.55 + Math.random() * 0.09, warm ? 0.34 : 0.12 + Math.random() * 0.18, 0.44 + Math.random() * 0.42);
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: 0.038,
      vertexColors: true,
      transparent: true,
      opacity: 0.2,
      depthWrite: false
    });

    this.stars = new THREE.Points(geometry, material);
    this.scene.add(this.stars);

    const brightPositions = new Float32Array(brightStarCount * 3);
    const brightColors = new Float32Array(brightStarCount * 3);
    for (let index = 0; index < brightStarCount; index += 1) {
      const radius = radiusMin + Math.random() * (radiusMax - radiusMin);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      brightPositions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      brightPositions[index * 3 + 1] = radius * Math.cos(phi);
      brightPositions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      color.setHSL(Math.random() > 0.7 ? 0.1 : 0.57, 0.18 + Math.random() * 0.2, 0.72 + Math.random() * 0.2);
      brightColors[index * 3] = color.r;
      brightColors[index * 3 + 1] = color.g;
      brightColors[index * 3 + 2] = color.b;
    }
    const brightGeometry = new THREE.BufferGeometry();
    brightGeometry.setAttribute("position", new THREE.BufferAttribute(brightPositions, 3));
    brightGeometry.setAttribute("color", new THREE.BufferAttribute(brightColors, 3));
    this.brightStars = new THREE.Points(
      brightGeometry,
      new THREE.PointsMaterial({
        size: 0.095,
        vertexColors: true,
        transparent: true,
        opacity: 0.24,
        depthWrite: false
      })
    );
    this.scene.add(this.brightStars);

    const dustPositions = new Float32Array(dustCount * 3);
    const dustColors = new Float32Array(dustCount * 3);
    for (let index = 0; index < dustCount; index += 1) {
      const radius = 54 + Math.random() * 42;
      const band = (Math.random() - 0.5) * 0.54;
      const theta = -0.65 + Math.random() * 2.7;
      dustPositions[index * 3] = Math.cos(theta) * radius;
      dustPositions[index * 3 + 1] = band * radius + 8 * Math.sin(theta * 0.9);
      dustPositions[index * 3 + 2] = Math.sin(theta) * radius - 18;
      const bandHue = index % 5 === 0 ? 0.72 : index % 7 === 0 ? 0.08 : 0.56;
      color.setHSL(bandHue + Math.random() * 0.04, 0.18 + Math.random() * 0.16, 0.32 + Math.random() * 0.22);
      dustColors[index * 3] = color.r;
      dustColors[index * 3 + 1] = color.g;
      dustColors[index * 3 + 2] = color.b;
    }

    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    dustGeometry.setAttribute("color", new THREE.BufferAttribute(dustColors, 3));
    const dustMaterial = new THREE.PointsMaterial({
      size: 0.16,
      vertexColors: true,
      transparent: true,
      opacity: 0.045,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.nebulaDust = new THREE.Points(dustGeometry, dustMaterial);
    this.nebulaDust.rotation.z = -0.22;
    this.scene.add(this.nebulaDust);
  }

  setPersonas(personas) {
    this.personas = personas;
    this.visibleIds = new Set(personas.map((persona) => persona.id));
    this.clearNodes();

    for (const persona of personas) {
      this.createNode(persona);
    }

    this.pickableMarkers = Array.from(this.nodeRecords.values()).flatMap((record) => [
      record.hitArea,
      record.surfaceDot,
      record.marker
    ]);
    this.debugCoordinateLayout();
    this.validateMarkerBindings();
  }

  createNode(persona) {
    const group = new THREE.Group();
    const normal = latLngToVector3(persona.visualLat, persona.visualLng, 1).normalize();
    const surfacePosition = normal.clone().multiplyScalar(SURFACE_RADIUS);
    const glowOffset = normal.clone().multiplyScalar(GLOW_RADIUS - SURFACE_RADIUS);
    const hitOffset = normal.clone().multiplyScalar(HIT_RADIUS - SURFACE_RADIUS);
    group.position.copy(surfacePosition);

    const color = new THREE.Color(CATEGORY_COLORS[persona.category] || "#b9c7c4");
    const surfaceShadow = new THREE.Mesh(
      this.surfaceShadowGeometry,
      new THREE.MeshBasicMaterial({
        color: "#050504",
        transparent: true,
        opacity: MARKER_BLEND_PRESET.shadowIdle,
        depthWrite: false,
        depthTest: true
      })
    );
    surfaceShadow.position.copy(normal.clone().multiplyScalar(0.002));
    surfaceShadow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

    const surfaceDot = new THREE.Mesh(
      this.surfaceDotGeometry,
      new THREE.MeshBasicMaterial({
        color: "#d8c28a",
        transparent: true,
        opacity: MARKER_BLEND_PRESET.surfaceIdle,
        depthWrite: false
      })
    );
    this.bindMarkerEvents(surfaceDot, persona, "persona-surface");

    const fallbackTexture = this.getFallbackAvatarTexture(persona);
    const marker = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: fallbackTexture,
        color: "#ffffff",
        transparent: true,
        opacity: 0.56,
        blending: THREE.NormalBlending,
        depthWrite: false
      })
    );
    marker.position.copy(glowOffset);
    marker.scale.setScalar(MARKER_DEFAULT_SCALE + persona.importance * 0.018);
    this.bindMarkerEvents(marker, persona, "persona-marker");

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.haloTexture,
        color,
        transparent: true,
        opacity: 0.026,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    halo.position.copy(glowOffset);
    halo.scale.setScalar(HALO_DEFAULT_SCALE + persona.importance * 0.08);
    halo.userData.phase = hashScalar(persona.id) * Math.PI * 2;
    this.bindMarkerEvents(halo, persona, "persona-halo");

    const stemLine = createStemLine(normal, color, GLOW_RADIUS - SURFACE_RADIUS);
    this.bindMarkerEvents(stemLine, persona, "persona-stem");

    const hitArea = this.createMarkerHitArea(marker, persona, hitOffset);
    const avatarLabel = new CSS2DObject(createAvatarMarkerElement(persona));
    avatarLabel.position.copy(latLngToVector3(persona.visualLat, persona.visualLng, MARKER_FLOAT_RADIUS));
    avatarLabel.element.style.opacity = "0";
    avatarLabel.userData.kind = "persona-avatar-marker";
    avatarLabel.userData.personaId = persona.id;
    avatarLabel.userData.persona = persona;
    this.bindNameplateEvents(avatarLabel.element, persona);

    const label = new CSS2DObject(createLabelElement(persona));
    label.position.copy(latLngToVector3(persona.visualLat, persona.visualLng, LABEL_RADIUS));
    label.element.style.opacity = "0";
    label.userData.kind = "persona-nameplate";
    label.userData.personaId = persona.id;
    label.userData.persona = persona;
    this.bindNameplateEvents(label.element, persona);

    const guideLine = createGuideLine(persona, color);

    group.add(surfaceShadow, surfaceDot, stemLine, halo, marker, hitArea);
    this.nodeGroup.add(group);
    this.labelGroup.add(guideLine);
    this.labelGroup.add(avatarLabel);
    this.labelGroup.add(label);
    this.nodeRecords.set(persona.id, {
      group,
      surfaceShadow,
      surfaceDot,
      stemLine,
      marker,
      avatarLabel,
      halo,
      hitArea,
      label,
      guideLine,
      persona,
      normal,
      baseScale: marker.scale.x,
      baseHaloScale: halo.scale.x,
      color,
      avatarTextureRequested: false,
      markerLod: "hidden"
    });
  }

  bindMarkerEvents(object, persona, kind = "persona-marker") {
    object.userData.kind = kind;
    object.userData.personaId = persona.id;
    object.userData.persona = persona;
  }

  bindNameplateEvents(element, persona) {
    element.dataset.personaId = persona.id;
    element.style.pointerEvents = "auto";
    let pointerDown = null;
    element.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      pointerDown = { x: event.clientX, y: event.clientY };
    });
    element.addEventListener("pointerup", (event) => {
      event.stopPropagation();
      if (!pointerDown) return;
      const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
      pointerDown = null;
      if (moved > CLICK_DRAG_THRESHOLD) return;
      this.clearInteractionTweens("nameplate-click");
      this.selectPersona(persona.id, { focus: true, emit: true, duration: 0.75, reason: "nameplate-click" });
    });
    element.addEventListener("pointerenter", (event) => {
      event.stopPropagation();
      if (this.isUserDragging || this.isModalOpen) return;
      const record = this.nodeRecords.get(persona.id);
      if (record) this.setHovered(record);
    });
  }

  createMarkerHitArea(marker, persona, offset) {
    const hitArea = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.hitTexture,
        color: 0xffffff,
        transparent: true,
        opacity: 0.006,
        depthWrite: false,
        depthTest: false
      })
    );
    hitArea.position.copy(offset);
    hitArea.scale.setScalar(HIT_AREA_SCALE);
    this.bindMarkerEvents(hitArea, persona, "persona-hit");
    return hitArea;
  }

  getFallbackAvatarTexture(persona) {
    const key = `pending:${persona.id || persona.displayName || "unknown"}`;
    if (!this.fallbackAvatarTextureCache.has(key)) {
      this.fallbackAvatarTextureCache.set(key, createAvatarMarkerTexture(persona));
    }
    return this.fallbackAvatarTextureCache.get(key);
  }

  getAvatarTexture(persona) {
    const url = avatarFor(persona, "marker");
    if (!url || !isCanvasSafeAvatarSource(url)) return Promise.resolve(this.getFallbackAvatarTexture(persona));
    return this.avatarTextureCache.get(url, persona);
  }

  requestRecordAvatarTexture(record) {
    if (!record || record.avatarTextureRequested) return;
    record.avatarTextureRequested = true;
    this.getAvatarTexture(record.persona).then((texture) => {
      const latest = this.nodeRecords.get(record.persona.id);
      if (!latest || latest.marker !== record.marker || record.marker.material.map === texture) return;
      record.marker.material.map = texture;
      record.marker.material.needsUpdate = true;
    });
  }

  preloadAvatarTextures(ids = []) {
    for (const id of ids) {
      const record = this.nodeRecords.get(id);
      this.requestRecordAvatarTexture(record);
      hydrateLazyImages(record?.avatarLabel?.element);
    }
  }

  setVisibleIds(ids) {
    this.visibleIds = new Set(ids);
    for (const [id, record] of this.nodeRecords) {
      const visible = this.visibleIds.has(id);
      record.group.visible = visible;
      record.avatarLabel.visible = visible;
      record.label.visible = visible;
      record.guideLine.visible = visible;
    }
    this.pickableMarkers = rebuildPickableMarkers(this.nodeRecords.values(), this.visibleIds);
  }

  setRouteIds(ids = []) {
    this.routeIds = new Set(ids);
    for (const [id, record] of this.nodeRecords) {
      const onRoute = this.routeIds.size === 0 || this.routeIds.has(id);
      record.marker.material.opacity = onRoute ? 0.74 : 0.24;
      record.halo.material.opacity = onRoute ? 0.1 : 0.026;
      record.avatarLabel.element.classList.toggle("is-route", onRoute);
      record.label.element.classList.toggle("is-route", onRoute);
    }
  }

  selectPersona(id, { focus = true, emit = false, duration = 1.08, reason = "select" } = {}) {
    const record = this.nodeRecords.get(id);
    if (!record) return;

    this.clearPreview();
    this.clearSelection(false);
    this.selectedId = id;
    record.marker.material.color.set("#ffffff");
    record.surfaceDot.material.color.set("#f4f1df");
    record.halo.material.opacity = 0.24;
    record.stemLine.material.opacity = 0.5;
    this.setLabelState(record, 0.98, true);
    this.selectedPulse = gsap.to(record.halo.scale, {
      x: Math.max(record.baseHaloScale * 1.34, 0.42),
      y: Math.max(record.baseHaloScale * 1.34, 0.42),
      z: Math.max(record.baseHaloScale * 1.34, 0.42),
      duration: 1.6,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true
    });

    gsap.to(record.marker.scale, {
      x: Math.max(record.baseScale * 1.34, MARKER_SELECTED_SCALE),
      y: Math.max(record.baseScale * 1.34, MARKER_SELECTED_SCALE),
      z: Math.max(record.baseScale * 1.34, MARKER_SELECTED_SCALE),
      duration: 0.28,
      ease: "power2.out"
    });

    if (focus) {
      if (
        reason.includes("auto") ||
        reason.includes("filter") ||
        reason.includes("search") ||
        reason.includes("default-earth-page") ||
        reason.includes("home-enter") ||
        reason.includes("drag-end")
      ) {
        this.focusGlobeOnPersona(id, {
          duration,
          reason,
          preferSpinDirection: true,
          spinDirection: EARTH_MOTION_CONFIG.spinDirection,
          screenOffsetX: window.innerWidth <= 760 ? 0 : 0.04,
          screenOffsetY: window.innerWidth <= 760 ? 0.04 : 0.035,
          faceCamera: true
        });
      } else {
        this.focusPersonaCamera(id, { mode: "select", rotateGlobe: true, duration, reason });
      }
    }
    if (emit) this.onSelect?.(record.persona);
  }

  focusPersona(id) {
    this.focusPersonaCamera(id, { mode: "select", rotateGlobe: true });
  }

  focusPersonaOnHover(personaOrId, { duration = 1.05, reason = "hover" } = {}) {
    const id = typeof personaOrId === "string" ? personaOrId : personaOrId?.id;
    if (this.isUserDragging || this.isModalOpen) return;
    if (performance.now() - this.lastUserDragAt < 1500) return;
    if (!this.nodeRecords.has(id)) return;
    this.tooltip?.classList.remove("is-visible");
    this.setHovered(null);
    this.clearSelection();
    this.previewId = id;
    this.isHoverFocusing = true;
    this.focusGlobeOnPersona(id, {
      duration,
      reason,
      preferSpinDirection: true,
      spinDirection: EARTH_MOTION_CONFIG.spinDirection,
      screenOffsetX: window.innerWidth <= 760 ? 0 : 0.04,
      screenOffsetY: window.innerWidth <= 760 ? 0.04 : 0.035,
      faceCamera: true
    });
    this.highlightPersonaMarker(id, { preview: true });
  }

  focusGlobeOnPersona(personaOrId, options = {}) {
    const id = typeof personaOrId === "string" ? personaOrId : personaOrId?.id;
    const record = this.nodeRecords.get(id);
    if (!record) return null;
    if (this.isUserDragging || this.isModalOpen) return null;
    if (performance.now() - this.lastUserDragAt < 1500) return null;

    const focus = this.getPersonaFocusLatLng(record.persona);
    if (!focus) {
      if (import.meta.env?.DEV) console.warn("[focusGlobeOnPersona] missing coordinates", id);
      return null;
    }

    this.rotationTween?.kill();
    this.hoverTween?.kill();
    const targetRotation = this.getEarthRotationForFocus(focus.lat, focus.lng, options);
    if (!targetRotation) return null;

    this.rotationTween = this.animateEarthRotation(targetRotation, {
      personaId: id,
      duration: options.duration ?? 1.05,
      reason: options.reason || "focus",
      ease: options.ease || "sine.inOut"
    });
    return targetRotation;
  }

  getPersonaFocusLatLng(persona) {
    const lat = Number.isFinite(persona.visualLat) ? persona.visualLat : persona.birthLat;
    const lng = Number.isFinite(persona.visualLng) ? persona.visualLng : persona.birthLng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }

  getEarthRotationForFocus(
    lat,
    lng,
    {
      screenOffsetX = 0,
      screenOffsetY = 0.035,
      preferSpinDirection = false,
      spinDirection = EARTH_MOTION_CONFIG.spinDirection,
      maxExtraRotationDeg = EARTH_MOTION_CONFIG.maxExtraRotationDeg
    } = {}
  ) {
    const targetRotation = this.getEarthRotationForLatLng(lat, lng, {
      screenOffsetX,
      screenOffsetY
    });
    if (!targetRotation) return null;
    return preferSpinDirection
      ? alignRotationToSpin(this.earthGroup.rotation, targetRotation, { spinDirection, maxExtraRotationDeg })
      : targetRotation;
  }

  animateEarthRotation(targetRotation, { personaId, duration = 1.05, reason = "focus", ease = "sine.inOut" } = {}) {
    return gsap.to(this.earthGroup.rotation, {
      x: targetRotation.x,
      y: targetRotation.y,
      z: targetRotation.z,
      duration: Math.max(0, Math.min(duration, 1.75)),
      ease,
      overwrite: true,
      onStart: () => {
        this.isHoverFocusing = reason.includes("hover") || reason.includes("search") || reason.includes("route") || reason.includes("auto");
      },
      onUpdate: () => {
        this.updateMarkerVisibility();
      },
      onComplete: () => {
        this.isHoverFocusing = false;
        if (personaId) this.verifyPersonaCentered(personaId);
      }
    });
  }

  focusPersonaCamera(personaOrId, { mode = "select", rotateGlobe = false, duration = 1.35, reason = "focus" } = {}) {
    const id = typeof personaOrId === "string" ? personaOrId : personaOrId?.id;
    const record = this.nodeRecords.get(id);
    if (!record) return;

    const resolveFocusVectors = () => {
      record.group.getWorldPosition(this.tempVector);
      const target = this.cameraTarget.copy(this.tempVector);
      const normal = this.cameraNormal.copy(target).sub(this.earthGroup.position).normalize();
      const destination = this.cameraDestination.copy(target).add(normal.multiplyScalar(mode === "hover" ? 3.9 : 3.25));
      if (window.innerWidth > 760) destination.x += mode === "hover" ? 0.14 : 0.36;
      destination.y += mode === "hover" ? 0.1 : 0.18;
      return {
        target: target.clone(),
        destination: destination.clone()
      };
    };

    let { target, destination } = resolveFocusVectors();

    if (rotateGlobe) this.rotateGlobeToPersona(id, { duration, reason });
    if (duration <= 0) {
      this.focusTween?.kill();
      if (rotateGlobe) {
        this.earthGroup.updateMatrixWorld(true);
        record.group.updateMatrixWorld(true);
        ({ target, destination } = resolveFocusVectors());
      }
      this.camera.position.copy(destination);
      this.controls.target.copy(target);
      this.controls.update();
      return;
    }
    this.focusTween?.kill();
    this.focusTween = gsap.timeline({ defaults: { ease: "power3.inOut" } });
    this.focusTween.to(
      this.camera.position,
      {
        x: destination.x,
        y: destination.y,
        z: destination.z,
        duration: mode === "hover" ? Math.min(duration, 1.05) : Math.max(0.75, Math.min(duration, 1.35))
      },
      0
    );
    this.focusTween.to(
      this.controls.target,
      {
        x: target.x,
        y: target.y,
        z: target.z,
        duration: mode === "hover" ? Math.min(duration, 1.05) : Math.max(0.75, Math.min(duration, 1.35)),
        onUpdate: () => this.controls.update()
      },
      0
    );
  }

  rotateGlobeToPersona(personaOrId, { duration = 1.05, reason = "focus", screenOffsetX = -0.08, screenOffsetY = -0.2 } = {}) {
    const id = typeof personaOrId === "string" ? personaOrId : personaOrId?.id;
    const record = this.nodeRecords.get(id);
    if (!record) return;
    this.rotationTween?.kill();
    const targetRotation = this.getEarthRotationForFocus(record.persona.visualLat, record.persona.visualLng, {
      screenOffsetX,
      screenOffsetY
    });
    if (!targetRotation) return;
    if (duration <= 0) {
      this.earthGroup.rotation.set(targetRotation.x, targetRotation.y, targetRotation.z);
      this.updateMarkerVisibility();
      return;
    }
    this.rotationTween = gsap.to(this.earthGroup.rotation, {
      x: targetRotation.x,
      y: targetRotation.y,
      z: targetRotation.z,
      duration,
      ease: "sine.inOut",
      overwrite: true,
      onStart: () => {
        this.isHoverFocusing = reason.includes("hover") || reason.includes("route") || reason.includes("auto");
      },
      onComplete: () => {
        this.isHoverFocusing = false;
      }
    });
  }

  getEarthRotationForLatLng(lat, lng, { screenOffsetX = -0.08, screenOffsetY = -0.2 } = {}) {
    return getProjectionRotationForLatLng(lat, lng, {
      currentRotation: this.earthGroup.rotation,
      screenOffsetX,
      screenOffsetY
    });
  }

  getFrontCenterLatLng() {
    return getFrontCenterFromRotation(this.earthGroup.rotation);
  }

  findNearestFrontPersona(ids = [], { currentPersonaId = "" } = {}) {
    const allowedIds = new Set(ids);
    this.camera.getWorldPosition(this.cameraWorld);
    this.earthGroup.getWorldPosition(this.earthWorld);
    this.toCamera.copy(this.cameraWorld).sub(this.earthWorld).normalize();
    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const [id, record] of this.nodeRecords) {
      if (allowedIds.size && !allowedIds.has(id)) continue;
      if (!record.group.visible) continue;
      record.group.getWorldPosition(this.markerWorld);
      this.normalWorld.copy(this.markerWorld).sub(this.earthWorld).normalize();
      const facing = this.normalWorld.dot(this.toCamera);
      if (facing < 0.08) continue;
      const screen = this.projectPersonaMarkerToScreen(id);
      const screenDistance = screen ? Math.hypot(screen.normalizedX, screen.normalizedY) : 1.5;
      const currentPenalty = id === currentPersonaId ? 0.08 : 0;
      const score = (1 - facing) * 1.6 + screenDistance + currentPenalty;
      if (score < bestScore) {
        bestScore = score;
        best = record.persona;
      }
    }

    return best;
  }

  projectPersonaMarkerToScreen(personaOrId) {
    const id = typeof personaOrId === "string" ? personaOrId : personaOrId?.id;
    const record = this.nodeRecords.get(id);
    if (!record) return null;
    this.camera.updateMatrixWorld();
    this.earthGroup.updateMatrixWorld(true);
    record.avatarLabel.getWorldPosition(this.markerWorld);
    const projected = this.markerWorld.clone().project(this.camera);
    const width = this.mount.clientWidth || window.innerWidth;
    const height = this.mount.clientHeight || window.innerHeight;
    return {
      x: (projected.x * 0.5 + 0.5) * width,
      y: (-projected.y * 0.5 + 0.5) * height,
      normalizedX: projected.x,
      normalizedY: projected.y,
      width,
      height
    };
  }

  verifyPersonaCentered(personaOrId) {
    const id = typeof personaOrId === "string" ? personaOrId : personaOrId?.id;
    const screen = this.projectPersonaMarkerToScreen(id);
    if (!screen) return null;
    const dx = Math.abs(screen.normalizedX);
    const dy = Math.abs(screen.normalizedY);
    if (import.meta.env?.DEV && (dx > 0.18 || dy > 0.22)) {
      const record = this.nodeRecords.get(id);
      console.warn("[persona-atlas] focus marker off center", {
        personaId: id,
        lat: record?.persona.visualLat,
        lng: record?.persona.visualLng,
        screenX: Math.round(screen.x),
        screenY: Math.round(screen.y),
        normalizedX: Math.round(screen.normalizedX * 1000) / 1000,
        normalizedY: Math.round(screen.normalizedY * 1000) / 1000
      });
    }
    return screen;
  }

  highlightPersonaMarker(personaOrId, { preview = false } = {}) {
    const id = typeof personaOrId === "string" ? personaOrId : personaOrId?.id;
    const record = this.nodeRecords.get(id);
    if (!record) return;

    if (preview) this.clearPreview(id);
    const targetScale = preview ? Math.max(record.baseScale * 1.44, MARKER_HOVER_SCALE) : record.baseScale * 1.2;
    gsap.killTweensOf(record.marker.scale);
    gsap.to(record.marker.scale, {
      x: targetScale,
      y: targetScale,
      z: targetScale,
      duration: preview ? 0.24 : 0.18,
      ease: "power2.out"
    });
    record.halo.material.opacity = preview ? 0.18 : record.halo.material.opacity;
    record.surfaceDot.material.opacity = preview ? 0.92 : record.surfaceDot.material.opacity;
    record.stemLine.material.opacity = preview ? 0.5 : record.stemLine.material.opacity;
    this.setLabelState(record, preview ? 1 : 0.78, preview);
  }

  clearSelection(resetId = true) {
    if (this.selectedPulse) {
      this.selectedPulse.kill();
      this.selectedPulse = null;
    }

    if (this.selectedId) {
      const record = this.nodeRecords.get(this.selectedId);
      if (record) {
        record.marker.material.color.set("#ffffff");
        record.surfaceDot.material.color.set("#eadfbf");
        record.marker.scale.setScalar(record.baseScale);
        record.halo.scale.setScalar(record.baseHaloScale);
        record.halo.material.opacity = this.routeIds.size === 0 || this.routeIds.has(record.persona.id) ? 0.1 : 0.026;
        record.stemLine.material.opacity = 0;
        this.setLabelState(record, 0, false);
      }
    }

    if (resetId) this.selectedId = null;
  }

  clearPreview(exceptId = null) {
    if (this.previewId && this.previewId !== this.selectedId && this.previewId !== exceptId) {
      const previous = this.nodeRecords.get(this.previewId);
      if (previous) {
        gsap.killTweensOf(previous.marker.scale);
        gsap.to(previous.marker.scale, {
          x: previous.baseScale,
          y: previous.baseScale,
          z: previous.baseScale,
          duration: 0.18,
          ease: "power2.out"
        });
        previous.halo.material.opacity = this.routeIds.size === 0 || this.routeIds.has(previous.persona.id) ? 0.1 : 0.026;
        previous.surfaceDot.material.opacity = 0.72;
        previous.stemLine.material.opacity = 0;
        this.setLabelState(previous, 0, false);
      }
    }
    if (exceptId === null || this.previewId !== exceptId) this.previewId = exceptId;
  }

  clearHoverPreview() {
    this.isHoverFocusing = false;
    this.rotationTween?.kill();
    this.clearPreview();
    this.setHovered(null);
  }

  clearInteractionTweens(reason = "interaction") {
    this.hoverTween?.kill();
    this.focusTween?.kill();
    this.rotationTween?.kill();
    this.isHoverFocusing = false;
    if (reason !== "keep-selection") this.clearPreview();
  }

  setLabelState(record, opacity = 0, highlighted = false) {
    if (!record?.label?.element) return;
    const visible = opacity > 0.02;
    if (visible) hydrateLazyImages(record.label.element);
    record.label.element.style.opacity = visible ? String(opacity) : "0";
    record.label.element.classList.toggle("is-visible", visible);
    record.label.element.classList.toggle("is-highlighted", highlighted || record.persona.id === this.selectedId);
    record.guideLine.material.opacity = visible ? Math.min(0.42, opacity * 0.42) : 0;
    record.stemLine.material.opacity = visible ? Math.max(record.stemLine.material.opacity, Math.min(0.52, opacity * 0.54)) : record.stemLine.material.opacity;
  }

  validateMarkerBindings() {
    const personaIds = new Set(this.personas.map((persona) => persona.id));
    const markerIds = [];
    const missingPersonaId = [];
    const missingPersona = [];
    const duplicatePersonaId = [];
    const seen = new Set();

    for (const [id, record] of this.nodeRecords) {
      for (const object of [record.surfaceDot, record.stemLine, record.marker, record.avatarLabel, record.halo, record.hitArea, record.label]) {
        const personaId = object.userData?.personaId;
        if (!personaId) {
          missingPersonaId.push({ recordId: id, kind: object.userData?.kind || object.type });
          continue;
        }
        if (!personaIds.has(personaId)) missingPersona.push(personaId);
      }
      const hitId = record.hitArea.userData?.personaId;
      markerIds.push(hitId);
      if (seen.has(hitId)) duplicatePersonaId.push(hitId);
      seen.add(hitId);
    }

    const clickable = this.pickableMarkers.filter(
      (object) => object.userData?.personaId && personaIds.has(object.userData.personaId)
    );
    const clickablePersonaIds = new Set(clickable.map((object) => object.userData.personaId));
    const visiblePersonaTotal = Array.from(this.nodeRecords.values()).filter(
      (record) => record.group.visible && this.visibleIds.has(record.persona.id)
    ).length;
    const nameplatePersonaIds = new Set(
      Array.from(this.nodeRecords.values())
        .map((record) => record.label.userData?.personaId)
        .filter((personaId) => personaId && personaIds.has(personaId))
    );
    const report = {
      markerTotal: this.nodeRecords.size,
      personaTotal: this.personas.length,
      missingPersonaId,
      missingPersona: Array.from(new Set(missingPersona)),
      duplicatePersonaId: Array.from(new Set(duplicatePersonaId)),
      clickableObjectTotal: clickable.length,
      clickableMarkerTotal: clickablePersonaIds.size,
      visiblePersonaTotal,
      nameplateTotal: nameplatePersonaIds.size,
      ok:
        this.nodeRecords.size === this.personas.length &&
        clickablePersonaIds.size === visiblePersonaTotal &&
        nameplatePersonaIds.size === this.personas.length &&
        missingPersonaId.length === 0 &&
        missingPersona.length === 0 &&
        duplicatePersonaId.length === 0
    };

    if (import.meta.env?.DEV) {
      console.debug("[persona-atlas] marker binding report", report);
      window.__personaAtlasDebug = {
        ...(window.__personaAtlasDebug || {}),
        validateMarkerBindings: () => this.validateMarkerBindings(),
        markerIds: () => markerIds.slice(),
        clickableMarkerIds: () => Array.from(clickablePersonaIds),
        landmarkCalibration: () => validateLandmarkAlignment(),
        showLandmarkPins: (enabled = true) => this.showLandmarkPins(enabled),
        focusLandmark: (name) => this.focusLandmark(name)
      };
    }

    return report;
  }

  getPerfSnapshot() {
    let visibleMarkerCount = 0;
    let renderedNameplateCount = 0;
    for (const record of this.nodeRecords.values()) {
      if (record.marker.visible || record.surfaceDot.visible) visibleMarkerCount += 1;
      if (record.label?.element?.classList.contains("is-visible")) renderedNameplateCount += 1;
    }
    return {
      markerCount: this.nodeRecords.size,
      visibleMarkerCount,
      renderedNameplateCount,
      avatarTextureCacheSize: this.avatarTextureCache.size() + this.fallbackAvatarTextureCache.size
    };
  }

  debugCoordinateLayout() {
    if (!import.meta.env?.DEV) return;

    const rows = [];
    const grid = new Map();
    for (const [id, record] of this.nodeRecords) {
      const spherePosition = toSpherePosition(record.persona.visualLat, record.persona.visualLng, MARKER_RADIUS);
      const distance = Math.sqrt(
        spherePosition.x * spherePosition.x + spherePosition.y * spherePosition.y + spherePosition.z * spherePosition.z
      );
      const key = `${Math.floor(record.persona.visualLat / 5) * 5}:${Math.floor(record.persona.visualLng / 5) * 5}`;
      const ids = grid.get(key) || [];
      ids.push(id);
      grid.set(key, ids);
      rows.push({
        id,
        name: record.persona.displayName,
        birthLat: record.persona.birthLat,
        birthLng: record.persona.birthLng,
        visualLat: record.persona.visualLat,
        visualLng: record.persona.visualLng,
        spherePosition,
        markerParent: record.group.parent === this.nodeGroup ? "nodeGroup" : record.group.parent?.type || "unknown",
        earthChild: this.nodeGroup.parent === this.earthGroup,
        distanceToCenter: Math.round(distance * 1000) / 1000
      });
    }

    console.debug("[persona-atlas] coordinate diagnostics", rows);
    console.debug("[persona-atlas] landmark projection calibration", validateLandmarkAlignment());
    const spread = validateCoordinateSpread(this.personas, MARKER_RADIUS);
    if (!spread.ok || spread.maxCellCount > Math.floor(this.personas.length * 0.3)) {
      console.warn("[persona-atlas] coordinate spread warning", spread, Array.from(grid.entries()));
    }
  }

  showRelations(relations) {
    this.clearRelations();
    if (window.innerWidth <= 720) return;

    for (const relation of relations) {
      const source = this.nodeRecords.get(relation.from)?.persona;
      const target = this.nodeRecords.get(relation.to)?.persona;
      if (!source || !target) continue;
      const line = this.createRelationLine(source, target);
      line.userData.relation = relation;
      this.relationGroup.add(line);
      this.relationLines.push(line);
    }
  }

  createRelationLine(source, target) {
    const sourcePoint = latLngToVector3(source.visualLat, source.visualLng, MARKER_RADIUS + 0.03);
    const targetPoint = latLngToVector3(target.visualLat, target.visualLng, MARKER_RADIUS + 0.03);
    const middle = sourcePoint.clone().add(targetPoint).normalize().multiplyScalar(EARTH_RADIUS * 1.23);
    const curve = new THREE.CatmullRomCurve3([sourcePoint, middle, targetPoint]);
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(36));
    const material = new THREE.LineBasicMaterial({
      color: this.accent,
      transparent: true,
      opacity: 0.32,
      depthWrite: false
    });
    return new THREE.Line(geometry, material);
  }

  clearRelations() {
    for (const line of this.relationLines) {
      line.geometry.dispose();
      line.material.dispose();
      this.relationGroup.remove(line);
    }
    this.relationLines = [];
  }

  setControlsEnabled(enabled) {
    this.controls.enabled = enabled;
    this.isModalOpen = !enabled;
  }

  setInteractionLocks({ isUserDragging, isAutoTouring, isHoverFocusing, isModalOpen } = {}) {
    if (typeof isUserDragging === "boolean") this.isUserDragging = isUserDragging;
    if (typeof isAutoTouring === "boolean") this.isAutoTouring = isAutoTouring;
    if (typeof isHoverFocusing === "boolean") this.isHoverFocusing = isHoverFocusing;
    if (typeof isModalOpen === "boolean") this.isModalOpen = isModalOpen;
  }

  setAccent(color) {
    this.accent.set(color || "#b9c7c4");
    for (const line of this.relationLines) {
      line.material.color.copy(this.accent);
    }
  }

  setupEvents() {
    this.onResize = () => this.resize();
    this.onPointerDown = (event) => this.handlePointerDown(event);
    this.onPointerMove = (event) => this.handlePointerMove(event);
    this.onPointerUp = (event) => this.handlePointerUp(event);
    this.onPointerLeave = () => {
      this.pointerInside = false;
      this.pointerDown = null;
      this.setHovered(null);
      this.tooltip?.classList.remove("is-visible");
    };

    window.addEventListener("resize", this.onResize);
    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.addEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.addEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.addEventListener("pointerleave", this.onPointerLeave);
  }

  setPointerFromEvent(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.pointerClientX = event.clientX;
    this.pointerClientY = event.clientY;
  }

  handlePointerDown(event) {
    if (event.button !== 0) return;
    this.setPointerFromEvent(event);
    this.pointerDown = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
      wasDragging: this.isUserDragging
    };
  }

  handlePointerMove(event) {
    this.setPointerFromEvent(event);
    this.pointerDirty = true;
    this.pointerInside = true;
    if (this.tooltip && this.hoveredId) {
      this.tooltip.style.left = `${event.clientX}px`;
      this.tooltip.style.top = `${event.clientY}px`;
    }
  }

  handlePointerUp(event) {
    if (!this.pointerDown || event.button !== 0) return;
    const down = this.pointerDown;
    this.pointerDown = null;
    const dx = event.clientX - down.x;
    const dy = event.clientY - down.y;
    const moved = Math.hypot(dx, dy);
    const blockedByDrag = moved > CLICK_DRAG_THRESHOLD || down.wasDragging || this.isUserDragging;
    if (blockedByDrag || performance.now() - this.lastUserDragAt < DRAG_CLICK_COOLDOWN) return;

    this.setPointerFromEvent(event);
    const record = this.pickNode(event);
    if (!record) return;
    this.clearInteractionTweens("marker-click");
    this.selectPersona(record.persona.id, { focus: true, emit: true });
  }

  pickNode(event) {
    if (event) this.setPointerFromEvent(event);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hits = this.raycaster.intersectObjects(this.pickableMarkers, false);
    for (const hit of hits) {
      const personaId = hit.object?.userData?.personaId;
      if (!personaId) continue;
      const record = this.nodeRecords.get(personaId);
      if (!record || !record.group.visible || !this.visibleIds.has(personaId)) continue;
      if (record.marker.material.opacity <= 0.04) continue;
      return record;
    }
    return null;
  }

  setHovered(record) {
    const nextId = record?.persona.id || null;
    if (nextId === this.hoveredId) return;

    if (this.hoveredId && this.hoveredId !== this.selectedId) {
      const previous = this.nodeRecords.get(this.hoveredId);
      if (previous) {
        gsap.killTweensOf(previous.marker.scale);
        gsap.to(previous.marker.scale, {
          x: previous.baseScale,
          y: previous.baseScale,
          z: previous.baseScale,
          duration: 0.18
        });
        previous.surfaceDot.material.opacity = MARKER_BLEND_PRESET.surfaceIdle;
        previous.surfaceShadow.material.opacity = MARKER_BLEND_PRESET.shadowIdle;
        previous.stemLine.material.opacity = 0;
        this.setLabelState(previous, 0, false);
      }
    }

    this.hoveredId = nextId;
    this.renderer.domElement.style.cursor = record ? "pointer" : "grab";

    if (record && record.persona.id !== this.selectedId) {
      gsap.killTweensOf(record.marker.scale);
      gsap.to(record.marker.scale, {
        x: Math.max(record.baseScale * 1.34, MARKER_HOVER_SCALE),
        y: Math.max(record.baseScale * 1.34, MARKER_HOVER_SCALE),
        z: Math.max(record.baseScale * 1.34, MARKER_HOVER_SCALE),
        duration: 0.18,
        ease: "power2.out"
      });
      record.halo.material.opacity = Math.max(record.halo.material.opacity, 0.16);
      record.surfaceDot.material.opacity = MARKER_BLEND_PRESET.surfaceActive;
      record.surfaceShadow.material.opacity = MARKER_BLEND_PRESET.shadowActive;
      record.stemLine.material.opacity = 0.5;
      this.setLabelState(record, 0.9, true);
      this.onPreview?.(record.persona, { source: "marker-hover" });
    }
  }

  updatePointerRaycast() {
    if (!this.pointerInside || !this.pointerDirty) return;
    const now = performance.now();
    if (now - this.lastRaycastAt < 100) return;
    this.lastRaycastAt = now;
    this.pointerDirty = false;
    const record = this.pickNode();
    this.setHovered(record);

    if (record && this.tooltip) {
      this.tooltip.innerHTML = `<strong>${escapeHtml(record.persona.displayName)}</strong><span>${escapeHtml(record.persona.identity)} · ${escapeHtml(record.persona.era)}</span>`;
      this.tooltip.classList.add("is-visible");
      this.tooltip.style.left = `${this.pointerClientX}px`;
      this.tooltip.style.top = `${this.pointerClientY}px`;
    } else {
      this.tooltip?.classList.remove("is-visible");
    }
  }

  handleControlStart() {
    this.isUserDragging = true;
    this.lastUserDragAt = performance.now();
    this.hoverTween?.kill();
    this.rotationTween?.kill();
    this.focusTween?.kill();
    this.clearPreview();
    this.onUserControl?.();
    this.onUserControlStart?.();
  }

  handleControlEnd() {
    this.isUserDragging = false;
    this.lastUserDragAt = performance.now();
    this.onUserControlEnd?.();
  }

  resize() {
    const width = this.mount.clientWidth || window.innerWidth;
    const height = this.mount.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(pixelRatioCap());
    this.renderer.setSize(width, height);
    this.labelRenderer?.setSize(width, height);

    const mobile = width <= 760;
    this.earthGroup.position.x = mobile ? 0 : 0.34;
    this.controls.target.x = mobile ? 0 : 0.32;
    this.controls.target.y = mobile ? 0.08 : 0;
    this.camera.position.z = mobile ? 8.2 : Math.min(Math.max(this.camera.position.z, 5.3), 8.2);
    for (const atmosphere of this.atmosphereMeshes) {
      const baseOpacity = atmosphere.material.userData.baseOpacity || 0;
      atmosphere.material.uniforms.opacity.value = mobile ? baseOpacity * 0.62 : baseOpacity;
    }
  }

  animate() {
    const delta = this.clock.getDelta();
    if (!this.isUserDragging && !this.isModalOpen && !this.isHoverFocusing) {
      const spinSpeed = this.isAutoTouring ? EARTH_MOTION_CONFIG.autoTourSpinSpeed : EARTH_MOTION_CONFIG.calmSpinSpeed;
      this.earthGroup.rotation.y += delta * 60 * spinSpeed * EARTH_MOTION_CONFIG.spinDirection;
    }
    if (this.cloudMesh) this.cloudMesh.rotation.y -= delta * 0.0038;
    if (this.stars) this.stars.rotation.y -= delta * 0.0016;
    if (this.brightStars) this.brightStars.rotation.y -= delta * 0.0011;
    if (this.nebulaDust) this.nebulaDust.rotation.y += delta * 0.0009;
    if (this.nebulaVeils) this.nebulaVeils.rotation.z += delta * 0.00018;

    this.updatePointerRaycast();
    const now = performance.now();
    if (!document.hidden && now - this.lastMarkerVisibilityAt > 33) {
      this.lastMarkerVisibilityAt = now;
      this.updateMarkerVisibility();
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer?.render(this.scene, this.camera);
    this.frameId = window.requestAnimationFrame(() => this.animate());
  }

  updateMarkerVisibility() {
    if (document.hidden) return;
    this.camera.getWorldPosition(this.cameraWorld);
    this.earthGroup.getWorldPosition(this.earthWorld);
    this.toCamera.copy(this.cameraWorld).sub(this.earthWorld).normalize();

    let visibleRank = 0;
    let visibleMarkerCount = 0;
    let renderedNameplateCount = 0;
    for (const [id, record] of this.nodeRecords) {
      if (!record.group.visible) continue;
      record.group.getWorldPosition(this.markerWorld);
      this.normalWorld.copy(this.markerWorld).sub(this.earthWorld).normalize();
      const facing = this.normalWorld.dot(this.toCamera);
      const onRoute = this.routeIds.size === 0 || this.routeIds.has(id);
      const selected = id === this.selectedId;
      const hovered = id === this.hoveredId;
      const preview = id === this.previewId;
      const opacity = markerFacingOpacity({ facing, selected, preview, hovered, onRoute });
      const lod = markerLod({ selected, preview, hovered, onRoute, facing, visibleRank });
      const markerVisible = shouldShowMarker({ opacity, selected, preview, hovered }) && lod !== "hidden";
      if (markerVisible) visibleRank += 1;
      if (markerVisible) visibleMarkerCount += 1;
      if (shouldHydrateMarkerAvatar({ facing, selected, preview, hovered, onRoute }) && lod !== "hidden") {
        this.requestRecordAvatarTexture(record);
        hydrateLazyImages(record.avatarLabel.element);
      }
      record.marker.visible = markerVisible;
      record.halo.visible = (markerVisible || onRoute) && lod !== "hidden";
      record.surfaceDot.visible = opacity > 0.018 || selected || preview || hovered;
      record.surfaceShadow.visible = opacity > 0.055 || selected || preview || hovered;
      record.stemLine.visible = markerVisible && (selected || preview || hovered || lod === "route");
      record.hitArea.visible = markerVisible;
      record.avatarLabel.visible = markerVisible && lod !== "dot";
      record.markerLod = lod;
      const breath = 0.86 + Math.sin(this.clock.elapsedTime * 1.35 + record.halo.userData.phase) * 0.08;
      record.marker.material.opacity = Math.min(
        selected || preview || hovered ? MARKER_BLEND_PRESET.markerActive : MARKER_BLEND_PRESET.markerIdle,
        opacity
      );
      record.surfaceDot.material.opacity = Math.min(
        selected || preview || hovered ? MARKER_BLEND_PRESET.surfaceActive : onRoute ? 0.48 : 0.2,
        opacity * 0.84
      );
      record.surfaceShadow.material.opacity = Math.min(
        selected || preview || hovered ? MARKER_BLEND_PRESET.shadowActive : MARKER_BLEND_PRESET.shadowIdle,
        opacity * 0.28
      );
      record.hitArea.material.opacity = Math.max(0.003, Math.min(0.012, opacity * 0.012));
      record.hitArea.visible = markerVisible;
      record.avatarLabel.element.style.opacity = String(Math.max(0, Math.min(1, opacity)));
      record.avatarLabel.element.classList.toggle("is-visible", record.avatarLabel.visible && opacity > 0.08);
      record.avatarLabel.element.classList.toggle("is-muted", !selected && !preview && !hovered && !onRoute);
      record.avatarLabel.element.classList.toggle("is-highlighted", selected || preview || hovered);
      record.halo.material.opacity = Math.min(
        selected ? MARKER_BLEND_PRESET.haloActive : preview || hovered ? 0.12 : onRoute ? MARKER_BLEND_PRESET.haloIdle : 0.014,
        opacity * 0.16
      ) * breath;
      record.stemLine.material.opacity = Math.min(
        selected ? 0.52 : preview || hovered ? 0.46 : onRoute && facing > 0.76 ? 0.14 : 0.02,
        opacity * 0.5
      );

      if (!selected && !hovered && !preview) {
        this.setLabelState(record, 0, false);
      } else {
        renderedNameplateCount += 1;
      }
    }
    this.visibleMarkerCount = visibleMarkerCount;
    this.renderedNameplateCount = renderedNameplateCount;
    const now = performance.now();
    if (now - this.lastPickableRefreshAt > 250) {
      this.lastPickableRefreshAt = now;
      this.pickableMarkers = rebuildPickableMarkers(this.nodeRecords.values(), this.visibleIds);
    }
  }

  clearNodes() {
    this.clearRelations();
    for (const record of this.nodeRecords.values()) {
      record.surfaceDot.material.dispose();
      record.surfaceShadow.material.dispose();
      record.stemLine.geometry.dispose();
      record.stemLine.material.dispose();
      record.marker.material.dispose();
      record.halo.material.dispose();
      record.hitArea.material.dispose();
      record.guideLine.geometry.dispose();
      record.guideLine.material.dispose();
      record.avatarLabel.element?.remove();
      record.label.element?.remove();
      this.nodeGroup.remove(record.group);
      this.labelGroup.remove(record.avatarLabel);
      this.labelGroup.remove(record.label);
      this.labelGroup.remove(record.guideLine);
    }
    this.nodeRecords.clear();
    this.pickableMarkers = [];
  }

  dispose() {
    window.cancelAnimationFrame(this.frameId);
    window.removeEventListener("resize", this.onResize);
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.removeEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.removeEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.removeEventListener("pointerleave", this.onPointerLeave);
    this.clearNodes();
    for (const record of this.landmarkRecords.values()) {
      record.dot.geometry.dispose();
      record.dot.material.dispose();
      record.label.element?.remove();
      this.labelGroup.remove(record.label);
    }
    this.landmarkRecords.clear();
    this.haloTexture.dispose();
    this.hitTexture.dispose();
    this.avatarTextureCache.clear();
    for (const texture of this.fallbackAvatarTextureCache.values()) {
      texture.dispose();
    }
    this.fallbackAvatarTextureCache.clear();
    this.surfaceDotGeometry.dispose();
    this.surfaceShadowGeometry.dispose();
    this.scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (material.uniforms) {
            for (const uniform of Object.values(material.uniforms)) {
              if (uniform?.value?.isTexture) uniform.value.dispose();
            }
          }
          for (const value of Object.values(material)) {
            if (value && value.isTexture) value.dispose();
          }
          material.dispose();
        }
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelRenderer?.domElement.remove();
  }
}

function latLngToVector3(lat, lng, radius) {
  return geoToSphere(lat, lng, radius);
}

function pixelRatioCap() {
  const ratio = window.devicePixelRatio || 1;
  const mobile = window.innerWidth <= 760;
  return Math.min(ratio, mobile ? 1.25 : 1.5);
}

function hydrateLazyImages(root) {
  if (!root) return;
  for (const image of root.querySelectorAll("img[data-src]")) {
    image.src = image.dataset.src;
    delete image.dataset.src;
  }
}

function nearestAngle(current, target) {
  const twoPi = Math.PI * 2;
  return current + ((((target - current) % twoPi) + Math.PI * 3) % twoPi) - Math.PI;
}

function hashScalar(value) {
  let hash = 2166136261;
  const input = String(value || "");
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createGlowTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,240,0.92)");
  gradient.addColorStop(0.24, "rgba(220,236,226,0.44)");
  gradient.addColorStop(0.64, "rgba(150,180,184,0.14)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function loadAvatarImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function avatarFor(persona, size = "marker") {
  if (!persona || persona.avatarIsAuthentic !== true) return "";
  if (size === "marker") return persona.avatarMarkerLocal || persona.avatarThumbLocal || persona.avatarLocal || "";
  if (size === "thumb") return persona.avatarThumbLocal || persona.avatarLocal || "";
  return persona.avatarLocal || persona.avatarThumbLocal || "";
}

function isCanvasSafeAvatarSource(url) {
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.protocol === "data:" || parsed.protocol === "blob:" || parsed.origin === window.location.origin;
  } catch {
    return !/^https?:\/\//i.test(String(url));
  }
}

function createAvatarMarkerTexture(persona, image = null) {
  const size = 192;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, size, size);
  const shadow = ctx.createRadialGradient(96, 104, 42, 96, 104, 92);
  shadow.addColorStop(0, "rgba(0, 0, 0, 0.34)");
  shadow.addColorStop(0.58, "rgba(0, 0, 0, 0.22)");
  shadow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = shadow;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.beginPath();
  ctx.arc(96, 92, 58, 0, Math.PI * 2);
  ctx.clip();

  if (image) {
    const ratio = Math.max(116 / image.width, 116 / image.height);
    const drawWidth = image.width * ratio;
    const drawHeight = image.height * ratio;
    ctx.drawImage(image, 96 - drawWidth / 2, 92 - drawHeight / 2, drawWidth, drawHeight);
    ctx.fillStyle = "rgba(4, 12, 12, 0.12)";
    ctx.fillRect(38, 34, 116, 116);
  } else {
    const fill = ctx.createLinearGradient(38, 34, 154, 150);
    fill.addColorStop(0, "rgba(84, 96, 96, 0.72)");
    fill.addColorStop(0.56, "rgba(28, 38, 38, 0.95)");
    fill.addColorStop(1, "rgba(8, 16, 15, 0.98)");
    ctx.fillStyle = fill;
    ctx.fillRect(38, 34, 116, 116);
    ctx.strokeStyle = "rgba(176, 192, 184, 0.66)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(96, 78, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(96, 132, 34, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
  }
  ctx.restore();

  ctx.lineWidth = 7;
  ctx.strokeStyle = "rgba(17, 43, 39, 0.94)";
  ctx.beginPath();
  ctx.arc(96, 92, 61, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(199, 157, 86, 0.92)";
  ctx.beginPath();
  ctx.arc(96, 92, 58, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255, 245, 210, 0.52)";
  ctx.beginPath();
  ctx.arc(96, 92, 64, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(182, 132, 63, 0.92)";
  ctx.beginPath();
  ctx.arc(96, 157, 5, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createAvatarMarkerElement(persona) {
  const element = document.createElement("div");
  element.className = "earth-avatar-marker-anchor";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "earth-avatar-marker";
  button.setAttribute("aria-label", persona.displayName || persona.name || "persona");
  const avatar = document.createElement("span");
  avatar.className = "earth-avatar-marker-image";
  avatar.setAttribute("aria-label", persona.avatarIsAuthentic ? `${persona.displayName || persona.name || "人物"} 肖像` : "图像待核验");
  const avatarUrl = avatarFor(persona, "marker");
  if (avatarUrl) {
    const image = document.createElement("img");
    image.dataset.src = avatarUrl;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.width = 64;
    image.height = 64;
    image.addEventListener("load", () => {
      avatar.classList.remove("is-pending-avatar");
      avatar.classList.add("has-image");
    });
    image.addEventListener("error", () => {
      image.remove();
      avatar.classList.remove("has-image");
      avatar.classList.add("is-pending-avatar");
      if (import.meta.env?.DEV) console.warn(`avatar failed: ${persona?.id || "unknown"}`);
    });
    avatar.classList.add("is-pending-avatar");
    avatar.appendChild(image);
  } else {
    avatar.classList.add("is-pending-avatar");
  }
  button.appendChild(avatar);
  element.appendChild(button);
  return element;
}

function createHitTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.beginPath();
  ctx.arc(32, 32, 31, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

function createNebulaTexture(hue = "blue") {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  const palettes = {
    blue: ["rgba(77, 132, 178, 0.34)", "rgba(36, 82, 92, 0.18)", "rgba(235, 226, 190, 0.08)"],
    violet: ["rgba(105, 86, 145, 0.22)", "rgba(48, 87, 126, 0.18)", "rgba(182, 132, 63, 0.08)"],
    warm: ["rgba(182, 132, 63, 0.16)", "rgba(113, 43, 42, 0.12)", "rgba(68, 145, 160, 0.12)"]
  };
  const colors = palettes[hue] || palettes.blue;

  for (let i = 0; i < 18; i += 1) {
    const x = 120 + Math.random() * 280;
    const y = 120 + Math.random() * 280;
    const r = 80 + Math.random() * 170;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, colors[i % colors.length]);
    gradient.addColorStop(0.42, colors[(i + 1) % colors.length]);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }

  for (let i = 0; i < 360; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const alpha = Math.random() * 0.16;
    ctx.fillStyle = `rgba(238, 232, 214, ${alpha})`;
    ctx.fillRect(x, y, Math.random() * 1.4 + 0.3, Math.random() * 1.4 + 0.3);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createLabelElement(persona) {
  const element = document.createElement("div");
  element.className = "marker-label-anchor";
  element.style.pointerEvents = "none";
  const panel = document.createElement("div");
  panel.className = "marker-label";
  const stamp = document.createElement("span");
  stamp.className = "marker-label-avatar";
  stamp.setAttribute("aria-label", persona.avatarIsAuthentic ? `${persona.displayName || persona.name || "人物"} 肖像` : "图像待核验");
  const avatarUrl = avatarFor(persona, "thumb");
  if (avatarUrl) {
    const image = document.createElement("img");
    image.dataset.src = avatarUrl;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.width = 96;
    image.height = 96;
    image.addEventListener("load", () => {
      stamp.classList.remove("is-pending-avatar");
      stamp.classList.add("has-image");
    });
    image.addEventListener("error", () => {
      image.remove();
      stamp.classList.remove("has-image");
      stamp.classList.add("is-pending-avatar");
      if (import.meta.env?.DEV) console.warn(`avatar failed: ${persona?.id || "unknown"}`);
    });
    stamp.classList.add("is-pending-avatar");
    stamp.appendChild(image);
  } else {
    stamp.classList.add("is-pending-avatar");
  }
  const copy = document.createElement("span");
  copy.className = "marker-label-copy";
  const title = document.createElement("strong");
  title.textContent = persona.displayName || persona.name || "待补充";
  const meta = document.createElement("span");
  meta.textContent = [persona.identity, persona.era].filter(Boolean).join(" · ") || "待补充";
  copy.append(title, meta);
  panel.append(stamp, copy);
  element.append(panel);
  return element;
}

function createLandmarkLabelElement(name) {
  const element = document.createElement("div");
  element.className = "debug-landmark-label";
  element.style.pointerEvents = "none";
  element.textContent = name;
  return element;
}

function createGuideLine(persona, color) {
  const start = latLngToVector3(persona.visualLat, persona.visualLng, SURFACE_RADIUS);
  const end = latLngToVector3(persona.visualLat, persona.visualLng, LABEL_RADIUS);
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false
  });
  return new THREE.Line(geometry, material);
}

function createStemLine(normal, color, length) {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    normal.clone().multiplyScalar(length)
  ]);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false
  });
  return new THREE.Line(geometry, material);
}

function createLabelTexture(persona, color) {
  const width = 440;
  const height = 112;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(5, 8, 10, 0.42)";
  roundRect(ctx, 0, 0, width, height, 10);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 1;
  roundRect(ctx, 0.5, 0.5, width - 1, height - 1, 10);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#f4f0df";
  ctx.font = '650 28px "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.fillText(persona.displayName, 22, 43);
  ctx.fillStyle = "rgba(220, 226, 218, 0.66)";
  ctx.font = '18px "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.fillText(`${persona.identity}，${persona.era}`, 22, 73, width - 44);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createProceduralEarthTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const ocean = ctx.createLinearGradient(0, 0, 0, 512);
  ocean.addColorStop(0, "#0d2333");
  ocean.addColorStop(0.45, "#163f55");
  ocean.addColorStop(1, "#071725");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, 1024, 512);

  ctx.fillStyle = "rgba(118, 126, 101, 0.62)";
  for (let i = 0; i < 90; i += 1) {
    const x = Math.random() * 1024;
    const y = 70 + Math.random() * 360;
    const w = 40 + Math.random() * 130;
    const h = 18 + Math.random() * 70;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(230, 232, 220, 0.2)";
  ctx.fillRect(0, 0, 1024, 34);
  ctx.fillRect(0, 474, 1024, 38);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createProceduralNightTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, 1024, 512);
  ctx.fillStyle = "rgba(255, 207, 128, 0.76)";
  for (let i = 0; i < 380; i += 1) {
    const x = Math.random() * 1024;
    const y = 80 + Math.random() * 340;
    const size = Math.random() * 1.6 + 0.4;
    ctx.fillRect(x, y, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createProceduralCloudTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 1024, 512);
  for (let i = 0; i < 120; i += 1) {
    const x = Math.random() * 1024;
    const y = Math.random() * 512;
    const rx = 22 + Math.random() * 88;
    const ry = 8 + Math.random() * 28;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, rx);
    gradient.addColorStop(0, "rgba(255,255,255,0.58)");
    gradient.addColorStop(0.45, "rgba(235,239,238,0.2)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((Math.random() - 0.5) * 0.8);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = gradient;
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function applyLegacyEarthSurfaceGrade(material) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
      vec3 earthArchiveSaturate(vec3 color, float amount) {
        float luma = dot(color, vec3(0.299, 0.587, 0.114));
        return mix(vec3(luma), color, amount);
      }`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <tonemapping_fragment>",
      `
      #ifdef USE_MAP
        vec3 earthSource = texture2D(map, vMapUv).rgb;
        float sourceMax = max(max(earthSource.r, earthSource.g), earthSource.b);
        float oceanMask = smoothstep(0.08, 0.34, earthSource.b - max(earthSource.r, earthSource.g) * 0.72);
        float warmLandMask = smoothstep(0.02, 0.34, earthSource.r - earthSource.b) * smoothstep(0.18, 0.62, earthSource.g);
        float brightDesertMask = smoothstep(0.46, 0.82, sourceMax) * warmLandMask;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(0.68, 0.83, 1.02), oceanMask * 0.5);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(1.16, 1.06, 0.86), warmLandMask * 0.34);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(1.1, 1.03, 0.9), brightDesertMask * 0.24);
      #endif
      gl_FragColor.rgb = pow(max(gl_FragColor.rgb, vec3(0.0)), vec3(0.98)) * 1.02;
      gl_FragColor.rgb = earthArchiveSaturate(gl_FragColor.rgb, 1.05);
      gl_FragColor.rgb = clamp(gl_FragColor.rgb, 0.0, 1.0);
      #include <tonemapping_fragment>`
    );
  };
  material.customProgramCacheKey = () => "legacy-earth-surface-grade-v1";
}

function createAtmosphereMaterial({
  color = "#c8d4d5",
  opacity = 0.12,
  power = 3.8,
  sunDirection = new THREE.Vector3(1, 0, 0),
  intensity = 1
} = {}) {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: {
      glowColor: { value: new THREE.Color(color) },
      opacity: { value: opacity },
      power: { value: power },
      sunDirection: { value: sunDirection },
      intensity: { value: intensity }
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      uniform float opacity;
      uniform float power;
      uniform vec3 sunDirection;
      uniform float intensity;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float rim = 1.0 - clamp(dot(normalize(vWorldNormal), viewDir), 0.0, 1.0);
        float sunFacing = dot(normalize(vWorldNormal), normalize(sunDirection));
        float dawn = smoothstep(-0.45, 0.48, sunFacing);
        float edge = smoothstep(0.22, 1.0, rim);
        float glow = pow(edge, power) * (0.64 + dawn * 0.58) * intensity;
        gl_FragColor = vec4(glowColor, glow * opacity);
      }
    `
  });
  material.userData.baseOpacity = opacity;
  return material;
}

function createNightLightsMaterial(map, sunDirection, opacity = 0.38) {
  return new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: {
      map: { value: map },
      sunDirection: { value: sunDirection },
      opacity: { value: opacity }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform vec3 sunDirection;
      uniform float opacity;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      void main() {
        float day = dot(normalize(vWorldNormal), normalize(sunDirection));
        float night = smoothstep(0.16, -0.34, day);
        vec3 lights = texture2D(map, vUv).rgb;
        float intensity = max(max(lights.r, lights.g), lights.b);
        gl_FragColor = vec4(lights * 1.12, intensity * night * opacity);
      }
    `
  });
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}
