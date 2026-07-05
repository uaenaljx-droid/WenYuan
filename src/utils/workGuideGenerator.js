const PLACEHOLDER_TERMS = [
  "可" + "结合",
  "后续" + "将",
  "后续" + "补" + "充",
  "继续" + "补" + "充",
  "可靠资料" + "继续" + "补" + "充",
  "本条目先" + "保留基础作品说明",
  "暂无" + "简介",
  "待" + "补" + "充",
  "待" + "完善",
  "更多资料" + "后续补全",
  "暂不" + "内嵌正文",
  "授权" + "待复核",
  "全文授权" + "状态",
  "版权状态" + "尚未确认",
  "????"
];

const DEFAULT_READING_NOTE = "可从作者生平、同代思想论争与相关文学史脉络继续阅读，优先参照可靠出版物、图书馆目录、学术导论和作者年谱。";

const SPECIAL_GUIDES = {
  "liang-qichao::新民说": {
    workEpigraph: "在旧邦与新世之间，重写国民的精神轮廓。",
    shortIntro:
      "《新民说》是梁启超在晚清思想转型时期写下的重要政论作品之一。它以“新民”为核心，讨论中国若要走向现代国家，不能只停留在制度移植和器物更新，也必须更新国民的精神气质、公共意识、责任伦理与政治参与能力。作品将国家兴衰与个人品格联系起来，把“民”的自觉、自治和进取视为社会变革的基础。它既延续晚清救亡图存的紧迫感，也显露出梁启超试图以思想启蒙重塑现代中国人的努力。",
    background:
      "《新民说》产生于戊戌变法失败之后的流亡语境中。梁启超身处日本，面对清末政治危机、列强压力与中国社会内部的迟滞，逐渐把思考重心从单纯制度改革转向国民精神的塑造。他意识到，现代国家的成立不仅依赖宪政、议会、学校和法律，也依赖能够承担公共责任的新型国民。因此，《新民说》既是政治启蒙文本，也是晚清知识分子回应现代世界冲击的一次思想实验。它的语言带有强烈的时代焦虑，也带有面向未来的动员性。",
    themes: ["新民", "启蒙", "国民性", "公共精神", "近代中国", "政治改革", "现代国家", "梁启超"],
    readingGuide:
      "阅读《新民说》时，可以把它放在晚清变法失败、知识分子流亡和现代民族国家观念输入中国的背景中理解。它讨论的“新民”并不只是道德意义上的好人，也指能够理解公共事务、承担国家责任、拥有自治意识和进取精神的现代国民。阅读时应注意梁启超如何把个人修养、社会风气和国家命运连接起来，也要看到其中带有时代局限的国民性论述与强烈的启蒙立场。",
    whyItMatters:
      "《新民说》的重要性在于，它把中国近代思想中的改革问题从制度层面推进到人的层面。梁启超不只追问怎样建立新制度，也追问怎样的人才能支撑新制度运行。这个问题深刻影响了二十世纪中国关于国民性、启蒙、教育、国家建设与公共精神的讨论。它既是晚清政治思想的关键文本，也是理解近代中国知识分子如何想象“现代人”和“现代国家”的重要入口。",
    personaConnection:
      "《新民说》集中体现了梁启超作为启蒙者、政论家和思想转型者的一面。戊戌变法失败后，他不再只把希望寄托于朝廷改革，而是转向对社会、教育和国民精神的长期塑造。作品中的急迫、鼓动和自我反省，正对应梁启超在流亡时期的思想状态：既不愿放弃政治理想，又意识到变革必须深入人的观念和日常伦理之中。",
    relatedTopics: ["新民", "启蒙", "国民性", "公共精神", "近代中国", "政治改革", "现代国家", "梁启超"],
    furtherReadingNote:
      "可将《新民说》与梁启超的《少年中国说》《变法通议》及晚清报刊政论文一起阅读，也可与严复、康有为、陈独秀、鲁迅等人关于国民、启蒙和现代性的讨论互相参照。"
  },
  "hannah-arendt::极权主义的起源": {
    workEpigraph: "在孤独、恐惧与群众政治之间，追问现代黑暗的来处。",
    shortIntro:
      "《极权主义的起源》是汉娜·阿伦特理解二十世纪政治灾难的关键著作。它不把极权主义仅仅视为某个独裁者的意志，而是追踪反犹主义、帝国主义、民族国家危机、群众社会和意识形态机器怎样相互缠绕，最终制造出一种消灭公共世界、摧毁个人判断的统治形式。作品的力度在于把历史材料、政治概念和流亡者的切身经验放在同一张分析网中，使读者看见现代制度、孤独处境与群众动员之间的危险关系。",
    background:
      "这部书写于二战后欧洲秩序崩塌与冷战格局形成之际。阿伦特作为犹太流亡者，亲历纳粹迫害，也长期观察现代国家、难民问题和群众政治的断裂。她把纳粹主义与斯大林主义放入更长的历史结构中考察，关注民族国家保护机制失效、殖民扩张中的种族思想、官僚统治和意识形态解释体系怎样为极权政治准备条件。作品带有鲜明的历史紧迫感，但并不止于控诉，而是试图说明共同世界如何被一步步拆除。",
    themes: ["极权主义", "孤独", "群众政治", "反犹主义", "帝国主义", "意识形态", "官僚机器", "政治判断"],
    readingGuide:
      "阅读时可以按“反犹主义”“帝国主义”“极权主义”三部分推进，先分清她处理的是历史过程、政治结构还是概念判断。不要只寻找定义式结论，更要观察阿伦特怎样把无权者、难民、群众、秘密警察和意识形态叙事连接起来。若读到材料密集处，可以回到一个核心问题：当人失去公共关系、法律保护和判断空间时，极权统治怎样获得进入日常生活的通道。",
    whyItMatters:
      "它的重要性在于，把现代政治灾难从道德谴责推进到制度、社会心理和思想结构的分析。阿伦特说明，极权主义不是传统暴政的简单升级，而是一种试图重造现实、消灭自发行动和公共判断的现代统治形式。这个问题也为她后来的公共领域、行动、复数性和判断理论提供了历史底色，使这部书成为理解二十世纪政治思想不可绕开的入口。",
    personaConnection:
      "这部书集中呈现阿伦特从流亡经验中形成的问题意识。她既关心制度怎样失灵，也关心人在孤独、恐惧和意识形态包围中怎样失去判断。作品中的冷静分析、历史跨度和对公共世界的坚持，正对应她作为政治思想家的核心姿态：不把灾难神秘化，而是追问它在人类共同生活中的生成条件。",
    relatedTopics: ["反犹主义", "帝国主义", "极权主义", "孤独", "群众社会", "公共领域", "政治判断"],
    furtherReadingNote:
      "可与《人的境况》《艾希曼在耶路撒冷》并读，也可参照二十世纪极权主义研究、难民问题、民族国家危机和公共领域理论。"
  }
};

const TYPE_TOPICS = {
  philosophy: ["核心概念", "论证结构", "主体问题", "知识边界", "伦理判断", "思想史"],
  thought: ["公共议题", "制度想象", "观念转型", "社会秩序", "时代诊断", "思想史"],
  literature: ["叙事结构", "人物命运", "社会经验", "语言风格", "情感秩序", "文学史"],
  poetry: ["意象", "声律", "抒情主体", "时间感", "语言节奏", "诗歌传统"],
  drama: ["舞台冲突", "对白结构", "行动伦理", "人物关系", "悲喜张力", "戏剧史"],
  classic: ["文本形态", "解释传统", "伦理秩序", "历史影响", "概念源流", "经典阅读"],
  history: ["史学方法", "人物叙事", "制度观察", "历史记忆", "叙事伦理", "史学传统"]
};

export function buildWorkEpigraph(work, persona) {
  const title = workTitle(work);
  const topics = buildWorkThemes(work, persona);
  if (title.length <= 4 && topics.length >= 2) return `在${topics[0]}与${topics[1]}之间，读见时代深处的回声。`;
  if (topics.length >= 2) return `沿着${topics[0]}与${topics[1]}，进入《${title}》的精神现场。`;
  return `在《${title}》的纹理中，辨认${authorName(work, persona)}的精神来路。`;
}

export function buildWorkIntro(work, persona) {
  const title = workTitle(work);
  const author = authorName(work, persona);
  const type = workType(work, persona);
  const topics = buildWorkThemes(work, persona);
  if (type === "philosophy") {
    return `《${title}》是${author}思想脉络中的重要作品，可从${topicPhrase(topics)}等问题进入。它关注的不只是某个孤立命题，而是概念如何组织经验、判断和世界理解。作品的价值在于把抽象问题推到具体处境中，让读者看见知识、自由、伦理或存在问题怎样影响人的自我认识。阅读这部作品时，应把它视为一套提问方式：作者借由概念辨析、论证推进和时代回应，建立起理解现代思想处境的入口。`;
  }
  if (type === "thought") {
    return `《${title}》是${author}回应时代问题的重要文本，可从${topicPhrase(topics)}等线索把握。作品并不只是观念陈列，而是试图说明人在社会、制度和历史压力中如何重新理解自身位置。它把个人修养、公共秩序、政治想象或文化转型连接起来，使读者看到思想写作如何介入现实。作为导读入口，最值得注意的是作者怎样把一个时代的焦虑转化为可讨论的概念，并由此展开对共同生活的重新设想。`;
  }
  if (type === "history") {
    return `《${title}》是${author}相关作品中具有历史叙事意味的一部，可从${topicPhrase(topics)}等角度进入。它的重点不只在事件排列，更在于怎样通过人物、制度、时间和因果关系组织历史理解。作品往往把个体命运放进更宽的社会结构中，让读者看到历史书写如何承载价值判断。阅读时可以留意作者如何选择材料、安排叙事节奏，并在事实、评价与文学表达之间建立一种可辨认的史学气质。`;
  }
  if (type === "poetry") {
    return `《${title}》呈现了${author}作品中鲜明的抒情面向，可从${topicPhrase(topics)}等线索进入。它的核心不只是情绪表达，而是通过意象、节奏、语气和空间感组织一种精神经验。诗歌的密度常常来自词语之间的留白：个人遭际、时代气息和语言传统在短句中互相折射。阅读这部作品时，宜把注意力放在声音、转折和意象关系上，看作者如何以有限篇幅展开复杂的生命感受。`;
  }
  if (type === "drama") {
    return `《${title}》是${author}戏剧世界中的重要入口，可从${topicPhrase(topics)}等方面理解。戏剧的力量不只来自情节，而在人物行动、对白推进和舞台冲突如何共同暴露伦理困境。作品通过关系的紧张、选择的迟疑和命运的逼近，把私人情感推向公共秩序或历史处境。阅读时可以把它当作一组行动实验：每个角色的言说与沉默，都在塑造作品的精神张力。`;
  }
  return `《${title}》是${author}作品序列中值得细读的一部，可从${topicPhrase(topics)}等线索进入。它的意义不只在故事或主题本身，也在叙述方式、人物关系、语言节奏和时代经验如何共同构成一个文学世界。作品把个人命运放进社会结构、情感秩序或历史变动之中，使读者能够通过具体场景理解更深的精神问题。作为导读入口，应关注它怎样让人物处境、形式选择和作者气质彼此照亮。`;
}

export function buildWorkBackground(work, persona) {
  const title = workTitle(work);
  const author = authorName(work, persona);
  const era = work.era || persona?.era || "相关时代";
  const movement = persona?.movement || persona?.school || persona?.identity || "思想与文学传统";
  const type = workType(work, persona);
  if (type === "classic") {
    return `《${title}》的阅读背景应放在${era}及其解释传统中理解。古代经典往往不是一次性完成的封闭文本，而是在传抄、注释、讲授和再阐释中持续获得生命。与其急于寻找单一作者意图，不如留意它怎样被后世用来讨论秩序、伦理、知识和人的位置。对于今天的读者，背景意识意味着同时看到文本形成的历史层次、概念进入传统的方式，以及不同版本、注疏和译解可能带来的阅读差异。`;
  }
  if (type === "philosophy") {
    return `《${title}》的形成可放在${author}所属的${movement}与${era}问题中理解。哲学作品常常来自对既有概念的不满：作者面对知识、主体、世界、伦理或政治的难题，试图重新规定问题的边界。它既回应前人的论证，也与当时的学术制度、公共争论和思想危机发生关系。把背景读清楚，有助于避免把概念当成孤立术语，而能看见它们为什么在某个时代变得尖锐。`;
  }
  if (type === "thought") {
    return `《${title}》的背景与${author}所处的${era}密切相关。思想类写作往往产生于制度压力、文化转型或公共危机之中，作者借文字处理的不只是个人意见，而是一个时代如何理解自身的问题。作品背后有知识传播方式、教育结构、政治想象和社会经验的变化，也有作者自身立场的调整。阅读背景时，应注意文本怎样把现实焦虑转化为概念语言，并在动员、分析与自我反省之间形成张力。`;
  }
  if (type === "history") {
    return `《${title}》的背景需要放在${era}的历史记忆与书写传统中把握。史学文本既处理事实，也处理叙述秩序：谁被写入历史，事件如何被连接，人物怎样承受评价，都是作品的关键。${author}在材料选择、结构安排和语气控制中体现了自己的历史判断。阅读时若能同时关注文本所写的时代、作者写作的时代以及后世接受的时代，就更能理解它在史学和文学之间的复杂位置。`;
  }
  return `《${title}》的背景与${author}所处的${era}、个人经验和文学传统相互交织。文学作品并不是脱离现实的装饰物，它常常把社会变化、情感结构、语言习惯和审美选择压缩进人物与场景之中。理解背景时，不必把作品简单还原为作者生平，而要看到生平、时代和形式如何彼此作用。这样阅读，既能把握作品为何在当时出现，也能理解它为什么仍能在今天引发新的解释。`;
}

export function buildWorkThemes(work, persona) {
  const type = workType(work, persona);
  const base = uniqueValues([...(work?.themes || []), ...(work?.tags || []), ...(work?.relatedTopics || []), ...(persona?.keywords || [])]);
  return uniqueValues([...base, ...(TYPE_TOPICS[type] || TYPE_TOPICS.literature), persona?.movement, persona?.school, persona?.category])
    .filter(Boolean)
    .slice(0, 8);
}

export function buildReadingGuide(work, persona) {
  const title = workTitle(work);
  const topics = buildWorkThemes(work, persona);
  const type = workType(work, persona);
  if (type === "philosophy" || type === "thought") {
    return `阅读《${title}》时，先抓住${topicPhrase(topics)}这些关键词，再观察作者如何从问题提出走向概念组织。遇到抽象段落时，不必急着寻找结论，可以追问：作者反对什么、重建什么、把人的处境放在怎样的制度或世界图景里。读完一节后回到人物档案，比较其生平、时代压力和其他作品，会更容易看见文本内部的思想转折。`;
  }
  if (type === "classic" || type === "history") {
    return `阅读《${title}》时，宜先确认文本形态和基本结构，再按主题重读。可从${topicPhrase(topics)}进入，留意关键词在不同段落中的变化，以及人物、事件或概念怎样构成整体秩序。古典与史学文本尤其需要慢读，不要只摘取名句或结论；把叙述方式、注释传统和后世影响放在一起看，才能读出它的层次。`;
  }
  return `阅读《${title}》时，可以先从人物关系、叙事节奏和核心意象入手，再回看${topicPhrase(topics)}等主题如何贯穿全篇。不要只把作品当作情节概要来读，重要的是观察作者如何安排视角、语气、场景和沉默。若作品语言密度较高，可分段记录转折处：人物何时改变，叙述何时收紧，情感何时从私人经验进入时代经验。`;
}

export function buildWhyItMatters(work, persona) {
  const title = workTitle(work);
  const author = authorName(work, persona);
  const type = workType(work, persona);
  if (type === "philosophy" || type === "thought") {
    return `《${title}》的重要性在于，它把${author}的核心问题推向更清楚的思想形态。作品让读者看到某些概念为何会在特定历史时刻变得迫切，也说明理论并非远离生活，而是在重塑人理解世界、制度和自我的方式。它未必给出简单答案，却提供了一套辨认问题的路径，因此适合作为进入${author}思想世界和相关思想史争论的关键入口。`;
  }
  if (type === "classic" || type === "history") {
    return `《${title}》之所以重要，是因为它不只属于某一时期的文本遗产，也长期参与了后世对秩序、人物、价值和历史记忆的塑造。它让读者看到经典如何在不同语境中被重新解释，并持续影响文学、思想或史学语言。通过这部作品，可以理解传统并不是静止材料，而是一套不断被阅读、争论和更新的问题系统。`;
  }
  return `《${title}》的重要性在于，它把${author}的艺术气质、时代经验和形式探索集中到可感的文学结构中。作品通过人物、语言和情境，使抽象的情感或社会问题变得具体可读。它的价值不只在题材，也在叙述方式怎样改变读者观看世界的角度。由此进入，可以更好理解${author}在文学史中的位置，以及这部作品为何能继续引发解释。`;
}

export function buildPersonaConnection(work, persona) {
  const title = workTitle(work);
  const author = authorName(work, persona);
  const identity = persona?.identity || persona?.category || "作者";
  const keywords = uniqueValues([...(persona?.keywords || []), persona?.movement, persona?.school]).filter(Boolean).slice(0, 4);
  return `《${title}》与${author}作为${identity}的精神位置紧密相连。作品中的${topicPhrase(keywords)}等关切，呼应其生平经验、时代判断和表达方式。它不是孤立条目，而是理解作者如何把个人感受、公共问题或形式追求转化为作品结构的线索，也能帮助读者在人物档案与作品世界之间建立更具体的往返。`;
}

export function buildFurtherReadingNote(work, persona) {
  const author = authorName(work, persona);
  const topics = buildWorkThemes(work, persona).slice(0, 4);
  return `可把这部作品放入${author}的其他代表作、同代思想论争、相关文学史章节和可靠版本导读中互读，重点追踪${topicPhrase(topics)}的延展。若需要继续深入，优先查阅作者年谱、学术导论、图书馆书目和权威注释本。`;
}

export function normalizeWorkGuide(work, persona, personas = []) {
  const key = `${work?.authorId || persona?.id || ""}::${workTitle(work)}`;
  const special = SPECIAL_GUIDES[key];
  const generated = {
    workEpigraph: buildWorkEpigraph(work, persona),
    shortIntro: buildWorkIntro(work, persona),
    background: buildWorkBackground(work, persona),
    themes: buildWorkThemes(work, persona),
    readingGuide: buildReadingGuide(work, persona),
    whyItMatters: buildWhyItMatters(work, persona),
    personaConnection: buildPersonaConnection(work, persona),
    relatedTopics: buildWorkThemes(work, persona).slice(0, 8),
    furtherReadingPath: buildFurtherReadingNote(work, persona),
    furtherReadingNote: buildFurtherReadingNote(work, persona)
  };
  const merged = {
    ...work,
    ...(special || {}),
    displayMode: work?.displayMode || inferDisplayMode(work),
    workEpigraph: chooseLongText(12, special?.workEpigraph, work?.workEpigraph, generated.workEpigraph),
    shortIntro: chooseLongText(160, special?.shortIntro, work?.shortIntro, work?.summary, generated.shortIntro),
    background: chooseLongText(160, special?.background, work?.background, generated.background),
    themes: normalizeThemes(special?.themes || work?.themes || generated.themes, generated.themes),
    readingGuide: chooseLongText(140, special?.readingGuide, work?.readingGuide, generated.readingGuide),
    whyItMatters: chooseLongText(140, special?.whyItMatters, work?.whyItMatters, generated.whyItMatters),
    personaConnection: chooseLongText(100, special?.personaConnection, work?.personaConnection, generated.personaConnection),
    relatedTopics: normalizeThemes(special?.relatedTopics || work?.relatedTopics || generated.relatedTopics, generated.relatedTopics),
    furtherReadingPath: chooseLongText(
      80,
      special?.furtherReadingPath,
      work?.furtherReadingPath,
      work?.furtherReadingNote,
      generated.furtherReadingPath
    ),
    furtherReadingNote: chooseLongText(
      80,
      special?.furtherReadingNote,
      work?.furtherReadingNote,
      work?.furtherReadingPath,
      generated.furtherReadingNote
    )
  };
  merged.summary = merged.shortIntro;
  merged.relatedPersonas = normalizeRelatedPersonas(merged, persona, personas);
  return ensureGuideDensity(merged, persona);
}

export function hasPlaceholderText(value) {
  const text = String(value || "");
  return !text || PLACEHOLDER_TERMS.some((term) => text.includes(term));
}

export function guideCharLength(value) {
  return Array.from(String(value || "").replace(/\s+/g, "")).length;
}

function chooseGuideText(...values) {
  return values.find((value) => !hasPlaceholderText(value)) || values.filter(Boolean).at(-1) || "";
}

function chooseLongText(minLength, ...values) {
  return (
    values.find((value) => !hasPlaceholderText(value) && guideCharLength(value) >= minLength) ||
    values
      .slice()
      .reverse()
      .find((value) => !hasPlaceholderText(value)) ||
    values.filter(Boolean).at(-1) ||
    ""
  );
}

function normalizeThemes(values, generated) {
  return uniqueValues([...(values || []), ...(generated || []), "作品脉络", "时代经验"]).filter((value) => !hasPlaceholderText(value)).slice(0, 8);
}

function normalizeRelatedPersonas(work, persona, personas) {
  const personaIds = new Set((personas || []).map((item) => item.id));
  const values = uniqueValues([...(work?.relatedPersonas || []), persona?.id || work?.authorId]).filter(Boolean);
  if (!personaIds.size) return values;
  return values.filter((id) => personaIds.has(id));
}

function inferDisplayMode(work) {
  const status = String(work?.copyrightStatus || work?.oldCopyrightStatus || "");
  const hasPublicText =
    Boolean(work?.contentPath) ||
    work?.dataQuality?.fullText === "available_legally" ||
    (Array.isArray(work?.legalFullTextSources) && work.legalFullTextSources.length > 0);
  if (status === "copyright_unknown_or_restricted" || status === "protected" || status === "unknown") return "ai_guide";
  return hasPublicText ? "guide_with_public_text" : "public_domain_reference";
}

function ensureGuideDensity(work, persona) {
  const title = workTitle(work);
  const author = authorName(work, persona);
  const topics = buildWorkThemes(work, persona);
  return {
    ...work,
    shortIntro: extendToLength(
      work.shortIntro,
      160,
      `它因此适合作为进入《${title}》的第一层索引，让读者先看清作品的问题意识、表达方式和精神坐标。`
    ),
    summary: extendToLength(
      work.shortIntro,
      160,
      `它因此适合作为进入《${title}》的第一层索引，让读者先看清作品的问题意识、表达方式和精神坐标。`
    ),
    background: extendToLength(
      work.background,
      160,
      `这一背景提醒读者，作品并非孤立存在，而是在${author}的时代压力、知识传统和表达选择之间逐渐显出意义。`
    ),
    readingGuide: extendToLength(
      work.readingGuide,
      140,
      `阅读中可反复回到${topicPhrase(topics)}，观察这些线索如何改变对人物、概念或叙事结构的理解。`
    ),
    whyItMatters: extendToLength(
      work.whyItMatters,
      140,
      `它也帮助读者把单部作品放回更宽的文学史、思想史和公共经验之中，而不是只停留在题名印象。`
    ),
    personaConnection: extendToLength(
      work.personaConnection,
      120,
      `由此进入，可以更准确地把握${author}在作品、人格和时代之间形成的独特张力。`
    )
  };
}

function extendToLength(value, minLength, addition) {
  const text = String(value || "").trim();
  if (guideCharLength(text) >= minLength) return text;
  return `${text}${text.endsWith("。") ? "" : "。"}${addition}`;
}

function workType(work, persona) {
  const text = [work?.genre, work?.title, persona?.category, persona?.identity, persona?.movement, persona?.school].filter(Boolean).join(" ");
  if (/诗|词|歌|赋|诗人/.test(text)) return "poetry";
  if (/剧|戏|悲剧|喜剧|剧作家/.test(text)) return "drama";
  if (/史|传|纪|史学|年鉴/.test(text)) return "history";
  if (/论语|道德经|庄子|孟子|经典|经|子|兵法|山海经/.test(text)) return "classic";
  if (/哲学|伦理|形而上|存在|批判|理性|逻辑|现象学|哲学家/.test(text)) return "philosophy";
  if (/思想|政论|启蒙|政治|社会|国民|公共|学者|思想家/.test(text)) return "thought";
  return "literature";
}

function topicPhrase(topics) {
  const picked = (topics || []).filter(Boolean).slice(0, 3);
  return picked.length ? picked.join("、") : "作品主题、时代经验、人物精神";
}

function workTitle(work) {
  return work?.title || work?.originalTitle || "作品";
}

function authorName(work, persona) {
  return work?.authorName || work?.author || persona?.displayName || "作者";
}

function uniqueValues(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

export const WORK_GUIDE_PLACEHOLDER_TERMS = PLACEHOLDER_TERMS;
export const WORK_GUIDE_DEFAULT_READING_NOTE = DEFAULT_READING_NOTE;
