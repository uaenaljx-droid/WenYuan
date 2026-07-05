import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const targetUrl = process.env.PROMO_URL || "http://localhost:5176/";
const framesRoot = path.join(root, "public", "promo", "frames");
const generatedRoot = path.join(root, "public", "promo", "generated");
const sourceGeneratedRoot = path.join(root, "src", "video", "assets", "generated");

const viewport = { width: 1920, height: 1080 };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensureInsideRoot(target) {
  const resolved = path.resolve(target);
  if (!resolved.startsWith(path.resolve(root))) {
    throw new Error(`Refusing to write outside project root: ${resolved}`);
  }
  return resolved;
}

async function resetDir(dir) {
  const resolved = await ensureInsideRoot(dir);
  await fs.rm(resolved, { recursive: true, force: true });
  await fs.mkdir(resolved, { recursive: true });
}

async function copyGeneratedAssets() {
  await fs.mkdir(generatedRoot, { recursive: true });
  const files = await fs.readdir(sourceGeneratedRoot);
  await Promise.all(
    files
      .filter((file) => /\.(png|jpg|webp)$/i.test(file))
      .map((file) => fs.copyFile(path.join(sourceGeneratedRoot, file), path.join(generatedRoot, file)))
  );
}

async function launchBrowser() {
  const executableCandidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);

  for (const executablePath of executableCandidates) {
    try {
      await fs.access(executablePath);
      return chromium.launch({
        executablePath,
        headless: true,
        args: ["--hide-scrollbars", "--autoplay-policy=no-user-gesture-required", "--use-angle=default", "--enable-webgl"],
      });
    } catch {
      // Try the next candidate.
    }
  }

  for (const channel of ["msedge", "chrome"]) {
    try {
      return await chromium.launch({
        channel,
        headless: true,
        args: ["--hide-scrollbars", "--autoplay-policy=no-user-gesture-required", "--use-angle=default", "--enable-webgl"],
      });
    } catch {
      // Fall through to bundled browser.
    }
  }

  return chromium.launch({
    headless: true,
    args: ["--hide-scrollbars", "--autoplay-policy=no-user-gesture-required", "--use-angle=default", "--enable-webgl"],
  });
}

async function waitForReady(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector("#enterButton", { timeout: 60000 });
  await page.waitForFunction(() => {
    const button = document.querySelector("#enterButton");
    return button && !button.disabled;
  }, { timeout: 90000 });
  await page.evaluate(() => document.fonts?.ready);
  await sleep(900);
}

async function waitForEarth(page) {
  await page.waitForFunction(() => document.body.classList.contains("is-entered"), { timeout: 60000 });
  await page.waitForSelector(".person-card", { timeout: 60000 });
  await page.waitForSelector(".earth-avatar-marker-anchor.is-visible", { timeout: 60000 }).catch(() => null);
  await sleep(1700);
}

async function waitForProfileHydrated(page) {
  await page.waitForFunction(() => {
    const text = (selector) => document.querySelector(selector)?.textContent?.trim() || "";
    const birthplace = text("#profileBirthplace");
    const school = text("#profileSchool");
    const bio = text("#profileBio");
    return (
      birthplace &&
      school &&
      bio &&
      !/档案调阅中|文脉归档中|人物生平正在展开|资料未详/.test(`${birthplace} ${school} ${bio}`)
    );
  }, { timeout: 30000 });
  await sleep(500);
}

async function waitForWorkHydrated(page) {
  await page.waitForFunction(() => {
    const summary = document.querySelector("#workSummary")?.textContent?.trim() || "";
    const body = document.querySelector("#workBody")?.textContent?.trim() || "";
    return summary.length > 20 && body.length > 120 && !/正在入卷|资料未详/.test(`${summary} ${body}`);
  }, { timeout: 30000 });
  await sleep(500);
}

async function screenshot(page, sceneDir, name) {
  await page.screenshot({ path: path.join(sceneDir, name), type: "png" });
}

async function captureSequence(page, sceneName, count = 6, intervalMs = 450) {
  const sceneDir = path.join(framesRoot, sceneName);
  await fs.mkdir(sceneDir, { recursive: true });
  await screenshot(page, sceneDir, "poster.png");
  for (let i = 0; i < count; i += 1) {
    if (i > 0) await sleep(intervalMs);
    await screenshot(page, sceneDir, `frame-${String(i).padStart(3, "0")}.png`);
  }
  return sceneDir;
}

async function clickFirstVisible(page, selector, options = {}) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: "visible", timeout: options.timeout || 12000 });
  await locator.click({ timeout: options.timeout || 12000 });
}

async function main() {
  await resetDir(framesRoot);
  await copyGeneratedAssets();

  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.setDefaultTimeout(20000);

  try {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    await waitForReady(page);

    await captureSequence(page, "scene-01-home", 4, 450);

    const enterSceneDir = path.join(framesRoot, "scene-02-enter");
    await fs.mkdir(enterSceneDir, { recursive: true });
    await screenshot(page, enterSceneDir, "poster.png");
    await page.locator("#enterButton").click();
    await sleep(450);
    await screenshot(page, path.join(framesRoot, "scene-02-enter"), "frame-001-loading.png");
    await waitForEarth(page);
    await screenshot(page, path.join(framesRoot, "scene-02-enter"), "frame-002-earth.png");

    const marker = page.locator(".earth-avatar-marker-anchor.is-visible").first();
    if (await marker.count()) {
      await marker.hover({ timeout: 5000 }).catch(() => null);
      await sleep(500);
    }
    await captureSequence(page, "scene-03-earth-tour", 10, 720);

    const filterButtons = page.locator("#filterBar button[data-category]");
    if ((await filterButtons.count()) > 1) {
      await filterButtons.nth(1).click();
      await sleep(1800);
    }
    await page.locator("#searchInput").fill("鲁迅");
    await sleep(1200);
    await page.keyboard.press("Enter").catch(() => null);
    await sleep(1600);
    await captureSequence(page, "scene-04-filter-search", 6, 520);

    await clickFirstVisible(page, ".person-card");
    await page.waitForSelector("#profileModal:not([hidden])", { timeout: 20000 });
    await waitForProfileHydrated(page);
    await captureSequence(page, "scene-05-profile", 5, 520);

    const fullTextWork = page.locator(".work-chip.has-full-text").first();
    if ((await fullTextWork.count()) > 0) {
      await fullTextWork.click();
    } else {
      await page.locator(".work-chip").first().click();
    }
    await page.waitForSelector("#workReader:not([hidden])", { timeout: 20000 });
    await waitForWorkHydrated(page);
    await captureSequence(page, "scene-06-work-guide", 4, 500);
    await page.locator(".work-body").evaluate((node) => node.scrollTo({ top: node.scrollHeight * 0.38, behavior: "instant" })).catch(() => null);
    await sleep(600);
    await screenshot(page, path.join(framesRoot, "scene-06-work-guide"), "frame-005-scrolled.png");

    await page.keyboard.press("Escape").catch(() => null);
    await sleep(250);
    await page.keyboard.press("Escape").catch(() => null);
    await sleep(600);
    await page.locator("#autoButton").click().catch(() => null);
    await sleep(1000);
    await captureSequence(page, "scene-07-finale-earth", 5, 520);

    console.log(`Captured promo frames in ${path.relative(root, framesRoot)}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
