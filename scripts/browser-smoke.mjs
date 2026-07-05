import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import { Buffer } from "node:buffer";

const TARGET = process.argv[2] || "http://127.0.0.1:5174/";
const PORT = Number(process.argv[3] || 9333);
const SCREENSHOT = process.argv[4] || "verification-smoke.png";
const VIEWPORT_WIDTH = Number(process.argv[5] || 1366);
const VIEWPORT_HEIGHT = Number(process.argv[6] || 768);
const GLOBE_SCREENSHOT = SCREENSHOT.replace(/\.png$/i, "-globe.png");
const LANDMARK_SCREENSHOT = SCREENSHOT.replace(/\.png$/i, "-landmark.png");

const page = await getJson(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(TARGET)}`, "PUT");
const ws = await connectWebSocket(page.webSocketDebuggerUrl);
const errors = [];

ws.onMessage((message) => {
  if (message.method === "Runtime.exceptionThrown") {
    errors.push(message.params?.exceptionDetails?.text || "Runtime exception");
  }
  if (message.method === "Log.entryAdded" && message.params?.entry?.level === "error") {
    errors.push(message.params.entry.text);
  }
});

await ws.call("Runtime.enable");
await ws.call("Log.enable");
await ws.call("Page.enable");
await ws.call("Emulation.setDeviceMetricsOverride", {
  width: VIEWPORT_WIDTH,
  height: VIEWPORT_HEIGHT,
  deviceScaleFactor: 1,
  mobile: false
});
await ws.call("Page.navigate", { url: TARGET });
await wait(2500);

await ws.call("Runtime.evaluate", {
  expression: `document.querySelector('#enterButton')?.click(); true`,
  awaitPromise: true
});
await wait(2600);

const initial = await evalJson(ws, `(() => ({
  canvas: !!document.querySelector('canvas'),
  cards: document.querySelectorAll('.person-card').length,
  markerBinding: window.__personaAtlasDebug?.validateMarkerBindings?.() || null,
  landmarkCalibration: window.__personaAtlasDebug?.landmarkCalibration?.() || null,
  visibleNameplates: Array.from(document.querySelectorAll('.marker-label-anchor')).filter((node) => Number(getComputedStyle(node).opacity) > 0.05).length,
  visibleCardIds: window.__personaAtlasDebug?.visiblePersonaIds?.() || [],
  whisper: document.querySelector('#personaWhisper')?.textContent?.trim() || '',
  modalHidden: document.querySelector('#profileModal')?.hidden,
  topbarVisible: document.querySelector('.topbar') ? getComputedStyle(document.querySelector('.topbar')).opacity : 'missing'
}))()`);

const landmarkFocus = await evalJson(ws, `(() => ({
  show: window.__personaAtlasDebug?.showLandmarkPins?.(true) || null,
  focus: window.__personaAtlasDebug?.focusLandmark?.('北京') || null
}))()`);
await wait(1300);

const landmarkShot = await ws.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
fs.writeFileSync(LANDMARK_SCREENSHOT, Buffer.from(landmarkShot.data, "base64"));

await ws.call("Runtime.evaluate", {
  expression: `window.__personaAtlasDebug?.showLandmarkPins?.(false); true`,
  awaitPromise: true
});

await ws.call("Runtime.evaluate", {
  expression: `(() => {
    const cards = Array.from(document.querySelectorAll('.person-card'));
    const card = cards.find((item) => !item.classList.contains('is-active')) || cards[0];
    card?.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false, pointerType: 'mouse' }));
    return true;
  })()`
});
await wait(1400);

const afterHover = await evalJson(ws, `(() => ({
  whisper: document.querySelector('#personaWhisper')?.textContent?.trim() || '',
  modalHidden: document.querySelector('#profileModal')?.hidden,
  activeCards: document.querySelectorAll('.person-card.is-active').length,
  visibleNameplates: Array.from(document.querySelectorAll('.marker-label-anchor')).filter((node) => Number(getComputedStyle(node).opacity) > 0.05).length
}))()`);

const globeShot = await ws.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
fs.writeFileSync(GLOBE_SCREENSHOT, Buffer.from(globeShot.data, "base64"));

await ws.call("Runtime.evaluate", {
  expression: `document.querySelectorAll('.person-card')[1]?.click(); true`
});
await wait(900);

const afterClick = await evalJson(ws, `(() => ({
  modalHidden: document.querySelector('#profileModal')?.hidden,
  profileName: document.querySelector('#profileName')?.textContent?.trim() || '',
  clickedCardName: document.querySelectorAll('.person-card')[1]?.querySelector('strong')?.textContent?.trim() || ''
}))()`);

const screenshot = await ws.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
fs.writeFileSync(SCREENSHOT, Buffer.from(screenshot.data, "base64"));
await getJson(`http://127.0.0.1:${PORT}/json/close/${page.id}`).catch(() => null);
ws.close();

const failures = [];
if (!initial.canvas) failures.push("canvas missing");
if (initial.cards < 1) failures.push(`expected cards, got ${initial.cards}`);
if (!initial.markerBinding?.ok) failures.push(`marker binding failed: ${JSON.stringify(initial.markerBinding)}`);
if (initial.landmarkCalibration?.textureLongitudeOffset !== 90) {
  failures.push(`texture offset should be 90: ${JSON.stringify(initial.landmarkCalibration)}`);
}
if (!landmarkFocus.focus || landmarkFocus.focus.name !== "北京") {
  failures.push(`failed to focus Beijing landmark: ${JSON.stringify(landmarkFocus)}`);
}
if (initial.markerBinding && initial.cards !== initial.markerBinding.clickableMarkerTotal) {
  failures.push(`card/marker mismatch: ${initial.cards} cards vs ${initial.markerBinding.clickableMarkerTotal} markers`);
}
if (!initial.whisper) failures.push("whisper missing after enter");
if (initial.visibleNameplates > 1) failures.push(`too many initial nameplates: ${initial.visibleNameplates}`);
if (initial.modalHidden !== true) failures.push("modal should be hidden initially");
if (afterHover.modalHidden !== true) failures.push("hover opened modal");
if (afterHover.visibleNameplates !== 1) failures.push(`hover should show exactly one nameplate, got ${afterHover.visibleNameplates}`);
if (!afterHover.whisper || afterHover.whisper === initial.whisper) failures.push("hover did not update whisper");
if (afterClick.modalHidden !== false) failures.push("click did not open modal");
if (afterClick.clickedCardName && afterClick.profileName !== afterClick.clickedCardName) {
  failures.push(`modal/profile mismatch: ${afterClick.profileName} vs ${afterClick.clickedCardName}`);
}
if (errors.length) failures.push(`console errors: ${errors.join(" | ")}`);

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures, initial, afterHover, afterClick, screenshot: SCREENSHOT }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, initial, landmarkFocus, afterHover, afterClick, screenshot: SCREENSHOT, globeScreenshot: GLOBE_SCREENSHOT, landmarkScreenshot: LANDMARK_SCREENSHOT }, null, 2));

async function evalJson(ws, expression) {
  const result = await ws.call("Runtime.evaluate", {
    expression: `JSON.stringify(${expression})`,
    returnByValue: true,
    awaitPromise: true
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails, null, 2));
  }
  return JSON.parse(result.result?.value || "null");
}

function getJson(url, method = "GET") {
  return new Promise((resolve, reject) => {
    const request = http.request(url, { method }, (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode && response.statusCode >= 400) {
            reject(new Error(`${response.statusCode}: ${body}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(body);
          }
        });
      });
    request.on("error", reject);
    request.end();
  });
}

function connectWebSocket(url) {
  const parsed = new URL(url);
  const socket = net.createConnection(Number(parsed.port), parsed.hostname);
  const key = crypto.randomBytes(16).toString("base64");
  const listeners = new Set();
  let nextId = 1;
  let buffer = Buffer.alloc(0);
  let opened = false;
  const api = {
    call(method, params = {}) {
      const id = nextId++;
      send({ id, method, params });
      return new Promise((resolve, reject) => {
        const listener = (message) => {
          if (message.id !== id) return;
          listeners.delete(listener);
          if (message.error) reject(new Error(message.error.message));
          else resolve(message.result || {});
        };
        listeners.add(listener);
      });
    },
    onMessage(listener) {
      listeners.add(listener);
    },
    close() {
      socket.end();
    }
  };

  return new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.write(
      [
        `GET ${parsed.pathname}${parsed.search} HTTP/1.1`,
        `Host: ${parsed.host}`,
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Key: ${key}`,
        "Sec-WebSocket-Version: 13",
        "",
        ""
      ].join("\r\n")
    );

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (!opened) {
        const headerEnd = buffer.indexOf("\r\n\r\n");
        if (headerEnd === -1) return;
        const header = buffer.slice(0, headerEnd).toString("utf8");
        if (!header.includes("101")) {
          reject(new Error(`WebSocket upgrade failed: ${header}`));
          return;
        }
        opened = true;
        buffer = buffer.slice(headerEnd + 4);
        resolve(api);
      }
      parseFrames();
    });
  });

  function parseFrames() {
    while (buffer.length >= 2) {
      const first = buffer[0];
      const second = buffer[1];
      let offset = 2;
      let length = second & 0x7f;
      if (length === 126) {
        if (buffer.length < 4) return;
        length = buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (buffer.length < 10) return;
        const high = buffer.readUInt32BE(2);
        const low = buffer.readUInt32BE(6);
        length = high * 2 ** 32 + low;
        offset = 10;
      }
      const masked = Boolean(second & 0x80);
      const maskOffset = masked ? 4 : 0;
      if (buffer.length < offset + maskOffset + length) return;
      let payload = buffer.slice(offset + maskOffset, offset + maskOffset + length);
      if (masked) {
        const mask = buffer.slice(offset, offset + 4);
        payload = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]));
      }
      buffer = buffer.slice(offset + maskOffset + length);
      if ((first & 0x0f) === 1) {
        const message = JSON.parse(payload.toString("utf8"));
        for (const listener of listeners) listener(message);
      }
    }
  }

  function send(value) {
    const payload = Buffer.from(JSON.stringify(value), "utf8");
    const mask = crypto.randomBytes(4);
    const header = [];
    header.push(0x81);
    if (payload.length < 126) {
      header.push(0x80 | payload.length);
    } else if (payload.length < 65536) {
      header.push(0x80 | 126, (payload.length >> 8) & 255, payload.length & 255);
    } else {
      header.push(0x80 | 127, 0, 0, 0, 0);
      header.push((payload.length >>> 24) & 255, (payload.length >>> 16) & 255, (payload.length >>> 8) & 255, payload.length & 255);
    }
    const masked = Buffer.alloc(payload.length);
    for (let index = 0; index < payload.length; index += 1) masked[index] = payload[index] ^ mask[index % 4];
    socket.write(Buffer.concat([Buffer.from(header), mask, masked]));
  }

}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
