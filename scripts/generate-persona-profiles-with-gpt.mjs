import path from "node:path";
import {
  DATA_DIR,
  GENERATED_DIR,
  PERSONA_PROFILE_FIELDS,
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

const OUTPUT_FILE = path.join(GENERATED_DIR, "persona-profiles.gpt.json");
const ERROR_FILE = "gpt-persona-profile-errors.json";

const PROFILE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: PERSONA_PROFILE_FIELDS,
  properties: {
    profileEpigraph: { type: "string" },
    whoHeIs: { type: "string" },
    lifeArc: { type: "string" },
    whyMatters: { type: "string" },
    styleAndTemperament: { type: "string" },
    howToRead: { type: "string" },
    historicalRelation: { type: "string" },
    relatedPath: { type: "string" }
  }
};

const INSTRUCTIONS = [
  "你是一个文学史、思想史和数字人文项目的中文内容编辑。",
  "请为“文渊舆图”中的人物生成高质量人物介绍。",
  "写作目标：让普通读者在 1 分钟内理解这个人是谁、为什么重要、怎么进入他的作品或思想世界。",
  "语言风格：清楚、优雅、有文学感，但不能空泛。像一位优秀文学史老师在做导览。",
  "避免百科腔、模板腔、营销腔、论文腔。",
  "不要凭空编造具体引用、精确页码、未核实事件或不存在的来源。"
].join("\n");

const FORBIDDEN_PROMPT_TERMS = [
  "公开可核查",
  "较克制的生平说明",
  "后续补充",
  "可以结合……后续理解",
  "文本、概念或叙事方式",
  "具有重要影响",
  "值得关注",
  "提供了新的视角",
  "在某种程度上",
  "相关作品可以进一步阅读",
  "其意义主要体现在"
];

async function main() {
  const args = parseCliArgs();
  const apiKey = requireOpenAIKey();
  if (!apiKey) return;

  const personas = await readJson(path.join(DATA_DIR, "personas.index.json"));
  const details = await readJson(path.join(DATA_DIR, "personas.details.json"), {});
  const generated = await readJson(OUTPUT_FILE, {});
  const errors = [];
  const generatedBefore = generatedEntriesOf(generated).length;

  const idFilter = args.ids.length ? new Set(args.ids) : null;
  const queue = personas
    .filter((persona) => !idFilter || idFilter.has(persona.id))
    .filter((persona) => args.force || !generated[persona.id])
    .slice(0, args.limit);

  if (!queue.length) {
    console.log(`No persona profiles queued. Existing generated profiles: ${generatedBefore}.`);
    return;
  }

  for (let index = 0; index < queue.length; index += 1) {
    const persona = queue[index];
    const detail = details[persona.id] || {};
    try {
      const result = await requestOpenAIJson({
        apiKey,
        model: args.model,
        instructions: INSTRUCTIONS,
        prompt: buildPrompt(persona, detail),
        schema: PROFILE_SCHEMA,
        schemaName: "wenyuan_persona_profile",
        temperature: 0.42
      });
      validateProfile(persona.id, result);
      generated[persona.id] = {
        ...result,
        _meta: {
          source: "openai",
          model: args.model,
          generatedAt: new Date().toISOString()
        }
      };
      await writeJson(OUTPUT_FILE, generated);
      console.log(`[${index + 1}/${queue.length}] generated persona profile: ${persona.id}`);
    } catch (error) {
      errors.push({
        id: persona.id,
        name: persona.displayName || persona.nameZh || persona.nameEn,
        message: error.message
      });
      await writeDebugJson(ERROR_FILE, errors);
      console.warn(`[${index + 1}/${queue.length}] failed persona profile: ${persona.id} - ${error.message}`);
    }
  }

  await writeDebugJson(ERROR_FILE, errors);
  const generatedAfter = generatedEntriesOf(generated).length;
  console.log(`Persona profile generation complete. Generated ${generatedAfter - generatedBefore} new profiles.`);
  if (errors.length) {
    process.exitCode = 1;
    console.warn(`Failures: ${errors.length}. See public/debug/${ERROR_FILE}`);
  }
}

function buildPrompt(persona, detail) {
  const works = [...(persona.works || []), ...(detail.works || []), ...(detail.representativeWorks || [])];
  const keywords = [...(persona.keywords || []), ...(detail.keywords || [])];
  const categories = [...(persona.categoryList || []), persona.category, persona.primaryCategory, detail.category].filter(Boolean);
  const references = [...(detail.references || []), ...(persona.references || [])].slice(0, 4);

  return `请输出严格 JSON，不要在 JSON 外添加解释。

禁止使用这些话术：
${FORBIDDEN_PROMPT_TERMS.map((term) => `- ${term}`).join("\n")}

人物信息：
姓名：${persona.nameZh || detail.nameZh || persona.displayName}
原文名：${persona.nameOriginal || detail.nameOriginal || persona.nameEn || ""}
生卒年：${yearsOf({ ...detail, ...persona })}
出生地：${detail.birthplace || detail.birthPlace || persona.birthPlace || persona.birthCountry || ""}
国家/文化区域：${persona.cultureRegion || detail.cultureRegion || persona.civilizationRegion || ""}
身份：${compactList(categories, 8)}
时代：${persona.era || detail.era || ""}
流派：${persona.school || persona.movement || detail.school || detail.movement || ""}
代表作品：${compactList(works, 10)}
关键词：${compactList(keywords, 10)}
现有摘要：${persona.summary || detail.summary || ""}
现有生平线索：${detail.biography || detail.lifeSummary || ""}
参考链接线索：${compactList(references, 4)}

字段要求：
1. profileEpigraph 不超过 28 个汉字。
2. whoHeIs 120-180 字，介绍这个人是谁。
3. lifeArc 180-260 字，讲他的生平线索，不写流水账。
4. whyMatters 160-240 字，说明他为什么重要。
5. styleAndTemperament 160-240 字，说明写作气质、思想方式或精神特征。
6. howToRead 120-200 字，告诉读者如何开始理解他。
7. historicalRelation 160-240 字，说明他和时代的关系。
8. relatedPath 80-160 字，说明可与哪些人物、作品或思想路径放在一起理解，并给出具体原因。
9. 每段必须有这个人物自己的具体内容。
10. 信息不足时用稳妥表达，不要编造事实。`;
}

function validateProfile(personaId, result) {
  for (const field of PERSONA_PROFILE_FIELDS) {
    if (!String(result?.[field] || "").trim()) {
      throw new Error(`Missing field ${field}`);
    }
  }
  const banned = hasBannedTerm(withoutPrivateMetadata(result));
  if (banned) throw new Error(`Banned phrase found: ${banned}`);
  if (Array.isArray(result.themes)) throw new Error("Persona profile should not include themes.");
  if (result.profileEpigraph.length > 32) throw new Error(`profileEpigraph is too long for ${personaId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
