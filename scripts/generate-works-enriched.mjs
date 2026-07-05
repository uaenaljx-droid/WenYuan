import fs from "node:fs";
import path from "node:path";
import { normalizeWorkGuide } from "../src/utils/workGuideGenerator.js";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "src", "data");
const RETRIEVED_AT = "2026-07-03";

const catalog = readJson("works-catalog.json");
const personas = readJson("personas.enriched.json");
const personaIds = new Set(personas.map((persona) => persona.id));

const overrides = {
  "lu-xun::呐喊": {
    era: "现代中国",
    genre: "小说集",
    language: "中文",
    compositionPeriod: "1918-1922",
    copyrightStatus: "copyright_unknown_or_restricted",
    license: "Needs Review",
    licenseNote: "作品页以原创导读、阅读提示和思想脉络为主；整理底本和数字文本来源仅作为内部校验信息。",
    sourceConfidence: "medium",
    tags: ["现代中国文学", "小说集", "文化运动"],
    summary:
      "《呐喊》收录鲁迅早期小说，以冷峻笔触揭示近代中国社会的精神创痛。它不是单纯控诉，也不是情绪化悲鸣，而是通过人物命运、沉默群体与荒诞现实，逼近一个时代的病灶。",
    background:
      "这些小说多写于新文化运动前后，鲁迅把医学、启蒙、乡土经验与现代叙事结合起来，观察旧伦理、看客心理和个体觉醒的艰难。作品版本与数字文本来源需复核后才能公开嵌入。",
    themes: ["现代中国文学", "小说集", "文化运动", "看客", "精神创痛"],
    readingGuide:
      "可从《狂人日记》《孔乙己》《阿Q正传》等篇进入，关注叙述声音、旁观者结构和“看客”主题。阅读时宜把小说放回晚清民初的制度、语言和精神转型中理解。",
    whyItMatters:
      "它改变了现代中文小说的语气与伦理尺度，使文学成为审视时代精神结构的锋利方式。",
    relatedPersonas: ["lu-xun"],
    legalFullTextSources: [],
    catalogSources: [
      source("Wikidata 检索", "https://www.wikidata.org/w/index.php?search=%E5%91%90%E5%96%8A", "metadata_or_catalog", "仅用于元数据核对，不提供全文。"),
      source("中国国家图书馆检索", "https://find.nlc.cn/search/doSearch?query=%E5%91%90%E5%96%8A%20%E9%B2%81%E8%BF%85", "library", "建议核对馆藏与版本。")
    ],
    dataQuality: quality("partial", "partial", "needsReview", "unavailable", "《呐喊》页采用导读与书目索引模式，后续可继续复核版本与来源。")
  },
  "sima-qian::史记": {
    era: "西汉",
    genre: "纪传体史书",
    language: "中文",
    compositionPeriod: "西汉",
    copyrightStatus: "public_domain",
    license: "Public Domain",
    licenseNote: "古典原文已属公版；现代标点、校注、译文和整理本需单独复核。",
    sourceConfidence: "high",
    summary: "《史记》以本纪、表、书、世家、列传织成中国早期历史叙事的宏大结构，把制度、人物和命运写入同一条时间长河。",
    background: "司马迁继承父志，在宫刑之后完成此书。它既是史学工程，也是士人精神的自证，重在通过人物行动和抉择呈现历史的伦理张力。",
    themes: ["历史书写", "人物命运", "士人精神"],
    readingGuide: "可先读《项羽本纪》《陈涉世家》《伯夷列传》，体会叙事节奏、人物剪影与史家评断之间的关系。",
    whyItMatters: "它奠定纪传体传统，也让历史书写拥有文学的锋芒与道德追问。",
    relatedPersonas: ["sima-qian"],
    legalFullTextSources: [
      source("Chinese Text Project", "https://ctext.org/shiji/zh", "public_domain_or_open", "古典文本来源；版本需人工复核。"),
      source("中文维基文库", "https://zh.wikisource.org/wiki/%E5%8F%B2%E8%A8%98", "public_domain_or_open", "公版文本索引；标点与底本需复核。")
    ],
    catalogSources: [source("Wikidata 检索", "https://www.wikidata.org/w/index.php?search=%E5%8F%B2%E8%AE%B0", "metadata_or_catalog", "元数据核对。")],
    dataQuality: quality("verified", "partial", "verified", "available_legally", "原文公版；现代整理权利另审。")
  },
  "goethe::浮士德": publicClassic({
    era: "德国古典主义",
    genre: "诗剧",
    language: "德语",
    compositionPeriod: "1770s-1832",
    summary: "《浮士德》以一场灵魂契约展开，追问知识欲望、行动冲动与救赎可能，兼具哲学寓言和舞台诗的张力。",
    background: "歌德在漫长一生中持续修改此作，作品吸纳中世纪传说、启蒙理性、古典美学和现代主体意识，是德国文学转型的标志性文本。",
    themes: ["欲望", "知识", "救赎", "现代主体"],
    readingGuide: "可先把第一部视为个人灵魂剧，第二部视为文明寓言；中文译本需按译者和出版社单独判断版权。",
    whyItMatters: "它把现代人的求知、越界和不安浓缩为一个持续变形的文学形象。",
    relatedPersonas: ["goethe"],
    legalFullTextSources: [source("Project Gutenberg", "https://www.gutenberg.org/ebooks/14591", "public_domain_or_open", "公版原文/版本页；译本权利另审。")]
  }),
  "victor-hugo::巴黎圣母院": publicClassic({
    era: "法国浪漫主义",
    genre: "长篇小说",
    language: "法语",
    compositionPeriod: "1830-1831",
    summary: "《巴黎圣母院》围绕教堂、城市与边缘人物展开，把浪漫主义的激情、历史想象和建筑记忆编织在一起。",
    background: "雨果以中世纪巴黎为舞台，借建筑遗产与人物悲剧回应现代化对历史记忆的侵蚀。中文译本和数字版本仍需单独核验。",
    themes: ["城市记忆", "浪漫主义", "命运", "边缘人物"],
    readingGuide: "阅读时可把圣母院视为沉默主角，关注人物命运如何被城市空间、宗教秩序和群众目光共同塑形。",
    whyItMatters: "它让小说成为保存城市历史与建筑精神的一种文学行动。",
    relatedPersonas: ["victor-hugo"],
    legalFullTextSources: [source("Project Gutenberg 检索", "https://www.gutenberg.org/ebooks/search/?query=Notre-Dame+de+Paris+Victor+Hugo", "public_domain_or_open", "请复核具体版本与语言。")]
  }),
  "murasaki-shikibu::源氏物语": publicClassic({
    era: "平安时代",
    genre: "物语",
    language: "日语",
    compositionPeriod: "约11世纪初",
    summary: "《源氏物语》以宫廷生活和情感流转为经纬，写出权力、欲望、季节和无常感交织的细密世界。",
    background: "作品形成于平安贵族文化内部，女性书写、假名文学和宫廷审美共同塑造了它的叙事气质。现代译本版权需单独复核。",
    themes: ["宫廷生活", "无常", "女性书写", "物哀"],
    readingGuide: "可从人物关系和季节意象入手，少急于追情节，多观察称谓、空间和礼法怎样影响情感表达。",
    whyItMatters: "它展示了早期长篇叙事如何以细腻心理和审美秩序承载一个时代。",
    relatedPersonas: ["murasaki-shikibu"],
    legalFullTextSources: [source("日文维基文库", "https://ja.wikisource.org/wiki/%E6%BA%90%E6%B0%8F%E7%89%A9%E8%AA%9E", "public_domain_or_open", "日文原文索引；译本权利另审。")]
  }),
  "sun-tzu::孙子兵法": publicClassic({
    id: "sunzi-bingfa",
    title: "孙子兵法",
    authorId: "sun-tzu",
    authorName: "孙子",
    originalTitle: "孙子兵法",
    era: "春秋末期",
    genre: "兵书 / 思想经典",
    language: "中文",
    compositionPeriod: "春秋末期至战国早期",
    summary: "《孙子兵法》以简短篇章论战争、谋略、形势与判断，核心不在好战，而在以最小代价理解冲突和秩序。",
    background: "作品长期被置于兵学传统中阅读，也影响政治、组织和战略思维。古典原文公版，现代注译与整理本需另行复核。",
    themes: ["谋略", "形势", "战争伦理", "判断"],
    readingGuide: "可先读《计篇》《谋攻篇》《形篇》，关注“势”“虚实”“知彼知己”等概念如何从军事判断扩展为思想方法。",
    whyItMatters: "它把冲突处理转化为关于信息、时机和克制的经典思考。",
    relatedPersonas: [],
    legalFullTextSources: [source("Chinese Text Project", "https://ctext.org/art-of-war/zh", "public_domain_or_open", "古典文本来源；版本需人工复核。")]
  }),
  "confucius::论语": publicClassic({
    era: "春秋至战国",
    genre: "语录体经典",
    language: "中文",
    compositionPeriod: "战国前后编定",
    summary: "《论语》保存孔子及弟子言行，以片段方式展开仁、礼、学、政与君子人格的根基。",
    background: "它并非系统论文，而是由教学场景、问答和评论组成。后世注疏极多，原文公版，现代注译需单独复核。",
    themes: ["仁", "礼", "学习", "君子"],
    readingGuide: "可按主题重读，如“学”“仁”“政”“君子”，不要只把它当格言集，要看语境中的回应和分寸。",
    whyItMatters: "它塑造了东亚伦理、教育和政治语言的基本词汇。",
    relatedPersonas: ["confucius"],
    legalFullTextSources: [source("Chinese Text Project", "https://ctext.org/analects/zh", "public_domain_or_open", "古典文本来源；版本需人工复核。")]
  }),
  "laozi::道德经": publicClassic({
    era: "先秦",
    genre: "哲学经典",
    language: "中文",
    compositionPeriod: "先秦",
    summary: "《道德经》以短章论道、德、无为、反身和柔弱之力，语言凝练而多歧义。",
    background: "文本成书与作者问题仍有讨论，版本系统复杂。原文公版，现代校注、译文和解释体系需单独复核。",
    themes: ["道", "无为", "反身", "柔弱"],
    readingGuide: "宜慢读，不急于固定解释；可比较“道”“名”“无为”“有无”等概念在不同章中的回环。",
    whyItMatters: "它以极少文字打开中国思想中关于秩序、语言和行动的幽深问题。",
    relatedPersonas: ["laozi"],
    legalFullTextSources: [source("Chinese Text Project", "https://ctext.org/dao-de-jing/zh", "public_domain_or_open", "古典文本来源；版本需人工复核。")]
  }),
  "zhuangzi::庄子": publicClassic({
    era: "战国",
    genre: "哲学散文",
    language: "中文",
    compositionPeriod: "战国至汉初",
    summary: "《庄子》以寓言、辩论和奇异想象松动常识边界，讨论自由、齐物、生死和语言的限度。",
    background: "内篇、外篇、杂篇来源层次复杂，文本在思想史和文学史中都极为重要。原文公版，现代注译需复核。",
    themes: ["逍遥", "齐物", "寓言", "语言限度"],
    readingGuide: "可先读《逍遥游》《齐物论》《养生主》，把夸张想象看作思想实验，而不只是奇谈。",
    whyItMatters: "它让哲学以文学的方式发生，使自由问题拥有难以替代的想象力。",
    relatedPersonas: ["zhuangzi"],
    legalFullTextSources: [source("Chinese Text Project", "https://ctext.org/zhuangzi/zh", "public_domain_or_open", "古典文本来源；版本需人工复核。")]
  }),
  "cao-xueqin::红楼梦": publicClassic({
    era: "清代",
    genre: "章回小说",
    language: "中文",
    compositionPeriod: "18世纪",
    summary: "《红楼梦》以贾府兴衰和大观园群像展开，写情、家族、制度与幻灭，细部中藏着庞大的社会肌理。",
    background: "作品版本系统复杂，脂评本、程高本等差异需要谨慎对待。原著进入公版，现代校注、整理和译本权利另审。",
    themes: ["家族兴衰", "情", "女性群像", "幻灭"],
    readingGuide: "可从宝黛钗关系、大观园空间和诗社活动进入，同时留意章回结构与判词、梦境之间的暗线。",
    whyItMatters: "它把中国古典小说的心理、语言和社会观察推向极高密度。",
    relatedPersonas: ["cao-xueqin"],
    legalFullTextSources: [source("中文维基文库", "https://zh.wikisource.org/wiki/%E7%B4%85%E6%A8%93%E5%A4%A2", "public_domain_or_open", "公版文本索引；版本需复核。")]
  }),
  "dante::神曲": publicClassic({
    era: "中世纪晚期",
    genre: "长诗",
    language: "意大利语",
    compositionPeriod: "约1308-1321",
    summary: "《神曲》以地狱、炼狱、天堂三重旅程组织信仰、政治、爱情与知识，形成一部宏大的灵魂地图。",
    background: "但丁把个人放逐经验、经院哲学和佛罗伦萨政治写入诗体结构。原文公版，各语种译本需单独核验。",
    themes: ["灵魂旅程", "神学", "政治", "爱"],
    readingGuide: "可先理解三部结构和维吉尔、贝雅特丽齐的引导意义，再逐步进入典故与神学层次。",
    whyItMatters: "它使中世纪宇宙观与个人生命经验在诗中形成完整秩序。",
    relatedPersonas: ["dante"],
    legalFullTextSources: [source("Project Gutenberg 检索", "https://www.gutenberg.org/ebooks/search/?query=Divine+Comedy+Dante", "public_domain_or_open", "请复核具体版本与译者。")]
  }),
  "shakespeare::哈姆雷特": publicClassic({
    era: "英国文艺复兴",
    genre: "悲剧",
    language: "英语",
    compositionPeriod: "约1600-1601",
    summary: "《哈姆雷特》围绕复仇、迟疑、表演和死亡展开，把宫廷阴谋转化为现代主体的深层独白。",
    background: "莎士比亚改写复仇剧传统，使戏剧从行动冲突进入意识内部。原文公版，现代译本和演出版需另审。",
    themes: ["复仇", "迟疑", "表演", "死亡"],
    readingGuide: "可关注独白、戏中戏和父权幽灵如何推动人物行动，也要留意奥菲莉娅和霍拉旭的结构位置。",
    whyItMatters: "它让戏剧人物的内在矛盾获得前所未有的复杂度。",
    relatedPersonas: ["shakespeare"],
    legalFullTextSources: [source("Project Gutenberg", "https://www.gutenberg.org/ebooks/1524", "public_domain_or_open", "公版英文文本；译本权利另审。")]
  }),
  "dostoevsky::罪与罚": publicClassic({
    era: "19世纪俄国",
    genre: "长篇小说",
    language: "俄语",
    compositionPeriod: "1865-1866",
    summary: "《罪与罚》以拉斯柯尔尼科夫的犯罪与精神崩裂为核心，追问理性傲慢、贫困、良知和救赎。",
    background: "作品写于俄国城市现代化和思想激荡之中，把社会现实、宗教伦理和心理叙事压进紧张结构。",
    themes: ["罪", "良知", "贫困", "救赎"],
    readingGuide: "阅读时关注人物对话中的思想试探，以及城市空间怎样放大孤独、恐惧和自我辩护。",
    whyItMatters: "它把小说变成道德心理的实验室，深刻影响现代叙事。",
    relatedPersonas: ["dostoevsky"],
    legalFullTextSources: [source("Project Gutenberg", "https://www.gutenberg.org/ebooks/2554", "public_domain_or_open", "公版英文译本；其他译本权利另审。")]
  }),
  "tolstoy::战争与和平": publicClassic({
    era: "19世纪俄国",
    genre: "长篇小说",
    language: "俄语",
    compositionPeriod: "1863-1869",
    summary: "《战争与和平》把家族生活、战争现场和历史哲学交织起来，呈现个人命运与时代洪流的相互牵动。",
    background: "托尔斯泰以拿破仑战争为背景，反思英雄史观、历史偶然性和日常生活的伦理重量。",
    themes: ["历史", "战争", "家庭", "命运"],
    readingGuide: "可从主要家族线索进入，再回看战争章节和历史论述如何彼此照应；中文译本需复核版权。",
    whyItMatters: "它把史诗规模与日常细节结合，重新定义长篇小说的容量。",
    relatedPersonas: ["tolstoy"],
    legalFullTextSources: [source("Project Gutenberg", "https://www.gutenberg.org/ebooks/2600", "public_domain_or_open", "公版英文译本；其他译本权利另审。")]
  }),
  "proust::追忆似水年华": restrictedClassic({
    era: "20世纪法国",
    genre: "长篇小说",
    language: "法语",
    compositionPeriod: "1909-1922",
    summary: "《追忆似水年华》以记忆、感官和时间经验展开，把社交生活、爱情心理与艺术自觉写成绵密的意识长卷。",
    background: "普鲁斯特在现代主义语境中重塑小说时间。原作与各语种译本的版本、权利和数字来源需要逐项核对，作品页采用导读与书目索引模式。",
    themes: ["记忆", "时间", "感官", "艺术"],
    readingGuide: "可从“非自愿记忆”入手，慢读句法和场景回返，不必急于追求情节速度。",
    whyItMatters: "它把小说的中心从外部事件转向时间意识和记忆结构。",
    relatedPersonas: ["proust"],
    catalogSources: [
      source("Wikidata 检索", "https://www.wikidata.org/w/index.php?search=%E8%BF%BD%E5%BF%86%E4%BC%BC%E6%B0%B4%E5%B9%B4%E5%8D%8E", "metadata_or_catalog", "元数据核对。"),
      source("WorldCat 检索", "https://search.worldcat.org/search?q=%E8%BF%BD%E5%BF%86%E4%BC%BC%E6%B0%B4%E5%B9%B4%E5%8D%8E", "library", "馆藏与版本核对。")
    ]
  }),
  "joyce::尤利西斯": restrictedClassic({
    era: "现代主义",
    genre: "长篇小说",
    language: "英语",
    compositionPeriod: "1914-1921",
    summary: "《尤利西斯》以都柏林一天为结构，借神话框架、意识流和语言实验重写现代城市生活。",
    background: "乔伊斯把荷马史诗转化为普通人的日常漫游。不同国家版权期限、校订本与译本权利复杂，作品页采用导读与书目索引模式。",
    themes: ["现代主义", "意识流", "城市", "神话重写"],
    readingGuide: "可先按章节结构和人物路线阅读，再逐步进入典故、语体转换和语言游戏。",
    whyItMatters: "它扩大了小说语言和结构的可能性，是现代主义叙事的重要坐标。",
    relatedPersonas: ["joyce"],
    catalogSources: [
      source("Wikidata 检索", "https://www.wikidata.org/w/index.php?search=%E5%B0%A4%E5%88%A9%E8%A5%BF%E6%96%AF", "metadata_or_catalog", "元数据核对。"),
      source("WorldCat 检索", "https://search.worldcat.org/search?q=Ulysses%20James%20Joyce", "library", "馆藏与版本核对。")
    ]
  }),
  "kafka::变形记": publicClassic({
    era: "现代主义",
    genre: "中篇小说",
    language: "德语",
    compositionPeriod: "1912",
    summary: "《变形记》从格里高尔一觉醒来变成异物开始，把家庭责任、劳动压力和身份崩塌压缩成冷静而荒诞的叙事。",
    background: "卡夫卡以近乎平直的语气处理极端情境，使现代人的羞耻、负债和隔绝感获得寓言形态。中文译本需复核版权。",
    themes: ["异化", "家庭", "劳动", "羞耻"],
    readingGuide: "不要只把变形当奇观；可关注家人态度、房间空间和经济压力如何一步步重写人物价值。",
    whyItMatters: "它用极短篇幅确立了现代文学中“异化”的经典形象。",
    relatedPersonas: ["kafka"],
    legalFullTextSources: [source("Project Gutenberg 检索", "https://www.gutenberg.org/ebooks/search/?query=Metamorphosis+Kafka", "public_domain_or_open", "请复核具体译者和版本。")]
  }),
  "gabriel-garcia-marquez::百年孤独": restrictedClassic({
    era: "20世纪拉丁美洲",
    genre: "长篇小说",
    language: "西班牙语",
    compositionPeriod: "1965-1967",
    summary: "《百年孤独》以布恩迪亚家族和马孔多为中心，把历史循环、殖民经验、记忆和神话感交织为浓密叙事。",
    background: "作品仍处版权保护期，中文译本和电子版本也受权利限制。本项目仅提供导读、主题提示与合法来源索引。",
    themes: ["魔幻现实主义", "家族", "历史循环", "记忆"],
    readingGuide: "阅读时可建立家族谱系，关注重复姓名、预言文本和马孔多历史怎样互相映照。",
    whyItMatters: "它让拉丁美洲历史经验以神话般的叙事密度进入世界文学视野。",
    relatedPersonas: ["gabriel-garcia-marquez"],
    catalogSources: [
      source("Wikipedia", "https://zh.wikipedia.org/wiki/%E7%99%BE%E5%B9%B4%E5%AD%A4%E7%8B%AC", "encyclopedia", "百科与元数据参考。"),
      source("WorldCat 检索", "https://search.worldcat.org/search?q=%E7%99%BE%E5%B9%B4%E5%AD%A4%E7%8B%AC", "library", "馆藏与版本核对。")
    ]
  }),
  "camus::局外人": restrictedClassic({
    era: "20世纪法国",
    genre: "中篇小说",
    language: "法语",
    compositionPeriod: "1941-1942",
    summary: "《局外人》以默尔索的冷淡叙述展开，讨论荒诞、审判、社会规范和个体经验之间的断裂。",
    background: "加缪作品仍处版权保护期，不同译本也需单独授权；作品页保留导读、主题提示和书目索引。",
    themes: ["荒诞", "审判", "冷淡叙述", "社会规范"],
    readingGuide: "可关注第一人称叙述的克制，以及审判如何从行为事实转向对人格和情感的审判。",
    whyItMatters: "它以极简语气写出荒诞哲学在日常生活中的压迫感。",
    relatedPersonas: ["camus"],
    catalogSources: [
      source("Wikidata 检索", "https://www.wikidata.org/w/index.php?search=%E5%B1%80%E5%A4%96%E4%BA%BA", "metadata_or_catalog", "元数据核对。"),
      source("WorldCat 检索", "https://search.worldcat.org/search?q=%E5%B1%80%E5%A4%96%E4%BA%BA%20%E5%8A%A0%E7%BC%AA", "library", "馆藏与版本核对。")
    ]
  }),
  "heidegger::存在与时间": restrictedClassic({
    era: "20世纪德国",
    genre: "哲学著作",
    language: "德语",
    compositionPeriod: "1920年代",
    summary: "《存在与时间》以此在、时间性、世界内存在等概念重新开启存在问题，是20世纪现象学和哲学解释学的重要文本。",
    background: "海德格尔著作和译本仍涉及权利与版本问题；作品页提供概念导读、阅读路径和书目索引。",
    themes: ["存在", "时间性", "此在", "现象学"],
    readingGuide: "建议先理解“此在”“世界内存在”“向死而在”等基本概念，再进入时间性结构；阅读应依可靠译本和学术注释。",
    whyItMatters: "它深刻改变了20世纪哲学对主体、世界和时间的提问方式。",
    relatedPersonas: ["heidegger"],
    catalogSources: [
      source("Wikidata 检索", "https://www.wikidata.org/w/index.php?search=%E5%AD%98%E5%9C%A8%E4%B8%8E%E6%97%B6%E9%97%B4", "metadata_or_catalog", "元数据核对。"),
      source("WorldCat 检索", "https://search.worldcat.org/search?q=Sein%20und%20Zeit", "library", "馆藏与版本核对。")
    ]
  })
};

const enriched = catalog.map((work) => {
  const base = baseFromCatalog(work);
  return normalizeEntry({ ...base, ...(overrides[`${work.personaId}::${work.title}`] || {}) }, work);
});

if (!enriched.some((work) => work.id === "sunzi-bingfa")) {
  enriched.push(normalizeEntry(overrides["sun-tzu::孙子兵法"], null));
}

fs.writeFileSync(path.join(DATA, "works.enriched.json"), `${JSON.stringify(enriched, null, 2)}\n`, "utf8");
console.log(`generated ${enriched.length} enriched work entries`);

function baseFromCatalog(work) {
  const normalizedStatus = normalizeStatus(work.copyrightStatus);
  const fullTextAllowed = normalizedStatus === "public_domain" || normalizedStatus === "licensed_or_open";
  const legalSource =
    fullTextAllowed && work.sourceUrl
      ? [source(work.sourceName || "公开文本来源", work.sourceUrl, "public_domain_or_open", "来自旧作品目录；版本和授权仍需人工复核。")]
      : [];
  const catalogSources =
    work.sourceUrl && !legalSource.length
      ? [source(work.sourceName || "Reference lookup", work.sourceUrl, "metadata_or_catalog", "仅用于元数据或版本线索，不作为全文来源。")]
      : [];

  return {
    id: work.workId,
    workId: work.workId,
    title: work.title,
    authorId: work.personaId,
    authorName: work.author,
    originalTitle: work.title,
    era: null,
    genre: null,
    language: work.language || null,
    firstPublished: null,
    compositionPeriod: null,
    copyrightStatus: normalizedStatus,
    license: fullTextAllowed ? work.license || "Public Domain" : "Needs Review",
    licenseNote: fullTextAllowed
      ? "旧目录标记为公版或开放授权；公开发布前仍需复核具体版本、译者和整理权利。"
      : "作品页采用导读与书目索引模式；内部仍保留权利状态字段供发布前复核。",
    sourceConfidence: fullTextAllowed ? "medium" : "low",
    tags: [],
    summary: work.summary || `${work.title} 的作品资料仍在整理中。`,
    background: "作品页以作者处境、时代问题和文本主题为中心组织导读，帮助读者先建立作品脉络和阅读路径。",
    themes: [],
    readingGuide:
      "可先把握作品主题、人物处境与时代脉络，再结合可靠版本、图书馆目录或相关研究继续深入。",
    whyItMatters: "这部作品为理解作者的文学、思想或精神气质提供了一处入口。",
    relatedPersonas: [work.personaId].filter(Boolean),
    legalFullTextSources: legalSource,
    catalogSources,
    references: [...legalSource, ...catalogSources],
    excerpts: [],
    dataQuality: quality("partial", "partial", fullTextAllowed ? "needsReview" : "needsReview", fullTextAllowed ? "available_legally" : "unavailable", "由旧作品目录生成，需逐条人工复核。")
  };
}

function publicClassic(entry) {
  return {
    firstPublished: null,
    copyrightStatus: "public_domain",
    license: "Public Domain",
    licenseNote: "原著或古典原文已属公版；现代译本、校注、整理本和数字版本需单独复核。",
    sourceConfidence: "high",
    catalogSources: [],
    dataQuality: quality("verified", "partial", "verified", "available_legally", "公版判断限原文或古典文本，译本权利另审。"),
    ...entry
  };
}

function restrictedClassic(entry) {
  return {
    firstPublished: null,
    copyrightStatus: "copyright_unknown_or_restricted",
    license: "Restricted / Needs Review",
    licenseNote: "作品页采用导读与书目索引模式；具体版本、译本权利和数字来源需随来源复核。",
    sourceConfidence: "medium",
    legalFullTextSources: [],
    dataQuality: quality("partial", "partial", "needsReview", "unavailable", "版权或译本权利需人工复核。"),
    ...entry
  };
}

function normalizeEntry(entry, catalogWork) {
  const id = entry.id || catalogWork?.workId;
  const references = [...(entry.legalFullTextSources || []), ...(entry.catalogSources || []), ...(entry.references || [])];
  const uniqueReferences = uniqueSources(references);
  const raw = {
    id,
    workId: entry.workId || catalogWork?.workId || id,
    title: entry.title || catalogWork?.title,
    authorId: entry.authorId || catalogWork?.personaId || null,
    authorName: entry.authorName || catalogWork?.author || "作者未详",
    originalTitle: entry.originalTitle || entry.title || catalogWork?.title,
    era: entry.era ?? null,
    genre: entry.genre ?? null,
    language: entry.language ?? catalogWork?.language ?? null,
    firstPublished: entry.firstPublished ?? null,
    compositionPeriod: entry.compositionPeriod ?? null,
    copyrightStatus: entry.copyrightStatus,
    license: entry.license,
    licenseNote: entry.licenseNote,
    sourceConfidence: entry.sourceConfidence || "medium",
    tags: entry.tags || [],
    summary: entry.summary,
    displayMode: displayMode(entry),
    workEpigraph: entry.workEpigraph || makeEpigraph(entry, catalogWork),
    shortIntro: entry.shortIntro || entry.summary,
    background: entry.background,
    themes: entry.themes || [],
    readingGuide: entry.readingGuide,
    whyItMatters: entry.whyItMatters,
    personaConnection:
      entry.personaConnection ||
      `这部作品与${entry.authorName || catalogWork?.author || "作者"}的核心关切相互映照，可与人物档案和时代语境一并阅读。`,
    relatedTopics: entry.relatedTopics || entry.themes || entry.tags || [],
    relatedPersonas: (entry.relatedPersonas || [entry.authorId || catalogWork?.personaId].filter(Boolean)).filter((id) =>
      personaIds.has(id)
    ),
    legalFullTextSources: uniqueSources(entry.legalFullTextSources || []),
    catalogSources: uniqueSources(entry.catalogSources || []),
    references: uniqueReferences,
    excerpts: entry.excerpts || [],
    dataQuality: entry.dataQuality || quality("partial", "partial", "needsReview", "unavailable", "作品目录生成后保留内部复核信息。")
  };
  const persona = personas.find((item) => item.id === raw.authorId) || null;
  return normalizeWorkGuide(raw, persona, personas);
}

function source(name, url, type, notes) {
  return {
    name,
    sourceName: name,
    url,
    sourceUrl: url,
    type,
    notes,
    retrievedAt: RETRIEVED_AT
  };
}

function quality(metadata, summary, copyright, fullText, notes) {
  return { metadata, summary, copyright, fullText, notes };
}

function normalizeStatus(status) {
  if (status === "public-domain") return "public_domain";
  if (status === "open-license") return "licensed_or_open";
  return "copyright_unknown_or_restricted";
}

function displayMode(entry) {
  const hasText = entry.dataQuality?.fullText === "available_legally" || (entry.legalFullTextSources || []).length > 0;
  if (entry.copyrightStatus === "copyright_unknown_or_restricted") return "ai_guide";
  if (hasText) return "guide_with_public_text";
  return "public_domain_reference";
}

function makeEpigraph(entry, catalogWork) {
  const topics = [...(entry.themes || []), ...(entry.tags || [])].filter(Boolean);
  const title = entry.title || catalogWork?.title || "作品";
  const author = entry.authorName || catalogWork?.author || "作者";
  if (topics.length >= 2) return `在${topics[0]}与${topics[1]}之间，辨认《${title}》的精神来路。`;
  return `在《${title}》的回声里，照见${author}的精神纹理。`;
}

function uniqueSources(sources) {
  const seen = new Set();
  return sources.filter((item) => {
    if (!item?.url) return false;
    const key = `${item.name || item.sourceName}::${item.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA, file), "utf8"));
}
