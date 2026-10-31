import { GIVEN_NAMES, ITEMS, gearTier, REALMS, REGIONS, SECTS, SURNAMES } from './data.ts';
import { FAMILIES, HISTORY_CHAPTERS, regionalStanding } from './history.ts';
import type { Choice, Effect, EventDef, Game, LogKind, NPC } from './types.ts';

interface PeopleHooks {
  random: (cursor: { rng: number }) => number;
  log: (g: Game, title: string, text: string, kind: LogKind, important?: boolean) => void;
  gain: (g: Game, effect: Effect) => void;
}
const limit = (value: number, low = 0, high = 100) => Math.max(low, Math.min(high, value));
const meetingTitles: Record<string, string> = {
  'meet-road': '渡口初逢', 'meet-healer': '山雨中的药篮', 'meet-heir': '一笔没有谈成的买卖',
  'meet-sword': '剑碑前的陌生人', 'meet-stranger': '山河间的一面', 'rival-pursuit': '追来的旧怨',
};
export const RELATIONSHIP_EVENTS: EventDef[] = Object.entries(meetingTitles).map(([id, title]) => ({ id, title, text: '', kind: 'turning', category: 'relationship', weight: 0, choices: [] }));
const peerForMeeting: Record<string, string> = { 'meet-road': 'peer-2', 'meet-healer': 'peer-1', 'meet-heir': 'peer-0', 'meet-sword': 'peer-3' };
const existing = (g: Game, id: string) => g.npcs.some(npc => npc.id === id);

export function nextRelationshipEvent(g: Game, roll: number): string | undefined {
  const pursuer = g.npcs.find(npc => npc.alive && npc.role === 'enemy' && (npc.hostility ?? 0) >= 40 && g.age >= (npc.pursuitAt ?? Infinity));
  if (g.age >= 18 && pursuer) return 'rival-pursuit';
  if (g.age < 8 || g.npcs.length >= 64) return;
  const lastMeeting = Math.max(-20, ...g.npcs.map(npc => npc.metAt ?? 0));
  if (g.age - lastMeeting < 7) return;
  if (!existing(g, 'peer-2') && (g.age <= 18 || g.focus === 'adventure') && roll < 0.7) return 'meet-road';
  if (g.age < 16) return;
  if (!existing(g, 'peer-1') && (g.focus === 'alchemy' || g.focus === 'rest' || g.region === 'river') && roll < 0.58) return 'meet-healer';
  if (!existing(g, 'peer-0') && (g.focus === 'work' || g.origin === 'merchant' || g.origin === 'clan') && roll < 0.45) return 'meet-heir';
  if (!existing(g, 'peer-3') && (g.sect || g.focus === 'adventure' || g.region === 'north') && roll < 0.5) return 'meet-sword';
  if (g.age - lastMeeting >= 16 && g.npcs.filter(npc => npc.alive).length < 14 && roll < (g.focus === 'adventure' || g.focus === 'social' ? 0.34 : 0.13)) return 'meet-stranger';
}

function newCareer(npc: NPC, g: Game, draw: PeopleHooks['random']) {
  const potential = draw(g);
  return {
    pace: 0.3 + draw(g) * 1.8,
    ceiling: Math.max(npc.realm, potential < 0.38 ? 1 : potential < 0.7 ? 2 : potential < 0.9 ? 3 : potential < 0.97 ? 4 : potential < 0.995 ? 5 : 6),
    resources: 10 + Math.floor(draw(g) * (40 + npc.realm * 80)),
    breakthroughAt: npc.age + 2 + Math.floor(draw(g) * 10),
    opportunityAt: npc.age + 12 + Math.floor(draw(g) * 36),
  };
}

export function meetPerson(g: Game, kind: string, hooks: PeopleHooks, id?: string, profileOverride?: Partial<Pick<NPC, 'name' | 'title' | 'family' | 'desire'>>): NPC {
  if (id) {
    const known = g.npcs.find(npc => npc.id === id);
    if (known) return known;
  }
  const draw = () => hooks.random(g), int = (low: number, high: number) => low + Math.floor(draw() * (high - low + 1));
  const knownNames = new Set([g.name, ...g.npcs.map(npc => npc.name)]);
  const availableNames = SURNAMES.flatMap(surname => GIVEN_NAMES.map(given => surname + given)).filter(name => !knownNames.has(name));
  const name = availableNames[int(0, availableNames.length - 1)];
  const profiles = {
    road: { title: '行路人', personality: '随性洒脱', realm: g.age < 16 ? 0 : int(0, 1), age: g.age < 16 ? int(8, 16) : int(19, 45), desire: '看见黑潮以外的海' },
    healer: { title: '行脚药师', personality: '温厚执拗', realm: int(0, 1), age: int(22, 58), desire: '补完一部旧药书' },
    heir: { title: '世家来客', personality: '要强好胜', realm: int(1, 2), age: int(23, 67), desire: '做成一件不靠姓氏的事' },
    sword: { title: '失传剑门的后人', personality: '清冷执着', realm: int(1, 2), age: int(27, 95), desire: '找回师门失去的剑谱' },
    elder: { title: '远来前辈', personality: '爱酒惜才', realm: int(3, 4), age: int(170, 390), desire: '在寿尽前见到旧院重开' },
    wanderer: { title: '落魄散修', personality: '谨慎多疑', realm: int(0, 1), age: int(25, 74), desire: '攒够下一次冲关的钱' },
    artisan: { title: '异乡器师', personality: '骄傲挑剔', realm: int(1, 2), age: int(33, 115), desire: '造出胜过名门藏品的法宝' },
    prodigy: { title: '少年成名的修士', personality: '锋芒毕露', realm: int(2, 3), age: int(24, 49), desire: '赢下从未败过的同辈' },
    avenger: { title: '夺宝追索者', personality: '记仇善战', realm: int(1, 3), age: int(38, 150), desire: '夺回被带走的传承' },
  };
  const profile = profiles[kind as keyof typeof profiles] ?? profiles.wanderer;
  const tier = kind === 'artisan' || kind === 'avenger' ? int(2, 4) : int(0, 2);
  const family = FAMILIES[g.region][int(0, 2)].name;
  const regionName = REGIONS.find(region => region.id === g.region)!.name;
  const npc: NPC = {
    id: id ?? `encounter-${g.age}-${g.npcs.length}`, name, ...profile, ...profileOverride,
    progress: 0, aptitude: kind === 'prodigy' ? int(82, 97) : int(22, 92),
    lifespan: Math.max(profile.age + 20, REALMS[profile.realm].life + int(-7, 9)),
    alive: true, relation: 30, role: 'acquaintance', lastInteraction: -1,
    region: g.region, family: profileOverride?.family ?? family, metAt: g.age, meeting: `${g.age}岁，在${regionName}初次相识。`,
    story: '', gear: { name: ['旧木剑', '青锋法剑', '护身灵镜', '离火宝轮', '照夜古剑'][tier], tier },
  };
  npc.career = newCareer(npc, g, hooks.random);
  if (kind === 'prodigy') { npc.career.pace = 2.25; npc.career.ceiling = 5; }
  npc.story = `${npc.meeting}${npc.name}想${npc.desire}。`;
  g.npcs.push(npc);
  hooks.log(g, '初识 · ' + npc.name, `${npc.meeting}${npc.title}，${REALMS[npc.realm].name}境，${npc.age}岁。${npc.name}想${npc.desire}。`, 'relationship', true);
  return npc;
}

export function bindRelationshipEvent(g: Game, id: string, hooks: PeopleHooks) {
  if (!meetingTitles[id]) return;
  const prefix = `meeting-actor:${id}:`;
  let actor: NPC | undefined;
  if (id === 'rival-pursuit') {
    actor = g.npcs.find(npc => npc.alive && npc.role === 'enemy' && (npc.hostility ?? 0) >= 40 && g.age >= (npc.pursuitAt ?? Infinity));
    if (actor) actor.region = g.region;
  } else {
    const kinds: Record<string, string> = { 'meet-road': 'road', 'meet-healer': 'healer', 'meet-heir': 'heir', 'meet-sword': 'sword' };
    const strangers = ['wanderer', 'wanderer', 'wanderer', 'healer', 'healer', 'artisan', 'artisan', 'road', 'elder', 'prodigy'];
    const kind = kinds[id] ?? strangers[Math.floor(hooks.random(g) * strangers.length)];
    actor = meetPerson(g, kind, hooks, peerForMeeting[id]);
  }
  if (actor) { g.flags = g.flags.filter(flag => !flag.startsWith(prefix)); g.flags.push(prefix + actor.id); }
}

function eventActor(g: Game, id: string) {
  const actorId = g.flags.find(flag => flag.startsWith(`meeting-actor:${id}:`))?.slice(`meeting-actor:${id}:`.length);
  return g.npcs.find(npc => npc.id === actorId);
}

export function playerGearTier(g: Game) {
  const item = ITEMS.find(item => item.id === g.equipped);
  return gearTier(item);
}

export function confrontationChance(g: Game, npc: NPC) {
  const self = Math.pow(2.6, g.realm) * (0.7 + g.stats.combat / 130) * (0.55 + g.stats.health / 160) * (1 + playerGearTier(g) * 0.3);
  const rival = Math.pow(2.6, npc.realm) * (0.8 + npc.aptitude / 150) * (1 + (npc.gear?.tier ?? 0) * 0.3);
  return limit(self / (self + rival), 0.015, 0.985);
}

function pursuitEvent(g: Game, npc: NPC): EventDef {
  const chance = confrontationChance(g, npc);
  const damage = Math.round(limit(38 + (npc.realm - g.realm) * 25 + ((npc.gear?.tier ?? 0) - playerGearTier(g)) * 9, 18, 140));
  const escape = limit(0.72 + (g.realm - npc.realm) * 0.1 + (g.region === 'qinglan' ? 0.08 : 0), 0.18, 0.95);
  const price = Math.ceil(45 + npc.realm * 35 + g.stones * 0.2);
  const mark = (action: string) => `pursuit-choice:${npc.id}:${action}`;
  if (g.realm >= npc.realm + 2) return {
    id: 'rival-pursuit', title: '路上的旧怨', kind: 'turning', category: 'relationship',
    text: `${npc.name}循着旧日线索找到了你。对方如今是${REALMS[npc.realm].name}境，而你已是${REALMS[g.realm].name}境。${npc.grievance ?? npc.story}认出你后，${npc.name}停在远处，没有拔剑，只托人问你打算如何了结旧账。`,
    choices: [
      { label: '把当年的事讲清楚，不承诺补偿', hint: '', autoScore: 7, effect: { flag: mark('talk') }, successText: `你说明当年为何这样做。${npc.name}仍有怨意，却没有再向前逼近。` },
      { label: '出资补偿，结束这段追索', hint: `${price} 灵石`, cost: price, autoScore: 8, effect: { flag: mark('settle') }, successText: `${npc.name}收下补偿，此事到此为止。你们仍是陌路。` },
      { label: '不作回应，继续赶路', hint: '', autoScore: 6, effect: { flag: mark('ignore') }, successText: `你没有停下。${npc.name}明白单凭如今的修为无法拦你，转身离开。` },
    ],
  };
  const choices: Choice[] = [
    { label: '迎战，决生死', hint: `胜算 ${Math.round(chance * 100)}% · 失败体魄 −${damage}${damage >= g.stats.health ? '，会陨落' : ''}`, chance, autoScore: chance > 0.76 ? 10 : -8, effect: { flag: mark('fight'), stats: { combat: 5, reputation: 3 } }, failure: { stats: { health: -damage, mind: -8 } }, successText: `你击败了${npc.name}。这场生死之争终于结束，对方再也不能追来。`, failureText: `${npc.name}的攻势击穿了你的防护。${damage >= g.stats.health ? '这一次，你没能活着离开。' : '你带伤逃离，旧怨尚未结束。'}` },
    { label: '脱身，不恋战', hint: `脱身 ${Math.round(escape * 100)}% · 失手体魄 −${Math.min(42, damage)}${Math.min(42, damage) >= g.stats.health ? '，会陨落' : ''}`, chance: escape, autoScore: 7, effect: { flag: mark('escape') }, failure: { stats: { health: -Math.min(42, damage) } }, successText: `你摆脱了${npc.name}的追索，但没有抹掉双方的旧怨。`, failureText: `${npc.name}在退路上截住了你。${Math.min(42, damage) >= g.stats.health ? '伤势已经无法挽回。' : '你付出伤势才勉强脱身。'}` },
    { label: '交出资用，了结这笔旧账', hint: `${price} 灵石`, cost: price, autoScore: 8, effect: { flag: mark('settle') }, successText: `${npc.name}收下约定的资用，停止了这一次追索。你们没有因此成为朋友。` },
  ];
  const ally = g.npcs.find(person => person.alive && ['friend', 'benefactor', 'mentor', 'companion'].includes(person.role) && person.relation >= 60 && person.realm >= npc.realm && (!person.region || person.region === g.region));
  const sect = SECTS.find(entry => entry.id === g.sect);
  const shelter = sect && sect.home === g.region && regionalStanding(g, sect.home).strength >= 20 && npc.realm <= (regionalStanding(g, sect.home).strength > 76 ? 5 : 4) && g.contribution >= 25;
  if (ally || shelter) choices.push({
    label: ally ? `请${ally.name}出手` : `退入${sect!.name}`, hint: ally ? '情谊 −12' : '贡献 −25', autoScore: 10,
    effect: { flag: mark('shelter'), ...(ally ? { npcId: ally.id, npcRelation: -12 } : { contribution: -25 }) },
    successText: ally ? `${ally.name}挡下了追索。${npc.name}退去，至少此后很长一段时间不敢再来。` : `山门护阵拦住了${npc.name}。这份庇护来自你此前积累的贡献。`,
  });
  return {
    id: 'rival-pursuit', title: '追来的旧怨', kind: 'turning', category: 'relationship',
    text: `${npc.name}在${REGIONS.find(region => region.id === g.region)!.name}拦住了你。${npc.grievance ?? npc.story}对方现在是${REALMS[npc.realm].name}境，持${npc.gear?.name ?? '普通法器'}；你是${REALMS[g.realm].name}境。这不是切磋。`, choices,
  };
}

export function getRelationshipEvent(g: Game, id: string): EventDef | undefined {
  if (!meetingTitles[id]) return;
  const npc = eventActor(g, id);
  if (!npc) return;
  if (id === 'rival-pursuit') return pursuitEvent(g, npc);
  const mark = (action: string) => `meeting-choice:${npc.id}:${action}`;
  const scenes: Record<string, string> = {
    'meet-road': `渡口的小船搁在浅滩，${npc.name}正把一张湿地图摊开。对方也想知道河流更远的地方有什么，你们还不知道彼此会不会再见。`,
    'meet-healer': `山雨来时，${npc.name}的药篮翻在路边。这个药师正在寻找一种当地少见的草，愿意用自己的医术交换你的帮助。`,
    'meet-heir': `${npc.name}带着一袋灵玉独自来买旧物，却不肯用家族的名帖压价。摊主已经收起货物，你在旁边看见了这一幕。`,
    'meet-sword': `剑碑前，${npc.name}问你是否认得一招残缺的剑式。碑下压着一封旧信，封口已经磨白。`,
    'meet-stranger': `${npc.name}在旅舍与你同桌，桌边放着一袋灵玉。这位${npc.title}今年${npc.age}岁，已在${REALMS[npc.realm].name}境，想${npc.desire}。你们有各自的来路。`,
  };
  const choices: Choice[] = [
    { label: ({'meet-road':'帮忙辨认渡口水路','meet-healer':'帮忙寻药，一起避雨','meet-heir':'帮忙查清旧物的来历','meet-sword':'一起查读残缺的剑式','meet-stranger':'坐下来聊聊各自的来路'} as Record<string,string>)[id], hint: '', autoScore: 8, effect: { flag: mark('join'), npcId: npc.id, npcRelation: 22 }, successText: `你与${npc.name}留下了可以再相见的地址。临别时，对方又回头招了招手。` },
    { label: '聊过便各自上路', hint: '', autoScore: 6, effect: { flag: mark('pass'), npcId: npc.id, npcRelation: 3 }, successText: `你记住了${npc.name}，对方也记住了你。这一面还不足以成为承诺。` },
  ];
  if (g.age >= 16 && (id === 'meet-healer' || npc.realm >= 3)) choices.push({ label: '接受对方的援手', hint: '体魄 +18', autoScore: g.stats.health < 60 ? 10 : 5, effect: { flag: mark('aid'), stats: { health: 18 }, npcId: npc.id, npcRelation: 10 }, successText: `${npc.name}没有索要回报。临别前，对方把药方留在了桌上。` });
  if (g.age >= 18 && ['meet-heir', 'meet-stranger'].includes(id)) choices.push({
    label: '夺走那袋灵玉', hint: '灵玉 +3 · 会结仇，可能遭追杀', autoScore: -8,
    effect: { flag: mark('take'), item: 'jade', amount: 3 }, successText: `你带走了灵玉。${npc.name}记住了这次夺取，不会把它当作一场误会。`,
  });
  return { id, title: meetingTitles[id], text: scenes[id], category: 'relationship', kind: 'turning', choices };
}

export function recordRelationshipChoice(g: Game, event: EventDef, choice: Choice, success: boolean, hooks: PeopleHooks): string | undefined {
  if (event.id.startsWith('meet-')) {
    const npc = eventActor(g, event.id);
    if (!npc || !success) return;
    const action = choice.effect.flag?.split(':').at(-1);
    if (action === 'join') npc.role = npc.realm >= 3 ? 'mentor' : 'friend';
    if (action === 'aid') npc.role = 'benefactor';
    if (action === 'take') {
      npc.role = 'enemy'; npc.relation = 0; npc.hostility = 85; npc.pursuitAt = g.age + 8 + Math.floor(hooks.random(g) * 10);
      npc.grievance = `${g.age}岁时，你夺走了${npc.name}的一袋灵玉。`;
      npc.story = `${npc.grievance}对方一直在找你。`;
    }
    return;
  }
  if (event.id === 'rival-pursuit') {
    const npc = eventActor(g, event.id);
    if (!npc) return;
    const action = choice.effect.flag?.split(':').at(-1);
    npc.pursuitAt = g.age + (action === 'shelter' || action === 'talk' || action === 'ignore' ? 45 : 18) + Math.floor(hooks.random(g) * 15);
    if (success && action === 'talk') npc.hostility = Math.max(20, (npc.hostility ?? 0) - 15);
    if (success && action === 'fight') { npc.alive = false; npc.hostility = 0; npc.story = `${npc.age}岁，在追索中被你击败身亡。`; }
    if (success && action === 'settle') { npc.hostility = 0; npc.role = 'rival'; npc.story = `${g.age}岁，你付出资用了结旧账。彼此仍无亲近之意。`; }
    if (!success && g.stats.health <= 0) return `${npc.name}以${REALMS[npc.realm].name}境与${npc.gear?.name ?? '法器'}结束了这场旧怨。你没能活着离开${REGIONS.find(region => region.id === g.region)!.name}。`;
    return;
  }
  if (success && event.id === 'life-sword-answer' && choice.effect.flag === 'life-sword-published' && g.flags.includes('life-sword-private')) {
    const npc = g.npcs.find(person => person.id === 'peer-3' && person.alive);
    if (npc && npc.relation < 40) {
      npc.role = 'enemy'; npc.hostility = 65; npc.pursuitAt = g.age + 12;
      npc.grievance = `你答应不外传剑谱，后来却公开了它。${npc.name}要求收回传承。`;
      hooks.log(g, '旧约成仇', `${npc.grievance}来信已留下追索之言。`, 'relationship', true);
    }
  }
  if (success && event.id.startsWith('history-') && choice.effect.flag?.endsWith(':self')) {
    const chapter = HISTORY_CHAPTERS.find(entry => event.id === `history-${entry.id}`)!;
    if (chapter.tier < 2 || g.npcs.length >= 64 || hooks.random(g) >= 0.38) return;
    const npc = meetPerson(g, 'avenger', hooks);
    npc.role = 'enemy'; npc.relation = 0; npc.hostility = 75; npc.pursuitAt = g.age + 10 + Math.floor(hooks.random(g) * 12);
    npc.grievance = `${chapter.title}时，你带走了${npc.name}也在寻找的旧物。`;
    npc.story = `${npc.grievance}对方当面留下了追索之言。`;
    hooks.log(g, '夺宝者的名字', `${npc.name}想得到同一件东西，已经记下你的去向。对方是${REALMS[npc.realm].name}境，持${npc.gear!.name}。`, 'relationship', true);
  }
}

export function growRelationships(g: Game, hooks: PeopleHooks, care: (g: Game, npc: NPC) => { training: number; risk: number }) {
  const draw = () => hooks.random(g);
  for (const npc of g.npcs) {
    if (!npc.alive) continue;
    npc.age++;
    npc.career ??= newCareer(npc, g, hooks.random);
    const career = npc.career, factors = care(g, npc);
    if (npc.age >= career.opportunityAt && npc.realm < 6) {
      career.opportunityAt = npc.age + 18 + Math.floor(draw() * 55);
      const fortune = draw();
      if (fortune < 0.2) {
        career.ceiling = Math.min(6, career.ceiling + 1); career.pace = Math.min(3.2, career.pace + 0.45);
        career.resources += 50 + npc.realm * 90; career.breakthroughAt = npc.age;
        npc.gear = { name: ['照夜灵剑', '离火宝轮', '护身灵镜'][Math.floor(draw() * 3)], tier: Math.min(5, (npc.gear?.tier ?? 0) + 1) };
        npc.story = `${npc.age}岁，得到契合自身的传承，旧瓶颈开始松动。`;
        hooks.log(g, '各自的机缘', `${npc.name}${npc.story}随信附来的新剑痕，已不是你记忆中的样子。`, 'relationship', true);
      } else if (fortune < 0.38) {
        career.breakthroughAt = npc.age + 12 + Math.floor(draw() * (15 + npc.realm * 9));
        career.pace = Math.max(0.22, career.pace * 0.72);
        npc.story = `${npc.age}岁历练受伤，暂时难以冲关。`;
        hooks.log(g, '故人的来信', `${npc.name}${npc.story}`, 'relationship');
      } else if (fortune < 0.57) {
        career.resources += 30 + npc.realm * 65;
        npc.story = `${npc.age}岁，靠手艺攒下一笔资用，仍在${REALMS[npc.realm].name}境。`;
      }
    }
    if (npc.age >= 6 && npc.realm < 6) {
      career.resources += (0.8 + npc.aptitude / 45) * (npc.realm + 1);
      npc.progress = Math.min(REALMS[npc.realm].need, npc.progress + (2 + npc.aptitude / 17) * [1, 1.05, 1.3, 1.7, 2.1, 2.6][npc.realm] * career.pace * factors.training);
      const ready = npc.age >= 16 && npc.progress >= REALMS[npc.realm].need && npc.age >= career.breakthroughAt;
      if (ready && npc.realm < career.ceiling && career.resources >= REALMS[npc.realm].cost) {
        career.resources -= REALMS[npc.realm].cost;
        if (draw() < limit(0.22 + npc.aptitude * 0.003 - npc.realm * 0.035, 0.1, 0.7)) {
          npc.realm++; npc.progress = 0; npc.lifespan = Math.max(npc.lifespan, REALMS[npc.realm].life);
          career.breakthroughAt = npc.age + 3;
          npc.story = `${npc.age}岁，突破${REALMS[npc.realm].name}。`;
          if (npc.realm === 6) { npc.alive = false; npc.story = `${npc.age}岁飞升，离开此界。`; }
          hooks.log(g, npc.realm === 6 ? '有人飞升' : '故人破境', `${npc.name}${npc.story}`, 'relationship', true);
        } else {
          npc.progress *= 0.6; career.breakthroughAt = npc.age + 5 + Math.floor(draw() * (9 + npc.realm * 7));
          npc.story = `${npc.age}岁冲关失利，需重新寻找契机。`;
        }
      } else if (ready && npc.realm >= career.ceiling && !g.flags.includes(`npc-stalled:${npc.id}:${npc.realm}`)) {
        g.flags.push(`npc-stalled:${npc.id}:${npc.realm}`);
        npc.story = `${npc.age}岁，修为已足，却困在${REALMS[npc.realm].name}境。`;
        hooks.log(g, '迟迟未开的关', `${npc.name}${npc.story}现有法门尚不能带对方继续向前。`, 'relationship');
      }
    }
    if (npc.alive && (npc.age >= npc.lifespan || (npc.age >= 20 && draw() < 0.00065 * factors.risk * (npc.role === 'enemy' ? 1.5 : 1)))) {
      npc.alive = false;
      npc.story = `${npc.age}岁${npc.age >= npc.lifespan ? '寿终坐化' : '在独自历练时陨落'}。`;
      hooks.log(g, npc.role === 'enemy' ? '旧怨无归' : '故人远去', `${npc.name}${npc.story}`, 'relationship', true);
      if (npc.relation > 55) hooks.gain(g, { stats: { mind: -8 } });
    }
    if (npc.alive && g.age % 6 === 0 && g.focus !== 'social' && npc.role !== 'enemy') npc.relation = Math.round(limit(npc.relation - (npc.role === 'companion' ? 0.5 : 1.5)) * 10) / 10;
    if (npc.alive && npc.role === 'companion') hooks.gain(g, { stats: { mind: 0.8 } });
  }
}

export const relationshipLabel = (npc: NPC) => ({ acquaintance: '相识', friend: '朋友', benefactor: '恩人', enemy: '仇敌', rival: '对手', companion: '道侣', mentor: '前辈' }[npc.role]);
