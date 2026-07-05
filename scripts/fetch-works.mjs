import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PERSONAS_PATH = path.join(ROOT, "src", "data", "personas.enriched.json");
const CATALOG_PATH = path.join(ROOT, "src", "data", "works-catalog.json");
const CONTENT_DIR = path.join(ROOT, "public", "data", "works-content");

const PROTECTED_PERSONA_IDS = new Set([
  "qian-zhongshu",
  "wang-xiaobo",
  "foucault",
  "derrida",
  "roland-barthes",
  "calvino",
  "gabriel-garcia-marquez",
  "kawabata"
]);

const OPEN_SOURCE_WORKS = {
  "su-shi::赤壁赋": {
    sourceName: "Wikisource",
    sourceUrl: "https://zh.wikisource.org/wiki/前赤壁賦",
    license: "Public domain classical Chinese text",
    language: "zh-classical",
    fallback: [
      {
        heading: "前赤壁赋",
        text:
          "壬戌之秋，七月既望，苏子与客泛舟游于赤壁之下。清风徐来，水波不兴。举酒属客，诵明月之诗，歌窈窕之章。少焉，月出于东山之上，徘徊于斗牛之间。白露横江，水光接天。纵一苇之所如，凌万顷之茫然。浩浩乎如冯虚御风，而不知其所止；飘飘乎如遗世独立，羽化而登仙。\n\n于是饮酒乐甚，扣舷而歌之。歌曰：“桂棹兮兰桨，击空明兮溯流光。渺渺兮予怀，望美人兮天一方。”客有吹洞箫者，倚歌而和之，其声呜呜然，如怨如慕，如泣如诉，余音袅袅，不绝如缕。舞幽壑之潜蛟，泣孤舟之嫠妇。\n\n苏子愀然，正襟危坐而问客曰：“何为其然也？”客曰：“月明星稀，乌鹊南飞。此非曹孟德之诗乎？西望夏口，东望武昌，山川相缪，郁乎苍苍，此非孟德之困于周郎者乎？方其破荆州，下江陵，顺流而东也，舳舻千里，旌旗蔽空，酾酒临江，横槊赋诗，固一世之雄也，而今安在哉？况吾与子渔樵于江渚之上，侣鱼虾而友麋鹿，驾一叶之扁舟，举匏樽以相属。寄蜉蝣于天地，渺沧海之一粟。哀吾生之须臾，羡长江之无穷。挟飞仙以遨游，抱明月而长终。知不可乎骤得，托遗响于悲风。”\n\n苏子曰：“客亦知夫水与月乎？逝者如斯，而未尝往也；盈虚者如彼，而卒莫消长也。盖将自其变者而观之，则天地曾不能以一瞬；自其不变者而观之，则物与我皆无尽也，而又何羡乎！且夫天地之间，物各有主，苟非吾之所有，虽一毫而莫取。惟江上之清风，与山间之明月，耳得之而为声，目遇之而成色，取之无禁，用之不竭，是造物者之无尽藏也，而吾与子之所共适。”\n\n客喜而笑，洗盏更酌。肴核既尽，杯盘狼籍。相与枕藉乎舟中，不知东方之既白。"
      },
      {
        heading: "今译",
        kind: "commentary",
        text:
          "壬戌年秋天，七月十六日，苏轼和朋友乘船来到赤壁之下。江风缓缓吹来，水面平静无波。他们举杯劝酒，吟诵写明月的诗章。过了一会儿，月亮从东山升起，徘徊在斗宿和牛宿之间；白茫茫的雾气横在江面，水光与天色相接。小船任意漂流在辽阔江面上，仿佛凌空乘风，不知将停在何处；又仿佛离开尘世，羽化登仙。\n\n客人因曹操、周瑜旧事而感叹英雄已逝、人生短促。苏轼却以江水与明月作答：从变化看，天地万物片刻不停；从不变看，万物与我也并没有穷尽。人不必执着于不可占有之物，江上清风、山间明月才是取用无尽的共同宝藏。"
      },
      {
        heading: "解读",
        kind: "commentary",
        text:
          "《赤壁赋》把一次夜游写成精神上的转身：先有江月清景，再有箫声触发的历史悲感，最后抵达旷达的生命观。苏轼没有否认短暂和失意，而是把它们放回更大的时间与自然之中。所谓“清风明月”，不是逃避现实，而是在困顿里重新找到可共享、不可剥夺的自由。"
      }
    ]
  },
  "su-shi::念奴娇·赤壁怀古": {
    sourceName: "Wikisource",
    sourceUrl: "https://zh.wikisource.org/wiki/念奴嬌·赤壁懷古",
    license: "Public domain classical Chinese text",
    language: "zh-classical",
    fallback: [
      {
        heading: "念奴娇·赤壁怀古",
        text:
          "大江东去，浪淘尽，千古风流人物。故垒西边，人道是，三国周郎赤壁。乱石穿空，惊涛拍岸，卷起千堆雪。江山如画，一时多少豪杰。\n\n遥想公瑾当年，小乔初嫁了，雄姿英发。羽扇纶巾，谈笑间，樯橹灰飞烟灭。故国神游，多情应笑我，早生华发。人生如梦，一尊还酹江月。"
      },
      {
        heading: "今译",
        kind: "commentary",
        text:
          "长江滚滚东流，浪涛淘尽千古英雄。旧营垒的西边，人们说那里就是三国时周瑜大破曹军的赤壁。乱石高耸入云，惊涛拍击江岸，卷起雪白浪花；江山如画，一时涌现多少豪杰。\n\n遥想周瑜当年，小乔刚嫁给他，他姿态英俊、风采勃发，手执羽扇、头戴纶巾，在谈笑之间就让曹军战船化作灰烬。我今日神游旧地，多情的人应笑我早生白发。人生如梦，且把一杯酒洒向江月。"
      },
      {
        heading: "解读",
        kind: "commentary",
        text:
          "这首词不只是豪放怀古，也有自我安放。上片写江山与英雄，气势开阔；下片把周瑜的青春功业与自己的贬谪迟暮相照。结尾“一尊还酹江月”并非消沉，而是把个人得失交还给江月，在历史长河里保留人的尊严和清醒。"
      }
    ]
  },
  "su-shi::水调歌头·明月几时有": {
    sourceName: "Wikisource",
    sourceUrl: "https://zh.wikisource.org/wiki/水調歌頭",
    license: "Public domain classical Chinese text",
    language: "zh-classical",
    fallback: [
      {
        heading: "水调歌头·明月几时有",
        text:
          "丙辰中秋，欢饮达旦，大醉，作此篇，兼怀子由。\n\n明月几时有？把酒问青天。不知天上宫阙，今夕是何年。我欲乘风归去，又恐琼楼玉宇，高处不胜寒。起舞弄清影，何似在人间。\n\n转朱阁，低绮户，照无眠。不应有恨，何事长向别时圆？人有悲欢离合，月有阴晴圆缺，此事古难全。但愿人长久，千里共婵娟。"
      },
      {
        heading: "今译",
        kind: "commentary",
        text:
          "丙辰年中秋，苏轼通宵饮酒，大醉后写下这首词，同时怀念弟弟子由。\n\n明月从什么时候开始存在？我举杯向青天发问。不知道天上的宫殿，今晚又是哪一年。我想乘风回到天上，又担心玉楼琼宇太高太冷。起身舞动，看清影相随，还是人间更亲近。\n\n月光转过朱红楼阁，低照雕花窗户，也照着无眠的人。明月不该有怨恨，为什么偏在人离别时圆满？人的悲欢离合，月的阴晴圆缺，自古难以两全。只愿人能长久平安，即使相隔千里，也能共赏这一轮明月。"
      },
      {
        heading: "解读",
        kind: "commentary",
        text:
          "这首词从问天开始，最后落回人间。苏轼把离别之苦推到宇宙尺度里审视，于是伤感没有消失，却变得明净宽广。“但愿人长久”不是廉价安慰，而是人在无常中仍愿意祝福他人的深情。"
      }
    ]
  },
  "laozi::道德经": {
    sourceName: "Chinese Text Project",
    sourceUrl: "https://ctext.org/dao-de-jing/zh",
    license: "Public domain classical Chinese text",
    language: "zh-classical",
    fallback: [
      {
        heading: "第一章",
        text: "道可道，非常道；名可名，非常名。无名天地之始；有名万物之母。故常无欲，以观其妙；常有欲，以观其徼。此两者，同出而异名，同谓之玄。玄之又玄，众妙之门。"
      },
      {
        heading: "第二章",
        text: "天下皆知美之为美，斯恶已；皆知善之为善，斯不善已。有无相生，难易相成，长短相形，高下相倾，音声相和，前后相随。"
      }
    ]
  },
  "confucius::论语": {
    sourceName: "Chinese Text Project",
    sourceUrl: "https://ctext.org/analects/zh",
    license: "Public domain classical Chinese text",
    language: "zh-classical",
    fallback: [
      {
        heading: "学而",
        text: "子曰：“学而时习之，不亦说乎？有朋自远方来，不亦乐乎？人不知而不愠，不亦君子乎？”\n\n有子曰：“其为人也孝弟，而好犯上者，鲜矣；不好犯上，而好作乱者，未之有也。君子务本，本立而道生。孝弟也者，其为仁之本与！”"
      }
    ]
  },
  "shakespeare::哈姆雷特": {
    sourceName: "Project Gutenberg",
    sourceUrl: "https://www.gutenberg.org/ebooks/1524",
    textUrl: "https://www.gutenberg.org/cache/epub/1524/pg1524.txt",
    license: "Project Gutenberg public domain text",
    language: "en"
  },
  "shakespeare::麦克白": {
    sourceName: "Project Gutenberg",
    sourceUrl: "https://www.gutenberg.org/ebooks/1533",
    textUrl: "https://www.gutenberg.org/cache/epub/1533/pg1533.txt",
    license: "Project Gutenberg public domain text",
    language: "en"
  },
  "shakespeare::李尔王": {
    sourceName: "Project Gutenberg",
    sourceUrl: "https://www.gutenberg.org/ebooks/1532",
    textUrl: "https://www.gutenberg.org/cache/epub/1532/pg1532.txt",
    license: "Project Gutenberg public domain text",
    language: "en"
  },
  "shakespeare::罗密欧与朱丽叶": {
    sourceName: "Project Gutenberg",
    sourceUrl: "https://www.gutenberg.org/ebooks/1513",
    textUrl: "https://www.gutenberg.org/cache/epub/1513/pg1513.txt",
    license: "Project Gutenberg public domain text",
    language: "en"
  },
  "goethe::浮士德": {
    sourceName: "Project Gutenberg",
    sourceUrl: "https://www.gutenberg.org/ebooks/14591",
    textUrl: "https://www.gutenberg.org/cache/epub/14591/pg14591.txt",
    license: "Project Gutenberg public domain text",
    language: "en"
  },
  "tolstoy::战争与和平": {
    sourceName: "Project Gutenberg",
    sourceUrl: "https://www.gutenberg.org/ebooks/2600",
    textUrl: "https://www.gutenberg.org/cache/epub/2600/pg2600.txt",
    license: "Project Gutenberg public domain text",
    language: "en"
  },
  "tolstoy::安娜·卡列尼娜": {
    sourceName: "Project Gutenberg",
    sourceUrl: "https://www.gutenberg.org/ebooks/1399",
    textUrl: "https://www.gutenberg.org/cache/epub/1399/pg1399.txt",
    license: "Project Gutenberg public domain text",
    language: "en"
  }
};

const PROTECTED_WORK_OVERRIDES = {
  "qian-zhongshu::围城": {
    sourceName: "Wikipedia",
    sourceUrl: "https://zh.wikipedia.org/wiki/围城",
    summary: "一座以婚姻、学历、社交和知识分子自尊搭成的精神城池，城外的人想进去，城里的人想出来。",
    excerpt: "思想总结：小说借方鸿渐的漂泊与婚恋，写现代知识分子的虚荣、窘迫和自我讽刺。它的锋利不在情节奇观，而在看穿人如何被体面、话术和欲望困住。"
  },
  "wang-xiaobo::黄金时代": {
    sourceName: "Wikipedia",
    sourceUrl: "https://zh.wikipedia.org/wiki/黄金时代_(小说)",
    summary: "在荒诞年代里，一个人仍试图保存身体、理性和爱的自由；笑声之下，是对权力叙事的冷静拆解。",
    excerpt: "思想总结：作品以反讽和黑色幽默处理个人记忆、欲望与时代规训。它不把苦难写成姿态，而让人的诚实、荒唐和自由意志在压抑环境中显影。"
  },
  "gabriel-garcia-marquez::百年孤独": {
    sourceName: "Wikipedia",
    sourceUrl: "https://zh.wikipedia.org/wiki/百年孤独",
    summary: "一座座城市像记忆、欲望和语言的剖面，旅行者讲述的其实是人如何想象世界。",
    excerpt: "思想总结：作品以短章和寓言结构讨论城市、记忆、符号和观看方式。它不追求传统情节，而让每座城市成为一种心灵模型。"
  },
  "calvino::看不见的城市": {
    sourceName: "Wikipedia",
    sourceUrl: "https://zh.wikipedia.org/wiki/看不见的城市",
    summary: "马孔多家族的兴衰像一场循环的梦，孤独、权力、欲望和历史在热带雨林中反复回声。",
    excerpt: "思想总结：作品以魔幻现实主义书写家族史与拉丁美洲历史创伤。它关心的不只是传奇，而是记忆如何被重复、误读，并最终吞没人的命运。"
  }
};

const personas = JSON.parse(fs.readFileSync(PERSONAS_PATH, "utf8"));
fs.mkdirSync(CONTENT_DIR, { recursive: true });

const catalog = [];
for (const persona of personas) {
  for (const title of persona.works || []) {
    const key = `${persona.id}::${title}`;
    const id = stableWorkId(persona.id, title);
    const open = OPEN_SOURCE_WORKS[key];
    const protectedOverride = PROTECTED_WORK_OVERRIDES[key];
    const protectedWork = protectedOverride || PROTECTED_PERSONA_IDS.has(persona.id);

    if (open) {
      const contentPath = `data/works-content/${id}.json`;
      const content = await getOpenContent(id, title, persona, open);
      fs.writeFileSync(path.join(ROOT, "public", contentPath), JSON.stringify(content, null, 2) + "\n", "utf8");
      catalog.push({
        workId: id,
        personaId: persona.id,
        title,
        author: persona.displayName,
        copyrightStatus: open.license.includes("public domain") || open.license.includes("Public domain") ? "public-domain" : "open-license",
        availability: "embedded-full-text",
        contentPath,
        sourceUrl: open.sourceUrl,
        sourceName: open.sourceName,
        license: open.license,
        language: open.language || "zh",
        summary: openWorkIntro(persona, title, open),
        excerpt: makeExcerpt(content.sections.map((section) => section.text).join("\n"))
      });
      await wait(300);
      continue;
    }

    catalog.push({
      workId: id,
      personaId: persona.id,
      title,
      author: persona.displayName,
      copyrightStatus: protectedWork ? "protected" : "unknown",
      availability: protectedWork ? "external-link" : "summary-only",
      contentPath: null,
      sourceUrl: protectedOverride?.sourceUrl || sourceForTitle(title),
      sourceName: protectedOverride?.sourceName || "Reference lookup",
      license: protectedWork ? "Copyright protected or version rights need review." : "Copyright status needs review.",
      language: guessLanguage(title),
      summary: protectedOverride?.summary || `${title} 先以导读方式呈现，围绕作者、时代处境与主题线索建立阅读入口。`,
      excerpt: protectedOverride?.excerpt || genericProtectedInsight(persona, title, protectedWork)
    });
  }
}

fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n", "utf8");
console.log(`works-catalog: ${catalog.length} entries`);
console.log(`embedded full text: ${catalog.filter((item) => item.availability === "embedded-full-text").length}`);

async function getOpenContent(id, title, persona, source) {
  let fetched = null;
  if (source.textUrl) {
    fetched = await fetchPlainText(source.textUrl);
  }
  const sections = fetched ? sectionsFromPlainText(fetched) : source.fallback;
  if (!sections?.length) throw new Error(`No content available for ${id}`);
  return {
    workId: id,
    title,
    author: persona.displayName,
    sourceUrl: source.sourceUrl,
    sourceName: source.sourceName,
    license: source.license,
    language: source.language || guessLanguage(title),
    fetchedAt: new Date().toISOString(),
    sections
  };
}

async function fetchPlainText(url) {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "PersonaAtlasWorkFetcher/1.0" }
    });
    if (!response.ok) return null;
    const text = await response.text();
    const cleaned = trimGutenberg(text);
    return cleaned.length > 500 ? cleaned : null;
  } catch {
    return null;
  }
}

function trimGutenberg(text) {
  const startMatch = text.match(/\*\*\* START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\n/i);
  const endMatch = text.match(/\*\*\* END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i);
  const start = startMatch ? startMatch.index + startMatch[0].length : 0;
  const end = endMatch ? endMatch.index : text.length;
  return text.slice(start, end).replace(/\r/g, "").trim();
}

function sectionsFromPlainText(text) {
  const chunks = [];
  const lines = text.split("\n");
  let currentHeading = "Full Text";
  let buffer = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const headingLike =
      /^(ACT|SCENE|CHAPTER|BOOK|PART)\b[\s\w\dIVXLCDM.,:-]*$/i.test(trimmed) ||
      /^第.+[章节回]$/.test(trimmed);
    if (headingLike && buffer.join("\n").trim().length > 400) {
      chunks.push({ heading: currentHeading, text: buffer.join("\n").trim() });
      currentHeading = trimmed;
      buffer = [];
      continue;
    }
    if (trimmed || buffer.length) buffer.push(line);
  }
  if (buffer.join("\n").trim()) chunks.push({ heading: currentHeading, text: buffer.join("\n").trim() });

  if (chunks.length === 0) return [{ heading: "Full Text", text }];
  return chunks.slice(0, 240);
}

function makeExcerpt(text) {
  return Array.from(text.replace(/\s+/g, " ").trim()).slice(0, 96).join("");
}

function openWorkIntro(persona, title, source) {
  const key = `${persona.id}::${title}`;
  const special = {
    "su-shi::赤壁赋": "一夜江月，一叶扁舟，把贬谪中的伤感化成清风明月之间的旷达。",
    "su-shi::念奴娇·赤壁怀古": "借赤壁风涛追想周郎，也照见词人自身的迟暮、豪情与清醒。",
    "su-shi::水调歌头·明月几时有": "从问月到怀人，把离别之苦写成千里共照的温柔祝愿。",
    "confucius::论语": "一部由言行片段组成的精神书卷，保存了礼、仁、学与君子人格的源头。",
    "laozi::道德经": "短章如深井，以道、无为和反身之智打开中国思想最幽微的水脉。",
    "goethe::浮士德": "一个不肯停下追问的人，与知识、欲望、救赎和行动不断订立契约。",
    "tolstoy::战争与和平": "宏阔历史与私人命运交织，战争、家庭和精神觉醒共同构成时代长卷。",
    "tolstoy::安娜·卡列尼娜": "爱情、婚姻、社会凝视与个人渴望互相撕扯，照出十九世纪心灵秩序的裂缝。"
  }[key];
  if (special) return special;
  return `${title} 是 ${persona.displayName} 的代表作品；当前条目采用 ${source.sourceName} 的公开文本，适合在原文中慢读其语言节奏和思想纹理。`;
}

function genericProtectedInsight(persona, title, protectedWork) {
  if (protectedWork) {
    return `思想总结：${title} 可从人物生平、时代处境和作品主题入手，关注其中关于自由、孤独、权力、欲望或语言的精神线索。`;
  }
  return `阅读提示：阅读 ${title} 时，可先把握人物时代和思想脉络，再结合可靠出版物、图书馆目录或来源链接继续深入。`;
}

function stableWorkId(personaId, title) {
  return `${personaId}-${slug(title)}`;
}

function slug(value) {
  const ascii = String(value)
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  if (ascii) return ascii;
  return Array.from(String(value))
    .map((char) => char.codePointAt(0).toString(36))
    .join("-");
}

function sourceForTitle(title) {
  return `https://www.wikidata.org/w/index.php?search=${encodeURIComponent(title)}`;
}

function guessLanguage(title) {
  return /[\u4e00-\u9fff]/.test(title) ? "zh" : "en";
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
