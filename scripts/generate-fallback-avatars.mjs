import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, "src", "data", "personas.enriched.json");
const AVATAR_DIR = path.join(ROOT, "public", "assets", "avatars");
const CHROME_PORT = 9231;
const BATCH_SIZE = 40;

const personas = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const chromePath = findChrome();
if (!chromePath) {
  console.error("Chrome or Edge is required to export local WebP fallback avatars.");
  process.exit(1);
}

const profileDir = path.join(os.tmpdir(), `codex-shop-avatar-webp-${Date.now()}`);
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    `--remote-debugging-port=${CHROME_PORT}`,
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${profileDir}`,
    "about:blank"
  ],
  { stdio: "ignore", windowsHide: true }
);

try {
  await waitForChrome();
  const target = await cdpJson(`/json/new?about:blank`, { method: "PUT" });
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await once(socket, "open");
  const cdp = createCdp(socket);
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");

  let written = 0;
  for (let index = 0; index < personas.length; index += BATCH_SIZE) {
    const batch = personas.slice(index, index + BATCH_SIZE).map((persona) => ({
      id: persona.id,
      displayName: persona.displayName || persona.name || persona.id,
      category: persona.category || "",
      era: persona.era || "",
      initials: initials(persona)
    }));
    const result = await cdp.evaluate(`(${browserGenerate.toString()})(${JSON.stringify(batch)})`);
    for (const item of result) {
      const filePath = path.join(AVATAR_DIR, `${item.id}.webp`);
      const base64 = String(item.dataUrl).replace(/^data:image\/webp;base64,/, "");
      fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
      written += 1;
    }
  }

  await cdp.send("Browser.close").catch(() => {});
  console.log(`generated ${written} local WebP fallback avatars in public/assets/avatars`);
} finally {
  chrome.kill("SIGKILL");
  setTimeout(() => {
    try {
      fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
    } catch {
      // Chrome can keep cache files locked briefly on Windows; temp cleanup is best effort.
    }
  }, 500);
}

function browserGenerate(items) {
  const results = [];
  for (const item of items) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 256, 256);

    const bg = ctx.createLinearGradient(0, 0, 256, 256);
    bg.addColorStop(0, "#e9dfbf");
    bg.addColorStop(0.34, "#667765");
    bg.addColorStop(0.7, "#173d38");
    bg.addColorStop(1, "#061614");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 256);

    const vignette = ctx.createRadialGradient(128, 104, 30, 128, 128, 156);
    vignette.addColorStop(0, "rgba(255,246,215,.28)");
    vignette.addColorStop(0.54, "rgba(16,52,46,.08)");
    vignette.addColorStop(1, "rgba(0,0,0,.58)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, 256, 256);

    ctx.save();
    ctx.translate(128, 126);
    ctx.rotate(-0.04);
    ctx.fillStyle = "rgba(13, 45, 40, .72)";
    roundRect(ctx, -68, -68, 136, 136, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(189, 130, 61, .86)";
    ctx.lineWidth = 5;
    roundRect(ctx, -64, -64, 128, 128, 15);
    ctx.stroke();
    ctx.strokeStyle = "rgba(151, 35, 28, .64)";
    ctx.lineWidth = 3;
    roundRect(ctx, -44, -44, 88, 88, 8);
    ctx.stroke();

    ctx.fillStyle = "rgba(238, 224, 178, .96)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '700 76px "Songti SC", "STSong", "SimSun", serif';
    ctx.fillText(item.initials || "文", 0, -2, 118);
    ctx.restore();

    ctx.fillStyle = "rgba(245, 235, 199, .72)";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = '600 18px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.fillText(item.displayName || item.id, 128, 220, 196);
    ctx.font = '400 12px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.fillStyle = "rgba(216, 196, 144, .72)";
    ctx.fillText(item.category || item.era || "文渊", 128, 238, 190);

    results.push({ id: item.id, dataUrl: canvas.toDataURL("image/webp", 0.86) });
  }
  return results;

  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }
}

function initials(persona) {
  const text = String(persona.displayName || persona.name || persona.id || "文").trim();
  return Array.from(text.replace(/[^\p{Letter}\p{Number}]/gu, ""))[0] || "文";
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function waitForChrome() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      await cdpJson("/json/version");
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("Timed out waiting for Chrome DevTools.");
}

async function cdpJson(pathname, options) {
  const response = await fetch(`http://127.0.0.1:${CHROME_PORT}${pathname}`, options);
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}`);
  return response.json();
}

function createCdp(socket) {
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
  });
  return {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const requestId = ++id;
        pending.set(requestId, { resolve, reject });
        socket.send(JSON.stringify({ id: requestId, method, params }));
      });
    },
    async evaluate(expression) {
      const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Runtime exception");
      }
      return result.result.value;
    }
  };
}

function once(target, eventName) {
  return new Promise((resolve, reject) => {
    target.addEventListener(eventName, resolve, { once: true });
    target.addEventListener("error", reject, { once: true });
  });
}
