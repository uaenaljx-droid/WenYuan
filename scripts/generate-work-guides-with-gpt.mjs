import path from "node:path";
import {
  DATA_DIR,
  GENERATED_DIR,
  WORK_GUIDE_FIELDS,
  compactList,
  generatedEntriesOf,
  hasBannedTerm,
  parseCliArgs,
  readJson,
  requestOpenAIJson,
  requireOpenAIKey,
  withoutPrivateMetadata,
  writeDebugJson,
  writeJson,
  yearsOf
} from "./gpt-content-utils.mjs";

const OUTPUT_FILE = path.join(GENERATED_DIR, "work-guides.gpt.json");
const ERROR_FILE = "gpt-work-guide-errors.json";

const WORK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: WORK_GUIDE_FIELDS,
  properties: {
    workEpigraph: { type: "string" },
    shortIntro: { type: "string" },
    background: { type: "string" },
    themes: {
      type: "array",
      minItems: 5,
      maxItems: 8,
      items: { type: "string" }
    },
    readingGuide: { type: "string" },
    whyItMatters: { type: "string" },
    personaConnection: { type: "string" },
    furtherReadingPath: { type: "string" }
  }
};

const INSTRUCTIONS = [
  "你是一个面向普通读者的文学与思想作品导读编辑。",
  "请为“文渊舆图”的作品页生成高质量中文导读。",
  "目标：帮助读者理解这部作品是什么、为什么重要、应该从哪里读进去。",
  "语言风格：清楚、优雅、具体，有人文感。",
  "不要写成版权说明、百科摘要或模板化读书笔记。",
  "不要凭空编造版本、页码、引用或未核实出版事实。"
].join("\n");

const FORBIDDEN_PROMPT_TERMS = [
  "版权状态",
  "授权待复核",
  "暂不内嵌正文",
  "后续补充",
  "可结合",
  "相关主题",
  "阅读时可以留意作者如何选择材料",
  "提供了一个视角",
  "具有重要意义"
];

async function main() {
  const args = parseCliArgs();
  const apiKey = requireOpenAIKey();
  if (!apiKey) return;

  const works = await readJson(path.join(DATA_DIR, "works.index.json"));
  const workDetails = await readJson(path.join(DATA_DIR, "works.details.json"), {});
  const personas = await readJson(path.join(DATA_DIR, "personas.index.json"));
  const personaDetails = await readJson(path.join(DATA_DIR, "personas.details.json"), {});
  const personaById = new Map(personas.map((persona) => [persona.id, persona]));
  const generated = await readJson(OUTPUT_FILE, {});
  const errors = [];
  const generatedBefore = generatedEntriesOf(generated).length;

  const idFilter = args.ids.length ? new Set(args.ids) : null;
  const queue = works
    .filter((work) => !idFilter || idFilter.has(work.workId) || idFilter.has(work.id))
    .filter((work) => args.force || !generated[work.workId])
    .slice(0, args.limit);

  if (!queue.length) {
    console.log(`No work guides queued. Existing generated guides: ${generatedBefore}.`);
    return;
  }

  for (let index = 0; index < queue.length; index += 1) {
    const work = queue[index];
    const richWork = workDetails[work.workId] || {};
    const persona = personaById.get(work.personaId) || null;
    const personaDetail = personaDetails[work.personaId] || {};
    try {
      const result = await requestOpenAIJson({
        apiKey,
        model: args.model,
        instructions: INSTRUCTIONS,
        prompt: buildPrompt(work, richWork, persona, personaDetail, personas),
        schema: WORK_SCHEMA,
        schemaName: "wenyuan_work_guide",
        temperature: 0.42
      });
      validateWorkGuide(work.workId, work.title, result);
      generated[work.workId] = {
        ...result,
        _meta: {
          source: "openai",
          model: args.model,
          generatedAt: new Date().toISOString()
        }
      };
      await writeJson(OUTPUT_FILE, generated);
      console.log(`[${index + 1}/${queue.length}] generated work guide: ${work.workId}`);
    } catch (error) {
      errors.push({
        id: work.workId,
        title: work.title,
        personaId: work.personaId,
        message: error.message
      });
      await writeDebugJson(ERROR_FILE, errors);
      console.warn(`[${index + 1}/${queue.length}] failed work guide: ${work.workId} - ${error.message}`);
    }
  }

  await writeDebugJson(ERROR_FILE, errors);
  const generatedAfter = generatedEntriesOf(generated).length;
  console.log(`Work guide generation complete. Generated ${generatedAfter - generatedBefore} new guides.`);
  if (errors.length) {
    process.exitCode = 1;
    console.warn(`Failures: ${errors.length}. See public/debug/${ERROR_FILE}`);
  }
}

function buildPrompt(work, richWork, persona, personaDetail, personas) {
  const mergedWork = { ...work, ...richWork };
  const author = { ...(persona || {}), ...(personaDetail || {}) };
  const relatedNames = (mergedWork.relatedPersonas || [])
    .map((id) => personas.find((item) => item.id === id)?.displayName || id)
    .filter(Boolean);

  return `请输出严格 JSON，不要在 JSON 外添加解释。

禁止使用这些话术：
${FORBIDDEN_PROMPT_TERMS.map((term) => `- ${term}`).join("\n")}

作品信息：
作品名：${mergedWork.title || work.title}
原文名：${mergedWork.originalTitle || ""}
作者：${author.displayName || mergedWork.authorName || work.author || ""}
作者原文名：${author.nameOriginal || author.nameEn || ""}
作者身份：${author.identity || author.category || ""}
作者生卒年：${yearsOf(author)}
作者时代：${author.era || ""}
作者流派：${author.school || author.movement || ""}
时代背景：${mergedWork.era || author.era || ""}
作品类型：${mergedWork.genre || ""}
关键词：${compactList([...(mergedWork.tags || []), ...(mergedWork.themes || []), ...(author.keywords || [])], 10)}
相关人物：${compactList(relatedNames, 8)}
现有作品简介：${mergedWork.shortIntro || mergedWork.summary || ""}
现有阅读提示：${mergedWork.readingGuide || ""}
作者人物摘要：${author.summary || author.whoHeIs || ""}

字段要求：
1. workEpigraph 不超过 30 个汉字。
2. shortIntro 160-240 字，必须具体到这部作品。
3. background 160-260 字，说明作品的时代和思想文学背景。
4. themes 5-8 个关键词。
5. readingGuide 160-240 字，告诉读者从哪里读进去。
6. whyItMatters 160-240 字，说明作品为什么重要。
7. personaConnection 120-200 字，说明作品与作者核心气质的关系。
8. furtherReadingPath 80-160 字，给出具体延伸路径。
9. 不要写版权、授权、缓存、目录或项目说明。
10. 信息不足时用稳妥表达，不要编造事实。`;
}

function validateWorkGuide(workId, title, result) {
  for (const field of WORK_GUIDE_FIELDS) {
    if (field === "themes") {
      if (!Array.isArray(result?.themes) || result.themes.length < 5) throw new Error("themes must contain at least 5 items");
    } else if (!String(result?.[field] || "").trim()) {
      throw new Error(`Missing field ${field}`);
    }
  }
  const banned = hasBannedTerm(withoutPrivateMetadata(result));
  if (banned) throw new Error(`Banned phrase found: ${banned}`);
  if (result.workEpigraph.length > 36) throw new Error(`workEpigraph is too long for ${workId}`);
  const intro = String(result.shortIntro || "");
  const normalizedTitle = normalizeTitle(title);
  if (title && !intro.includes(title.replace(/^《|》$/g, "")) && (!normalizedTitle || !intro.includes(normalizedTitle))) {
    throw new Error("shortIntro does not mention the work title");
  }
}

function normalizeTitle(title) {
  return String(title || "")
    .replace(/^《|》$/g, "")
    .replace(/\s*[\(（][^)）]+[\)）]\s*/g, "")
    .trim();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
