import { REGIONS } from './data.ts';
import type { Choice, Effect, EventDef, Game, LogKind, WorldFaction, WorldHistory } from './types.ts';

export const FACTIONS: { id: WorldFaction; name: string; region: string; aim: string }[] = [
  { id: 'sword', name: '青岚剑盟', region: 'qinglan', aim: '寻回照夜剑传，守住西岸山门' },
  { id: 'tide', name: '沧溟水盟', region: 'river', aim: '造船越过黑潮，取得旧院航路' },
  { id: 'star', name: '玄朔诸门', region: 'north', aim: '打开剑冢，查明断雪旧事' },
  { id: 'ember', name: '烬原同盟', region: 'desert', aim: '夺回祖器，不再依附名门' },
  { id: 'jade', name: '天衡议庭', region: 'central', aim: '重建旧院，掌握登阶名册' },
];
export const FAMILIES: Record<string, { name: string; story: string }[]> = {
  qinglan: [{ name: '陆氏', story: '白石渡的船与仓' }, { name: '谢氏', story: '断雪旁传' }, { name: '虞氏', story: '雾隐泉的守灯人' }],
  river: [{ name: '闻氏', story: '七桥旧药方' }, { name: '祝氏', story: '渡海船坞' }, { name: '沈氏', story: '外港与水盟' }],
  north: [{ name: '顾氏', story: '剑庭铸兵后人' }, { name: '程氏', story: '长夜守阵世家' }, { name: '白氏', story: '雪原行路人' }],
  desert: [{ name: '燕氏', story: '赤乌祖器的后人' }, { name: '沙氏', story: '荒原御兽家族' }, { name: '殷氏', story: '沉砂旧图' }],
  central: [{ name: '裴氏', story: '登阶名册的持有者' }, { name: '苏氏', story: '符器与浮槎' }, { name: '秦氏', story: '玉京世家与散修盟约' }],
};
interface HistoryChapter {
  id: string; title: string; start: number; end: number; region: string; sides: [WorldFaction, WorldFaction]; tier: number;
  object: string; opening: string; scene: string; prize: string;
}
export const HISTORY_CHAPTERS: HistoryChapter[] = [
  { id: 'night-tide', title: '白石夜潮', start: 2318, end: 2332, region: 'qinglan', sides: ['sword', 'tide'], tier: 1, object: '泉下遗迹', prize: 'relic-jade', opening: '白石渡一夜退潮，泉下显露旧院引灯台。裴照野的剑修与陆见秋请来的船队同时赶到，谁也不肯先走。', scene: '寻宝人带来一片断玉。青岚剑盟想先查清引灯台，沧溟船队却要把它运去造船。你也可以留下断玉，自己寻找它的来历。' },
  { id: 'seven-bridges', title: '七桥竞渡', start: 2340, end: 2358, region: 'river', sides: ['tide', 'jade'], tier: 1, object: '归潮号与黑潮航线', prize: 'relic-bell', opening: '祝行舟的归潮号即将下水。水盟要第一条跨海航线，玉京买家想连船带图一并带走；七桥药市里到处都是招募同行者的消息。', scene: '归潮号的旧图上有一处缺口。船坞请你带消息给愿意支持的一方，玉京也开出了价码。船上还有一只无人认领的旧铃。' },
  { id: 'sword-tomb', title: '照夜开冢', start: 2370, end: 2394, region: 'north', sides: ['star', 'sword'], tier: 2, object: '照夜剑胎与星砂', prize: 'relic-stardust', opening: '镜冰原裂开，照夜剑冢现世。程雪衡要查清断雪剑庭的旧史，南来的剑修则要迎回一柄仍未择主的剑胎。', scene: '剑冢中的署名与流传的旧史不同。你可以帮北溟留住残碑，也可以替青岚接走传剑人，或带走一袋会发光的砂。' },
  { id: 'red-sun', title: '赤乌归主', start: 2410, end: 2442, region: 'desert', sides: ['ember', 'jade'], tier: 2, object: '赤乌祖器与沉砂都', prize: 'relic-scabbard', opening: '燕无赦在沉砂都找到赤乌枪。烬原诸部开始聚集，玉京派人索回自称属于旧院的兵器；荒原上已经有人为这把枪结仇。', scene: '沉砂都外，双方正在寻找愿意送信与作证的人。枪只有一把，旧账却不止一本。你也看到一只没有剑的残鞘。' },
  { id: 'jade-schism', title: '玉京分席', start: 2465, end: 2505, region: 'central', sides: ['jade', 'star'], tier: 3, object: '登阶名册与真传席位', prize: 'relic-seal', opening: '天衡议庭公开旧院名册，北溟带来的残碑却对不上其中几个名字。百家道会要求重新分席，世家内部也出现了不同声音。', scene: '有人请你辨认一块无字铜牌。玉京要维持现有名册，北溟要追问被删掉的人；争论已经关系到谁能进入旧院。' },
  { id: 'sea-raft', title: '浮槎入海', start: 2540, end: 2595, region: 'river', sides: ['tide', 'ember'], tier: 3, object: '旧院渡台', prize: 'jade', opening: '苏家后人造出的浮槎穿过黑潮，沉海旧院终于可以抵达。水盟与烬原争夺登岸处，旧物开始回应水底的石阶。', scene: '浮槎上的人各有所求。先前的航图、旧铃与星砂不再只是行囊里的东西：它们能辨出真正的落脚处。你可以助一方先登岸，也可以公开石阶所在。' },
  { id: 'river-duel', title: '玄川问剑', start: 2660, end: 2735, region: 'qinglan', sides: ['sword', 'jade'], tier: 3, object: '重开的渡台', prize: 'jade', opening: '第一批进入旧院的人已各自开山。青岚新一代剑主向玉京约战，渡台的归属再次动摇，旧盟友并没有永远站在一起。', scene: '问剑的请帖送到你手里。有人愿意与你同去，有人已站到另一边。你可以支持一门，也可以让不属于名门的人知道通路。' },
  { id: 'academy', title: '旧院再开', start: 2840, end: 2940, region: 'central', sides: ['jade', 'tide'], tier: 4, object: '旧院功法与新山门', prize: 'manual', opening: '旧院中的功法逐渐流出。新师承不肯只做旧门派的附庸，玉京与水盟为谁能传授这些功法争执不休。', scene: '一部旧院手抄本流到你这里。将它交给哪一方，决定了谁得到下一代弟子；自己研习或让它流传，也是不同的路。' },
  { id: 'long-night', title: '长夜渡海', start: 3120, end: 3250, region: 'north', sides: ['star', 'ember'], tier: 4, object: '远海星路', prize: 'jade', opening: '玄朔与烬原的后来者准备越过旧院更远的海面。有人想寻找失踪师祖，有人想抛开五洲的旧身份，长夜关再次有人送别。', scene: '远行者展开一幅新星图。它与数百年前的星砂留下的纹路相合，但这一次，执图的人已不是你当年认识的那一代。' },
  { id: 'new-houses', title: '五洲易主', start: 3500, end: 3670, region: 'desert', sides: ['ember', 'sword'], tier: 4, object: '旧山门与新师承', prize: 'jade', opening: '年轻的山门开始挑战古老名号。荒原传承东进，青岚弟子守山；有的家族终于兴起，有的家族只剩旧谱中的名字。', scene: '争夺者都引用过去的事为自己辩护。你亲历过其中一些，也知道他们漏掉了什么。旧山门里还留着当年的剑痕，新来的人已在门前立旗。' },
  { id: 'heaven-light', title: '天门重光', start: 3980, end: 4190, region: 'central', sides: ['jade', 'star'], tier: 5, object: '重建的登天石阶', prize: 'jade', opening: '五洲散落的航图终于能拼起一条路。玉京与玄朔各自重建登天石阶，成功者已经出现，通路仍远未稳定。', scene: '旧院最后一段石阶在夜里亮起。你经历过的争夺与身上留下的旧物，已经成为后来者眼里的历史。谁能走上去，并没有统一答案。' },
  { id: 'after-us', title: '后来者之世', start: 4420, end: 4670, region: 'river', sides: ['tide', 'ember'], tier: 5, object: '下一代的渡海路', prize: 'jade', opening: '新的一代不再把天门当作传说。水盟与烬原的后人仍在争夺远海，故事不会因为某位长者已经老去而停止。', scene: '年轻人带来一幅与你记忆不同的地图。他们想走自己的路，也想听见你真实经历过的那一页，而不是石碑上已经写好的评语。' },
];
export const HISTORY_EVENTS: EventDef[] = HISTORY_CHAPTERS.map(chapter => ({ id: `history-${chapter.id}`, title: chapter.title, text: '', category: 'world', kind: 'turning', once: true, weight: 0, choices: [] }));
export const factionForRegion = (region: string) => FACTIONS.find(faction => faction.region === region)!.id;
export const factionName = (id: WorldFaction | 'open') => id === 'open' ? '五洲散修与诸门' : FACTIONS.find(faction => faction.id === id)!.name;
export const worldYear = (g: Pick<Game, 'age' | 'history'>) => (g.history?.birthYear ?? 2300) + g.age;
const bound = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
type Draw = (cursor: { rng: number }) => number;
type HistoryHooks = { random: Draw; log: (g: Game, title: string, text: string, kind: LogKind, important?: boolean) => void; gain: (g: Game, effect: Effect) => void };

function resolveChapter(history: WorldHistory, chapter: HistoryChapter, draw: Draw) {
  const [first, second] = chapter.sides, choice = history.choices[chapter.id];
  const edge = (history.strength[first] - history.strength[second]) / 180;
  const intervention = choice?.side === first ? choice.weight / 100 : choice?.side === second ? -choice.weight / 100 : 0;
  const winner = choice?.side === 'open' && draw(history) < 0.32 + choice.weight / 100
    ? 'open' : draw(history) < bound(0.5 + edge + intervention, 0.06, 0.94) ? first : second;
  history.outcomes[chapter.id] = winner;
  if (winner === 'open') {
    for (const faction of FACTIONS) history.strength[faction.id] = bound(history.strength[faction.id] + (chapter.sides.includes(faction.id) ? -7 : 4), 10, 95);
  } else {
    const loser = winner === first ? second : first;
    history.strength[winner] = bound(history.strength[winner] + 11, 10, 95);
    history.strength[loser] = bound(history.strength[loser] - 19, 10, 95);
  }
  return winner;
}

export function initializeHistory(g: Game, draw: Draw) {
  if (g.history) return;
  const birthYear = g.era === 'chaos' ? 2362 : g.era === 'renewal' ? 2316 : 2300;
  const history: WorldHistory = {
    birthYear, lastYear: birthYear + g.age - 1, rng: g.seed,
    strength: { sword: 62, tide: 60, star: 52, ember: 44, jade: 72 }, choices: {}, outcomes: {},
  };
  for (const chapter of HISTORY_CHAPTERS) if (chapter.end < birthYear + g.age) resolveChapter(history, chapter, draw);
  g.history = history;
}

export function regionalStanding(g: Pick<Game, 'history'>, region: string) {
  const strength = g.history?.strength[factionForRegion(region)] ?? 60;
  return { strength, label: strength < 20 ? '闭山' : strength < 38 ? '困守' : strength > 76 ? '鼎盛' : '安稳', income: strength < 20 ? 0 : bound(strength / 60, 0.4, 1.55) };
}

export function currentHistoryChapter(g: Pick<Game, 'age' | 'history'>) {
  const year = worldYear(g);
  return HISTORY_CHAPTERS.find(chapter => year >= chapter.start && year <= chapter.end);
}

export function historyConditions(g: Pick<Game, 'age'> & Partial<Pick<Game, 'history' | 'region'>>, region = g.region ?? 'qinglan') {
  const active = currentHistoryChapter(g), standing = regionalStanding(g, region);
  const localConflict = active?.region === region;
  const spirit = bound(0.88 + standing.strength / 400 + (active?.id === 'sea-raft' ? 0.12 : 0), 0.9, 1.25);
  return {
    name: active?.title ?? '五洲余响', description: active?.opening ?? '诸洲在已经发生的变局中继续生活。',
    spirit, income: bound(0.7 + standing.strength / 180 - (localConflict ? 0.12 : 0), 0.55, 1.3),
    risk: (localConflict ? 1.45 : 0.9) * (standing.strength < 38 ? 1.25 : 1),
    price: 1 + (localConflict ? 0.18 : 0) + (standing.strength < 38 ? 0.12 : 0),
    travel: 1 + (localConflict ? 0.25 : 0) + (standing.strength < 20 ? 0.2 : 0),
  };
}

export function advanceHistory(g: Game, hooks: HistoryHooks) {
  initializeHistory(g, hooks.random);
  const history = g.history!, year = worldYear(g);
  for (const chapter of HISTORY_CHAPTERS) {
    if (history.lastYear < chapter.start && year >= chapter.start) hooks.log(g, chapter.title, `${chapter.start}年。${chapter.opening}`, 'world', true);
    if (year < chapter.end || history.outcomes[chapter.id]) continue;
    const winner = resolveChapter(history, chapter, hooks.random);
    const choice = history.choices[chapter.id];
    const impact = choice && choice.side !== 'watch' ? `你当年${choice.side === 'self' ? '带走了自己的所得' : choice.side === 'open' ? '公开了线索' : `支持${factionName(choice.side)}`}，相关的人仍记着这件事。` : '这场变局在你自己的生活之外有了结果。';
    hooks.log(g, `${chapter.title} · 尘埃落定`, `${chapter.end}年，${factionName(winner)}取得${chapter.object}。${impact}落败一方的山门减发年例，胜者扩建了沿途据点。`, 'world', true);
    if (choice?.side === winner && winner !== 'open') {
      hooks.gain(g, { stones: 25 + g.realm * 18, contribution: 15 });
      hooks.log(g, '旧盟的回信', `${factionName(winner)}记得你在${chapter.title}时的支持，送来${25 + g.realm * 18}灵石资用。`, 'relationship');
    }
  }
  history.lastYear = year;
}

export function nextHistoryEvent(g: Game) {
  if (!g.alive || g.age < 16) return;
  const chapter = currentHistoryChapter(g);
  if (!chapter || g.history?.outcomes[chapter.id] || g.seen[`history-${chapter.id}`] !== undefined) return;
  return `history-${chapter.id}`;
}

export function getHistoryEvent(g: Game, id: string): EventDef | undefined {
  const chapter = HISTORY_CHAPTERS.find(entry => id === `history-${entry.id}`);
  if (!chapter) return;
  const base = HISTORY_EVENTS.find(event => event.id === id)!;
  const previous = [...HISTORY_CHAPTERS].reverse().find(entry => entry.start < chapter.start && g.history?.outcomes[entry.id]);
  const previousText = previous ? `自${previous.title}之后，${factionName(g.history!.outcomes[previous.id])}占据先机。` : '';
  const footprint = g.sect ? '山门中的消息也催着你作出自己的打算。' : '散修也收到消息，但没有人替你决定立场。';
  const mark = (side: string) => `history-choice:${chapter.id}:${side}`;
  const choices: Choice[] = chapter.sides.map(side => ({
    label: `支持${factionName(side)}`, hint: `${12 + g.realm * 8} 灵石`, cost: 12 + g.realm * 8,
    effect: { flag: mark(side), stats: { reputation: 4 } }, autoScore: g.region === FACTIONS.find(f => f.id === side)!.region ? 7 : 4,
    successText: `你把支持交给${factionName(side)}。局面尚未定，相关的人已经记下你的名字。`,
  }));
  if (g.region === chapter.region && (g.realm >= chapter.tier || chapter.tier === 1)) choices.push({
    label: chapter.prize.startsWith('relic-') ? '留下旧物，自己寻找来历' : '取一份所得，不立盟约', hint: [g.realm < chapter.tier ? '体魄 −8' : '', chapter.tier >= 2 ? '夺取可能结仇，遭人追杀' : ''].filter(Boolean).join(' · '),
    effect: { flag: mark('self'), item: chapter.prize, amount: chapter.prize === 'jade' ? 3 : 1, ...(g.realm < chapter.tier ? { stats: { health: -8 } } : {}) }, autoScore: 6,
    successText: chapter.prize.startsWith('relic-') ? '你将旧物带在身上。眼下还没有人能说清它的全部来历。' : '你收好所得，独自离开了会场。',
  });
  if (g.realm >= chapter.tier || g.flags.some(flag => flag.startsWith('relic-known:'))) choices.push({
    label: '公开所知，让诸门自行选择', hint: '声望 +6', effect: { flag: mark('open'), stats: { reputation: 6 } }, autoScore: 5,
    successText: '消息不再只掌握在一方手里。新的同行者出现，原本想独占的人也会记住这一步。',
  });
  choices.push({ label: '不介入这场争夺', hint: '', effect: { flag: mark('watch') }, autoScore: 6, successText: '你没有留下盟书。来客收起名帖，赶往下一处山门。' });
  return { ...base, text: `${previousText}${chapter.scene}${footprint}`, choices };
}

export function recordHistoryChoice(g: Game, event: EventDef, choice: Choice) {
  if (!event.id.startsWith('history-') || !choice.effect.flag?.startsWith('history-choice:')) return;
  const [, chapterId, side] = choice.effect.flag.split(':');
  const chapter = HISTORY_CHAPTERS.find(entry => entry.id === chapterId)!;
  const relic = relevantRelic(g, chapter.id);
  const weight = Math.min(48, 8 + g.realm * 5 + g.sectRank * 2 + (relic ? 18 : 0));
  g.history!.choices[chapterId] = { side: side as WorldHistory['choices'][string]['side'], weight };
  if (side !== 'self' && side !== 'watch' && relic && !g.flags.includes(`relic-used:${relic}:${chapterId}`)) g.flags.push(`relic-used:${relic}:${chapterId}`);
}

const RELIC_CHAPTERS: Record<string, string[]> = {
  'relic-jade': ['seven-bridges', 'sea-raft'],
  'relic-bell': ['sea-raft', 'long-night'],
  'relic-stardust': ['jade-schism', 'sea-raft', 'long-night'],
  'relic-scabbard': ['river-duel', 'heaven-light'],
  'relic-seal': ['academy', 'heaven-light'],
};
export function relevantRelic(g: Game, chapterId: string) {
  return Object.keys(RELIC_CHAPTERS).find(id => (g.inventory[id] ?? 0) > 0 && RELIC_CHAPTERS[id].includes(chapterId));
}
export function resonateRelics(g: Game, hooks: HistoryHooks) {
  const chapter = currentHistoryChapter(g);
  if (!chapter || g.history?.outcomes[chapter.id]) return;
  for (const [id, chapters] of Object.entries(RELIC_CHAPTERS)) {
    if (!(g.inventory[id] > 0) || !chapters.includes(chapter.id) || g.flags.includes(`relic-known:${id}`)) continue;
    if (g.region !== chapter.region && g.pending !== `history-${chapter.id}`) continue;
    g.flags.push(`relic-known:${id}`);
    hooks.gain(g, { stats: { insight: 5 }, progress: 12 + g.realm * 5 });
    const moments: Record<string, string> = {
      'relic-jade': '裂纹玉片与新送来的残图恰好相合，缺失的黑潮航路显了出来。',
      'relic-bell': '听潮铃忽然朝海雾的另一侧鸣响，你终于辨认出能够落脚的方向。',
      'relic-stardust': '照夜星砂沿着旧图滚出一道光痕，被抹去的石阶重新可见。',
      'relic-scabbard': '残鞘回应了远处的剑鸣。它等的并不是更高的价钱，而是重见那柄剑。',
      'relic-seal': '铜牌上的无字旧印在名册旁浮出纹路，一条被删去的传承有了实物证据。',
    };
    hooks.log(g, '旧物有了来历', `${moments[id]}它改变了你在${chapter.title}中能拿出的证据，悟性与修行也因此有所长进。`, 'encounter', true);
  }
}

export function historyView(g: Game) {
  const year = worldYear(g), current = currentHistoryChapter(g);
  const resolved = HISTORY_CHAPTERS.filter(chapter => g.history?.outcomes[chapter.id]).map(chapter => ({
    id: chapter.id, year: chapter.end, title: chapter.title, winner: factionName(g.history!.outcomes[chapter.id]),
    involvement: g.history?.choices[chapter.id]?.side ?? null,
  }));
  return {
    year, current: current ? { title: current.title, object: current.object, opening: current.opening, region: REGIONS.find(r => r.id === current.region)!.name } : null,
    resolved, factions: FACTIONS.map(faction => ({ ...faction, ...regionalStanding(g, faction.region) })),
    family: g.family ? Object.values(FAMILIES).flat().find(family => family.name === g.family) : undefined,
  };
}
