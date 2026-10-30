import { REALMS } from './data.ts';
import { SECTS, sectPassive, type SectBenefits } from './sects.ts';
import { regionPractice } from './world.ts';
import type { Effect, Focus, Game, LogKind, Preparation, PreparationMethod } from './types.ts';

export const PREPARATION_METHODS: PreparationMethod[] = ['temper', 'meditate', 'medicine'];
const has = (g: Game, flag: string) => g.flags.includes(flag);
export function preparationState(g: Game): Preparation {
  return g.preparation?.realm === g.realm ? g.preparation : { realm: g.realm, selected: null, progress: { temper: 0, meditate: 0, medicine: 0 } };
}
export function preparationTarget(realm: number, method: PreparationMethod): number {
  return 6 + realm * 2 - (method === 'medicine' ? 1 : 0);
}
const methodFocus: Record<PreparationMethod, Focus[]> = { temper: ['adventure'], meditate: ['study'], medicine: ['alchemy'] };
const methodNames: Record<PreparationMethod, string[]> = {
  temper: ['行山感气', '淬脉筑基', '罡气凝丹', '炼体护婴', '行劫养神', '以身承劫'],
  meditate: ['灵台初照', '归元推演', '照见丹心', '观想定婴', '神游问真', '观天证道'],
  medicine: ['识药温养', '药性合脉', '丹火养元', '药浴护神', '炼药渡厄', '丹炉合道'],
};
const realmThemes = ['辨认自身气机，准备第一次引气入体', '让经脉承受更稳定的周天，选择怎样筑基', '在凝丹之前，决定自己的丹道底色', '从金丹到元婴，练习承受失利与更漫长的修行', '让元婴与所走过的山河相合，准备化神', '最后一次整理此身所学，准备回答天劫'];

type Benefits = SectBenefits;
interface Attainment { id: string; name: string; description: string; bonus?: Partial<Benefits>; aptitude?: number }
const earned = (realm: number, method: PreparationMethod, name: string, description: string, bonus: Partial<Benefits> = {}, aptitude?: number): Attainment => ({ id: `attainment-${realm}-${method}`, name, description, bonus, aptitude });
const PREPARATION_ATTAINMENTS: Attainment[] = [
  earned(0, 'temper', '息行不辍', '静养每年额外恢复2体魄；此生永久保留。', { restHealth: 2 }),
  earned(0, 'meditate', '灵台初开', '突破时先天资质永久增加3，上限100，不随年度属性维护衰减。', {}, 3),
  earned(0, 'medicine', '辨药入微', '炼丹成功率增加4个百分点；此生永久保留。', { craftChance: 0.04 }),
  earned(1, 'temper', '护脉道基', '突破失败受到的体魄伤害减少15%。', { failureDamage: 0.85 }),
  earned(1, 'meditate', '归元内景', '所有年度重心的基础修炼速度提高5%。', { training: 1.05 }),
  earned(1, 'medicine', '药性相和', '回春丹、清心丹的对应恢复量增加6。', { pillPotency: 6 }),
  earned(2, 'temper', '护体罡气', '年度历练受伤时，体魄伤害减少15%。', { adventureDamage: 0.85 }),
  earned(2, 'meditate', '丹心自照', '今后每次突破成功率增加2.5个百分点，仍受90%上限约束。', { breakthrough: 0.025 }),
  earned(2, 'medicine', '丹火回收', '炼丹失败时能回收1株灵草，其他材料和炉费仍会消耗。', { failedCraftHerbs: 1 }),
  earned(3, 'temper', '肉身载道', '突破失败后的调息年限减少1年，最短仍为1年。', { cooldownReduction: 1 }),
  earned(3, 'meditate', '观想归藏', '突破失败保留至少78%修为，替代普通的72%。', { failureRetention: 0.78 }),
  earned(3, 'medicine', '药浴养神', '静养每年额外恢复3体魄、2道心。', { restHealth: 3, restMind: 2 }),
  earned(4, 'temper', '神行山河', '年度历练所得灵石提高12%。', { adventureIncome: 1.12 }),
  earned(4, 'meditate', '照破先天', '突破时先天资质永久增加4，上限100，不随岁月衰减。', {}, 4),
  earned(4, 'medicine', '药力归一', '使用凝灵丹冲关时，丹药额外增加4个百分点成功率。', { pillChance: 0.04 }),
  earned(5, 'temper', '以身证道', '你以行劫淬体完成最后一次准备；飞升时写入此生终卷。'),
  earned(5, 'meditate', '观天证道', '你以周天推演完成最后一次准备；飞升时写入此生终卷。'),
  earned(5, 'medicine', '丹炉合道', '你以草木药性完成最后一次准备；飞升时写入此生终卷。'),
];
const SPECIALTIES = Object.fromEntries(SECTS.map(sect => [sect.id, sect.specialty]));
const EXPEDITION_ATTAINMENTS: Attainment[] = [
  { id: 'exp-spring-clear', name: '清泉息', description: '静养重心每年额外恢复3道心。', bonus: { restMind: 3 } },
  { id: 'exp-spring-vein', name: '地脉吐纳', description: '所有年度重心的基础修炼速度提高8%。', bonus: { training: 1.08 } },
  { id: 'exp-rescue-healer', name: '同心医理', description: '回春丹、清心丹的对应恢复量增加6。', bonus: { pillPotency: 6 } },
  { id: 'exp-rescue-cache', name: '药库经营', description: '营生重心每年额外收入5灵石。', bonus: { workIncome: 5 } },
  { id: 'exp-tomb-sword', name: '照夜剑意', description: '年度历练所得灵石提高15%。', bonus: { adventureIncome: 1.15 } },
  { id: 'exp-tomb-ward', name: '照夜守阵', description: '年度历练受伤时体魄伤害减少20%。', bonus: { adventureDamage: 0.8 } },
  { id: 'exp-observatory-chart', name: '无昼星图', description: '突破成功率增加4个百分点，仍受90%上限约束。', bonus: { breakthrough: 0.04 } },
  { id: 'exp-observatory-anchor', name: '渡厄守心诀', description: '突破失败保留至少82%修为，替代普通的72%。', bonus: { failureRetention: 0.82 } },
  { id: 'legacy-eclipse', name: '蚀日炼身传承', description: '历练修为提高35%，每年体魄恢复1.5；额外供养5灵石／年，声望每年承受0.3的压力。承接时获得的5点资质永久保留。', bonus: { adventureTraining: 1.35, upkeep: 5, yearHealth: 1.5, yearReputation: -0.3 } },
];
const allAttainments = [...PREPARATION_ATTAINMENTS, ...Object.values(SPECIALTIES), ...EXPEDITION_ATTAINMENTS];
export function attainedAbilities(g: Game) {
  return allAttainments.filter(ability => has(g, ability.id)).map(({ id, name, description }) => ({ id, name, description }));
}
/** The display and all engine actions read the same permanent abilities. */
export function progressionBenefits(g: Game): Benefits {
  const value: Benefits = { restHealth: 0, restMind: 0, training: 1, craftChance: 0, pillPotency: 0, adventureDamage: 1, adventureIncome: 1, breakthrough: 0, failureDamage: 1, failureRetention: 0.72, cooldownReduction: 0, failedCraftHerbs: 0, pillChance: 0, workIncome: 0, adventureCombat: 0, adventureTraining: 1, upkeep: 0, yearHealth: 0, yearReputation: 0 };
  const multiply = ['training', 'adventureDamage', 'adventureIncome', 'failureDamage', 'adventureTraining'];
  const apply = (bonus: Partial<Benefits>) => {
    for (const [key, amount] of Object.entries(bonus) as [keyof Benefits, number][]) {
      if (multiply.includes(key)) value[key] *= amount;
      else if (key === 'failureRetention') value[key] = Math.max(value[key], amount);
      else value[key] += amount;
    }
  };
  for (const ability of [...PREPARATION_ATTAINMENTS, ...EXPEDITION_ATTAINMENTS]) {
    if (has(g, ability.id) && ability.bonus) apply(ability.bonus);
  }
  // Learning another school's solution keeps its narrative uses. Shared numerical
  // benefits use the strongest school, rather than compounding twenty careers.
  const school: Partial<Benefits> = {};
  for (const ability of Object.values(SPECIALTIES)) {
    if (!has(g, ability.id)) continue;
    for (const [key, amount] of Object.entries(ability.bonus) as [keyof Benefits, number][]) {
      if (school[key] === undefined) school[key] = amount;
      else school[key] = ['adventureDamage', 'failureDamage'].includes(key) ? Math.min(school[key]!, amount) : Math.max(school[key]!, amount);
    }
  }
  apply(school);
  // These two active-school effects retain their existing engine calculation.
  const { cultivation: _cultivation, breakthrough: _breakthrough, ...passive } = sectPassive(g);
  apply(passive);
  if (g.equipped === 'sword') value.adventureCombat += 15;
  const equipped = SECTS.find(sect => sect.specialty.gear.id === g.equipped)?.specialty.gear;
  if (equipped) apply(equipped.bonus);
  return value;
}
function annualCost(g: Game, method: PreparationMethod) {
  return { stones: method === 'medicine' ? 3 + g.realm * 2 : method === 'temper' ? 2 + g.realm : 1 + g.realm, herbs: method === 'medicine' ? 2 : 0, health: method === 'temper' ? 2 : 0 };
}
function methodUnavailable(g: Game, method: PreparationMethod): string | undefined {
  if (!g.alive || g.realm >= 6) return '此生已结卷';
  if (g.age < 16) return '十六岁后可独立选择突破准备';
  if (g.pending || g.expeditions?.active) return '请先处理眼前的经历';
  if (method === 'medicine' && !g.home.furnace) return '需要先在洞府建造青铜丹炉';
}
function yearBlocked(g: Game, method: PreparationMethod): string | undefined {
  if (method === 'medicine' && !g.home.furnace) return '尚无丹炉，准备暂停';
  if (!methodFocus[method].includes(g.focus)) return `当前年度重心不符，已投入的进度仍保留`;
  const cost = annualCost(g, method);
  if (g.stones < cost.stones) return `供养之后还需${cost.stones}灵石，资用不足时暂停投入`;
  if ((g.inventory.herb || 0) < cost.herbs) return `每次温养需要${cost.herbs}株灵草，材料不足时暂停`;
  if (cost.health && g.stats.health < 35) return '体魄低于35，先静养再继续行山';
}
export function preparationChance(g: Game): number {
  const state = preparationState(g);
  if (!state.selected || g.realm >= 6) return 0;
  const maximum = { temper: 0.10, meditate: 0.12, medicine: 0.14 }[state.selected];
  return maximum * Math.min(1, state.progress[state.selected] / preparationTarget(g.realm, state.selected));
}
export function preparationView(g: Game) {
  const state = preparationState(g);
  return {
    title: g.realm >= 6 ? '此生所学已成终卷' : `${REALMS[g.realm].name} · ${REALMS[Math.min(6, g.realm + 1)].name}准备`,
    description: g.realm >= 6 ? '保留这段人生努力得到的本领。' : `${realmThemes[g.realm]}。这些准备可选，普通突破始终开放；切换方案保留本境已投入的进度。`,
    selected: state.selected,
    methods: PREPARATION_METHODS.map(id => {
      const cost = annualCost(g, id), target = preparationTarget(g.realm, id), progress = state.progress[id];
      const reason = methodUnavailable(g, id), pauseReason = progress >= target ? undefined : yearBlocked(g, id);
      const ability = PREPARATION_ATTAINMENTS.find(a => a.id === `attainment-${g.realm}-${id}`);
      return { id, name: methodNames[id][g.realm] ?? '此生已成', description: { temper: '在真实历练中淬炼身躯，承担额外体魄消耗。', meditate: '在典籍中逐年推演周天，以时间和资用换取稳定准备。', medicine: '用丹炉与灵草温养自身，材料投入更高，准备也更充分。' }[id], progress, target,
        available: !reason, reason, focus: methodFocus[id], working: state.selected === id && progress < target && !pauseReason && !reason, pauseReason,
        cost: `每个有效年份：${cost.stones}灵石${cost.herbs ? `、${cost.herbs}灵草` : ''}${cost.health ? `、${cost.health}体魄` : ''}；当地每年推进${regionPractice(g.region, id)}点`,
        rate: regionPractice(g.region, id),
        benefit: `所选方法最多增加${{ temper: 10, meditate: 12, medicine: 14 }[id]}个百分点突破机会。${ability ? `完成后以此法突破成功，留下「${ability.name}」：${ability.description}` : ''}`,
      };
    }),
    attainments: attainedAbilities(g), chanceBonus: preparationChance(g),
    next: !state.selected ? '可先选一种方法，再让对应年度重心持续推进；也可以直接准备普通突破。'
      : state.progress[state.selected] >= preparationTarget(g.realm, state.selected) ? '当前方法已完成。以此法突破成功会固化本世成果；失败仍保留准备。'
      : yearBlocked(g, state.selected) ?? '计划会在每个有效年份自动投入一次，无需反复点击。',
  };
}
export function selectPreparation(g: Game, method: string | null): string | undefined {
  if (method !== null && !PREPARATION_METHODS.includes(method as PreparationMethod)) return '没有这条准备方法';
  if (!g.alive || g.realm >= 6 || g.age < 16) return '当前无法安排突破准备';
  if (method) {
    const reason = methodUnavailable(g, method as PreparationMethod); if (reason) return reason;
  }
  g.preparation = { ...preparationState(g), selected: method as PreparationMethod | null };
}
interface ProgressionContext { gain: (g: Game, effect: Effect) => void; log: (g: Game, title: string, text: string, kind?: LogKind, important?: boolean) => void }
export function advancePreparation(g: Game, ctx: ProgressionContext) {
  const state = preparationState(g), method = state.selected;
  if (!method || g.age < 16 || g.realm >= 6 || state.progress[method] >= preparationTarget(g.realm, method) || yearBlocked(g, method)) return;
  const cost = annualCost(g, method);
  g.stones -= cost.stones;
  if (cost.herbs) g.inventory.herb -= cost.herbs;
  if (cost.health) ctx.gain(g, { stats: { health: -cost.health } });
  g.preparation = { ...state, progress: { ...state.progress, [method]: Math.min(preparationTarget(g.realm, method), Math.round((state.progress[method] + regionPractice(g.region, method)) * 100) / 100) } };
  if (g.preparation.progress[method] === preparationTarget(g.realm, method)) ctx.log(g, '突破准备完成 · ' + methodNames[method][g.realm], '持续投入已完成。下次以此法突破成功，将把这一境的努力留成本世本领；突破失败不会清空这些准备。', 'cultivation', true);
}
export function completePreparation(g: Game, ctx: ProgressionContext) {
  const state = preparationState(g), method = state.selected;
  if (method && state.progress[method] >= preparationTarget(g.realm, method)) {
    const ability = PREPARATION_ATTAINMENTS.find(a => a.id === `attainment-${g.realm}-${method}`)!;
    if (!has(g, ability.id)) {
      ctx.gain(g, { flag: ability.id, ...(ability.aptitude ? { rootBoost: ability.aptitude } : {}) });
      ctx.log(g, '所学留身 · ' + ability.name, ability.description, 'cultivation', true);
    }
  }
  // The next realm starts with no compulsory plan. Old effort remains in its named attainment/log.
  delete g.preparation;
}
export function sectSpecialty(g: Game, sectId: string | null = g.sect) {
  const specialty = sectId ? SPECIALTIES[sectId] : undefined;
  if (!specialty) return null;
  const owned = has(g, specialty.id);
  const reason = owned ? '此生已经学会，不会重复付费叠加' : !g.alive ? '此生已结卷' : g.sect !== sectId ? '需要先加入这个宗门' : g.pending || g.expeditions?.active ? '请先处理眼前的经历' : g.actionsLeft <= 0 ? '今年主动行动已用完' : g.contribution < specialty.cost ? `需要${specialty.cost}宗门贡献` : undefined;
  return { id: specialty.id, name: specialty.name, description: specialty.description, owned, cost: specialty.cost, available: !reason, reason };
}
export function learnSectSpecialty(g: Game, ctx: ProgressionContext): string | undefined {
  const specialty = sectSpecialty(g);
  if (!specialty) return '尚未加入宗门';
  if (!specialty.available) return specialty.reason;
  g.contribution -= specialty.cost;
  const gear = SECTS.find(sect => sect.id === g.sect)!.specialty.gear;
  ctx.gain(g, { flag: specialty.id, item: gear.id });
  ctx.log(g, '学得宗门专长 · ' + specialty.name, `用${specialty.cost}贡献完成传授。${specialty.description} 获得${gear.name}，本世只授予一次；离宗后本领保留。`, 'cultivation', true);
}
export function companionTraits(g: Game) {
  const traits = [
    { id: 'peer-0', traitId: 'ledger', traitName: '识契盘账', description: '熟悉来往契约，可在同行与物资纠纷中辨出线索。' },
    { id: 'peer-1', traitId: 'healer', traitName: '辨药施救', description: '熟悉草木与伤势，可在救援经历中帮助辨药。' },
    { id: 'peer-2', traitId: 'pathfinder', traitName: '山野寻路', description: '熟悉山川小径，可在相应秘境中帮助判断退路。' },
    { id: 'peer-3', traitId: 'sword', traitName: '剑意护阵', description: '熟悉剑阵，可在相应遗迹中与你合力护阵。' },
  ];
  return traits.filter(trait => g.npcs.some(npc => npc.id === trait.id)).map(trait => {
    const npc = g.npcs.find(n => n.id === trait.id), shared = has(g, `companion-bond:${trait.id}`), required = shared ? 55 : 60;
    const alive = Boolean(npc?.alive && npc.realm < 6), relation = npc?.relation ?? 0;
    const reason = npc?.role === 'enemy' ? '旧怨未了' : !alive ? npc?.realm === 6 ? '已经飞升离界' : '已经不在人间' : relation < required ? `情谊达到${required}才能彼此托付` : undefined;
    return { ...trait, name: npc?.name ?? '旧日同道', description: trait.description + (shared ? '共同经历让你们更容易彼此托付。' : ''), available: !reason, reason, relation, alive, shared };
  });
}
