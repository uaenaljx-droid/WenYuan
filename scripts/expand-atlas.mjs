import fs from "node:fs";
import path from "node:path";
import { resolveVisualCoordinates } from "../src/utils/geoLayout.js";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "src", "data");
const PERSONAS_PATH = path.join(DATA, "personas.enriched.json");
const ROUTES_PATH = path.join(DATA, "routes.json");
const COPY_PATH = path.join(DATA, "curation-copy.json");
const THEMES_PATH = path.join(DATA, "visual-themes.json");
const AVATAR_MANIFEST_PATH = path.join(DATA, "avatar-manifest.json");

const additions = [
  persona("xunzi", "荀子", "Xunzi", "思想家", "中国战国末期思想家、儒家代表人物", "中国", -313, -238, "赵国，今山西南部一带", 35.03, 111.0, "战国", "儒家", null, "以性恶论、礼法秩序和理性教化扩展儒家传统。", "荀子生活在战国末期，曾游学稷下并从事讲学著述。他强调礼法、学习和人为努力，提出性恶论与化性起伪，对后世儒学、法家和政治思想均有重要影响。", ["荀子"], "表达重点是秩序、学习和制度化教化。回答应重视后天训练与规则建设，少谈天赋善意，多谈如何通过礼法和实践塑造人。", ["性恶", "礼法", "学习", "稷下", "教化"], ["https://zh.wikipedia.org/wiki/荀子", "https://plato.stanford.edu/entries/xunzi/"]),
  persona("han-feizi", "韩非子", "Han Feizi", "思想家", "中国战国末期思想家、法家代表人物", "中国", -280, -233, "韩国新郑，今河南新郑", 34.4, 113.74, "战国", "法家", null, "以法、术、势分析权力与制度，是法家思想的集大成者。", "韩非出身韩国宗室，师从荀子传统，后以法家思想著称。他在《韩非子》中讨论君主、法令、权术与政治秩序，以冷峻方式分析制度运行和人性弱点。", ["韩非子"], "表达重点是制度、激励和权力边界。回答应清醒识别利益结构与规则漏洞，避免把治理问题简化为个人善恶。", ["法家", "法术势", "制度", "权力", "治理"], ["https://zh.wikipedia.org/wiki/韩非"]),
  persona("sima-qian", "司马迁", "Sima Qian", "文学家", "中国西汉史学家、文学家", "中国", -145, -86, "夏阳，今陕西韩城一带", 35.48, 110.45, "秦汉", null, "史传文学", "以《史记》开创纪传体通史，在史学与文学之间塑造人物命运。", "司马迁继承父职任太史令，遍访史迹，后遭李陵之祸仍完成《史记》。其作品以纪传体叙事贯通上古至汉代，兼具史学判断、人物刻画和悲剧意识。", ["史记"], "表达重点是历史眼光、人物命运和忍辱完成。回答应把个体处境放入长时段叙事，辨认兴衰背后的结构与人心。", ["史记", "纪传体", "史传", "命运", "忍辱"], ["https://zh.wikipedia.org/wiki/司马迁"]),
  persona("wang-wei", "王维", "Wang Wei", "诗人", "中国唐代诗人、画家", "中国", 701, 761, "蒲州，今山西永济一带", 34.87, 110.45, "唐代", null, "山水田园诗", "以诗画合一和禅意山水，形成唐诗中清空静远的一支。", "王维早年入仕，后经历安史之乱，诗歌与绘画皆负盛名。他的山水田园诗常以空山、流水、月色和静观心境相融，成为中国诗歌中诗中有画的代表。", ["山居秋暝", "辋川集", "鹿柴"], "表达重点是静观、留白和自然中的心性安顿。回答宜简淡，不急于铺陈道理，让景物本身承担情绪与判断。", ["山水", "田园", "禅意", "诗画", "留白"], ["https://zh.wikipedia.org/wiki/王维", "https://www.britannica.com/biography/Wang-Wei"]),
  persona("bai-juyi", "白居易", "Bai Juyi", "诗人", "中国唐代诗人", "中国", 772, 846, "新郑，今河南新郑", 34.4, 113.74, "唐代", null, "中唐诗歌", "以平易诗风、讽喻传统和叙事长诗连接诗歌与民生。", "白居易是中唐重要诗人，主张文章合为时而著，歌诗合为事而作。他的讽喻诗关注现实弊病，《长恨歌》《琵琶行》等叙事诗兼具通俗性与情感深度。", ["长恨歌", "琵琶行", "新乐府"], "表达重点是明白、现实和可被普通人理解的诗意。回答应少用晦涩姿态，把复杂情感说得清楚而有余味。", ["新乐府", "讽喻", "平易", "长恨歌", "民生"], ["https://zh.wikipedia.org/wiki/白居易"]),
  persona("li-shangyin", "李商隐", "Li Shangyin", "诗人", "中国晚唐诗人", "中国", 813, 858, "怀州河内，今河南沁阳一带", 35.09, 112.94, "唐代", null, "晚唐诗歌", "以朦胧象征、华密辞采和无题诗，写出晚唐复杂心绪。", "李商隐仕途受牛李党争牵连，一生漂泊困顿。他的诗以典故密集、情感幽微和象征结构见长，无题诗尤能呈现爱、失落、政治隐喻与时间感。", ["无题", "锦瑟", "夜雨寄北"], "表达重点是幽微、象征和难以直说的情感。回答可保留暧昧与余音，不把复杂心事拆成简单结论。", ["无题诗", "锦瑟", "晚唐", "象征", "幽微"], ["https://zh.wikipedia.org/wiki/李商隐"]),
  persona("xin-qiji", "辛弃疾", "Xin Qiji", "诗人", "中国南宋词人、军事人物", "中国", 1140, 1207, "历城，今山东济南", 36.67, 117.02, "宋代", null, "豪放词", "以英雄气、家国忧思和豪放词风构成宋词高峰。", "辛弃疾早年参与抗金起义，南归后长期抱负难展。他的词既有金戈铁马的豪迈，也有壮志难酬的沉郁，把政治理想、军事经验和词体艺术结合起来。", ["永遇乐·京口北固亭怀古", "破阵子", "青玉案·元夕"], "表达重点是壮怀、家国与失意中的不屈。回答应有锋芒与热血，也承认理想被现实阻隔时的沉痛。", ["豪放词", "抗金", "家国", "壮志", "宋词"], ["https://zh.wikipedia.org/wiki/辛弃疾"]),
  persona("guan-hanqing", "关汉卿", "Guan Hanqing", "剧作家", "中国元代杂剧作家", "中国", 1220, 1300, "大都或解州等说法并存", 39.9, 116.4, "元代", null, "元杂剧", "元杂剧代表作家，以市井生命和悲剧正义塑造戏曲传统。", "关汉卿生平资料有限，通常被视为元杂剧最重要的作家之一。他的剧作善写底层人物、女性命运和社会不平，《窦娥冤》成为中国戏曲悲剧的重要范本。", ["窦娥冤", "救风尘", "望江亭"], "表达重点是市井、悲愤和被压迫者的声音。回答应看见具体人的冤屈与尊严，不把苦难写成装饰。", ["元杂剧", "窦娥冤", "戏曲", "市井", "悲剧"], ["https://zh.wikipedia.org/wiki/关汉卿"]),
  persona("tang-xianzu", "汤显祖", "Tang Xianzu", "剧作家", "中国明代戏曲家、文学家", "中国", 1550, 1616, "江西临川，今江西抚州", 27.95, 116.36, "明代", null, "临川四梦", "以至情、梦境与戏曲结构，写出明代传奇的精神深处。", "汤显祖曾任官，后以戏曲创作名世。他的临川四梦尤其《牡丹亭》强调情的力量，让梦、欲望、生命与礼法冲突在舞台上展开。", ["牡丹亭", "紫钗记", "邯郸记"], "表达重点是至情、梦境和生命欲望。回答可从礼法之外辨认真情，但不把情感简单浪漫化。", ["牡丹亭", "至情", "临川四梦", "传奇", "梦"], ["https://zh.wikipedia.org/wiki/汤显祖"]),
  persona("shen-congwen", "沈从文", "Shen Congwen", "小说家", "中国现代作家", "中国", 1902, 1988, "湖南凤凰", 27.95, 109.6, "现代中国", null, "现代乡土文学", "以湘西经验、清澈叙事和人性温柔构成现代文学独特支流。", "沈从文生于湘西，早年经历地方军旅生活，后进入现代文学与教育领域。他的小说以湘西风物、边地人物和清澈叙事见长，《边城》成为现代中文小说的经典。", ["边城", "长河", "湘行散记"], "表达重点是清澈、人性和边地生活的诗意。回答应温柔观察普通人的命运，不把乡土经验写成猎奇风景。", ["湘西", "边城", "乡土", "人性", "清澈"], ["https://zh.wikipedia.org/wiki/沈从文"]),
  persona("zhang-ailing", "张爱玲", "Eileen Chang", "小说家", "中国现代作家", "中国", 1920, 1995, "上海", 31.23, 121.47, "现代中国", null, "现代都市文学", "以冷眼、华丽细部和都市人情，写出现代亲密关系的暗面。", "张爱玲生于上海，受中西教育影响，二十世纪四十年代以小说和散文成名。她的作品善写都市家庭、男女关系和时代变动中的苍凉感，语言精确而富有质地。", ["倾城之恋", "金锁记", "半生缘"], "表达重点是冷眼、细节和苍凉人情。回答应能看见亲密关系中的算计、脆弱与命运感，语言精确不滥情。", ["都市", "苍凉", "金锁记", "女性书写", "细节"], ["https://zh.wikipedia.org/wiki/张爱玲"]),
  persona("zhu-xi", "朱熹", "Zhu Xi", "思想家", "中国南宋理学家", "中国", 1130, 1200, "尤溪，今福建尤溪", 26.17, 118.19, "宋代", "关学理学", null, "理学集大成者，以格物、理气和经典诠释重塑儒学。", "朱熹是南宋重要思想家和教育家，长期讲学著述，整理四书并建立理学体系。他以理、气、格物致知和修身工夫影响后世教育、政治伦理与东亚思想秩序。", ["四书章句集注", "朱子语类"], "表达重点是理、工夫和秩序化修身。回答应从日用实践中追问原则，让学习成为渐进而严整的自我训练。", ["理学", "格物", "四书", "修身", "经典诠释"], ["https://zh.wikipedia.org/wiki/朱熹", "https://plato.stanford.edu/entries/zhu-xi/"]),
  persona("gu-yanwu", "顾炎武", "Gu Yanwu", "思想家", "中国明末清初思想家、学者", "中国", 1613, 1682, "昆山，今江苏昆山", 31.39, 120.98, "清代", "考据与经世", null, "以经世致用、考据学和天下兴亡意识开启清初思想转向。", "顾炎武经历明清鼎革，长期游历著述，重视实学、考据和经世之用。他反思空疏学风，强调学问与天下责任相连，对清代学术风气影响深远。", ["日知录", "天下郡国利病书"], "表达重点是实学、责任和考据精神。回答应回到证据与公共担当，避免空谈姿态遮蔽现实问题。", ["经世致用", "日知录", "考据", "天下", "实学"], ["https://zh.wikipedia.org/wiki/顾炎武"]),
  persona("liang-qichao", "梁启超", "Liang Qichao", "思想家", "中国近代思想家、学者", "中国", 1873, 1929, "广东新会", 22.46, 113.03, "现代中国", null, "近代启蒙", "以新民、史学和公共写作推动近代中国思想转型。", "梁启超参与戊戌变法，流亡日本期间以报刊文章和学术著述影响巨大。他关注国民、历史、政治制度与文化更新，是近代中国公共思想和现代学术的重要人物。", ["新民说", "中国近三百年学术史"], "表达重点是启蒙、公共写作和时代转型。回答应把个人困惑放进制度与国民气质的更新之中，语气清醒而有动员力。", ["新民", "启蒙", "近代思想", "史学", "公共写作"], ["https://zh.wikipedia.org/wiki/梁启超"]),
  persona("thomas-aquinas", "托马斯·阿奎那", "Thomas Aquinas", "哲学家", "中世纪经院哲学家、神学家", "意大利", 1225, 1274, "罗卡塞卡，今意大利拉齐奥", 41.55, 13.67, "中世纪经院哲学", "经院哲学", null, "以信仰与理性、自然法和神学体系塑造中世纪思想高峰。", "托马斯·阿奎那是多明我会神学家，吸收亚里士多德哲学并建构系统神学。他在《神学大全》中讨论存在、德性、法律和神学问题，对天主教思想和西方哲学影响深远。", ["神学大全", "反异教大全"], "表达重点是秩序、理性和信仰之间的调和。回答应把问题放入层级分明的目的与德性框架中。", ["经院哲学", "自然法", "神学", "德性", "理性"], ["https://zh.wikipedia.org/wiki/托马斯·阿奎那", "https://plato.stanford.edu/entries/aquinas/"]),
  persona("spinoza", "斯宾诺莎", "Baruch Spinoza", "哲学家", "荷兰哲学家", "荷兰", 1632, 1677, "阿姆斯特丹", 52.37, 4.9, "17世纪", "理性主义", null, "以实体一元论、伦理学和自由观构成近代理性主义高峰。", "斯宾诺莎出身阿姆斯特丹犹太社群，后被逐出教会并以磨镜维生。他在《伦理学》中以几何方式讨论神、自然、心灵、情感和自由，对近代哲学影响深远。", ["伦理学", "神学政治论"], "表达重点是理性、自然和情感的理解。回答应减少责备，转向因果认识，让自由来自对必然性的清明把握。", ["实体", "理性主义", "伦理学", "自由", "自然"], ["https://zh.wikipedia.org/wiki/巴鲁赫·斯宾诺莎", "https://plato.stanford.edu/entries/spinoza/"]),
  persona("locke", "洛克", "John Locke", "哲学家", "英国哲学家、政治思想家", "英国", 1632, 1704, "英格兰萨默塞特郡林顿", 51.44, -2.74, "启蒙时代", "经验主义", null, "以经验论、自然权利和政府同意论影响近代自由主义。", "洛克经历英国政治变动，著述涉及认识论、教育和政治哲学。《人类理解论》讨论经验与观念来源，《政府论》则成为近代自由主义和宪政思想的重要文本。", ["人类理解论", "政府论", "教育漫话"], "表达重点是经验、权利和有限政府。回答应从可检验经验与个人边界出发，警惕权力越界。", ["经验主义", "自然权利", "自由主义", "政府论", "认识论"], ["https://zh.wikipedia.org/wiki/约翰·洛克", "https://plato.stanford.edu/entries/locke/"]),
  persona("rousseau", "卢梭", "Jean-Jacques Rousseau", "思想家", "启蒙时代思想家、作家", "法国", 1712, 1778, "日内瓦", 46.2, 6.14, "启蒙时代", null, "社会契约论", "以自然、教育、人民主权和自我书写改变现代政治与文学。", "卢梭生于日内瓦，长期在法国思想界活动。他的《社会契约论》《爱弥儿》《忏悔录》讨论政治共同体、教育和自我经验，深刻影响现代民主思想和浪漫主义。", ["社会契约论", "爱弥儿", "忏悔录"], "表达重点是自然、自由和共同意志。回答应追问制度如何保存人的尊严，也警惕文明虚饰遮蔽真实感受。", ["社会契约", "自然", "教育", "人民主权", "忏悔"], ["https://zh.wikipedia.org/wiki/让-雅克·卢梭", "https://plato.stanford.edu/entries/rousseau/"]),
  persona("hume", "休谟", "David Hume", "哲学家", "苏格兰哲学家、历史学家", "英国", 1711, 1776, "爱丁堡", 55.95, -3.19, "启蒙时代", "经验主义", null, "以经验论、怀疑主义和因果问题动摇近代知识基础。", "休谟是苏格兰启蒙的重要哲学家，著作涉及认识论、道德、宗教和历史。他对因果、归纳和自我同一性的怀疑，深刻影响康德以及后来的分析哲学。", ["人性论", "人类理解研究", "英国史"], "表达重点是怀疑、习惯和经验限度。回答应把确定性降温，区分证据、习惯与想象。", ["怀疑主义", "因果", "经验主义", "归纳", "苏格兰启蒙"], ["https://zh.wikipedia.org/wiki/大卫·休谟", "https://plato.stanford.edu/entries/hume/"]),
  persona("kierkegaard", "克尔凯郭尔", "Soren Kierkegaard", "哲学家", "丹麦哲学家、神学作家", "丹麦", 1813, 1855, "哥本哈根", 55.68, 12.57, "19世纪", "存在主义", null, "以个体、焦虑、信仰跳跃和存在选择开启现代存在主义问题。", "克尔凯郭尔生于哥本哈根，以多重笔名写作哲学、宗教和文学文本。他反对把信仰化为抽象体系，强调个体选择、焦虑、绝望和面对上帝的单独性。", ["非此即彼", "恐惧与战栗", "致死的疾病"], "表达重点是个体选择、焦虑和信仰深处的孤独。回答应逼近当事人的存在处境，而不躲进抽象系统。", ["个体", "焦虑", "信仰", "存在主义", "选择"], ["https://zh.wikipedia.org/wiki/索伦·克尔凯郭尔", "https://plato.stanford.edu/entries/kierkegaard/"]),
  persona("marx", "马克思", "Karl Marx", "思想家", "德国哲学家、政治经济学批判家", "德国", 1818, 1883, "特里尔", 49.76, 6.64, "19世纪", null, "历史唯物主义", "以资本批判、阶级分析和历史唯物主义重塑现代社会理论。", "马克思生于特里尔，长期流亡并在伦敦从事写作研究。他与恩格斯合作，围绕资本主义生产、阶级关系和历史变迁展开批判，对现代政治、经济和社会思想影响巨大。", ["资本论", "共产党宣言", "德意志意识形态"], "表达重点是结构、劳动和历史动力。回答应追问利益关系与生产条件，不把社会问题化约为个人道德。", ["资本", "劳动", "阶级", "历史唯物主义", "批判"], ["https://zh.wikipedia.org/wiki/卡尔·马克思", "https://plato.stanford.edu/entries/marx/"]),
  persona("freud", "弗洛伊德", "Sigmund Freud", "思想家", "奥地利精神分析学创始人", "奥地利", 1856, 1939, "弗赖贝格，今捷克普日博尔", 49.64, 18.14, "20世纪思想", "精神分析", null, "以无意识、梦和欲望理论改变现代主体与文学理解。", "弗洛伊德在维也纳行医并发展精神分析理论。他关于无意识、梦、压抑、欲望和童年经验的研究，影响心理学、文学批评、文化理论和现代思想。", ["梦的解析", "精神分析引论", "文明及其不满"], "表达重点是无意识、欲望和压抑的回声。回答应倾听表层话语背后的重复与症候，不急于道德裁判。", ["无意识", "精神分析", "梦", "欲望", "压抑"], ["https://zh.wikipedia.org/wiki/西格蒙德·弗洛伊德", "https://plato.stanford.edu/entries/freud/"]),
  persona("heidegger", "海德格尔", "Martin Heidegger", "哲学家", "德国哲学家", "德国", 1889, 1976, "梅斯基尔希", 47.99, 9.11, "20世纪思想", "存在主义", null, "以存在问题、此在和时间性重塑二十世纪欧陆哲学。", "海德格尔生于德国西南部，曾任弗赖堡大学教授。《存在与时间》重新提出存在问题，围绕此在、时间性、世界和技术展开思考，对现象学与欧陆思想影响深远。", ["存在与时间", "林中路"], "表达重点是存在、时间和人如何居于世界。回答应把问题从对象管理带回人的处境和显现方式。", ["存在", "此在", "时间性", "现象学", "技术"], ["https://zh.wikipedia.org/wiki/马丁·海德格尔", "https://plato.stanford.edu/entries/heidegger/"]),
  persona("sartre", "萨特", "Jean-Paul Sartre", "哲学家", "法国哲学家、作家", "法国", 1905, 1980, "巴黎", 48.86, 2.35, "20世纪思想", "存在主义", null, "以自由、选择、责任和存在主义文学影响二十世纪思想。", "萨特是法国存在主义代表人物，同时创作小说、戏剧和评论。他在《存在与虚无》等作品中讨论自由、虚无、他人和责任，并积极介入公共议题。", ["存在与虚无", "恶心", "禁闭"], "表达重点是自由与责任不可分割。回答应提醒人不能把选择完全推给环境，同时也不轻看处境压力。", ["存在主义", "自由", "责任", "他人", "公共介入"], ["https://zh.wikipedia.org/wiki/让-保罗·萨特", "https://plato.stanford.edu/entries/sartre/"]),
  persona("derrida", "德里达", "Jacques Derrida", "哲学家", "法国哲学家", "法国", 1930, 2004, "阿尔及利亚埃尔比亚尔", 36.77, 3.03, "20世纪思想", "后结构主义", null, "以解构、延异和文本性改变现代哲学与文学理论。", "德里达出生于阿尔及利亚，后在法国学术界活动。他的解构思想追问西方形而上学、语言、书写和差异，影响哲学、文学批评、法学和人文学科。", ["论文字学", "书写与差异", "声音与现象"], "表达重点是差异、书写和意义的不稳定。回答应细读概念缝隙，警惕任何自称天然稳固的中心。", ["解构", "延异", "书写", "文本", "后结构主义"], ["https://zh.wikipedia.org/wiki/雅克·德里达", "https://plato.stanford.edu/entries/derrida/"]),
  persona("roland-barthes", "罗兰·巴特", "Roland Barthes", "学者", "法国文学理论家、符号学家", "法国", 1915, 1980, "瑟堡", 49.63, -1.62, "20世纪思想", "后结构主义", null, "以符号学、文本理论和神话分析影响现代文学批评。", "罗兰·巴特长期从事文学批评、符号学和文化分析。他从神话、作者、文本、恋人话语和摄影等角度研究现代意义生产，是二十世纪人文学术的重要声音。", ["神话学", "S/Z", "恋人絮语", "明室"], "表达重点是符号、欲望和阅读的细部。回答应拆开日常符号如何制造意义，也保留文本中的感性闪光。", ["符号学", "文本", "神话学", "作者之死", "批评"], ["https://zh.wikipedia.org/wiki/罗兰·巴特"]),
  persona("dante", "但丁", "Dante Alighieri", "诗人", "意大利中世纪诗人", "意大利", 1265, 1321, "佛罗伦萨", 43.77, 11.25, "中世纪文学", null, "意大利文学", "以《神曲》穿越地狱、炼狱与天堂，奠定意大利文学传统。", "但丁生于佛罗伦萨，后因政治斗争流亡。他的《神曲》融合神学、政治、古典传统和个人命运，使用俗语写作，对欧洲文学和意大利语言影响深远。", ["神曲", "新生"], "表达重点是流亡、审判和灵魂上升。回答可从迷途开始，穿过罪与爱，抵达更高秩序。", ["神曲", "流亡", "中世纪", "意大利文学", "灵魂"], ["https://zh.wikipedia.org/wiki/但丁·阿利吉耶里", "https://www.britannica.com/biography/Dante-Alighieri"]),
  persona("cervantes", "塞万提斯", "Miguel de Cervantes", "小说家", "西班牙小说家、剧作家", "西班牙", 1547, 1616, "阿尔卡拉德埃纳雷斯", 40.48, -3.37, "文艺复兴", null, "西班牙黄金时代", "以《堂吉诃德》开启现代小说的反讽与自我意识。", "塞万提斯一生经历从军、被俘和贫困，晚年完成《堂吉诃德》。这部小说以骑士幻想和现实世界的碰撞，开启现代小说关于叙事、理想和反讽的复杂传统。", ["堂吉诃德", "训诫小说"], "表达重点是理想、荒唐和现实的摩擦。回答应保留可笑中的尊严，也看见梦与世界相撞的疼痛。", ["堂吉诃德", "现代小说", "反讽", "骑士", "西班牙"], ["https://zh.wikipedia.org/wiki/米格尔·德·塞万提斯", "https://www.britannica.com/biography/Miguel-de-Cervantes"]),
  persona("victor-hugo", "雨果", "Victor Hugo", "文学家", "法国浪漫主义作家", "法国", 1802, 1885, "贝桑松", 47.24, 6.02, "19世纪", null, "浪漫主义", "以宏大叙事、社会同情和浪漫主义激情塑造法国文学。", "雨果是法国浪漫主义代表，作品涵盖诗歌、戏剧和小说。他在《巴黎圣母院》《悲惨世界》中结合历史场景、社会不公和道德激情，成为十九世纪欧洲文学巨匠。", ["巴黎圣母院", "悲惨世界", "欧那尼"], "表达重点是苦难、正义和宏大同情。回答应在个人命运中看见制度阴影，也不放弃人的善意。", ["浪漫主义", "悲惨世界", "巴黎圣母院", "社会同情", "流亡"], ["https://zh.wikipedia.org/wiki/维克多·雨果", "https://www.britannica.com/biography/Victor-Hugo"]),
  persona("baudelaire", "波德莱尔", "Charles Baudelaire", "诗人", "法国诗人、文学批评家", "法国", 1821, 1867, "巴黎", 48.86, 2.35, "19世纪", null, "象征主义先声", "以现代都市、忧郁和审美反叛开启现代诗歌经验。", "波德莱尔生活在十九世纪巴黎，其《恶之花》以都市、欲望、忧郁、美和堕落构成现代诗歌的重要转折。他也以艺术批评和现代性观念影响后世。", ["恶之花", "巴黎的忧郁"], "表达重点是都市、忧郁和美的危险光泽。回答可触及阴影，但应让审美保持锋利。", ["恶之花", "现代性", "忧郁", "象征主义", "都市"], ["https://zh.wikipedia.org/wiki/夏尔·波德莱尔", "https://www.britannica.com/biography/Charles-Baudelaire"]),
  persona("t-s-eliot", "艾略特", "T. S. Eliot", "诗人", "英美诗人、文学批评家", "美国、英国", 1888, 1965, "美国圣路易斯", 38.63, -90.2, "现代主义时期", null, "现代主义诗歌", "以碎片化城市、传统意识和批评理论塑造现代主义诗歌。", "艾略特生于美国，后定居英国。他的《荒原》成为现代主义诗歌标志性作品，融合典故、断片、城市经验与精神荒芜，并以批评文章影响英语文学传统。", ["荒原", "四个四重奏", "传统与个人才能"], "表达重点是碎片、传统和精神荒原。回答应在断裂经验中寻找回声，而不急于制造完整幻象。", ["荒原", "现代主义", "批评", "传统", "断片"], ["https://zh.wikipedia.org/wiki/T·S·艾略特", "https://www.britannica.com/biography/T-S-Eliot"]),
  persona("rilke", "里尔克", "Rainer Maria Rilke", "诗人", "奥地利诗人", "奥地利", 1875, 1926, "布拉格", 50.08, 14.44, "现代主义时期", null, "现代诗歌", "以孤独、天使和内在转化写出现代诗的深处回声。", "里尔克生于布拉格德语文化圈，一生旅居欧洲多地。他的诗歌与书信以孤独、死亡、艺术和内在转化为主题，《杜伊诺哀歌》与《献给奥尔甫斯的十四行诗》影响深远。", ["杜伊诺哀歌", "献给奥尔甫斯的十四行诗", "给青年诗人的信"], "表达重点是孤独、转化和不可言说的内在震动。回答宜低声深入，让问题在诗意中慢慢显形。", ["孤独", "天使", "现代诗", "内在", "哀歌"], ["https://zh.wikipedia.org/wiki/莱内·马利亚·里尔克", "https://www.britannica.com/biography/Rainer-Maria-Rilke"]),
  persona("beckett", "贝克特", "Samuel Beckett", "剧作家", "爱尔兰剧作家、小说家", "爱尔兰", 1906, 1989, "都柏林", 53.35, -6.26, "现代主义时期", null, "荒诞派戏剧", "以等待、沉默和极简舞台写出现代存在的荒凉。", "贝克特生于都柏林，后长期用英语和法语写作。他的戏剧和小说以极简形式、重复、等待和语言失效为特征，《等待戈多》成为荒诞派戏剧的代表。", ["等待戈多", "终局", "莫洛伊"], "表达重点是等待、沉默和存在的荒凉。回答不急于安慰，而在空白中保留人的微弱坚持。", ["等待戈多", "荒诞派", "极简", "沉默", "现代戏剧"], ["https://zh.wikipedia.org/wiki/萨缪尔·贝克特", "https://www.britannica.com/biography/Samuel-Beckett"]),
  persona("calvino", "卡尔维诺", "Italo Calvino", "小说家", "意大利小说家", "意大利", 1923, 1985, "古巴圣地亚哥-德拉斯维加斯", 22.97, -82.38, "20世纪文学", null, "后现代文学", "以轻盈、结构游戏和寓言想象重塑二十世纪小说。", "卡尔维诺出生于古巴，成长于意大利，参与抵抗运动后从事文学编辑与写作。他的小说融合寓言、结构实验和哲理想象，在轻盈与精密之间拓展现代叙事。", ["看不见的城市", "寒冬夜行人", "我们的祖先"], "表达重点是轻盈、结构和想象秩序。回答可像城市地图般展开，让思想保持透明的复杂。", ["看不见的城市", "后现代", "寓言", "结构", "轻盈"], ["https://zh.wikipedia.org/wiki/伊塔洛·卡尔维诺", "https://www.britannica.com/biography/Italo-Calvino"]),
  persona("camus", "加缪", "Albert Camus", "小说家", "法国作家、思想家", "法国", 1913, 1960, "阿尔及利亚德雷昂", 36.75, 8.31, "20世纪思想", "存在主义", "荒诞文学", "以荒诞、反抗和清醒尊严书写现代人的伦理处境。", "加缪出生于法属阿尔及利亚，后在法国从事写作和公共评论。他的小说、戏剧和随笔围绕荒诞、反抗、死亡和正义展开，是二十世纪文学与思想的重要人物。", ["局外人", "鼠疫", "西西弗神话"], "表达重点是荒诞、清醒和反抗。回答应承认世界无声，却仍守住人的尊严与限度。", ["荒诞", "反抗", "局外人", "鼠疫", "清醒"], ["https://zh.wikipedia.org/wiki/阿尔贝·加缪", "https://www.britannica.com/biography/Albert-Camus"]),
  persona("gabriel-garcia-marquez", "马尔克斯", "Gabriel Garcia Marquez", "小说家", "哥伦比亚小说家", "哥伦比亚", 1927, 2014, "阿拉卡塔卡", 10.59, -74.19, "20世纪文学", null, "魔幻现实主义", "以魔幻现实主义、家族记忆和拉美历史塑造世界文学经典。", "马尔克斯生于哥伦比亚加勒比地区，长期从事新闻与小说写作。《百年孤独》将家族传奇、政治暴力、神话和日常现实交织，成为拉美文学爆炸的重要作品。", ["百年孤独", "霍乱时期的爱情", "没有人给他写信的上校"], "表达重点是孤独、记忆和现实中的神话光泽。回答可让家族与历史互相回声。", ["百年孤独", "魔幻现实主义", "拉美", "家族", "记忆"], ["https://zh.wikipedia.org/wiki/加夫列尔·加西亚·马尔克斯", "https://www.britannica.com/biography/Gabriel-Garcia-Marquez"]),
  persona("tagore", "泰戈尔", "Rabindranath Tagore", "诗人", "印度诗人、思想家", "印度", 1861, 1941, "加尔各答", 22.57, 88.36, "20世纪文学", null, "孟加拉文学", "以诗歌、歌曲、教育与人文主义连接印度传统和世界文学。", "泰戈尔出生于孟加拉文化家庭，是诗人、音乐家和教育实践者。他的作品以自然、爱、神性和人类共同体为主题，《吉檀迦利》使他获得世界声誉。", ["吉檀迦利", "飞鸟集", "戈拉"], "表达重点是歌声、自然和万物之间的敬意。回答应温柔开阔，让精神从狭窄自我中抬头。", ["吉檀迦利", "孟加拉", "诗歌", "教育", "人文主义"], ["https://zh.wikipedia.org/wiki/罗宾德拉纳特·泰戈尔", "https://www.britannica.com/biography/Rabindranath-Tagore"]),
  persona("gibran", "纪伯伦", "Kahlil Gibran", "诗人", "黎巴嫩裔诗人、作家", "黎巴嫩", 1883, 1931, "黎巴嫩卜舍里", 34.25, 36.01, "20世纪文学", null, "阿拉伯流亡文学", "以诗性寓言、灵性语言和流亡经验连接东方与西方。", "纪伯伦生于黎巴嫩，少年移居美国，后在阿拉伯语和英语之间写作。他的《先知》以寓言式散文诗讨论爱、自由、劳作、死亡和灵性，流传甚广。", ["先知", "折断的翅膀"], "表达重点是灵性、流亡和寓言式温柔。回答应像远行者低声劝慰，但避免空泛格言。", ["先知", "流亡", "寓言", "灵性", "黎巴嫩"], ["https://zh.wikipedia.org/wiki/纪伯伦·哈利勒·纪伯伦", "https://www.britannica.com/biography/Kahlil-Gibran"]),
  persona("rumi", "鲁米", "Rumi", "诗人", "波斯语苏菲诗人", "波斯", 1207, 1273, "巴尔赫，今阿富汗北部", 36.76, 66.9, "中世纪文学", null, "苏菲诗歌", "以爱、旋转和神秘体验构成波斯语诗歌的精神中心之一。", "鲁米生于中亚，后在安纳托利亚科尼亚生活和讲学。他的诗歌与苏菲传统密切相关，以爱、灵魂、师友和神圣追寻为主题，对波斯文学和世界诗歌影响深远。", ["玛斯纳维", "沙姆斯诗集"], "表达重点是爱、旋转和神圣中心。回答应从分离之痛走向内在相遇，让语言保留歌声。", ["苏菲", "波斯诗歌", "爱", "玛斯纳维", "神秘主义"], ["https://zh.wikipedia.org/wiki/鲁米", "https://www.britannica.com/biography/Rumi"]),
  persona("omar-khayyam", "奥马尔·海亚姆", "Omar Khayyam", "诗人", "波斯诗人、数学家", "波斯", 1048, 1131, "内沙布尔", 36.21, 58.8, "中世纪文学", null, "波斯诗歌", "以四行诗、时间意识和哲思怀疑构成波斯文学独特声音。", "奥马尔·海亚姆生于内沙布尔，兼具数学、天文学和诗歌声名。他被后世以《鲁拜集》记忆，诗中常见时间流逝、酒、命运和人生无常的沉思。", ["鲁拜集"], "表达重点是短歌、酒盏和时间无常。回答应承认命运阴影，也让当下拥有微光。", ["鲁拜集", "波斯诗歌", "时间", "怀疑", "四行诗"], ["https://zh.wikipedia.org/wiki/奥马尔·海亚姆", "https://www.britannica.com/biography/Omar-Khayyam"]),
  persona("murasaki-shikibu", "紫式部", "Murasaki Shikibu", "文学家", "日本平安时代作家", "日本", 973, 1014, "平安京，今日本京都", 35.01, 135.77, "平安时代", null, "日本古典文学", "以《源氏物语》开创细腻宫廷叙事和心理书写传统。", "紫式部是日本平安时代宫廷女性作家，生平资料有限。她创作的《源氏物语》以宫廷生活、情感关系和人物心理见长，被视为世界文学早期长篇叙事杰作。", ["源氏物语", "紫式部日记"], "表达重点是幽微情感、宫廷光影和无常。回答应细察关系中的礼、情与寂寞。", ["源氏物语", "平安文学", "宫廷", "心理", "物哀"], ["https://zh.wikipedia.org/wiki/紫式部", "https://www.britannica.com/biography/Murasaki-Shikibu"]),
  persona("kawabata", "川端康成", "Yasunari Kawabata", "小说家", "日本小说家", "日本", 1899, 1972, "大阪", 34.69, 135.5, "20世纪文学", null, "日本现代文学", "以物哀、静美和孤独感呈现日本现代文学的细腻侧影。", "川端康成出生于大阪，早年亲人离散，对其文学气质影响深远。他的小说常以雪、山、古都和女性形象承载孤独与美感，成为日本现代文学的重要代表。", ["雪国", "古都", "千只鹤"], "表达重点是静美、孤独和稍纵即逝的感受。回答应轻而准，让沉默处显出余韵。", ["雪国", "物哀", "日本文学", "静美", "孤独"], ["https://zh.wikipedia.org/wiki/川端康成", "https://www.britannica.com/biography/Kawabata-Yasunari"])
];

const editorial = {
  confucius: ["以礼与仁安顿人间秩序", "在礼与仁之间，安顿人间秩序。"],
  laozi: ["以退让听见自然之道", "以退为进，听万物归于自然。"],
  zhuangzi: ["以逍遥松开万物边界", "乘物游心，把自由写入大梦。"],
  mencius: ["以浩然之气守护人心", "以浩然之气，守住人的尊严。"],
  "qu-yuan": ["以孤忠照亮楚辞深处", "把孤忠沉入江水，也照亮来路。"],
  "tao-yuanming": ["以田园重排生命尺度", "归去来兮，于田园中自守其真。"],
  "li-bai": ["以月光与酒拓开胸襟", "举杯邀月，把天地写成胸襟。"],
  "du-fu": ["以沉郁之笔记山河苍生", "以沉郁之笔，记山河与苍生。"],
  "su-shi": ["以旷达安放风雨人生", "一蓑烟雨，安放旷达平生。"],
  "cao-xueqin": ["以繁华写尽人世盛衰", "借一场繁华，写尽人世盛衰。"],
  "lu-xun": ["以冷峻之笔照见病灶", "以冷峻之笔，照见沉默的病灶。"],
  "qian-zhongshu": ["以博识机锋拆解世相", "于机锋与博识中，拆解人情世相。"],
  "wang-xiaobo": ["以清醒幽默抵抗庸常", "以清醒与幽默，抵抗庸常之网。"],
  "wang-yangming": ["以良知会通知与行", "在良知微光里，使知与行相逢。"],
  homer: ["以古老歌声托起归途", "让古老歌声，托起英雄与归途。"],
  shakespeare: ["以悲喜照亮人心剧场", "借众生悲喜，照出人心剧场。"],
  goethe: ["以诗与求知拓展生命", "在诗与求知之间，拓开生命尺度。"],
  dostoevsky: ["以罪与信逼问灵魂", "于罪与信之间，逼问灵魂深渊。"],
  tolstoy: ["以广阔笔触书写良知", "以广阔笔触，写尽良知与命运。"],
  kafka: ["以荒诞之门听现实低语", "在荒诞之门前，听现实低声作响。"],
  proust: ["以记忆微光重返时间", "循记忆微光，重返逝去时光。"],
  joyce: ["以意识之河穿过城邦", "让意识成河，流过现代城邦。"],
  woolf: ["以细微波纹倾听内心", "于细微波纹中，听见内心潮汐。"],
  borges: ["以迷宫与书页容纳宇宙", "把宇宙藏入迷宫与无尽书页。"],
  socrates: ["以追问照亮灵魂深处", "以追问为灯，照向灵魂深处。"],
  plato: ["以理念寻找城邦与善", "在理念之境，寻找城邦与善。"],
  aristotle: ["以秩序观照万物知识", "以秩序观万物，使知识各安其位。"],
  augustine: ["以忏悔寻回时间与爱", "在忏悔深处，寻回时间与爱。"],
  descartes: ["以怀疑抵达清明之我", "以怀疑为径，抵达清明之我。"],
  kant: ["以法度连接星空与内心", "仰观星空，内省心中法度。"],
  hegel: ["以历史辨认精神自身", "让精神穿过历史，辨认自身。"],
  schopenhauer: ["以意志阴影听生命低语", "在意志阴影里，听见生命低语。"],
  nietzsche: ["以深渊处重估价值", "临深渊处，重估一切价值。"],
  wittgenstein: ["以语言之界量度世界", "以语言为界，量度世界边缘。"],
  foucault: ["以规训缝隙辨认权力", "于规训缝隙间，辨认权力形状。"],
  "hannah-arendt": ["以公共世界守护行动", "在公共世界里，守护思考与行动。"],
  xunzi: ["以礼法磨砺人的形质", "以礼法为砺，磨出人的尺度。"],
  "han-feizi": ["以冷眼辨认权力机关", "在法术势之间，看清权力暗流。"],
  "sima-qian": ["以史笔承担命运之重", "忍辱成史，替众生命运立传。"],
  "wang-wei": ["以空山月色安顿心境", "空山一声鸟，万念归于澄明。"],
  "bai-juyi": ["以平易诗心照见民生", "把世间疾苦，写成明白诗行。"],
  "li-shangyin": ["以幽微辞采封存心事", "锦瑟弦中，藏着难言心事。"],
  "xin-qiji": ["以壮怀照见家国山河", "铁马入梦，词心仍向山河。"],
  "guan-hanqing": ["以戏曲替冤屈发声", "让窦娥一声，震醒沉默人间。"],
  "tang-xianzu": ["以至情穿过礼法之墙", "一梦牡丹，唤醒生死之间。"],
  "shen-congwen": ["以湘西清水照见人性", "清水照边城，人心自有微光。"],
  "zhang-ailing": ["以冷眼写尽都市苍凉", "华灯背后，人情自有冷香。"],
  "zhu-xi": ["以格物工夫整理人心", "格物穷理，使日用之学有根。"],
  "gu-yanwu": ["以实学守住天下责任", "考据入世，天下仍在心上。"],
  "liang-qichao": ["以新民之笔催动时代", "笔端风雷，唤起新民之梦。"],
  "thomas-aquinas": ["以理性扶住信仰穹顶", "在理性阶梯上，仰望信仰。"],
  spinoza: ["以自然之理澄明自由", "把万物归于自然，也归于自由。"],
  locke: ["以经验守护个人边界", "从经验出发，守住自由边界。"],
  rousseau: ["以自然之心追问文明", "在文明尘土里，寻找自然之心。"],
  hume: ["以怀疑温柔削弱确定", "让确定性退后，经验慢慢说话。"],
  kierkegaard: ["以孤独选择逼近信仰", "在焦虑深处，独自作出选择。"],
  marx: ["以资本批判照见结构", "从劳动深处，看见历史暗流。"],
  freud: ["以梦与欲望叩问自我", "梦的裂缝里，欲望低声回返。"],
  heidegger: ["以时间追问存在之居", "在时间深处，追问何以为在。"],
  sartre: ["以自由之重逼人负责", "自由落在肩上，责任无处可逃。"],
  derrida: ["以细读松动意义中心", "在文字缝隙里，中心悄然松动。"],
  "roland-barthes": ["以符号细读日常神话", "日常符号中，神话悄悄生长。"],
  dante: ["以流亡之路穿越灵魂", "从幽暗中行，直至群星重现。"],
  cervantes: ["以荒唐骑士守护理想", "瘦马长矛间，理想仍有光。"],
  "victor-hugo": ["以宏大同情拥抱苦难", "苦难如夜，人心仍向黎明。"],
  baudelaire: ["以都市忧郁炼出诗金", "在污浊街灯下，炼出幽暗之花。"],
  "t-s-eliot": ["以荒原碎片寻回传统", "荒原碎片里，旧声仍在回响。"],
  rilke: ["以孤独倾听内在天使", "独处深处，天使掠过心弦。"],
  beckett: ["以等待写尽存在荒凉", "等候无回应，人仍低声坚持。"],
  calvino: ["以轻盈结构安放想象", "看不见的城，在纸上轻轻升起。"],
  camus: ["以荒诞守住清醒尊严", "在荒诞之中，守住清醒尊严。"],
  "gabriel-garcia-marquez": ["以孤独开出家族繁花", "让孤独开花，长成百年家族。"],
  tagore: ["以歌声向万物致意", "以歌声渡河，向万物致意。"],
  gibran: ["以流亡寓言安顿灵魂", "远行者低语，替灵魂点灯。"],
  rumi: ["以旋转与爱寻找中心", "在旋转与爱里，寻找神圣中心。"],
  "omar-khayyam": ["以酒盏照见时间无常", "一只酒盏里，盛着流年无常。"],
  "murasaki-shikibu": ["以宫廷幽光书写物哀", "帘影深处，情与无常相照。"],
  kawabata: ["以雪国静美照见孤独", "雪落无声，孤独自有清光。"]
};

const routes = [
  route("east-west-dialogue", "中西对照", "把东方修身传统与西方哲学、现代文学并置，观察人格理想如何在不同文明中展开。", ["confucius", "socrates", "laozi", "plato", "zhuangzi", "aristotle", "zhu-xi", "augustine", "wang-yangming", "descartes", "lu-xun", "nietzsche", "qian-zhongshu", "wittgenstein", "wang-xiaobo", "foucault"], true),
  route("oriental-thought", "东方思想", "从先秦诸子到理学、经世与现代启蒙，梳理中国人格修养和现实批判的路线。", ["confucius", "laozi", "zhuangzi", "mencius", "xunzi", "han-feizi", "zhu-xi", "wang-yangming", "gu-yanwu", "liang-qichao", "lu-xun", "qian-zhongshu", "wang-xiaobo"]),
  route("chinese-literature", "中国文学", "沿诗、史、词、曲、小说与现代文学，观看中文传统如何书写人心和时代。", ["qu-yuan", "sima-qian", "tao-yuanming", "wang-wei", "li-bai", "du-fu", "bai-juyi", "li-shangyin", "su-shi", "xin-qiji", "guan-hanqing", "tang-xianzu", "cao-xueqin", "lu-xun", "shen-congwen", "zhang-ailing"]),
  route("western-philosophy", "西方哲学", "从雅典对话到中世纪、近代主体、社会批判和二十世纪欧陆思想。", ["socrates", "plato", "aristotle", "augustine", "thomas-aquinas", "descartes", "spinoza", "locke", "rousseau", "hume", "kant", "hegel", "schopenhauer", "kierkegaard", "marx", "nietzsche", "wittgenstein", "heidegger", "sartre", "foucault", "derrida", "hannah-arendt"]),
  route("world-literature", "世界文学", "沿着史诗、戏剧、小说和现代叙事，观看世界文学如何书写命运、记忆和内心。", ["homer", "dante", "shakespeare", "cervantes", "goethe", "victor-hugo", "baudelaire", "dostoevsky", "tolstoy", "kafka", "proust", "joyce", "woolf", "borges", "calvino", "camus", "gabriel-garcia-marquez"]),
  route("modernism", "现代主义", "聚焦二十世纪前后的语言实验、意识结构、荒诞经验和现代制度感。", ["nietzsche", "freud", "baudelaire", "kafka", "proust", "joyce", "woolf", "t-s-eliot", "rilke", "borges", "beckett", "camus", "foucault", "roland-barthes"]),
  route("civilization-border", "文明边界", "从南亚、中东、波斯、日本与拉美边界，看文学如何跨越语言和文明。", ["tagore", "gibran", "rumi", "omar-khayyam", "murasaki-shikibu", "kawabata", "calvino", "borges", "gabriel-garcia-marquez"])
];

const themesToAdd = {
  秦汉: ["bronze-history", "#c2ae82", "rgba(18, 15, 10, 0.36)"],
  魏晋南北朝: ["mist-ink", "#b7c1b8", "rgba(11, 16, 15, 0.34)"],
  元代: ["stage-umber", "#b8a17a", "rgba(18, 14, 11, 0.36)"],
  中世纪经院哲学: ["stone-gold", "#c5b894", "rgba(16, 15, 12, 0.36)"],
  中世纪文学: ["manuscript-night", "#c2b486", "rgba(17, 14, 10, 0.38)"],
  中世纪: ["manuscript-night", "#c2b486", "rgba(17, 14, 10, 0.38)"],
  平安时代: ["moon-paper", "#c8bfa3", "rgba(15, 14, 12, 0.34)"],
  "20世纪文学": ["modern-document", "#aebfc1", "rgba(9, 13, 17, 0.4)"]
};

const routeThemesToAdd = {
  "chinese-literature": ["ink-literature", "#c4b58e", "rgba(16, 14, 10, 0.36)"],
  "civilization-border": ["world-border", "#b9c7b4", "rgba(8, 13, 12, 0.4)"]
};

const existing = JSON.parse(fs.readFileSync(PERSONAS_PATH, "utf8"));
const byId = new Map(existing.map((item) => [item.id, item]));
for (const item of additions) byId.set(item.id, item);

const merged = Array.from(byId.values()).map((item) => ({
  ...item,
  visualLat: null,
  visualLng: null,
  avatarUrl: item.avatarUrl || null,
  avatarLocal: item.avatarLocal || null,
  avatarCredit: normalizeAvatarCredit(item),
  dataQuality: {
    level: item.dataQuality?.level || "partial",
    biography: item.dataQuality?.biography || "partial",
    works: item.dataQuality?.works || "partial",
    avatar: item.avatarUrl || item.avatarLocal ? "partial" : "missing",
    birthplace: item.dataQuality?.birthplace || "partial",
    notes: item.dataQuality?.notes || "资料来自公开百科与参考页，头像版权需人工复核。"
  }
}));

const resolved = resolveVisualCoordinates(merged).map(({ lat, lng, importance, ...item }) => item);
fs.writeFileSync(PERSONAS_PATH, `${JSON.stringify(resolved, null, 2)}\n`, "utf8");
fs.writeFileSync(ROUTES_PATH, `${JSON.stringify(routes, null, 2)}\n`, "utf8");

const copy = JSON.parse(fs.readFileSync(COPY_PATH, "utf8"));
copy.personaEditorial = Object.fromEntries(
  resolved.map((item) => {
    const [oneLine, whisper] = editorial[item.id] || [item.summary.slice(0, 24), item.summary.slice(0, 24)];
    return [item.id, { oneLine, whisper }];
  })
);
copy.routeCaptions = Object.fromEntries(
  routes.map((item) => [
    item.id,
    Object.fromEntries(
      item.personaIds.map((id) => {
        const personaItem = resolved.find((person) => person.id === id);
        const caption = copy.personaEditorial[id]?.oneLine || personaItem?.summary || "";
        return [id, `${personaItem?.displayName || id}：${caption}`];
      })
    )
  ])
);
fs.writeFileSync(COPY_PATH, `${JSON.stringify(copy, null, 2)}\n`, "utf8");

const themes = JSON.parse(fs.readFileSync(THEMES_PATH, "utf8"));
for (const [era, [temperature, accent, overlay]] of Object.entries(themesToAdd)) {
  themes.eras[era] ||= { temperature, accent, overlay };
}
for (const [routeId, [temperature, accent, overlay]] of Object.entries(routeThemesToAdd)) {
  themes.routes[routeId] ||= { temperature, accent, overlay };
}
fs.writeFileSync(THEMES_PATH, `${JSON.stringify(themes, null, 2)}\n`, "utf8");

const manifest = resolved.map((item) => ({
  personaId: item.id,
  preferredSource: "Wikimedia Commons / Wikipedia",
  suggestedSearch: `${item.latinName || item.displayName} portrait Wikimedia Commons`,
  status: item.avatarUrl || item.avatarLocal ? "remoteUrlNeedsReview" : "pendingDownload",
  notes: item.avatarUrl || item.avatarLocal ? "已有公开 URL，但仍需人工确认版权与裁切。" : "需要人工确认版权和下载，当前使用文字占位头像。"
}));
fs.writeFileSync(AVATAR_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`Expanded atlas to ${resolved.length} personas, ${routes.length} routes.`);

function persona(id, name, latinName, category, identity, nationality, birthYear, deathYear, birthplace, birthLat, birthLng, era, school, movement, summary, biography, works, personaSummary, keywords, references) {
  return {
    id,
    name,
    displayName: name,
    latinName,
    category,
    identity,
    nationality,
    birthYear,
    deathYear,
    birthplace,
    birthLat,
    birthLng,
    visualLat: null,
    visualLng: null,
    era,
    school,
    movement,
    avatarUrl: null,
    avatarLocal: null,
    avatarCredit: {
      sourceName: "来源未详",
      sourceUrl: null,
      license: null,
      needsReview: true
    },
    summary,
    biography,
    works,
    personaSummary,
    keywords,
    references,
    sourceUrl: references[0] || null,
    dataQuality: {
      level: "partial",
      biography: "partial",
      works: "verified",
      avatar: "missing",
      birthplace: birthLat === null || birthLng === null ? "partial" : "verified",
      notes: "资料来自公开百科与参考页，头像版权需人工复核。"
    }
  };
}

function route(id, name, description, personaIds, isDefault = false) {
  return isDefault ? { id, name, description, personaIds, default: true } : { id, name, description, personaIds };
}

function normalizeAvatarCredit(item) {
  const credit = item.avatarCredit || {};
  return {
    sourceName: credit.sourceName || "来源未详",
    sourceUrl: credit.sourceUrl || null,
    license: credit.license || null,
    needsReview: true
  };
}
