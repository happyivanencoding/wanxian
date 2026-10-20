import { currentStoryPath, fateInfluence, type StoryPath } from './fate.ts';
import type { Choice, Effect, EventDef, Game, NPC } from './types.ts';

const paths: StoryPath[] = ['guardian', 'lone', 'contract'];
const pathNames: Record<StoryPath, string> = { guardian: '守望人间', lone: '孤峰问道', contract: '山河商路' };
const peerIds: Record<StoryPath, string> = { guardian: 'peer-1', lone: 'peer-3', contract: 'peer-0' };
const middleIds: Record<StoryPath, string[]> = {
  guardian: ['story-guardian-healing', 'story-guardian-exodus'],
  lone: ['story-lone-riddle', 'story-lone-disciple'],
  contract: ['story-contract-supply', 'story-contract-debt'],
};
const has = (g: Game, flag: string) => g.flags.includes(flag);
const add = (g: Game, flag: string) => { if (!has(g, flag)) g.flags.push(flag); };
const c = (label: string, hint: string, effect: Effect, successText: string): Choice => ({ label, hint, effect, successText, autoScore: 5 });
const event = (id: string, title: string, text: string, choices: Choice[], kind: EventDef['kind'] = 'turning'): EventDef => ({ id, title: `命途 · ${title}`, text, category: 'life', kind, once: true, weight: 0, choices });

// The registry also keeps these IDs valid in v1 saves. Rendering and resolving use
// the same pure projection below; opening an event is the only place that chooses a branch.
export const STORY_EVENTS: EventDef[] = [
  ...paths.map(path => event(`story-call-${path}`, { guardian: '一城灯火', lone: '残卷上的疑问', contract: '同行的邀请' }[path], '', [])),
  event('story-guardian-healing', '药堂灯未熄', '', []),
  event('story-guardian-exodus', '山城之外还有路', '', []),
  event('story-lone-riddle', '残卷缺失的一页', '', []),
  event('story-lone-disciple', '孤峰门外的求学者', '', []),
  event('story-contract-supply', '断在雨季的商路', '', []),
  event('story-contract-debt', '账簿上没有名字的人', '', []),
  ...paths.map(path => event(`story-${path}-echo`, { guardian: '灯火有了回声', lone: '疑问走出了孤峰', contract: '道路记得来人' }[path], '', [], 'routine')),
  ...paths.map(path => event(`story-${path}-legacy`, { guardian: '把灯留给谁', lone: '道书的最后一页', contract: '商路不再只属于你' }[path], '', [])),
];
const registry = Object.fromEntries(STORY_EVENTS.map(e => [e.id, e]));

export function storyPerson(g: Game, path: StoryPath): NPC | undefined {
  const binding = g.flags.find(flag => flag.startsWith(`story-person:${path}:`));
  const id = binding?.slice(`story-person:${path}:`.length) ?? peerIds[path];
  return g.npcs.find(npc => npc.id === id);
}
function personWords(g: Game, path: StoryPath) {
  const person = storyPerson(g, path);
  const name = person?.name ?? '当年的同行者';
  return { person, name,
    arrival: person?.alive ? `${name}与你重读往年的约定。`
      : person?.realm === 6 ? `${name}飞升前托存的手札送到了你面前；那个人已经离开此界，旧约仍在。`
      : `${name}已经离世。你翻开${name}留下的旧札，纸上的约定仍然清楚。`,
    echo: person?.alive ? `${name}把这些年的见闻写在信里。`
      : person?.realm === 6 ? `你把后来发生的事续写在${name}飞升前留下的手札后。`
      : `你把后来发生的事续写在${name}的遗札后。`,
  };
}
function began(g: Game, path: StoryPath): number {
  const prefix = `story-began:${path}:`;
  const flag = g.flags.find(value => value.startsWith(prefix));
  if (flag) return Number(flag.slice(prefix.length));
  // Old v1 characters can continue their existing commitment without replaying their birth.
  return g.seen['fate-first'] ?? 18;
}
function middleAge(g: Game, path: StoryPath): number | undefined {
  const ages = middleIds[path].map(id => g.seen[id]).filter((age): age is number => age !== undefined);
  return ages.length ? Math.max(...ages) : undefined;
}
function lastStoryAge(g: Game): number {
  return Math.max(0, ...Object.entries(g.seen).filter(([id]) => id.startsWith('story-')).map(([, age]) => age));
}
export function activateStoryPath(g: Game, path: StoryPath) {
  const previous = currentStoryPath(g);
  if (previous && previous !== path) add(g, `story-former-${previous}`);
  g.flags = g.flags.filter(flag => !flag.startsWith('story-active-'));
  add(g, `story-active-${path}`); add(g, `fate-${path}`);
  if (!g.flags.some(flag => flag.startsWith(`story-person:${path}:`))) {
    const person = storyPerson(g, path);
    if (person) add(g, `story-person:${path}:${person.id}`);
  }
  if (!g.flags.some(flag => flag.startsWith(`story-began:${path}:`))) add(g, `story-began:${path}:${g.age}`);
}
export function recordStoryChoice(g: Game, e: EventDef, choice: Choice) {
  if (!e.id.startsWith('story-')) return;
  const path = currentStoryPath(g);
  if (path && !has(g, `story-active-${path}`)) activateStoryPath(g, path);
  const consequence: Record<string, string> = {
    'story-clinic': 'fate-city-defended', 'story-care-network': 'fate-city-defended', 'story-watch': 'fate-city-defended',
    'story-research': 'fate-secluded', 'story-private': 'fate-secluded',
    'story-fieldnotes': 'fate-shared', 'story-school': 'fate-shared',
    'story-ledger': 'fate-honest', 'story-fairtrade': 'fate-honest', 'story-market': 'fate-magnate',
  };
  if (choice.effect.flag && consequence[choice.effect.flag]) add(g, consequence[choice.effect.flag]);
}

function invitationCause(g: Game, path: StoryPath): string {
  if (path === 'guardian') return has(g, 'vow-people') ? '你曾立誓守护身边的人，这个回答被同道记住了。'
    : g.route === 'alchemy' || g.focus === 'alchemy' ? '你在草药与伤者之间渐渐有了名声，城中的托付因此找到你。'
    : g.origin === 'village' ? '你出身农家，知道田地与家人的安稳意味着什么。' : '青岚的日常与同道的来往，让一城灯火渐渐有了分量。';
  if (path === 'lone') return has(g, 'cave-studied') || has(g, 'cave-heir') ? '早年的洞府际遇留下了一个尚未解开的疑问。'
    : has(g, 'vow-dao') || has(g, 'seek-eternity') ? '你曾把求道当作此生方向，同行者因此把残卷留给你。'
    : g.focus === 'study' ? '你长年读典籍，残卷的线索与你正在思考的事相接。' : '你的修行已渐渐成形，一份残卷让往后的路有了新的可能。';
  return has(g, 'saved-merchant') ? '当年你护过商队，旧日的善意替你打开了新的门。'
    : has(g, 'travel-vow') || has(g, 'vow-world') ? '你曾说要去看山外，一段商路给了这个愿望具体的方向。'
    : g.origin === 'merchant' || g.focus === 'work' ? '出入坊市、经营生计的经历，让同行者愿意与你合作。' : '山河间的往来让你看见：修行之外，也有人靠一条路维生。';
}

/** Pure scheduler: the engine supplies one draw from Game.rng, never the renderer. */
export function nextStoryEvent(g: Game, roll: number): string | undefined {
  if (!g.alive || g.age < 22 + (g.seed % 7)) return;
  const path = currentStoryPath(g);
  if (!path) {
    if (paths.some(p => g.seen[`story-call-${p}`] !== undefined)) return;
    const weights = [
      1 + (has(g, 'vow-people') ? 4 : 0) + (g.route === 'alchemy' || g.origin === 'village' ? 3 : 0) + (g.focus === 'social' || g.focus === 'alchemy' ? 2 : 0),
      1 + (has(g, 'vow-dao') || has(g, 'cave-studied') ? 4 : 0) + (g.origin === 'clan' || g.route === 'sword' ? 2 : 0) + (g.focus === 'study' ? 3 : 0),
      1 + (has(g, 'vow-world') || has(g, 'saved-merchant') ? 4 : 0) + (g.origin === 'merchant' || g.origin === 'wanderer' ? 3 : 0) + (g.region !== 'qinglan' || g.focus === 'work' ? 2 : 0),
    ];
    let ticket = roll * weights.reduce((sum, value) => sum + value, 0);
    return `story-call-${paths[weights.findIndex((weight, i) => (ticket -= weight) < 0 || i === weights.length - 1)]}`;
  }
  if (g.age - lastStoryAge(g) < 6) return;
  const middle = middleAge(g, path);
  if (middle === undefined) {
    if (g.age - began(g, path) < 9 + (g.seed % 5)) return;
    let branch: string;
    if (path === 'guardian') {
      const medicine = g.route === 'alchemy' || g.focus === 'alchemy' || g.home.garden > 0 || g.origin === 'village';
      const displacement = g.era === 'chaos' || g.region !== 'qinglan' || ['sword', 'body'].includes(g.route);
      branch = medicine || (!displacement && ((storyPerson(g, path)?.relation ?? 0) >= 55 || roll < 0.5)) ? 'healing' : 'exodus';
    } else if (path === 'lone') {
      const teaching = has(g, 'took-disciple') || has(g, 'home-school') || g.focus === 'social' || (storyPerson(g, path)?.relation ?? 0) >= 60;
      branch = teaching || (!has(g, 'cave-studied') && g.focus !== 'study' && roll < 0.4) ? 'disciple' : 'riddle';
    } else {
      const travelling = has(g, 'story-caravan') || g.visited.length > 1 || g.focus === 'adventure' || has(g, 'saved-merchant');
      branch = travelling || (g.origin !== 'merchant' && roll < 0.5) ? 'supply' : 'debt';
    }
    return `story-${path}-${branch}`;
  }
  if (g.seen[`story-${path}-echo`] === undefined && g.age - middle >= 6) return `story-${path}-echo`;
  const readyToLeave = g.realm >= 4 || g.age >= g.lifespan * 0.8;
  if (readyToLeave && g.seen[`story-${path}-legacy`] === undefined && g.seen[`story-${path}-echo`] !== undefined && g.age - middle >= 22) return `story-${path}-legacy`;
}

export function getStoryEvent(g: Game, id: string): EventDef | undefined {
  const base = registry[id];
  if (!base) return;
  const path = paths.find(p => id.includes(`-${p}`))!;
  const { person, name, arrival, echo } = personWords(g, path);
  const relation = (amount: number): Effect => person ? { npcId: person.id, npcRelation: amount } : {};
  const result = (text: string, cause: string, choices: Choice[]): EventDef => ({ ...base, text, cause, choices });
  if (id.startsWith('story-call-')) {
    const guardian = personWords(g, 'guardian').name, lone = personWords(g, 'lone').name, trader = personWords(g, 'contract').name;
    const firstContact = person?.alive ? `${name}寄来一封信。` : `${name}${person?.realm === 6 ? '飞升前托存的手记' : '留下的遗札'}辗转送到你手中。`;
    const scene = path === 'guardian' ? '信笺里夹着一张缺药的清单，背面画着城中住户的门牌。青岚需要有人照应，但你也记得孤峰的残卷和通往山外的商路。'
      : path === 'lone' ? '一份残卷被包在旧纸里，末页只留着一句尚无答案的疑问。它指向孤峰的遗迹；而城中的灯火与山外的商队，也仍在等愿意同行的人。'
      : '行路图标出了沿途人家的姓名，空白处写着缺粮、缺药与失修的山道。商队在寻新的同行者；你也可以留下照看青岚，或带着残卷去孤峰求道。';
    return result(`${firstContact}${scene}`, invitationCause(g, path), [
      c('留下来，与一城人互相照应', '守望人间：承担护城供养；后续会围绕药堂、安居与故人展开', { storyPath: 'guardian', stats: { reputation: 6, mind: 5 } }, `你把名字写进守望簿。${guardian}的旧愿从此与你相连，今后的安居与离散都会留下痕迹。`),
      c('带着残卷，去孤峰寻找答案', '孤峰问道：修炼加快，身心消耗增加；后续围绕残卷、同行与传承展开', { storyPath: 'lone', stats: { insight: 6 }, progress: 15 }, `你带走${lone}经手的残卷。此后要研究什么、与谁分享，会决定这份传承的去处。`),
      c('沿着商路，去看山外的生活', '山河商路：每年盟约收入，修行略慢；后续围绕供给、信用与同行展开', { storyPath: 'contract', stones: 30 }, `你接下${trader}留下的行路图。路上的供给与信任，从此也是你要经营的人生。`),
    ]);
  }
  switch (id) {
    case 'story-guardian-healing':
      return result(`${arrival}守望的山城接连收容伤者。药师们能暂时熬药，却还没有长久的供给。你可以把这些年的积累变成一间药堂，也可以把医药知识教给每户人家。`, `${name}的药学旧札与你的守望之约相接；这些年的草药、手艺或往来，使救治成为你能参与的事情。`, [
        c('把空院改成药堂，持续供药', '建立药堂：每年体魄 +0.9；每3年灵草 +1；药堂需要3灵石年度供给', { flag: 'story-clinic', stats: { alchemy: 8 }, ...relation(8) }, `${name}的旧方被抄进药堂册中。往后药堂按年运转，伤者有去处，你也得到持续照应。`),
        c('教会各家照料彼此，建立互助簿', '互助网络：每年道心 +0.6、根基 +0.3；救治不依赖一处药堂', { flag: 'story-care-network', stats: { reputation: 8 }, ...relation(5) }, '家家留下一册简单医方。你不必独自照看每盏灯，城中人开始学会相互照料。'),
      ]);
    case 'story-guardian-exodus':
      return result(`${arrival}连年的山道损毁让旧城越来越难以获得供给。居民已清点好家当：有人愿意留下重建，有人想沿商路另寻安居地。你守护的是一座城，还是一起生活过的人？`, `你曾立下守望之约；${g.region !== 'qinglan' ? '亲自远行的经历让你知道城外仍有道路。' : g.era === 'chaos' ? '烽火里的安居始终需要付出。' : '这些年的护卫经历让迁居与重建都成为可行的选择。'}`, [
        c('留下修复旧城，让守望能延续', '守城成形：每年根基 +0.4、声望 +0.3；旧城供养继续', { flag: 'story-watch', stats: { foundation: 7, health: -5 }, ...relation(7) }, '你和愿意留下的人重修山道。修复不会一夜完成，但每年的守望都有了接续。'),
        c('带愿意离开的人迁居，改走商路', '人生转向山河商路：旧守望写入年谱；停止旧路线供养，获得行旅补给，后续处理新商路', { storyPath: 'contract', flag: 'story-caravan', stones: 25, stats: { mind: 5 } }, `你把${name}的旧约连同守望簿带上行囊。此后以商路收入和行旅补给维持新生活，旧城的历史仍然属于你。`),
      ]);
    case 'story-lone-riddle':
      return result(`${arrival}残卷终于推到关键处，却缺少最后一页。你发现它描述的并非固定术式，而是修士如何回应天地变化。闭门推演与亲历山河，可能导向不同的答案。`, `${has(g, 'cave-studied') ? '当年洞府阵纹中留下的疑问' : '你带上孤峰的那份残卷'}，经过这些年的研读终于露出缺口。`, [
        c('留在峰上，把推演做到尽头', '研究心得：典籍重心每年额外修为 2+境界；每年悟性 +0.4；独修身心负担增加', { flag: 'story-research', stats: { insight: 8 } }, '你把每次失败也写进札记。残卷渐渐成为自己的研究，往后的研读因此更有效。'),
        c('带着问题下山，以山河印证', '行旅心得：历练重心每年额外修为 2+境界；每年根基 +0.3；修炼放缓、心境较平稳', { flag: 'story-fieldnotes', stats: { combat: 5 }, ...relation(6) }, '你在残卷后添上空白纸页。旅途不再只为所得，也是在给当年的疑问寻找活的答案。'),
      ]);
    case 'story-lone-disciple':
      return result(`${arrival}这些年的论道传到山下，一群求学者在峰门外等候。他们没有要求你年年授课，只希望得到一条能够继续求证的路。开门可能改写研究；闭门也能把旧法推得更深。`, has(g, 'took-disciple') || has(g, 'home-school') ? '你早年留下的教导有了回响，求学者沿这条线索来到孤峰。' : `你与${name}的往来和论道，让孤峰的学问逐渐被人听见。`, [
        c('开门共学，让不同疑问留下来', '共学书院：每年道心 +0.6；典籍或访友时额外悟性 +0.6；身心负担较轻', { flag: 'story-school', stats: { reputation: 8 }, ...relation(8) }, '你留下能独立推演的书册，让求学者自行讨论。往后寄来的新问题，会不断改写你的旧答案。'),
        c('留下启蒙抄本，守住独修的时间', '独修札记：每年悟性 +0.5；典籍重心每年额外修为 2+境界；独修身心负担增加', { flag: 'story-private', stats: { insight: 8 } }, '你送出入门的抄本，仍把大部分时间留给自己的疑问。山门没有开成书院，札记却一年比一年厚。'),
      ]);
    case 'story-contract-supply':
      return result(`${arrival}一场长雨暴露了商路的薄弱处：运药者等不到车，沿途小镇也缺少补给。商盟只顾得上眼前恢复通行，你可以决定以后怎样走这条路。`, has(g, 'story-caravan') ? '你带着旧城居民走上商路，安置之后，稳定补给成为新的责任。' : '你曾经的远行与商队往来，让这段道路的困境有了具体的面孔。', [
        c('分段设驿，让路上总有补给', '沿途驿站：每年收入 +3；每4年灵草 +2；实际旅行路费降低30%', { flag: 'story-waystations', stats: { reputation: 6 }, ...relation(7) }, '沿途住户共同照料驿站。商队不再依赖一支车队，往后的远行也能在这些地方落脚。'),
        c('与产药人直订长约，少收中转钱', '药材长约：每年收入 +3；每3年灵草 +2；商盟转为薄利守信', { flag: 'story-fairtrade', stats: { alchemy: 6 }, ...relation(5) }, '新的契约让药材直接送到需要的人手上。你赚得慢一些，供应却逐渐稳定。'),
      ]);
    case 'story-contract-debt':
      return result(`${arrival}商盟旧账终于送到你手中。账上丰厚的利润，来自不断延后的工钱与被反复转卖的欠契。揭开旧账会缩减收入；接管这些欠契，则能让你迅速占据商路。`, `你接下了山河盟约，也因此有权看见${name}当年经手的账册背面。`, [
        c('公开旧账，与工匠另立公平账簿', '公开账簿：商盟收入减少；营生时每年额外收入 +5；每年道心 +0.4', { flag: 'story-ledger', stats: { reputation: 10 }, ...relation(6) }, '工匠的名字第一次写在正页。旧盟约收缩，却有更多人愿意亲自与你合作。'),
        c('接管欠契，掌握整条商路', '接掌商路：盟约收入增加但道心与声望持续承压；营生时每年额外收入 +8', { flag: 'story-market', stones: 60, stats: { mind: -8 } }, '你掌握了欠契，也承担了欠契引来的纷争。往后的财富会增长，旧账也不会因此消失。'),
      ]);
    case 'story-guardian-echo': {
      const clinic = has(g, 'story-clinic'), network = has(g, 'story-care-network');
      return result(`${echo}${clinic ? '药堂第一次靠自己种下的药材度过了寒冬。药册上写着受过照料的人，空院已经成了他们愿意回来的地方。' : network ? '互助簿已经不需要你逐页过问。邻里会自己补上空缺，那些被你教过的人正在教下一批人。' : '旧城的山道重新通行，城中人轮流看护。你从前一个人承担的守望，终于开始有人接手。'}`, '这是你上次安排逐年执行的结果，无需再替日常事务作一次决定。', [c('收到这段回响', '这段结果自动写入年谱，原有生活安排继续', { stats: { mind: 5 } }, `${echo}${clinic ? '药堂度过寒冬，旧医方有了新的名字。' : network ? '互助簿从你的安排变成了众人的习惯。' : '山道复通，守望开始有人接续。'}`)]);
    }
    case 'story-lone-echo':
      return result(`${echo}${has(g, 'story-school') ? '一份寄回的解法指出你旧稿里的疏漏。求学者没有只重复你的答案，这让开门有了真正的意义。' : has(g, 'story-fieldnotes') ? '旧卷中无法解释的变化，在一处普通山谷里得到印证。你终于把经历写成了新的注解。' : '一页旧稿终于能够首尾相接。多年推演没有带来所有答案，却让当初的问题变得更清楚。'}`, '你选择的研究或共学方式已经持续数年，结果来自那次安排。', [c('收好新的注解', '自动记入年谱；悟性 +5，既有研究方式继续', { stats: { insight: 5 } }, `${echo}残卷旁多了真正属于你这一生的注解。`)]);
    case 'story-contract-echo':
      return result(`${echo}${has(g, 'story-waystations') ? '又一场长雨来临，商队分段借宿驿站，药材仍如期送到。那次投资改变了商路渡过难关的方式。' : has(g, 'story-fairtrade') || has(g, 'story-ledger') ? '有人带着新订单来，只因旧账与交货都能说清楚。收入来得慢一些，名字却渐渐成为信用。' : '新账显示收入增长，也记着又一场催债争执。掌握商路的代价并未因为财富增加而消失。'}`, '这份回音来自你确立的驿站、契约或账簿安排。', [c('把回音记入行路簿', '自动记入年谱，当前商路收益与代价继续', { stones: 20 }, `${echo}新一季的账簿如实留下了你选择的结果。`)]);
    case 'story-guardian-legacy':
      return result(`${arrival}${has(g, 'story-clinic') ? '药堂' : has(g, 'story-care-network') ? '互助簿' : '守望阵'}已经能由后来者接续。人们问起这段生活以后怎样继续：仍等你回来主持，还是成为他们自己能照料的事情？`, '当年的安排已经有了回响，你现在决定这份守望如何留下。', [
        c('交给城中人，自己仍是其中一员', '薪火留城：每年道心 +0.5；原有药堂/守望安排继续，年谱留下接续者', { flag: 'story-guardian-inherited', stats: { mind: 8, reputation: 8 } }, `你把${name}的旧札与自己的补注放在一起。后来者不必成为另一个你，也能把这盏灯继续点下去。`),
        c('继续留在这里，把日子过深', '长守故土：每年体魄 +0.4、根基 +0.2；原有生活安排继续', { flag: 'story-guardian-kept', stats: { foundation: 6 } }, '你没有把山城当作求道途中用完即弃的一站。此后每次修行归来，都有一处真正熟悉的生活。'),
      ]);
    case 'story-lone-legacy':
      return result(`${arrival}残卷已变成一部有自己笔迹的道书。它仍有未解之处，却足以让后来者不必从头再走。你终于可以决定，这些年的答案属于哪里。`, '早年的残卷、你选择的研究方式与后来的回响，一起写成了现在的道书。', [
        c('公开道书，也留下未解的问题', '道书流传：每年悟性 +0.3、道心 +0.3；研究心得继续生效', { flag: 'story-lone-published', stats: { reputation: 10 } }, `你把${name}的名字写在卷首，也把自己的错误留下来。后人得到的不是一个无所不知的仙人，而是一条可以继续求证的路。`),
        c('把道书留在身边，继续求自己的答案', '终身求索：典籍重心每年额外修为 +2；研究心得继续生效', { flag: 'story-lone-kept', stats: { insight: 8 } }, '你合上已经写完的部分，又添了一叠空纸。那个最初让你上山的疑问，仍值得用余生回答。'),
      ]);
    case 'story-contract-legacy':
      return result(`${arrival}你参与建立的商路已经跨过许多年。走在路上的人越来越多，往后的契约可以只围绕你，也可以把更多权力交给实际经营的人。`, `${has(g, 'story-caravan') ? '曾经迁居的居民如今在路上有了新的家，' : ''}当年的供给与账簿选择已经改变沿途生活，你现在决定如何留下它。`, [
        c('让沿途的人共掌契约', '同行共营：盟约收入改为5／年、修炼倍率0.97；道心 +0.5、声望 +0.2／年；原有供给继续，停止权盟额外榨取', { flag: 'story-contract-common', stats: { reputation: 8 } }, `行路簿上的名字不再只是欠款与货物。${name}经手的旧图边，添上了一群能自己决定前路的人。`),
        c('继续主持商路，照看自己的事业', '继续经营：营生重心每年额外收入 +4；原有商路安排和代价继续', { flag: 'story-contract-kept', stones: 40 }, '你收好新一季的契约。往后的财富、纷争与相逢，仍将具体地来到你的案前。'),
      ]);
  }
}

export function storyAnnualEffects(g: Game): Effect[] {
  const effects: Effect[] = [], path = currentStoryPath(g);
  if (path === 'guardian') {
    if (has(g, 'story-clinic')) effects.push({ stats: { health: 0.9 } }, ...(g.age % 3 === 0 ? [{ item: 'herb', amount: 1 }] : []));
    if (has(g, 'story-care-network')) effects.push({ stats: { mind: 0.6, foundation: 0.3 } });
    if (has(g, 'story-watch')) effects.push({ stats: { foundation: 0.4, reputation: 0.3 } });
    if (has(g, 'story-guardian-inherited')) effects.push({ stats: { mind: 0.5 } });
    if (has(g, 'story-guardian-kept')) effects.push({ stats: { health: 0.4, foundation: 0.2 } });
  } else if (path === 'lone') {
    if (has(g, 'story-research') || has(g, 'story-private')) effects.push({ stats: { insight: has(g, 'story-private') ? 0.5 : 0.4 }, ...(g.focus === 'study' ? { progress: 2 + g.realm } : {}) });
    if (has(g, 'story-fieldnotes')) effects.push({ stats: { foundation: 0.3 }, ...(g.focus === 'adventure' ? { progress: 2 + g.realm } : {}) });
    if (has(g, 'story-school')) effects.push({ stats: { mind: 0.6, ...(['study', 'social'].includes(g.focus) ? { insight: 0.6 } : {}) } });
    if (has(g, 'story-lone-published')) effects.push({ stats: { insight: 0.3, mind: 0.3 } });
    if (has(g, 'story-lone-kept') && g.focus === 'study') effects.push({ progress: 2 });
  } else if (path === 'contract') {
    if (has(g, 'story-caravan') && g.age % 4 === 0) effects.push({ item: 'herb', amount: 1 });
    if (has(g, 'story-waystations')) effects.push({ stones: 3 }, ...(g.age % 4 === 0 ? [{ item: 'herb', amount: 2 }] : []));
    if (has(g, 'story-fairtrade')) effects.push({ stones: 3 }, ...(g.age % 3 === 0 ? [{ item: 'herb', amount: 2 }] : []));
    if (has(g, 'story-ledger')) effects.push({ stats: { mind: 0.4 }, ...(g.focus === 'work' ? { stones: 5 } : {}) });
    if (has(g, 'story-market') && !has(g, 'story-contract-common') && g.focus === 'work') effects.push({ stones: 8 });
    if (has(g, 'story-contract-common')) effects.push({ stats: { mind: 0.5, reputation: 0.2 } });
    if (has(g, 'story-contract-kept') && g.focus === 'work') effects.push({ stones: 4 });
  }
  return effects;
}
export function storyTravelMultiplier(g: Game): number {
  return currentStoryPath(g) === 'contract' && has(g, 'story-waystations') ? 0.7 : 1;
}
function benefitLabels(g: Game): string[] {
  const path = currentStoryPath(g), labels: string[] = [];
  const rules: [StoryPath, string, string][] = [
    ['guardian', 'story-clinic', '药堂按年供给：体魄 +0.9／年，灵草 +1／3年，支出3灵石／年。'],
    ['guardian', 'story-care-network', '互助网络：道心 +0.6、根基 +0.3／年。'],
    ['guardian', 'story-watch', '旧城守望：根基 +0.4、声望 +0.3／年。'],
    ['guardian', 'story-guardian-inherited', '薪火留城：额外道心 +0.5／年。'],
    ['guardian', 'story-guardian-kept', '长守故土：额外体魄 +0.4、根基 +0.2／年。'],
    ['lone', 'story-research', '研究心得：悟性 +0.4／年；典籍重心额外修为 2+境界／年。'],
    ['lone', 'story-private', '独修札记：悟性 +0.5／年；典籍重心额外修为 2+境界／年。'],
    ['lone', 'story-fieldnotes', '行旅心得：根基 +0.3／年；历练重心额外修为 2+境界／年。'],
    ['lone', 'story-school', '共学书院：道心 +0.6／年；典籍或访友时额外悟性 +0.6／年。'],
    ['lone', 'story-lone-published', '道书流传：额外悟性 +0.3、道心 +0.3／年。'],
    ['lone', 'story-lone-kept', '终身求索：典籍重心额外修为 +2／年。'],
    ['contract', 'story-caravan', '迁居行旅：灵草 +1／4年；旧城供养停止，旧誓仍记在年谱。'],
    ['contract', 'story-waystations', '沿途驿站：收入 +3／年，灵草 +2／4年，旅行路费降低30%。'],
    ['contract', 'story-fairtrade', '药材长约：收入 +3／年，灵草 +2／3年。'],
    ['contract', 'story-ledger', '公开账簿：道心 +0.4／年，营生时额外收入 +5／年。'],
    ['contract', 'story-market', '接掌欠契：营生时额外收入 +8／年，同时承担权盟的身心代价。'],
    ['contract', 'story-contract-common', '同行共营：道心 +0.5、声望 +0.2／年；停止权盟的额外榨取。'],
    ['contract', 'story-contract-kept', '继续经营：营生时额外收入 +4／年。'],
  ];
  for (const [owner, flag, label] of rules) if (owner === path && has(g, flag) && !(flag === 'story-market' && has(g, 'story-contract-common'))) labels.push(label);
  return labels;
}
export function storyLegacy(g: Game): string {
  const path = currentStoryPath(g);
  if (!path) return '';
  const name = storyPerson(g, path)?.name ?? '同行者';
  if (middleAge(g, path) === undefined) return `你选择了${pathNames[path]}，与${name}经手的旧物和愿望有了联系；这段人生尚未等来下一次转折。`;
  const echoed = g.seen[`story-${path}-echo`] !== undefined;
  if (!echoed) {
    const plan = path === 'guardian' ? has(g, 'story-clinic') ? '持续供给药堂' : has(g, 'story-care-network') ? '教各家互相照料' : '修复旧城山道'
      : path === 'lone' ? has(g, 'story-school') ? '开放孤峰共学' : has(g, 'story-fieldnotes') ? '带着问题走进山河' : '继续独自推演残卷'
      : has(g, 'story-waystations') ? '沿途设立驿站' : has(g, 'story-fairtrade') ? '与产药人直订长约' : has(g, 'story-ledger') ? '公开旧账、重建信用' : '接掌商路欠契';
    return `你决定${plan}，与${name}相连的往事因此有了新的方向；尚未等到岁月给出回音。`;
  }
  if (path === 'guardian') return has(g, 'story-clinic') ? `你与${name}留下的旧方在一座药堂里延续，照料过的人也学会照料后来者。`
    : has(g, 'story-care-network') ? `你与${name}的守望之约成了一本互助簿，一城人学会了相互照料。`
    : has(g, 'story-watch') ? `你记得${name}的旧约，修通了故土山道，城中人开始接续守望。` : '';
  if (path === 'lone') return has(g, 'story-school') ? `你从${name}经手的残卷出发，最后打开孤峰，让不同的人继续提出问题。`
    : has(g, 'story-fieldnotes') ? `你把${name}经手的残卷带进山河，用自己的经历写成了新的注解。`
    : has(g, 'story-research') || has(g, 'story-private') ? `你沿着${name}留下的疑问走了很久，残卷上多了属于自己的注解，也仍留着尚未解开的疑问。` : '';
  const opening = has(g, 'story-caravan') ? '你曾离开旧城，带着愿意同行的人在商路上重新安家。' : '';
  return opening + (has(g, 'story-waystations') ? `你与${name}的行路图最终变成沿途驿站，让后来者有处落脚。`
    : has(g, 'story-ledger') || has(g, 'story-fairtrade') || has(g, 'story-contract-common') ? `你让${name}经手的旧契约有了新的写法，信用与生计不再只是账上的数目。`
    : has(g, 'story-market') ? `你接掌了${name}经手的商路，财富与欠契一起成为此生难以抹去的名字。` : '');
}
export function storyView(g: Game) {
  const path = currentStoryPath(g), person = path ? storyPerson(g, path) : undefined;
  const chapters = g.logs.filter(entry => entry.title.startsWith('命途 ·') || ['山城守望之约', '孤峰问道之约', '山河商路之约'].includes(entry.title)).map(({ age, title, text }) => ({ age, title, text }));
  const fate = fateInfluence(g);
  const middle = path ? middleAge(g, path) : undefined;
  const next = !g.alive ? '此生已结卷，留下的选择与回响会随传记保存。'
    : g.pending && registry[g.pending]?.kind === 'turning' ? '眼前是会改变此生的决定，托管也会等你亲自回答。'
    : !path ? '日常修行会继续。出身、志向、同道与当前处境会带来不同的邀约。'
    : middle === undefined ? '安排已在按年执行；新的处境会结合你的手艺、行旅与同道关系出现。'
    : g.seen[`story-${path}-echo`] === undefined ? '让选择运行一段岁月。它的结果会自动回到年谱，无需年年确认。'
    : g.seen[`story-${path}-legacy`] === undefined ? '旧选择已有回响。到元婴境，或寿元渐近时，你会决定怎样把它留下。'
    : '这段命途已经落定，留下的生活与收益继续；后面的修行仍由你安排。';
  return {
    title: path ? pathNames[path] : '此生尚待展开',
    description: path ? (g.alive ? fate.description : storyLegacy(g)) : '每一段人生从不同的处境出发。少数重要选择会改变你遇见的人、生活的安排与最终留下的故事。',
    person: person ? { id: person.id, name: person.name, alive: person.alive, relation: person.relation } : undefined,
    chapters, effects: benefitLabels(g), next,
  };
}
