import type { Choice, Effect, EventDef, Focus, LogKind } from './types.ts';
import { REGIONS } from './data.ts';
import { STORY_EVENTS } from './story.ts';
import { LIFE_EVENTS } from './lifelines.ts';
const c = (label: string, hint: string, effect: Effect, extra: Partial<Choice> = {}): Choice => ({ label, hint, effect, autoScore: 5, ...extra });

const stories: EventDef[] = [
  { id: 'child-pebble', title: '溪边的第一块石头', text: '两岁那年，你在溪边捡起一块温润的石头。大人唤你回家，水面却映着从未见过的远山。', category: 'life', minAge: 2, maxAge: 2, once: true, choices: [c('仔细观察石上的纹路', '悟性 +5', { stats: { insight: 5 } }), c('把石头送给身边的孩子', '道心 +5 · 同道情谊 +5', { stats: { mind: 5 }, npcRelation: 5 }), c('沿溪流走得更远一些', '根基 +5 · 体魄 +3', { stats: { foundation: 5, health: 3 } })] },
  { id: 'child-root', title: '山门测灵', text: '六岁春日，行脚道人来到你居住的街巷。掌心一盏灵灯，照见每个孩子不同的天赋。无论结果如何，世上并非只有一条修行路。', category: 'life', minAge: 6, maxAge: 6, once: true, choices: [c('请教吐纳之法', '修为 +10 · 悟性 +3', { progress: 10, stats: { insight: 3 }, flag: 'breathing' }), c('求学锻体的功夫', '根基 +8 · 战技 +4', { stats: { foundation: 8, combat: 4 }, flag: 'early-body' }), c('询问山外的世界', '声望 +5 · 道心 +4', { stats: { reputation: 5, mind: 4 } })] },
  { id: 'child-letter', title: '一封未寄出的信', text: '你在旧书箱底找到一封写给远方仙人的信。家中长辈曾有过求仙的念头，后来却把一生留给了生计与家人。', category: 'life', minAge: 12, maxAge: 12, once: true, choices: [c('代他们去看山外', '道心 +7 · 获得「远行之愿」', { stats: { mind: 7 }, flag: 'travel-vow' }), c('留下来帮家里度过难关', '灵石 +25 · 根基 +4', { stones: 25, stats: { foundation: 4 } }), c('先读完箱里的旧书', '悟性 +9', { stats: { insight: 9 } })] },
  { id: 'departure', title: '十六岁，启程去', text: '行囊很轻，前路很长。住惯的街巷又过了一季，你终于要决定，如何度过属于自己的这一生。', category: 'life', minAge: 16, maxAge: 16, once: true, choices: [c('把长生当作此生的方向', '修为 +15 · 道心 +5', { progress: 15, stats: { mind: 5 }, flag: 'seek-eternity' }), c('先学一门可以立足的手艺', '丹术 +12 · 灵草 +4', { stats: { alchemy: 12 }, item: 'herb', amount: 4 }), c('结交同道，走遍山河', '声望 +10 · 同道情谊 +10', { stats: { reputation: 10 }, npcRelation: 10 })] },
  { id: 'vow', title: '你为何修行', text: '十八岁的夜晚，灯火将尽。一路听过许多关于长生的故事，现在轮到你回答：究竟为什么踏上这条路？', category: 'life', minAge: 18, maxAge: 18, once: true, choices: [c('为见未见之天地', '悟性 +8 · 道心 +5', { stats: { insight: 8, mind: 5 }, flag: 'vow-world' }), c('为护身边之人', '同道情谊 +12 · 根基 +5', { npcRelation: 12, stats: { foundation: 5 }, flag: 'vow-people' }), c('为求大道，不负此生', '修为 +20 · 根基 +4', { progress: 20, stats: { foundation: 4 }, flag: 'vow-dao' })] },
  { id: 'cave', title: '雨夜古修洞府', text: '雨水冲开山壁，一座古修洞府露出门扉。残阵仍有灵光流转，里面传来悠长的风声。', category: 'encounter', minAge: 16, minRealm: 1, focus: 'adventure', once: true, weight: 2, choices: [c('以剑破阵，取其中传承', '成功 48%：修为 +60、灵玉 +2；失败：体魄 −32', { progress: 60, item: 'jade', amount: 2, flag: 'cave-heir' }, { chance: 0.48, failure: { stats: { health: -32, mind: -6 } }, successText: '你破开残阵，带走了石台上的两枚灵玉。', failureText: '禁制反噬，你拖着伤躯退到雨中。', autoScore: 2 }), c('细读阵纹，再寻入口', '需悟性 50 · 灵石 −15 · 修为 +35 · 悟性 +6', { progress: 35, stats: { insight: 6 }, flag: 'cave-studied' }, { requiresStat: ['insight', 50], cost: 15, autoScore: 8 }), c('记下位置，交给坊市执事', '灵石 +30 · 声望 +8', { stones: 30, stats: { reputation: 8 }, flag: 'cave-reported' })] },
  { id: 'cave-return', title: '旧洞府的新山门', text: '昔日上报的洞府已被修复成试炼场。执事认出了你，特地为你留下一席参悟的位置。', category: 'encounter', minAge: 25, flag: 'cave-reported', once: true, choices: [c('重访洞府，参悟壁刻', '修为 +30 · 根基 +8', { progress: 30, stats: { foundation: 8 } }), c('请执事替你引荐同道', '声望 +12 · 灵石 +30', { stats: { reputation: 12 }, stones: 30 })] },
  { id: 'merchant-rescue', title: '山道上的商队', text: '暴雨毁了山路，一支运送药材的商队陷在泥泞中。领队仍在拼命护着那些将被水冲走的箱子。', category: 'encounter', minAge: 16, focus: 'adventure', once: true, choices: [c('帮他们把药材搬上高地', '体魄 −8 · 声望 +8', { stats: { health: -8, reputation: 8 }, flag: 'saved-merchant' }, { delayed: { after: 8, title: '八年前的那场雨', text: '当年获救的商人终于找到你。没有忘记的善意，化作一匣灵石与两株好药。', effect: { stones: 90, item: 'herb', amount: 2 } }, autoScore: 8 }), c('买下他们难以带走的药材', '灵石 −20 · 灵草 +6', { item: 'herb', amount: 6 }, { cost: 20 }), c('赶路要紧，留下干粮便走', '道心 +2', { stats: { mind: 2 } })] },
  { id: 'wounded-friend', title: '负伤的故人', text: '一位与你同年踏上仙途的道友重伤而归。门外放着一把断剑，屋内迟迟没有灯火。', category: 'relationship', minAge: 20, once: true, choices: [c('守在身旁，为其请医', '灵石 −35 · 情谊 +20 · 道心 +5', { npcRelation: 20, stats: { mind: 5 }, flag: 'friend-saved' }, { cost: 35, delayed: { after: 12, title: '一剑还恩', text: '多年前照料过的道友赠你一柄秋水剑，说今后不必独自赶路。', effect: { item: 'sword', amount: 1, npcRelation: 8 } }, autoScore: 8 }), c('留下自己珍藏的药草', '情谊 +8 · 声望 +3', { npcRelation: 8, stats: { reputation: 3 } }), c('此事太深，暂且回避', '道心 −4', { stats: { mind: -4 } }, { autoScore: 1 })] },
  { id: 'auction', title: '坊市压轴之物', text: '散场前，掌柜拿出一卷没有署名的养气篇。纸页泛黄，但行间的气机仍然清晰。', category: 'economy', minAge: 16, once: true, notFlag: 'read-manual', choices: [c('花灵石将它买下', '灵石 −45 · 获得太素养气篇', { item: 'manual', amount: 1 }, { cost: 45, autoScore: 7 }), c('只借灯光记住几句', '悟性 +4', { stats: { insight: 4 } }), c('替掌柜做一日抄书工', '灵石 +16 · 根基 +2', { stones: 16, stats: { foundation: 2 } })] },
  { id: 'heart-demon', title: '闭关中的旧梦', text: '夜半入定，旧日遗憾化作心魔。它没有面目，只一遍遍问你，是否还记得来时的路。', category: 'cultivation', minRealm: 1, focus: 'cultivate', cooldown: 15, choices: [c('直视旧事，接纳当年的自己', '修为 −10 · 道心 +15 · 根基 +5', { progress: -10, stats: { mind: 15, foundation: 5 } }, { autoScore: 8 }), c('强行斩断杂念', '成功 60%：修为 +30；失败：道心 −20', { progress: 30 }, { chance: 0.6, failure: { stats: { mind: -20 } }, autoScore: 2 }), c('出关，看看人间灯火', '道心 +10 · 体魄 +6', { stats: { mind: 10, health: 6 } })] },
  { id: 'sect-dispute', title: '同门相争', text: '两名弟子为一份灵田份额争执不休。执事迟迟未到，越来越多的人围在廊下。', category: 'relationship', sect: true, cooldown: 12, choices: [c('以门规调停', '悟性需求 40 · 贡献 +20 · 声望 +6', { contribution: 20, stats: { reputation: 6 } }, { requiresStat: ['insight', 40], autoScore: 8 }), c('替弱势的一方出头', '战技 +4 · 体魄 −10 · 声望 +8', { stats: { combat: 4, health: -10, reputation: 8 } }), c('请来执事，避免激化', '贡献 +8 · 道心 +3', { contribution: 8, stats: { mind: 3 } })] },
  { id: 'sect-war', title: '山门告急', text: '敌对修士逼近山门。护山阵外火光冲天，宗主召集弟子选择各自职责。', category: 'world', minRealm: 2, sect: true, cooldown: 35, choices: [c('守住外阵', '需战技 50 · 体魄 −18 · 贡献 +65', { stats: { health: -18, reputation: 12 }, contribution: 65 }, { requiresStat: ['combat', 50] }), c('在后方救治伤者', '丹术 +8 · 贡献 +35 · 灵石 −20', { stats: { alchemy: 8 }, contribution: 35 }, { cost: 20, autoScore: 8 }), c('护送凡人离开', '道心 +10 · 声望 +15 · 贡献 +15', { stats: { mind: 10, reputation: 15 }, contribution: 15 })] },
  { id: 'old-home', title: '故乡来信', text: '许多年后，故乡来人带来一封信：你小时候常去的旧街还在，卖糖的老人已经不在。信里夹着孩子们画的画像，问你如今是不是成了仙人。', category: 'life', minAge: 45, once: true, choices: [c('留下钱粮与一卷启蒙书', '灵石 −40 · 道心 +12 · 声望 +10', { stats: { mind: 12, reputation: 10 }, flag: 'home-school' }, { cost: 40, delayed: { after: 20, title: '旧街上的读书声', text: '你资助的学堂培养出一名药师。他带着谢礼来见你，也带来故乡安好的消息。', effect: { stones: 80, stats: { mind: 8 } } }, autoScore: 8 }), c('读着旧信，坐到天亮', '悟性 +8 · 道心 +8', { stats: { insight: 8, mind: 8 } }), c('收好旧信，继续赶路', '修为 +20 · 道心 −4', { progress: 20, stats: { mind: -4 } }, { autoScore: 2 })] },
  { id: 'disciple', title: '跪在门外的少年', text: '一个没有显赫出身的少年跪在洞府外，说愿以十年杂役换一个求道的机会。他很像许多年前的你。', category: 'relationship', minRealm: 2, minAge: 50, once: true, choices: [c('收下他，慢慢教', '修为 −20 · 声望 +15', { progress: -20, stats: { reputation: 15 }, flag: 'took-disciple' }, { delayed: { after: 25, title: '青出于蓝', text: '你亲手引入门的少年已能独当一面。他将第一笔历练所得留在你的案前。', effect: { stones: 180, stats: { mind: 15, reputation: 10 } } }, autoScore: 8 }), c('赠他启蒙功法，送往宗门', '灵石 −25 · 声望 +8 · 道心 +6', { stats: { reputation: 8, mind: 6 } }, { cost: 25 }), c('闭关在即，婉言谢绝', '根基 +4', { stats: { foundation: 4 } })] },
  { id: 'century', title: '人间已过百年', text: '第一百个生辰，没有酒宴。你翻开最早的行记，发现曾经无比鲜明的面孔，已经需要借助名字才能想起。', category: 'life', minAge: 100, maxAge: 110, once: true, choices: [c('为故人写下一卷小传', '道心 +15 · 悟性 +10', { stats: { mind: 15, insight: 10 }, flag: 'wrote-memoir' }), c('继续闭关，不问来路', '修为 +45 · 道心 −8', { progress: 45, stats: { mind: -8 } }, { autoScore: 2 }), c('与仍在的道友喝一壶茶', '情谊 +15 · 道心 +12', { npcRelation: 15, stats: { mind: 12 } })] },
  { id: 'spirit-beast', title: '落入陷阱的灵狐', text: '药圃边，一只幼小灵狐被旧猎夹困住。它警惕地望着你，尾尖有微弱的灵光。', category: 'encounter', minAge: 16, once: true, choices: [c('解开猎夹，照料伤口', '灵石 −15 · 道心 +8', { stats: { mind: 8 }, flag: 'fox-friend' }, { cost: 15, delayed: { after: 6, title: '狐狸的报答', text: '清晨，洞府门口多了三枚灵玉。树梢上，一条白色尾巴一闪而过。', effect: { item: 'jade', amount: 3 } }, autoScore: 8 }), c('带去百草谷求助', '声望 +6 · 丹术 +4', { stats: { reputation: 6, alchemy: 4 } }), c('打开夹子便离开', '道心 +4', { stats: { mind: 4 } })] },
  { id: 'forbidden', title: '禁术残页', text: '交易会上有人悄悄递来一页残卷。它许诺更快的修行，代价却写在背面的血色小字里。', category: 'cultivation', minRealm: 2, once: true, choices: [c('以寿元换取捷径', '寿元上限 −35 · 修为 +100 · 道心 −18', { lifespan: -35, progress: 100, stats: { mind: -18 }, flag: 'forbidden-art' }, { autoScore: -4 }), c('拆解术法，只研究原理', '需悟性 65 · 悟性 +8 · 根基 +10', { stats: { insight: 8, foundation: 10 } }, { requiresStat: ['insight', 65], autoScore: 9 }), c('将残页封存', '道心 +8', { stats: { mind: 8 } })] },
  { id: 'forbidden-echo', title: '血墨重新浮现', text: '当年研习的禁术开始反噬。你在铜镜中看见一个比自己苍老得多的身影，旧日的捷径索要新的代价。', category: 'cultivation', flag: 'forbidden-art', minRealm: 2, cooldown: 30, choices: [c('散去部分修为，重新养气', '修为 −55 · 根基 +10 · 道心 +15', { progress: -55, stats: { foundation: 10, mind: 15 } }, { autoScore: 8 }), c('以药物暂时压制', '灵石 −90 · 体魄 +12', { stats: { health: 12 } }, { cost: 90 }), c('继续强行运转', '体魄 −30 · 修为 +25', { stats: { health: -30 }, progress: 25 }, { autoScore: -6 })] },
  { id: 'sword-peak', title: '峰顶问剑', text: '一位白衣剑客在峰顶等你。他并不求胜，只想看看这世上还有多少不同的剑意。', category: 'cultivation', minRealm: 2, focus: 'adventure', cooldown: 22, choices: [c('以剑会友', '战技 +10 · 体魄 −12 · 根基 +5', { stats: { combat: 10, health: -12, foundation: 5 } }), c('旁观其剑势，静心参悟', '悟性 +7 · 修为 +15', { stats: { insight: 7 }, progress: 15 }, { autoScore: 8 }), c('请他指点同代的道友', '情谊 +10 · 声望 +6', { npcRelation: 10, stats: { reputation: 6 } })] },
  { id: 'pill-contest', title: '百草丹会', text: '药香笼罩整条长街。丹师们以一炉丹药论高下，也互相交流那些不写进丹方的细节。', category: 'economy', minAge: 20, focus: 'alchemy', cooldown: 15, choices: [c('参加丹会', '需丹术 40 · 灵石 +90 · 声望 +12', { stones: 90, stats: { reputation: 12, alchemy: 5 } }, { requiresStat: ['alchemy', 40], autoScore: 9 }), c('在旁观摩学习', '丹术 +9 · 悟性 +3', { stats: { alchemy: 9, insight: 3 } }), c('摆摊出售采药心得', '灵石 +32 · 声望 +3', { stones: 32, stats: { reputation: 3 } })] },
  { id: 'flood', title: '江水决堤', text: '大雨连下数日，下游村镇告急。修士可以御风离开，但河堤上的凡人无处可去。', category: 'world', minRealm: 1, region: 'river', cooldown: 35, choices: [c('帮助筑堤，救下居民', '体魄 −15 · 声望 +18 · 道心 +10', { stats: { health: -15, reputation: 18, mind: 10 }, flag: 'saved-town' }, { autoScore: 8 }), c('出资购买救灾粮食', '灵石 −60 · 声望 +14', { stats: { reputation: 14 }, flag: 'saved-town' }, { cost: 60 }), c('帮助运送求援的消息', '声望 +5 · 根基 +3', { stats: { reputation: 5, foundation: 3 } })] },
  { id: 'town-gratitude', title: '河畔的长生祠', text: '经过昔日受灾的村镇，你发现百姓为当年救灾的修士立了小祠。没有神迹，只有几盏常亮的灯。', category: 'life', flag: 'saved-town', minAge: 40, once: true, choices: [c('悄悄替他们修好河堤', '灵石 −30 · 道心 +18', { stats: { mind: 18 } }, { cost: 30 }), c('留下新的医药知识', '声望 +12 · 丹术 +5', { stats: { reputation: 12, alchemy: 5 } })] },
  { id: 'snow-hermit', title: '风雪中的守夜人', text: '雪域孤亭里，一名老修士守着将灭的炭火。他说自己等的不是某个人，而是一场看了百年仍未看透的雪。', category: 'cultivation', region: 'north', once: true, choices: [c('陪他看一夜雪', '道心 +14 · 悟性 +8', { stats: { mind: 14, insight: 8 } }, { autoScore: 8 }), c('请教御寒锻体之术', '根基 +10 · 战技 +5', { stats: { foundation: 10, combat: 5 } }), c('交换一块灵玉', '灵石 −20 · 灵玉 +2', { item: 'jade', amount: 2 }, { cost: 20 })] },
  { id: 'desert-mirror', title: '沙海幻城', text: '赤霞落尽时，沙海中升起一座不该存在的城。街道上有人叫你的名字，声音像极了早已故去的亲人。', category: 'encounter', region: 'desert', cooldown: 40, choices: [c('进入幻城寻觅', '成功 45%：修为 +100；失败：体魄 −35、道心 −15', { progress: 100, item: 'jade', amount: 3 }, { chance: 0.45, failure: { stats: { health: -35, mind: -15 } }, autoScore: 0 }), c('守住本心，静观幻象', '需道心 60 · 根基 +12 · 修为 +35', { stats: { foundation: 12 }, progress: 35 }, { requiresStat: ['mind', 60], autoScore: 9 }), c('闭眼绕行', '道心 +6', { stats: { mind: 6 } })] },
  { id: 'jade-debate', title: '玉京百家论道', text: '仙城的白玉台上，百家各言其道。剑、丹、阵、体，没有哪一条路能回答全部问题。', category: 'cultivation', region: 'central', cooldown: 25, choices: [c('登台阐述自己的道', '需悟性 70 · 声望 +20 · 修为 +60', { stats: { reputation: 20 }, progress: 60 }, { requiresStat: ['insight', 70], autoScore: 9 }), c('做一名认真听讲的人', '悟性 +10 · 根基 +8', { stats: { insight: 10, foundation: 8 } }), c('结识一位远方来客', '情谊 +12 · 灵石 +50', { npcRelation: 12, stones: 50 })] },
  { id: 'bottleneck', title: '水满而不溢', text: '体内真气已近充盈，却始终缺少一线契机。窗外一片落叶旋转很久，才轻轻落在水上。', category: 'cultivation', minRealm: 1, focus: 'study', cooldown: 18, choices: [c('放下急切，再打磨根基', '修为 −8 · 根基 +12 · 道心 +8', { progress: -8, stats: { foundation: 12, mind: 8 } }, { autoScore: 8 }), c('以灵石助推周天', '灵石 −35 · 修为 +30', { progress: 30 }, { cost: 35 }), c('记录这段困惑', '悟性 +8', { stats: { insight: 8 } })] },
  { id: 'empty-seat', title: '茶席上的空位', text: '约定聚会的日子到了，茶席上却多出一个空位。有些人忙于闭关，有些人再也不会来。', category: 'relationship', minAge: 80, cooldown: 35, choices: [c('把眼前的人留得久一点', '情谊 +12 · 道心 +10', { npcRelation: 12, stats: { mind: 10 } }), c('为所有人煮一壶旧茶', '悟性 +7 · 道心 +8', { stats: { insight: 7, mind: 8 } }), c('把空位当作修行的提醒', '根基 +8 · 修为 +25', { stats: { foundation: 8 }, progress: 25 })] },
  { id: 'last-lecture', title: '传道之前', text: '宗门请你开坛授课。你望着台下那些明亮的眼睛，终于明白，修行也可以不是一个人的事。', category: 'relationship', minRealm: 3, sect: true, once: true, choices: [c('毫无保留地讲授所学', '修为 −30 · 贡献 +80 · 声望 +20', { progress: -30, contribution: 80, stats: { reputation: 20 }, flag: 'open-teaching' }, { autoScore: 9 }), c('讲自己的失败与弯路', '贡献 +45 · 道心 +15', { contribution: 45, stats: { mind: 15 }, flag: 'open-teaching' }), c('只论道，不授术', '贡献 +25 · 悟性 +6', { contribution: 25, stats: { insight: 6 } })] },
  { id: 'heaven-sign', title: '天门的一缕微光', text: '天地间的风忽然停止。你在神识深处感到，一道遥远的门正在回应你，却没有许诺门后是什么。', category: 'cultivation', minRealm: 5, once: true, choices: [c('先安顿身后之事', '道心 +15 · 根基 +10 · 灵石 −100', { stats: { mind: 15, foundation: 10 }, flag: 'ready-heaven' }, { cost: 100, autoScore: 9 }), c('将一生所学写成道书', '声望 +20 · 悟性 +10', { stats: { reputation: 20, insight: 10 }, flag: 'wrote-dao' }), c('继续向那微光靠近', '修为 +150 · 道心 −10', { progress: 150, stats: { mind: -10 } }, { autoScore: 2 })] },
];

const turningPoints: EventDef[] = [
  {
    id: 'fate-first', title: '三条不能同时走的路',
    text: '二十八岁的深秋，边境山城发来求援，孤峰古修递来传承，灵石商盟同时奉上一纸盟约。三方都需要你的数十年光阴；接受其中一处，另外两扇门便会关闭。',
    category: 'life', minAge: 28, once: true, weight: 0,
    choices: [
      c('立誓守护边境山城', '体魄 −8 · 声望 +8；此后每年承担护城支出', { stats: { health: -8, reputation: 8 }, flag: 'fate-guardian' }, { autoScore: 7, successText: '你在山城留下名字，许诺不让守夜的人独自承担风雪。' }),
      c('独入孤峰求道', '道心 −10 · 悟性 +6；此后闭关更快，身心消耗更重', { stats: { mind: -10, insight: 6 }, flag: 'fate-lone' }, { autoScore: 5, successText: '你谢绝众人的邀约，踏进多年无人问津的孤峰。' }),
      c('与商盟缔结长期盟约', '道心 −6 · 灵石 +50；此后每年获得盟约收益，但修行放缓', { stats: { mind: -6 }, stones: 50, flag: 'fate-contract' }, { autoScore: 6, successText: '一纸契书，为你打开了财富的门，也把你与商会的命运绑在一起。' }),
    ],
  },
  {
    id: 'fate-mid-guardian', title: '城头最后一夜',
    text: '六十岁，边境山城遭围。粮仓所余无几，你当年的誓言被挂在城门上。有人愿意与你同守，也有人劝你离去。',
    category: 'world', minAge: 60, flag: 'fate-guardian', once: true, weight: 0,
    choices: [
      c('以自己修为护住全城', '体魄 −18 · 需灵石40 · 山城存续；此后护城支出降低，根基每年增长', { stats: { health: -18, mind: 5, reputation: 12 }, flag: 'fate-city-defended' }, { cost: 40, autoScore: 7, delayed: { after: 24, title: '城头长明灯', text: '你守住的山城成为修行者的歇脚处。几名年轻医师送来灵草和灵石，城中仍有人记得那一夜。', effect: { stones: 100, item: 'herb', amount: 4 } } }),
      c('封存旧诺，撤走守卫', '道心 −18 · 声望 −15；不再支付护城经费，但誓言的代价延续多年', { stats: { mind: -18, reputation: -15 }, flag: 'fate-city-abandoned' }, { autoScore: 3, successText: '你选择保存自己的修为，夜里回望时，山城的烽火正慢慢熄灭。' }),
    ],
  },
  {
    id: 'fate-mid-lone', title: '绝壁前的跪求',
    text: '孤峰旧洞前，有少年跪了七日，只为请你将一卷心法传给世人。师父留下的石碑写着：大道不可传。',
    category: 'cultivation', minAge: 60, flag: 'fate-lone', once: true, weight: 0,
    choices: [
      c('打破誓言，开山收徒', '根基 −8 · 声望 +12；闭关速度略放缓、身心消耗下降，传承开始流转', { stats: { foundation: -8, reputation: 12 }, npcRelation: 12, flag: 'fate-shared' }, { autoScore: 8, delayed: { after: 18, title: '山门有人来', text: '昔日少年带着徒弟归山，把多年整理的笔记放在你的案前。你第一次觉得这座山不再孤独。', effect: { stats: { insight: 8, mind: 10 }, item: 'manual' } } }),
      c('闭锁山门，独占古修秘传', '道心 −12 · 悟性 +12；此后闭关更快，但体魄和道心持续承受重负', { stats: { mind: -12, insight: 12 }, flag: 'fate-secluded' }, { autoScore: 3, successText: '你让石门落下，亲手切断了最后一条上山的路。' }),
    ],
  },
  {
    id: 'fate-mid-contract', title: '灵石账本里的名字',
    text: '商盟的一份旧账簿记录着多处灵矿的事故。你的分红正来自那些无人再能开口的矿工；现在你持有足以揭开真相的证据。',
    category: 'economy', minAge: 60, flag: 'fate-contract', once: true, weight: 0,
    choices: [
      c('公开矿难真相并补偿家眷', '灵石 −60 · 声望 +15 · 道心 +10；此后盟约收入下降但不再消耗道心', { stats: { reputation: 15, mind: 10 }, flag: 'fate-honest' }, { cost: 60, autoScore: 8, successText: '商盟把你逐出议事堂，但受过赔偿的家眷把你的名字刻在矿区的石碑上。' }),
      c('保留账簿，控制商盟', '灵石 +140 · 道心 −15；今后年收益更高，声望与道心持续承压', { stones: 140, stats: { mind: -15 }, flag: 'fate-magnate' }, { autoScore: 4, successText: '你将账簿封入铜匣，商盟的长老们低头承认你的地位。' }),
      c('将账簿送给监察使，退出商路', '声望 +8 · 修为 +25；盟约收缩，重新回归求道', { stats: { reputation: 8 }, progress: 25, flag: 'fate-honest' }, { autoScore: 6 }),
    ],
  },
  {
    id: 'fate-final', title: '百四十岁的天人之问',
    text: '走过百四十年，你终于明白：修仙并不只是冲关。你守护过的、舍弃过的、隐瞒过的，正在共同塑造最后一段道途。',
    category: 'life', minAge: 140, once: true, weight: 0,
    choices: [
      c('为后来者立下道统', '声望 +12 · 道心 +8；此后冲关 +5.5百分点，但每年承担传道经费6灵石', { stats: { reputation: 12, mind: 8 }, flag: 'fate-legacy' }, { autoScore: 8, successText: '你将所学写成公开的道书，自此你的道途也承担了无数人的期望。' }),
      c('以此身独证天机', '体魄 −15 · 悟性 +12；此后冲关 +9百分点，但每年额外消耗体魄', { stats: { health: -15, insight: 12 }, flag: 'fate-insight' }, { autoScore: 5, successText: '你在心湖深处燃起一盏灯，以肉身为灯油。' }),
      c('承认有限，珍惜眼前', '体魄 +10 · 道心 +12；此后修炼略慢，但年度道心负担减轻', { stats: { health: 10, mind: 12 }, flag: 'fate-balanced' }, { autoScore: 7, successText: '你愿意再慢一点，看清山河和故人；并未放弃长生，只是不再只为长生。' }),
    ],
  },
  {
    id: 'fate-guardian-echo', title: '城中少年携剑来',
    text: '许多年过去，一位年轻修士说自己出生在你守下的山城。他带来本城众人修补好的阵图，邀请你回去看看。',
    category: 'relationship', minAge: 95, flag: 'fate-city-defended', once: true,
    choices: [
      c('回城重修护山阵', '灵石 −40 · 根基 +12 · 声望 +8', { stats: { foundation: 12, reputation: 8 } }, { cost: 40, autoScore: 8 }),
      c('将阵图交给当地弟子', '根基 +6 · 道心 +8；山城可自行守望', { stats: { foundation: 6, mind: 8 } }, { autoScore: 7 }),
    ],
  },
  {
    id: 'fate-lone-echo', title: '弟子行遍千山',
    text: '当年收下的弟子寄回一本随行手记。书中有你从未走过的路，也有你从未认真听过的疑问。',
    category: 'cultivation', minAge: 95, flag: 'fate-shared', once: true,
    choices: [
      c('重读疑问，修订旧法', '悟性 +12 · 根基 +8', { stats: { insight: 12, foundation: 8 } }),
      c('请弟子们来坐一夜', '道心 +15 · 同道情谊 +10', { stats: { mind: 15 }, npcRelation: 10 }),
    ],
  },
  {
    id: 'fate-trade-echo', title: '商路再逢旧矿工',
    text: '矿区的旧道旁，你遇见当年账簿上的幸存者。他已经老去，眼神却仍然认得你。',
    category: 'life', minAge: 95, flag: 'fate-magnate', once: true,
    choices: [
      c('拿出灵石安置他的家人', '灵石 −100 · 道心 +15 · 声望 +8', { stats: { mind: 15, reputation: 8 } }, { cost: 100 }),
      c('沉默走过，不再回头', '道心 −12 · 灵石 +40', { stats: { mind: -12 }, stones: 40 }),
    ],
  },
];

const daily: { id: string; title: string; text: string; focus: Focus; category: LogKind; a: Choice; b: Choice }[] = [
  { id: 'breath', title: '晨钟里的吐纳', text: '晨钟响起，灵气随着呼吸缓缓归入丹田。今天的气息比往日更清晰。', focus: 'cultivate', category: 'cultivation', a: c('延长一个周天', '修为 +16 · 道心 −3', { progress: 16, stats: { mind: -3 } }), b: c('收功，巩固所得', '根基 +6 · 修为 +5', { progress: 5, stats: { foundation: 6 } }) },
  { id: 'moon', title: '月下独坐', text: '夜深，竹影映在石阶上。你忽然记起第一次听说仙人时的心情。', focus: 'cultivate', category: 'life', a: c('循着月色参悟', '悟性 +5 · 修为 +8', { stats: { insight: 5 }, progress: 8 }), b: c('静静坐到天明', '道心 +10', { stats: { mind: 10 } }) },
  { id: 'fatigue', title: '周天不畅', text: '连续运功后，经脉隐隐发胀。继续下去或许更快，也可能损伤根基。', focus: 'cultivate', category: 'cultivation', a: c('暂缓修行', '体魄 +10 · 根基 +3', { stats: { health: 10, foundation: 3 } }, { autoScore: 8 }), b: c('尝试强行冲开', '成功 55%：修为 +30；失败：体魄 −16', { progress: 30 }, { chance: 0.55, failure: { stats: { health: -16 } }, autoScore: 1 }) },
  { id: 'spring', title: '山间灵泉', text: '山间有一眼无人照料的灵泉，水底的细砂泛着淡淡光泽。', focus: 'adventure', category: 'encounter', a: c('借泉水淬炼经脉', '体魄 +12 · 根基 +5', { stats: { health: 12, foundation: 5 } }), b: c('采集泉边灵草', '灵草 +4', { item: 'herb', amount: 4 }) },
  { id: 'bandits', title: '拦路散修', text: '两名散修堵住去路，声称这一段山道归他们所有。', focus: 'adventure', category: 'encounter', a: c('以武开路', '需战技 40 · 体魄 −8 · 灵石 +35', { stones: 35, stats: { health: -8, combat: 4 } }, { requiresStat: ['combat', 40] }), b: c('绕过山脊', '体魄 −3 · 根基 +3', { stats: { health: -3, foundation: 3 } }, { autoScore: 8 }) },
  { id: 'path', title: '无人走过的小径', text: '岔路上的苔藓完整无缺，深处似乎有微弱的药香。', focus: 'adventure', category: 'encounter', a: c('沿药香寻去', '成功 65%：灵草 +6；失败：体魄 −12', { item: 'herb', amount: 6 }, { chance: 0.65, failure: { stats: { health: -12 } } }), b: c('做好标记，稳步前行', '悟性 +4 · 灵石 +10', { stats: { insight: 4 }, stones: 10 }, { autoScore: 7 }) },
  { id: 'margin', title: '书页边的批注', text: '旧书空白处有一行前人留下的批注。相隔百年，你们似乎正面对同一个疑问。', focus: 'study', category: 'cultivation', a: c('试着补全推演', '悟性 +7', { stats: { insight: 7 } }), b: c('用实践验证', '根基 +5 · 修为 +10', { stats: { foundation: 5 }, progress: 10 }) },
  { id: 'debate', title: '两卷相悖的道经', text: '两位前贤对同一术法各执一词。或许道理并非脱离处境便能成立。', focus: 'study', category: 'cultivation', a: c('兼收并蓄', '悟性 +6 · 道心 +3', { stats: { insight: 6, mind: 3 } }), b: c('选一条路亲自走', '根基 +8', { stats: { foundation: 8 } }) },
  { id: 'copy', title: '残经补全', text: '你终于从几份残本中拼出完整的一段经文，灯芯已经烧尽。', focus: 'study', category: 'economy', a: c('将抄本留给后来者', '声望 +7 · 道心 +4', { stats: { reputation: 7, mind: 4 } }), b: c('售予藏书楼', '灵石 +30 · 悟性 +3', { stones: 30, stats: { insight: 3 } }) },
  { id: 'order', title: '坊市的大单', text: '掌柜希望你接下一笔急单。酬劳不错，但需要昼夜忙碌。', focus: 'work', category: 'economy', a: c('接下订单', '灵石 +55 · 体魄 −10 · 道心 −3', { stones: 55, stats: { health: -10, mind: -3 } }), b: c('只接能按时做完的部分', '灵石 +25', { stones: 25 }, { autoScore: 8 }) },
  { id: 'account', title: '多付的灵石', text: '结算之后，你发现客人多付了一袋灵石。他似乎完全没有察觉。', focus: 'work', category: 'economy', a: c('追上去退还', '声望 +8 · 道心 +6', { stats: { reputation: 8, mind: 6 } }, { autoScore: 8 }), b: c('留下这笔意外之财', '灵石 +45 · 道心 −8 · 声望 −4', { stones: 45, stats: { mind: -8, reputation: -4 } }, { autoScore: 1 }) },
  { id: 'apprentice', title: '手艺的传承', text: '坊市的学徒请你教他辨认材料。他带来的拜师礼只是一篮热饼。', focus: 'work', category: 'relationship', a: c('慢慢教他', '声望 +7 · 悟性 +4', { stats: { reputation: 7, insight: 4 } }), b: c('一起完成今天的工单', '灵石 +28 · 道心 +4', { stones: 28, stats: { mind: 4 } }) },
  { id: 'herbs', title: '雨后的药香', text: '一场春雨后，药田的青灵草齐齐舒展开叶片。', focus: 'alchemy', category: 'economy', a: c('趁时采摘', '灵草 +5', { item: 'herb', amount: 5 }), b: c('观察药性的变化', '丹术 +7 · 灵草 +2', { stats: { alchemy: 7 }, item: 'herb', amount: 2 }) },
  { id: 'fire', title: '炉火将熄', text: '练习丹炉的炉温不稳，你需要选择是救这一炉药，还是先保住自己。', focus: 'alchemy', category: 'cultivation', a: c('凝神控制火候', '成功 70%：培元丹 +1；失败：体魄 −10', { item: 'foundation', amount: 1, stats: { alchemy: 3 } }, { chance: 0.7, failure: { stats: { health: -10 } } }), b: c('停炉，总结失败', '丹术 +8', { stats: { alchemy: 8 } }, { autoScore: 8 }) },
  { id: 'recipe', title: '老药师的偏方', text: '一位老药师递来一张便笺，提醒你：丹方之外，药材采摘的时辰同样重要。', focus: 'alchemy', category: 'cultivation', a: c('认真请教', '丹术 +6 · 悟性 +3', { stats: { alchemy: 6, insight: 3 } }), b: c('帮他整理药柜', '回春丹 +1 · 声望 +3', { item: 'heal', amount: 1, stats: { reputation: 3 } }) },
  { id: 'rain', title: '听一场雨', text: '屋檐滴水，炉火安稳。此刻没有人催你突破，也没有人问你何时成仙。', focus: 'rest', category: 'life', a: c('什么也不做', '道心 +12', { stats: { mind: 12 } }), b: c('写几行今日的心情', '道心 +6 · 悟性 +4', { stats: { mind: 6, insight: 4 } }) },
  { id: 'garden', title: '墙角的新芽', text: '荒疏的墙角长出一株新芽。你已经很久没有认真看过如此细小的生命。', focus: 'rest', category: 'life', a: c('给它浇水', '道心 +8 · 灵草 +2', { stats: { mind: 8 }, item: 'herb', amount: 2 }), b: c('在院中活动筋骨', '体魄 +12 · 根基 +3', { stats: { health: 12, foundation: 3 } }) },
  { id: 'dream', title: '梦见旧日', text: '梦里的自己还很年幼，跑过田埂，身后有人喊你回家吃饭。醒来时天刚亮。', focus: 'rest', category: 'life', a: c('珍惜还记得的温暖', '道心 +10', { stats: { mind: 10 } }), b: c('收拾行囊，重新出发', '根基 +5 · 体魄 +6', { stats: { foundation: 5, health: 6 } }) },
  { id: 'tea', title: '一盏茶的工夫', text: '道友来访，带来一包不名贵的山茶。你们聊了很多，却很少聊境界。', focus: 'social', category: 'relationship', a: c('听他说这些年的生活', '情谊 +9 · 道心 +6', { npcRelation: 9, stats: { mind: 6 } }), b: c('交换修行心得', '情谊 +5 · 悟性 +5 · 修为 +8', { npcRelation: 5, stats: { insight: 5 }, progress: 8 }) },
  { id: 'letter', title: '远山来信', text: '一只纸鹤停在窗前。信里没有求援，只是说远方的梅花又开了。', focus: 'social', category: 'relationship', a: c('认真回一封信', '情谊 +8 · 道心 +5', { npcRelation: 8, stats: { mind: 5 } }), b: c('寄去一份小礼物', '灵石 −12 · 情谊 +13', { npcRelation: 13 }, { cost: 12 }) },
  { id: 'chess', title: '烂柯一局', text: '树下棋局尚未结束，你们已经争论了许久。输赢之外，棋盘似乎也在讲述进退。', focus: 'social', category: 'cultivation', a: c('静看全局', '悟性 +7 · 情谊 +3', { stats: { insight: 7 }, npcRelation: 3 }), b: c('认输，给大家添茶', '道心 +9 · 情谊 +6', { stats: { mind: 9 }, npcRelation: 6 }) },
];
const recurring: EventDef[] = daily.map(({ a, b, ...e }) => ({ ...e, kind: 'routine', minAge: 16, cooldown: 14, weight: 1.3, choices: [a, b] }));
const landmarks: EventDef[] = REGIONS.flatMap(region => [
  { id: `${region.id}-ruin`, title: `${region.name} · 无名碑`, text: `${region.name}的小路尽头有一块无名碑。风霜磨去了名字，几道残存的刻痕却暗合周天之理。`, category: 'encounter' as const, region: region.id, minAge: 16, once: true, choices: [c('拓下碑文，留待参悟', '悟性 +6 · 修为 +18', { stats: { insight: 6 }, progress: 18 }), c('修整碑旁杂草', '道心 +8 · 根基 +4', { stats: { mind: 8, foundation: 4 } })] },
  { id: `${region.id}-fair`, title: `${region.name} · 小集`, text: `赶上${region.name}的季节小集。商贩、修士与凡人在同一条街道上讨价还价。`, category: 'economy' as const, region: region.id, minAge: 16, cooldown: 22, choices: [c('淘一包本地药材', '灵石 −15 · 灵草 +5', { item: 'herb', amount: 5 }, { cost: 15 }), c('帮掌柜鉴别货物', '需悟性 35 · 灵石 +28', { stones: 28 }, { requiresStat: ['insight', 35] }), c('在人群里走走', '道心 +6 · 声望 +2', { stats: { mind: 6, reputation: 2 } })] },
  { id: `${region.id}-night`, title: `${region.name} · 不眠之夜`, text: `暂居${region.name}的这一夜，远处有人抚琴。曲调并不熟悉，却让你想起一路走来的山川与故人。`, category: 'life' as const, region: region.id, minAge: 20, cooldown: 28, choices: [c('听完这一曲', '道心 +9 · 悟性 +3', { stats: { mind: 9, insight: 3 } }), c('以笛声相和', '声望 +5 · 情谊 +6', { stats: { reputation: 5 }, npcRelation: 6 })] },
]);
export const EVENTS: EventDef[] = [
  ...stories.map(e => ({ ...e, kind: (['departure', 'vow', 'forbidden', 'disciple', 'sect-war', 'forbidden-echo'].includes(e.id) ? 'turning' : 'opportunity') as EventDef['kind'] })),
  ...recurring,
  ...landmarks.map(e => ({ ...e, kind: 'routine' as const })),
  ...turningPoints.map(e => ({ ...e, kind: 'turning' as const })),
  ...STORY_EVENTS,
  ...LIFE_EVENTS,
];
export const EVENT_MAP = Object.fromEntries(EVENTS.map(event => [event.id, event]));
export const CHILD_EVENTS = new Map([[2, 'child-pebble'], [6, 'child-root'], [12, 'child-letter'], [16, 'departure'], [18, 'vow']]);
