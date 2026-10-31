import { REGIONS } from './data.ts';
import { hasSectArt } from './sects.ts';
import type { Action, Effect, ExpeditionState, Game, LogKind } from './types.ts';

type Active = NonNullable<ExpeditionState['active']>;
type Completion = ExpeditionState['completed'][number];
type ExpeditionAction = Extract<Action, { type: 'expedition-start' | 'expedition-choose' | 'expedition-retreat' }>;
export interface ExpeditionContext {
  random: (g: Game) => number;
  gain: (g: Game, effect: Effect) => void;
  log: (g: Game, title: string, text: string, kind?: LogKind, important?: boolean) => void;
  checkLife: (g: Game) => void;
}
export interface ExpeditionChoice { id: string; label: string; hint: string; disabled?: string }
export interface ExpeditionOffer { id: string; title: string; description: string; available: boolean; reason?: string; cost: number; risk: string; region: string }
const definitions = {
  spring: { title: '雾隐泉 · 洞天初开', minRealm: 1, maxRealm: 2, cost: 18, risk: '中险；泉眼深处可能重伤、损失当前修为', description: '山雨冲开一道石缝，泉水逆着岩壁流动。附近采药人都绕开了那片不散的雾。', marks: ['map', 'medicine', 'healer', 'guide', 'pathcraft', 'supplies', 'settled', 'turbulent', 'wounded'], outcomes: ['clear', 'vein', 'scarred', 'withdrawn'] },
  rescue: { title: '折梅谷 · 一封血书', minRealm: 1, maxRealm: 3, cost: 24, risk: '中险；毒瘴与坍塌可能造成重伤、修为折损', description: '熟悉的笔迹只剩半行，信纸上还沾着折梅谷的黑色花粉。送信人说，药师被困在废弃药库。', marks: ['medicine', 'ledger', 'ledger-study', 'guard', 'haste', 'treated', 'passage', 'forced'], outcomes: ['healer', 'cache', 'prescription', 'scarred', 'withdrawn'] },
  tomb: { title: '照夜剑冢 · 无主之锋', minRealm: 2, maxRealm: 4, cost: 55, risk: '高险；剑气可能重创体魄，强行试剑会折损修为', description: '荒原下的剑冢重见天日。石碑写的不是墓主姓名，而是历代守阵人的遗言。', marks: ['sword', 'guard', 'glyph', 'ward', 'victory', 'clash', 'still'], outcomes: ['sword', 'ward', 'sacrifice', 'withdrawn'] },
  observatory: { title: '无昼台 · 天机遗府', minRealm: 3, maxRealm: 5, cost: 100, risk: '极险；强留崩解中的阵心可能重伤甚至陨落，并折损大量当前修为', description: '一处旧日线索指向没有昼夜的高台。台阶上的刻痕，与你曾经见过的纹路相合。', marks: ['stars', 'spring', 'guide', 'pathcraft', 'notes', 'lens', 'anchor', 'balanced'], outcomes: ['chart', 'anchor', 'confluence', 'fracture', 'eclipse', 'withdrawn'] },
} as const;
type ExpeditionId = keyof typeof definitions;
const ids = Object.keys(definitions) as ExpeditionId[];
const regions: Record<ExpeditionId, string> = { spring: 'qinglan', rescue: 'river', tomb: 'north', observatory: 'central' };
const has = (g: Game, flag: string) => g.flags.includes(flag);
const marked = (a: Active, mark: string) => a.marks.includes(mark);
const springMedicine = (a: Active) => marked(a, 'medicine') || marked(a, 'healer');
const peer = (g: Game, id: string) => g.npcs.find(n => n.id === id);
function friendReady(g: Game, id: string): boolean {
  const npc = peer(g, id);
  return !!npc?.alive && npc.role !== 'enemy' && npc.relation >= (has(g, `companion-bond:${id}`) ? 55 : 60);
}
function friendReason(g: Game, id: string): string | undefined {
  const npc = peer(g, id);
  return !npc ? '尚未遇见这样的同伴' : npc.role === 'enemy' ? '旧怨未了' : !npc.alive ? '这位同道已不在人间' : !friendReady(g, id) ? `情谊需达到${has(g, `companion-bond:${id}`) ? 55 : 60}` : undefined;
}
const name = (g: Game, id: string) => peer(g, id)?.name ?? '旧识';
const art = (g: Game, id: 'qinglan' | 'herb' | 'star') => hasSectArt(g, { qinglan: 'sword', herb: 'medicine', star: 'formation' }[id] as 'sword' | 'medicine' | 'formation');
const guided = (a: Active) => marked(a, 'guide') || marked(a, 'pathcraft');
const readLedger = (a: Active) => marked(a, 'ledger') || marked(a, 'ledger-study');
const bearsImpact = (g: Game, a: Active) => marked(a, 'guard') || art(g, 'qinglan') || hasSectArt(g, 'body');
const money = (g: Game, cost: number) => g.stones < cost ? `需要 ${cost} 灵石，现有 ${g.stones}，还差 ${cost - g.stones}` : undefined;
const herbs = (g: Game, count: number) => (g.inventory.herb ?? 0) < count ? `需要 ${count} 株灵草` : undefined;
const choice = (id: string, label: string, hint: string, disabled?: string): ExpeditionChoice => ({ id, label, hint, ...(disabled ? { disabled } : {}) });

function visible(g: Game, id: ExpeditionId): boolean {
  const def = definitions[id];
  if (g.realm < def.minRealm || g.realm > def.maxRealm || g.expeditions?.completed.some(e => e.id === id)) return false;
  if (id === 'rescue') return !!peer(g, 'peer-1')?.alive && peer(g, 'peer-1')?.role !== 'enemy' && ((peer(g, 'peer-1')?.relation ?? 0) >= 45 || has(g, 'story-clinic'));
  if (id === 'observatory') return ['exp-spring-clear', 'exp-spring-vein', 'exp-tomb-ward', 'cave-studied', 'story-research', 'story-fieldnotes'].some(flag => has(g, flag));
  return true;
}
export function expeditionOffers(g: Game): ExpeditionOffer[] {
  return ids.filter(id => visible(g, id)).map(id => {
    const def = definitions[id];
    const region = regions[id];
    const reason = !g.alive ? '此生已经结卷' : g.expeditions?.active ? '先结束眼前的际遇' : g.pending ? '先回应眼前的事情' : g.region !== region ? `需前往${REGIONS.find(r => r.id === region)!.name}` : g.actionsLeft < 1 ? '本年主动行动已用尽' : g.stats.health < 35 ? '体魄至少需要 35' : money(g, def.cost);
    const description = id === 'rescue' ? `${name(g, 'peer-1')}的字迹只剩半行，信纸上沾着黑色花粉。送信人说，你的故友被困在折梅谷药库。`
      : id === 'observatory' ? `${has(g, 'exp-spring-clear') || has(g, 'exp-spring-vein') ? '雾隐泉石壁上记下的纹路' : has(g, 'exp-tomb-ward') ? '照夜剑冢留下的守阵刻痕' : '你反复研读的旧卷'}，出现在一张无昼台残图上。高台重现，那里似乎有人点着灯。` : def.description;
    return { id, title: def.title, description, available: !reason, ...(reason ? { reason } : {}), cost: def.cost, risk: def.risk, region };
  });
}

function scene(g: Game, a: Active): { text: string; choices: ExpeditionChoice[] } {
  const companion = a.companionId ? peer(g, a.companionId) : undefined;
  const together = companion?.alive ? `${companion.name}在你身边。` : '';
  if (a.id === 'spring') {
    if (a.stage === 0) return { text: '青衡洲青岚九府的泉守虞婆递给你半截水路图。她年老后不再入山，只想知道近年为何连草根都开始石化。雾中的水声时远时近；入洞之前，你还有时间做一件准备。', choices: [
      choice('map', '伏在石壁前补全水路图', '耗费 4 道心；记下支流与出口'),
      choice('medicine', '以药性辨认泉中浊气', '使用 2 株灵草；医药本领或丹术 25 可辨药性', !art(g, 'herb') && g.stats.alchemy < 25 ? '需要医药本领或丹术 25' : herbs(g, 2)),
      choice('healer', `请${name(g, 'peer-1')}同行照看经脉`, '可信的药师带来辨药经验，不必自己学会丹术', friendReason(g, 'peer-1')),
      ...(hasSectArt(g, 'pathfinder') ? [choice('pathcraft', '依门中辨路法，独自勘定水路', '道心 −4；以已学本领辨认支流与退路')] : []),
      choice('guide', `请${name(g, 'peer-2')}循水探路`, '可信的寻路同道可以一起进入', friendReason(g, 'peer-2')),
      choice('supplies', '备好绳索与护身灯', '灵石 −12；先保住退路', money(g, 12)),
    ] };
    if (a.stage === 1) return { text: `${together}石闸后的水流骤然分成两股，一股清冷，一股把碎石碾成粉末。${marked(a, 'map') ? '你认出图上曾被涂去的一条排水道。' : marked(a, 'healer') ? '药师拦住了你，先用药粉试出浑水里的侵蚀。' : marked(a, 'medicine') ? '你带来的药粉在浑浊水流上结成了黑色薄膜。' : marked(a, 'pathcraft') ? '你凭辨路所学找到暗处能落脚的石阶。' : marked(a, 'guide') ? '同伴已在暗处找到能落脚的石阶。' : '入口的绳索仍绷在你的手中。'}你需要先接近泉台。`, choices: [
      choice('channel', '一点点引开支流', `体魄 −${marked(a, 'map') || guided(a) ? 2 : 8}；沿外沿稳妥接近`),
      choice('read', '以所学识阵之法等候水势相交', '辨认灵息空隙，无须强闯', !art(g, 'star') ? '尚未掌握识阵本领' : undefined),
      choice('plunge', '趁水势回落，穿过急流', '有受伤风险；熟悉水路、药性或有同伴引路会更稳妥'),
    ] };
    return { text: `${together}${marked(a, 'wounded') ? '急流伤了经脉，你终于抓住泉台边缘。' : '你站上泉台，呼吸渐渐与泉水同拍。'}外池灵息温和，深处却有一道直通地底的细缝。石闸已经开始回落，泉眼只能承受一次尝试。`, choices: [
      choice('clear', '留在外池，完成温和的洗髓', '外池已经稳定；完成后离开洞天'),
      choice('vein', '顺着泉眼，尝试引入地脉灵息', `可能损失 40% 当前修为、伤及 30 体魄；${marked(a, 'settled') ? '你已疏通水路，地脉较为平稳' : '水势仍有紊乱'}${springMedicine(a) ? '；药性准备能护住经脉' : ''}`),
    ] };
  }
  if (a.id === 'rescue') {
    const target = name(g, 'peer-1');
    if (a.stage === 0) return { text: `${target}的信到了沧溟洲渡潮盟的水驿。库吏陶半夏划船送你到折梅谷，说药师是为核查被克扣的救济药材而来，塌方后带着一群伤者躲进旧药库。你检查行囊，决定怎样入谷。`, choices: [
      choice('medicine', '带上解瘴药草，先循药味找人', `灵草 −${art(g, 'herb') ? 1 : 3}；医药本领能减少用药`, herbs(g, art(g, 'herb') ? 1 : 3)),
      ...(hasSectArt(g, 'ledger') ? [choice('ledger-study', '亲自以勘契所学核对旧货路', '道心 −4；以已学本领核对契副与运输记号')] : []),
      choice('ledger', `请${name(g, 'peer-0')}核对旧货路`, '可信的盘账同道能认出药库与商道的联系', friendReason(g, 'peer-0')),
      choice('guard', `与${name(g, 'peer-3')}结伴开路`, '可信的护阵同道同行，替你照看身后的退路', friendReason(g, 'peer-3')),
      choice('haste', '不等天亮，沿血迹赶进去', '体魄 −8；带着现有行囊立刻出发'),
    ] };
    if (a.stage === 1) return { text: `${together}你找到了${target}。${target}把伤者安置在石台上，自己却中了瘴毒。药库内墙还在开裂，地上散落着写有工钱和药材去向的账页。`, choices: [
      choice('treat', '先解瘴毒，再护送伤者穿过内廊', marked(a, 'medicine') || art(g, 'herb') ? '已有药性准备，可稳住众人的伤势' : '再消耗 3 株灵草调配解药', marked(a, 'medicine') || art(g, 'herb') ? undefined : herbs(g, 3)),
      choice('passage', '循旧货路，从运输暗门转移', '灵石 −20，购买支撑暗道的工具；需要旧账线索或识阵本领', !readLedger(a) && !art(g, 'star') ? '尚未看懂药库旧货路' : money(g, 20)),
      choice('force', '顶住落石，背着故友冲过塌方', `体魄 −${bearsImpact(g, a) ? 8 : 20}；护阵同伴、剑道或炼体本领能分担冲击`),
    ] };
    return { text: `${target}和伤者已来到谷口，往外就是安全的山道。${marked(a, 'treated') ? '故友恢复了一些力气，把未写完的药方压在你的手心。' : '故友仍在咳嗽，却坚持清点每一位离开的人。'}你看见暗门后的火光正在逼近旧药库。${readLedger(a) || marked(a, 'passage') ? '散落的旧账让你看懂了这里曾怎样供养附近村落。' : ''}`, choices: [
      choice('healer', '扶着故友回去，把伤慢慢养好', '所有人都已脱险；收束这次救援'),
      choice('cache', '与谷外村民接管尚能使用的药库', '灵石 −30；先安置伤者，再修缮谷口库房', !readLedger(a) && !marked(a, 'passage') ? '缺少药库经营与货路的线索' : money(g, 30)),
      choice('prescription', '把伤者托付谷外，再取回药师的旧方匣', '自愿重返火场；可能伤及 24 体魄、损失 30% 当前修为；解毒准备或护阵同伴会提高把握'),
    ] };
  }
  if (a.id === 'tomb') {
    if (a.stage === 0) return { text: '玄朔洲古断雪剑庭的遗址里，风雪吹去两座石像上的薄灰：一人持剑，一人举盾。残碑只记着守阵人谢停霜的愿望——让手无寸铁的人先走。冢门里不断传来金铁声，你得先决定如何应对残存的剑意。', choices: [
      choice('sword', '以自己的剑意回应冢门', '需要剑道本领或战技 45；道心 −5', !art(g, 'qinglan') && g.stats.combat < 45 ? '需要剑道本领或战技 45' : undefined),
      choice('guard', `邀请${name(g, 'peer-3')}互为护阵`, '可信的护阵同道一起入冢', friendReason(g, 'peer-3')),
      choice('glyph', '抄下碑文，对照石像的遗言', '道心 −6；先读懂守阵人留下的文字'),
    ] };
    if (a.stage === 1) return { text: `${together}冢内重现了最后一战的残影。守阵人挡在一群没有兵器的人面前，持剑者却正在斩断同伴的退路。${marked(a, 'glyph') ? '你从拓本认出：两人原来是同门。' : '剑意卷着碎石向你压来。'}你可以选择承接哪一道残意。`, choices: [
      choice('ward', '站到守阵人身边，接住这一击', `体魄 −${marked(a, 'guard') || marked(a, 'glyph') ? 5 : 12}；稳住身后的石台`),
      choice('duel', '迎向持剑者，亲自拆解剑招', '可能被剑意震伤；剑术准备与护阵同伴能提高把握'),
      choice('still', '用观息法找出残影反复重演的间隙', '需要识阵本领；避开正面交锋', !art(g, 'star') ? '尚未掌握识阵本领' : undefined),
    ] };
    return { text: `${together}${marked(a, 'victory') ? '你拆开最后一剑，持剑残影终于低下剑尖。' : marked(a, 'clash') ? '剑意把你震退，但剑招在识海里留下了清楚的轨迹。' : '守阵人的残影渐渐散去，冢中只剩两道尚未熄灭的刻痕。'}石像下压着一柄断剑与一片盾纹。带走其中一道传承，冢门便会闭合。`, choices: [
      choice('sword', '收拢断剑中的照夜剑意', '需要已拆开剑招，或能够承接剑意的准备', !marked(a, 'victory') && !marked(a, 'sword') && !marked(a, 'guard') ? '剑意仍未接受你的回应' : undefined),
      choice('ward', '把守阵人的盾纹摹在护身物上', '稳妥带走已看清的守阵之法'),
      choice('sacrifice', '以自身经脉走完那一剑', '确定损耗 24 体魄与 25% 当前修为；用身体补足尚未领悟的剑路'),
    ] };
  }
  if (a.stage === 0) return { text: '玉京洲天衡算院的旧灯没有灯芯。最后一位司灯人容照的手记压在台边：他曾远赴赤曜洲，向蚀日道借来另一种炼体法，试图让撑不住雷劫的散修也有生路。你带来的旧线索在此找到对应的缺口，仍需要先选一个可靠的落脚处。', choices: [
    choice('stars', '依门中识阵所学推定此刻星位', '需要识阵本领；道心 −5', !art(g, 'star') ? '尚未掌握识阵本领' : undefined),
    choice('spring', '以雾隐泉的吐纳节律回应石柱', '需要亲历雾隐泉洗髓；已掌握的灵息可以共鸣', !has(g, 'exp-spring-clear') && !has(g, 'exp-spring-vein') ? '没有经历过雾隐泉洗髓' : undefined),
    ...(hasSectArt(g, 'pathfinder') ? [choice('pathcraft', '依辨路所学，独自勘定高台边缘', '道心 −5；标出虚实交界与可靠落脚点')] : []),
    choice('guide', `与${name(g, 'peer-2')}一起探查高台边缘`, '可信的寻路同道能标出虚实交界', friendReason(g, 'peer-2')),
    choice('notes', '伏案摹下完整的旧阵纹', '道心 −8；逐步核对旧卷与眼前刻痕'),
  ] };
  if (a.stage === 1) return { text: `${together}星盘开始转动，石柱却向地底沉下。你看清这不是占卜吉凶的法器，而是一座曾用来扶持渡劫者的旧阵。星盘与阵心之间只剩一根断续的灵线。`, choices: [
    choice('lens', '先固定星盘，留住正在消散的刻度', '道心 −10；集中观察阵法怎样应对灵息变化'),
    choice('anchor', '托住阵心，承接地下涌来的灵压', `体魄 −${marked(a, 'spring') || has(g, 'exp-tomb-ward') ? 8 : 18}；旧日洗髓或守阵经历能减轻负担`),
    choice('balanced', '沿星位与退路同时稳住两端', '需要识阵准备、寻路本领或寻路同伴；灵石 −35', !marked(a, 'stars') && !guided(a) ? '独自无法同时看清两端变化' : money(g, 35)),
  ] };
  return { text: `${together}高台下传来巨响，旧阵已经开始自行解体。${marked(a, 'lens') ? '你记录的星盘刻度仍清晰可辨。' : marked(a, 'anchor') ? '阵心的起伏已与你的呼吸相合；石柱中露出容照从赤曜洲带回的蚀日炼体法。' : '你暂时维持住了星盘与阵心之间的细线，也读到了容照带回的蚀日炼体法。'}沿着来路可以离开；若执意留下，便要承受旧阵最后一次灵潮。`, choices: [
    choice('chart', '收好星盘记录，沿来路离开', '带走已经记录的观察；不再承受崩解中的灵压', marked(a, 'anchor') ? '先前只来得及稳住阵心，没有记录星盘' : undefined),
    choice('anchor', '记住阵心的呼吸，卸去重压离开', '带走已经体会的守持之法', marked(a, 'lens') ? '先前只固定了星盘，没有接触阵心' : undefined),
    choice('eclipse', '放下算院旧法，承接蚀日炼体传承', '自愿改习异法：以行旅磨炼肉身，需额外供养 5 灵石／年，声望 −0.3／年；本世无法兼收此地另两门传承', marked(a, 'lens') ? '没有接触阵心，尚未读到其中异法' : undefined),
    choice('confluence', '留到灵潮合拢，将两端重新相接', `极险：可能伤及 45 体魄、损失 50% 当前修为；${marked(a, 'balanced') ? '两端已有支撑，把握较大' : '仍有一端没有支撑'}。体魄不足可能陨落`),
  ] };
}

export function expeditionView(g: Game) {
  const a = g.expeditions?.active;
  const companion = a?.companionId ? peer(g, a.companionId) : undefined;
  return {
    active: a ? { id: a.id, title: definitions[a.id as ExpeditionId].title, stage: a.stage, totalStages: 3, ...scene(g, a), ...(companion?.alive ? { companion: { id: companion.id, name: companion.name } } : {}) } : undefined,
    completed: g.expeditions?.completed ?? [],
  };
}

function end(g: Game, a: Active, ctx: ExpeditionContext, outcome: string, title: string, text: string, effects: Effect[] = []) {
  for (const effect of effects) ctx.gain(g, effect);
  if (a.companionId && peer(g, a.companionId)?.alive && outcome !== 'withdrawn') {
    ctx.gain(g, { flag: `companion-bond:${a.companionId}`, npcId: a.companionId, npcRelation: 10 });
    text += g.stats.health <= 0 ? ` ${name(g, a.companionId)}陪你走过了这段险路，情谊 +10，这场共同经历留在了同伴的记忆里。`
      : ` ${name(g, a.companionId)}与你共同走过了这段险路，情谊 +10，同行所需情谊降为 55。`;
  }
  if (g.stats.health <= 0) {
    title += ' · 陨落';
    text += ' 你勉强退到出口，却未能撑过伤势。此行以陨落结卷，所得与未竟的打算一同留在此生年谱中。';
  }
  const record: Completion = { id: a.id, outcome, title, text, age: g.age };
  g.expeditions!.completed.push(record);
  delete g.expeditions!.active;
  ctx.log(g, `际遇 · ${title}`, text, 'encounter', true);
  ctx.checkLife(g);
}
function setStage(g: Game, a: Active, mark: string, ctx: ExpeditionContext, text: string) {
  a.marks.push(mark); a.stage += 1;
  ctx.log(g, definitions[a.id as ExpeditionId].title, text, 'encounter', false);
  ctx.checkLife(g);
  if (!g.alive) delete g.expeditions!.active;
}
function invite(g: Game, a: Active, id: string) { a.companionId = id; }
function consumeHerbs(g: Game, count: number) { g.inventory.herb = (g.inventory.herb ?? 0) - count; }

/** Mutates only the engine's working copy. The engine owns RNG, gains, logs and life checks. */
export function mutateExpedition(g: Game, action: ExpeditionAction, ctx: ExpeditionContext): string | undefined {
  if (!g.alive) return '此生已经结卷';
  if (action.type === 'expedition-start') {
    const offer = expeditionOffers(g).find(e => e.id === action.id);
    if (!offer) return '眼前没有这条机缘';
    if (!offer.available) return offer.reason;
    if (!g.expeditions) g.expeditions = { completed: [] };
    ctx.gain(g, { stones: -offer.cost }); g.actionsLeft -= 1;
    g.expeditions.active = { id: action.id, stage: 0, marks: [], startedAge: g.age };
    ctx.log(g, `际遇 · ${offer.title}`, `你决定亲自走这一趟，备下 ${offer.cost} 灵石的行装。${offer.description}`, 'encounter', true);
    return;
  }
  const a = g.expeditions?.active;
  if (!a) return '当前没有正在经历的小剧本';
  if (action.type === 'expedition-retreat') {
    const learned = a.stage >= 2;
    const text = a.id === 'rescue' && learned ? `你把${name(g, 'peer-1')}和伤者送回谷外，没有再回头冒险。救人的经历留在彼此心里。悟性 +3，道心 +5；未取得药库或医道传承。`
      : learned ? '你辨明退路，在更大的风险到来前收手。沿途的见闻已经属于你。悟性 +3，道心 +5。' : '你记下入口与眼前险象，及时退回了安全的地方。此地的入口随后封闭，行装费用已经耗去。';
    end(g, a, ctx, 'withdrawn', '带着此行的经历归来', text, learned ? [{ stats: { insight: 3, mind: 5 } }, ...(a.id === 'rescue' ? [{ npcId: 'peer-1', npcRelation: 8 }] : [])] : []);
    return;
  }
  const selected = scene(g, a).choices.find(c => c.id === action.id);
  if (!selected) return '这不是眼前可以采取的行动';
  if (selected.disabled) return selected.disabled;
  const id = action.id;
  g.choices += 1;
  if (a.id === 'spring') {
    if (a.stage === 0) {
      if (id === 'map' || id === 'pathcraft') ctx.gain(g, { stats: { mind: -4 } });
      if (id === 'medicine') consumeHerbs(g, 2);
      if (id === 'healer') invite(g, a, 'peer-1');
      if (id === 'guide') invite(g, a, 'peer-2');
      if (id === 'supplies') ctx.gain(g, { stones: -12 });
      setStage(g, a, id, ctx, `你${selected.label}，然后走入雾中。`); return;
    }
    if (a.stage === 1) {
      let mark = 'settled';
      if (id === 'channel') ctx.gain(g, { stats: { health: marked(a, 'map') || guided(a) ? -2 : -8 } });
      if (id === 'plunge') {
        const success = ctx.random(g) < (guided(a) ? 0.9 : marked(a, 'map') || springMedicine(a) ? 0.8 : 0.5);
        mark = success ? 'turbulent' : 'wounded';
        ctx.gain(g, { stats: { health: success ? -4 : -18 } });
      }
      setStage(g, a, mark, ctx, mark === 'wounded' ? '急流撕裂护身灵息，体魄 −18。你仍抓住了泉台，认得来时的退路。' : `你${selected.label}，终于抵达泉台。`); return;
    }
    if (id === 'clear') {
      end(g, a, ctx, 'clear', '清泉洗髓', '你没有追逐最深处的灵潮，在外池完成了洗髓。经脉从此能够更安稳地承接灵息。资质永久 +4（上限100）；习得清泉息：静养每年额外恢复 3 道心。', [{ rootBoost: 4, stats: { foundation: 8 }, flag: 'exp-spring-clear' }]);
    } else {
      const chance = 0.35 + (marked(a, 'settled') ? 0.25 : 0) + (springMedicine(a) ? 0.2 : guided(a) || marked(a, 'map') ? 0.15 : 0.05);
      if (ctx.random(g) < chance) end(g, a, ctx, 'vein', '地脉入身', '先前铺开的水路与护脉准备撑过灵潮，地脉在你体内留下了新的循环。资质永久 +10（上限100）；习得地脉吐纳：年度修炼收益 +8%。你离开时，洞天已经重新隐入山雾。', [{ rootBoost: 10, stats: { foundation: 10 }, flag: 'exp-spring-vein' }]);
      else end(g, a, ctx, 'scarred', '泉眼闭合之前', '地底灵潮超过了经脉的承受，体魄 −30、当前修为损失 40%。你沿先前留下的退路返回外池，保住温和洗髓的所得：资质永久 +4（上限100），习得清泉息，静养每年额外恢复 3 道心。', [{ stats: { health: -30 }, progress: -g.progress * 0.4, rootBoost: 4, flag: 'exp-spring-clear' }]);
    }
    return;
  }
  if (a.id === 'rescue') {
    const target = name(g, 'peer-1');
    if (!peer(g, 'peer-1')?.alive) return '求援的故友已不在人间，不能继续这段救援';
    if (a.stage === 0) {
      if (id === 'medicine') consumeHerbs(g, art(g, 'herb') ? 1 : 3);
      if (id === 'ledger') invite(g, a, 'peer-0');
      if (id === 'ledger-study') ctx.gain(g, { stats: { mind: -4 } });
      if (id === 'guard') invite(g, a, 'peer-3');
      if (id === 'haste') ctx.gain(g, { stats: { health: -8 } });
      setStage(g, a, id, ctx, `你${selected.label}，循着${target}留下的记号入谷。`); return;
    }
    if (a.stage === 1) {
      if (id === 'treat' && !marked(a, 'medicine') && !art(g, 'herb')) consumeHerbs(g, 3);
      if (id === 'passage') ctx.gain(g, { stones: -20 });
      if (id === 'force') ctx.gain(g, { stats: { health: bearsImpact(g, a) ? -8 : -20 } });
      setStage(g, a, id === 'treat' ? 'treated' : id === 'force' ? 'forced' : 'passage', ctx, `你${selected.label}。${target}与伤者一同来到谷口，药库的火仍没有熄灭。`); return;
    }
    const relation: Effect = { npcId: 'peer-1', npcRelation: id === 'cache' ? 8 : 18, flag: 'companion-bond:peer-1' };
    if (id === 'cache') end(g, a, ctx, 'cache', '药库重新开门', `你先安顿${target}，再和谷外村民修好库房。曾经让药师陷入困境的供给，如今有人共同承担。灵石 −30；学会药库经营：营生每年额外收入 5 灵石。与${target}情谊 +8，同道相助门槛降为 55。`, [{ stones: -30, flag: 'exp-rescue-cache' }, relation]);
    else if (id === 'healer') end(g, a, ctx, 'healer', '故友案前的药方', `你陪${target}熬过伤后的夜晚。故友把多年来只写在私札里的配药方法一一教给你。习得同心医理：回复丹药额外恢复 6 点；与${target}情谊 +18，同道相助门槛降为 55。`, [{ stats: { alchemy: 8 }, flag: 'exp-rescue-healer' }, relation]);
    else {
      const success = ctx.random(g) < (marked(a, 'treated') ? 0.85 : marked(a, 'guard') ? 0.8 : 0.5);
      if (success) end(g, a, ctx, 'prescription', '火中留下的旧方', `你取回药匣时，${target}终于说起这些方子的来历。辨药与配脉的经验让你的经脉得到长久调理。资质永久 +7（上限100）；习得同心医理，回复丹药额外恢复 6 点；与${target}情谊 +18，相助门槛降为 55。`, [{ rootBoost: 7, stats: { alchemy: 10 }, flag: 'exp-rescue-healer' }, relation]);
      else end(g, a, ctx, 'scarred', '失去药匣，留下故友', `药库坍塌，你没能保住药匣。体魄 −24、当前修为损失 30%。${target}一直守在谷外，陪你重新整理还记得的药理。习得同心医理，回复丹药额外恢复 6 点；与${target}情谊 +18，相助门槛降为 55。`, [{ stats: { health: -24 }, progress: -g.progress * 0.3, flag: 'exp-rescue-healer' }, relation]);
    }
    return;
  }
  if (a.id === 'tomb') {
    if (a.stage === 0) {
      if (id === 'sword') ctx.gain(g, { stats: { mind: -5 } });
      if (id === 'guard') invite(g, a, 'peer-3');
      if (id === 'glyph') ctx.gain(g, { stats: { mind: -6 } });
      setStage(g, a, id, ctx, `你${selected.label}，冢门缓缓向内打开。`); return;
    }
    if (a.stage === 1) {
      let mark = id === 'ward' ? 'ward' : 'still';
      if (id === 'ward') ctx.gain(g, { stats: { health: marked(a, 'guard') || marked(a, 'glyph') ? -5 : -12 } });
      if (id === 'duel') {
        const won = ctx.random(g) < (marked(a, 'sword') ? 0.9 : marked(a, 'guard') ? 0.85 : 0.5);
        mark = won ? 'victory' : 'clash';
        ctx.gain(g, { stats: { health: won ? -5 : -22, combat: won ? 5 : 2 } });
      }
      setStage(g, a, mark, ctx, mark === 'clash' ? '你没能接稳最后一剑，体魄 −22，仍记下了剑招的轨迹。战技 +2。' : `你${selected.label}，残影终于不再重演那一夜。`); return;
    }
    if (id === 'ward') end(g, a, ctx, 'ward', '无名守阵人的传承', '你没有取剑，而把守阵人的盾纹留在身边。每次灵压袭来，都记得先为自己留一道退路。习得照夜守阵：历练受伤损失降低 20%；根基 +10。', [{ stats: { foundation: 10 }, flag: 'exp-tomb-ward' }]);
    else if (id === 'sword') end(g, a, ctx, 'sword', '照夜剑意', '你将残缺的剑路补进自己的功法。那柄断剑没有离开剑冢，剑意却第一次走出了最后一战。习得照夜剑意：年度历练所得灵石 +15%；战技 +12。', [{ stats: { combat: 12 }, flag: 'exp-tomb-sword' }]);
    else end(g, a, ctx, 'sacrifice', '以身补剑', '你用经脉补全剑路，付出了体魄 −24、当前修为损失 25% 的代价。剑意终于与自身相合。习得照夜剑意：年度历练所得灵石 +15%；资质永久 +3（上限100）。', [{ stats: { health: -24 }, progress: -g.progress * 0.25, rootBoost: 3, flag: 'exp-tomb-sword' }]);
    return;
  }
  if (a.stage === 0) {
    if (id === 'stars' || id === 'pathcraft') ctx.gain(g, { stats: { mind: -5 } });
    if (id === 'guide') invite(g, a, 'peer-2');
    if (id === 'notes') ctx.gain(g, { stats: { mind: -8 } });
    setStage(g, a, id, ctx, `你${selected.label}，台上的灯光随之亮起。`); return;
  }
  if (a.stage === 1) {
    if (id === 'lens') ctx.gain(g, { stats: { mind: -10 } });
    if (id === 'anchor') ctx.gain(g, { stats: { health: marked(a, 'spring') || has(g, 'exp-tomb-ward') ? -8 : -18 } });
    if (id === 'balanced') ctx.gain(g, { stones: -35 });
    setStage(g, a, id, ctx, `你${selected.label}，旧阵的用法在眼前渐渐清楚。`); return;
  }
  const chart: Effect = { flag: 'exp-observatory-chart', stats: { insight: 10 } };
  const anchor: Effect = { flag: 'exp-observatory-anchor', stats: { foundation: 10 } };
  if (id === 'chart') end(g, a, ctx, 'chart', '无昼星图', '你带着完整的星盘观察离开高台。旧阵没有替你预言未来，却让你学会辨认冲关时的灵息变化。习得无昼星图：突破成功率 +4 个百分点；悟性 +10。', [chart]);
  else if (id === 'anchor') end(g, a, ctx, 'anchor', '渡厄守心诀', '你把阵心的呼吸记在心里，终于懂得怎样在冲关失手时护住自己的修为。习得渡厄守心诀：突破失败至少保留 82% 修为；根基 +10。', [anchor]);
  else if (id === 'eclipse') end(g, a, ctx, 'eclipse', '蚀日遗脉的行路人', '你读懂容照留下的批注，放下算院的两门旧法，以身为炉承接蚀日炼体传承。资质永久 +5（上限100）；历练修为 +35%，每年体魄 +1.5；额外供养 5 灵石／年，因异法名声承受声望 −0.3／年。从今以后，你行走山河时有了不同的修行办法。', [{ rootBoost: 5, flag: 'legacy-eclipse' }]);
  else {
    const success = ctx.random(g) < Math.min(0.88, 0.35 + (marked(a, 'balanced') ? 0.3 : 0) + (marked(a, 'stars') || guided(a) || marked(a, 'spring') ? 0.2 : 0.1));
    if (success) end(g, a, ctx, 'confluence', '旧阵重明', '你让两端重新相接，旧阵在崩解前完整运转了一次。资质永久 +8（上限100）；同时领悟无昼星图与渡厄守心诀：突破成功率 +4 个百分点，失败至少保留 82% 修为；悟性与根基各 +10。你沿旧日经历指引的路，带回了属于自己的答案。', [chart, anchor, { rootBoost: 8 }]);
    else {
      const retained = marked(a, 'anchor') ? anchor : chart;
      end(g, a, ctx, 'fracture', '高台坠落时', `没有支撑住的灵线断裂，体魄 −45、当前修为损失 50%。此前亲手记下的${marked(a, 'anchor') ? '守阵之法没有丢失：习得渡厄守心诀，突破失败至少保留 82% 修为；根基 +10' : '星盘观察没有丢失：习得无昼星图，突破成功率 +4 个百分点；悟性 +10'}。旧阵的另一半永远留在了坠落的高台上。`, [retained, { stats: { health: -45 }, progress: -g.progress * 0.5 }]);
    }
  }
}

/** Save validation never executes story code or creates rewards. Older saves may omit this field. */
export function isValidExpeditions(value: unknown, g: Game): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const state = value as ExpeditionState;
  if (!Array.isArray(state.completed) || state.completed.length > ids.length) return false;
  const completedIds = new Set<string>();
  for (const record of state.completed) {
    if (!record || typeof record !== 'object' || !ids.includes(record.id as ExpeditionId) || completedIds.has(record.id)) return false;
    const def = definitions[record.id as ExpeditionId];
    if (!(def.outcomes as readonly string[]).includes(record.outcome) || typeof record.title !== 'string' || record.title.length > 120 || typeof record.text !== 'string' || record.text.length > 3000 || !Number.isInteger(record.age) || record.age < 0 || record.age > g.age) return false;
    completedIds.add(record.id);
  }
  if (state.active === undefined) return true;
  const a = state.active;
  if (!a || typeof a !== 'object' || !ids.includes(a.id as ExpeditionId) || !g.alive || g.pending || completedIds.has(a.id)) return false;
  if (!Number.isInteger(a.stage) || a.stage < 0 || a.stage > 2 || !Number.isInteger(a.startedAge) || a.startedAge !== g.age || !Array.isArray(a.marks) || a.marks.length !== a.stage || new Set(a.marks).size !== a.marks.length) return false;
  const def = definitions[a.id as ExpeditionId];
  if (g.realm < def.minRealm || g.realm > def.maxRealm || g.region !== regions[a.id as ExpeditionId] || a.marks.some(mark => !(def.marks as readonly string[]).includes(mark))) return false;
  const firstMarks: Record<ExpeditionId, string[]> = { spring: ['map', 'medicine', 'healer', 'guide', 'pathcraft', 'supplies'], rescue: ['medicine', 'ledger', 'ledger-study', 'guard', 'haste'], tomb: ['sword', 'guard', 'glyph'], observatory: ['stars', 'spring', 'guide', 'pathcraft', 'notes'] };
  const secondMarks: Record<ExpeditionId, string[]> = { spring: ['settled', 'turbulent', 'wounded'], rescue: ['treated', 'passage', 'forced'], tomb: ['ward', 'victory', 'clash', 'still'], observatory: ['lens', 'anchor', 'balanced'] };
  if (a.stage > 0 && !firstMarks[a.id as ExpeditionId].includes(a.marks[0])) return false;
  if (a.stage > 1 && !secondMarks[a.id as ExpeditionId].includes(a.marks[1])) return false;
  if (a.marks[0] === 'pathcraft' && !hasSectArt(g, 'pathfinder')) return false;
  if (a.marks[0] === 'ledger-study' && !hasSectArt(g, 'ledger')) return false;
  const expectedCompanion = a.marks[0] === 'guide' ? 'peer-2' : a.marks[0] === 'guard' ? 'peer-3' : a.marks[0] === 'ledger' ? 'peer-0' : a.marks[0] === 'healer' ? 'peer-1' : undefined;
  if (a.companionId !== expectedCompanion || (a.companionId !== undefined && !peer(g, a.companionId)?.alive)) return false;
  if (a.id === 'rescue' && !peer(g, 'peer-1')?.alive) return false;
  return true;
}
