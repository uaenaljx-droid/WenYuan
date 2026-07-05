import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
export const DATA_DIR = path.join(ROOT_DIR, "src", "data");
export const GENERATED_DIR = path.join(DATA_DIR, "generated");
export const DEBUG_DIR = path.join(ROOT_DIR, "public", "debug");

export const PERSONA_PROFILE_FIELDS = [
  "profileEpigraph",
  "whoHeIs",
  "lifeArc",
  "whyMatters",
  "styleAndTemperament",
  "howToRead",
  "historicalRelation",
  "relatedPath"
];

export const WORK_GUIDE_FIELDS = [
  "workEpigraph",
  "shortIntro",
  "background",
  "themes",
  "readingGuide",
  "whyItMatters",
  "personaConnection",
  "furtherReadingPath"
];

export const BANNED_CONTENT_TERMS = [
  "公开可核查",
  "较克制",
  "后续补充",
  "待补充",
  "暂未",
  "可以结合",
  "其意义主要体现在",
  "文本、概念或叙事方式",
  "具有重要影响",
  "提供了新的视角",
  "值得关注",
  "相关主题",
  "阅读时可以留意作者如何选择材料",
  "安排叙事节奏",
  "事实、评价与文学表达之间",
  "版权状态",
  "授权待复核",
  "暂不内嵌正文",
  "GitHub",
  "skill",
  "AI Agent"
];

export function parseCliArgs(argv = process.argv.slice(2)) {
  const args = {
    ids: [],
    limit: Infinity,
    force: false,
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--force") {
      args.force = true;
    } else if (arg === "--id") {
      args.ids.push(...String(argv[index + 1] || "").split(",").filter(Boolean));
      index += 1;
    } else if (arg.startsWith("--id=")) {
      args.ids.push(...arg.slice("--id=".length).split(",").filter(Boolean));
    } else if (arg === "--limit") {
      args.limit = Number.parseInt(argv[index + 1] || "", 10);
      index += 1;
    } else if (arg.startsWith("--limit=")) {
      args.limit = Number.parseInt(arg.slice("--limit=".length), 10);
    } else if (arg === "--model") {
      args.model = argv[index + 1] || args.model;
      index += 1;
    } else if (arg.startsWith("--model=")) {
      args.model = arg.slice("--model=".length) || args.model;
    }
  }

  if (!Number.isFinite(args.limit) || args.limit <= 0) args.limit = Infinity;
  args.ids = Array.from(new Set(args.ids.map((id) => id.trim()).filter(Boolean)));
  return args;
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function readJson(filePath, fallback = null) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return JSON.parse(text);
  } catch (error) {
    if (error.code === "ENOENT" && fallback !== null) return fallback;
    throw error;
  }
}

export async function writeJson(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function writeDebugJson(fileName, data) {
  const filePath = path.join(DEBUG_DIR, fileName);
  await writeJson(filePath, data);
  return filePath;
}

export function requireOpenAIKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    const message =
      "OPENAI_API_KEY is required. No GPT content was generated, and no placeholder content was written.";
    console.error(message);
    process.exitCode = 1;
    return "";
  }
  return key;
}

export async function requestOpenAIJson({ apiKey, model, instructions, prompt, schema, schemaName, temperature = 0.45 }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      instructions,
      input: prompt,
      temperature,
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema
        }
      }
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || response.statusText;
    throw new Error(`OpenAI request failed (${response.status}): ${message}`);
  }

  const text =
    payload?.output_text ||
    payload?.output
      ?.flatMap((item) => item.content || [])
      .map((item) => item.text || "")
      .join("") ||
    "";
  if (!text.trim()) throw new Error("OpenAI response did not include JSON text.");
  return JSON.parse(text);
}

export function compactList(values = [], limit = 8) {
  return Array.from(new Set(values.filter(Boolean))).slice(0, limit).join("、") || "待辨认";
}

export function yearsOf(persona) {
  const birth = persona?.birthYear ?? persona?.birth_year;
  const death = persona?.deathYear ?? persona?.death_year;
  if (birth == null && death == null) return "年代待辨认";
  if (death == null) return `${birth}年生`;
  return `${birth}年-${death}年`;
}

export function hasBannedTerm(value) {
  const text = stringifyForAudit(value);
  return BANNED_CONTENT_TERMS.find((term) => text.includes(term)) || "";
}

export function charCount(value) {
  return Array.from(String(value || "").replace(/\s+/g, "")).length;
}

export function stringifyForAudit(value) {
  if (Array.isArray(value)) return value.join("\n");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value || "");
}

export function withoutPrivateMetadata(entry = {}) {
  return Object.fromEntries(Object.entries(entry).filter(([key]) => !key.startsWith("_")));
}

export function generatedEntriesOf(data = {}) {
  return Object.entries(data).filter(([id, value]) => !id.startsWith("_") && value && typeof value === "object");
}
