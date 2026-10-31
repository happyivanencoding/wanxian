import { regionalStanding } from './history.ts';
import type { Effect, Game, Stats } from './types.ts';

/** Runtime, UI and the optional director share this authored catalogue. */
export interface SectBenefits {
  restHealth: number; restMind: number; training: number; craftChance: number; pillPotency: number;
  adventureDamage: number; adventureIncome: number; breakthrough: number; failureDamage: number;
  failureRetention: number; cooldownReduction: number; failedCraftHerbs: number; pillChance: number; workIncome: number;
  adventureCombat: number; adventureTraining: number; upkeep: number; yearHealth: number; yearReputation: number;
}
export type SectArt = 'sword' | 'medicine' | 'formation' | 'ledger' | 'pathfinder' | 'body';
export interface SectGear {
  id: string; name: string; mark: string; price: number; minRealm: number; description: string; bonus: Partial<SectBenefits>;
}
export interface SectDefinition {
  id: string; home: string; name: string; mark: string; style: string; minRealm: number; reputation: number; entryCost: number;
  culture: string; preferences: string[]; description: string; bonus: string; allowance: number; annual: Effect;
  passive: Partial<SectBenefits> & { cultivation?: number };
  mission: { name: string; description: string; baseStones: number; realmStones: number; contribution: number; rankContribution: number; stats: Partial<Stats>; item?: string; amount?: number };
  specialty: { id: string; name: string; cost: number; description: string; bonus: Partial<SectBenefits>; arts: SectArt[]; gear: SectGear };
}
const mission = (name: string, description: string, stats: Partial<Stats> = { health: -6, reputation: 2 }, baseStones = 18, contribution = 22, item?: string): SectDefinition['mission'] =>
  ({ name, description, baseStones, realmStones: 12, contribution, rankContribution: 5, stats, ...(item ? { item, amount: 1 } : {}) });
const gear = (id: string, name: string, mark: string, description: string, bonus: Partial<SectBenefits>, minRealm = 1, price = 160): SectGear =>
  ({ id, name, mark, description, bonus, minRealm, price });
const specialty = (id: string, name: string, cost: number, description: string, bonus: Partial<SectBenefits>, arts: SectArt[], item: SectGear): SectDefinition['specialty'] =>
  ({ id: `sect-art-${id}`, name, cost, description, bonus, arts, gear: item });

export const SECTS: SectDefinition[] = [
  {
    id: 'qinglan', home: 'qinglan', name: '青岚剑宗', mark: '剑', style: '剑心明澈', minRealm: 1, reputation: 8, entryCost: 30,
    culture: '师承以护山和传功延续。剑法先用来守住身后的路，再谈个人声名。', preferences: ['护送', '守约', '传功', '剑道'],
    description: '以剑护道，以心养锋。每日演阵，师徒共同照看九府山路。', bonus: '修炼 +12% · 战技 +1 / 年', allowance: 6, annual: { stats: { combat: 1 } }, passive: { cultivation: 0.12 },
    mission: mission('巡山护送', '护送物资，照看山道。宗门也由一件件小事维系。'),
    specialty: specialty('qinglan', '青岚剑阵', 100, '年度历练伤害减少20%；可回应剑冢剑意、分担救援冲击。传授时另得青岚阵纹剑。', { adventureDamage: 0.8 }, ['sword'], gear('sect-sword', '青岚阵纹剑', '阵', '装备后历练有效战技 +24。', { adventureCombat: 24 })),
  },
  {
    id: 'covenant', home: 'qinglan', name: '九府同契院', mark: '契', style: '乡约相守', minRealm: 1, reputation: 4, entryCost: 20,
    culture: '乡里药堂与修士共订守望契。先照看具体的人，再议名分高低。', preferences: ['救治', '守望', '乡里', '互助'],
    description: '在乡约中修行，轮值药堂与水渠。收入不丰，却有人彼此照应。', bonus: '静养道心 +2 · 体魄 +1、声望 +0.5 / 年', allowance: 4, annual: { stats: { health: 1, reputation: 0.5 } }, passive: { restMind: 2 },
    mission: mission('乡里义诊', '以所学照看村镇的病人与药圃。', { health: -3, mind: -3, reputation: 3, alchemy: 1 }, 12, 25, 'herb'),
    specialty: specialty('covenant', '乡约救护法', 75, '静养每年额外恢复3道心，营生每年多得3灵石；能以药理参与救援。', { restMind: 3, workIncome: 3 }, ['medicine'], gear('sect-covenant-lantern', '乡约长明灯', '灯', '装备后静养额外恢复5道心，年度历练伤害减少10%。', { restMind: 5, adventureDamage: 0.9 })),
  },
  {
    id: 'cloudledger', home: 'qinglan', name: '白石行会', mark: '商', style: '货路有信', minRealm: 1, reputation: 6, entryCost: 45,
    culture: '师徒以真实账目授业，商利须对得起押在契上的名字。', preferences: ['契约', '营生', '护货', '偿还'],
    description: '沿山道经营灵材与手艺，用盘账、识货和信用支撑修行。', bonus: '营生 +6 灵石 / 年 · 悟性 +0.3 / 年', allowance: 10, annual: { stats: { insight: 0.3 } }, passive: { workIncome: 6 },
    mission: mission('核验货契', '沿商路复核货物与欠契，需要心力，报酬较丰。', { mind: -7, reputation: 2 }, 30, 20),
    specialty: specialty('cloudledger', '白石勘契术', 95, '营生每年多得8灵石；能自己核对药库货路，不必等待盘账同伴。', { workIncome: 8 }, ['ledger'], gear('sect-white-ledger', '白石验契盘', '盘', '装备后营生每年多得7灵石，历练灵石收益提高8%。', { workIncome: 7, adventureIncome: 1.08 })),
  },
  {
    id: 'stillpine', home: 'qinglan', name: '松灯观', mark: '松', style: '静中见微', minRealm: 1, reputation: 3, entryCost: 25,
    culture: '清修不问家世，功课在于分辨细微气机，并为行人保留一盏灯。', preferences: ['清修', '参悟', '克制', '留灯'],
    description: '以观息与抄经安顿身心。少争名位，重视持久而稳定的修行。', bonus: '修炼 +6% · 静养道心 +3 · 道心 +1 / 年', allowance: 4, annual: { stats: { mind: 1 } }, passive: { cultivation: 0.06, restMind: 3 },
    mission: mission('守灯抄经', '守夜校对失散经页，给山行者留灯。', { mind: -4, insight: 2, reputation: 1 }, 12, 24),
    specialty: specialty('stillpine', '松灯观息法', 85, '静养每年额外恢复6道心；能辨认秘境灵息与阵势。', { restMind: 6 }, ['formation'], gear('sect-pine-beads', '松灯念珠', '珠', '装备后突破失败保留至少78%修为。', { failureRetention: 0.78 })),
  },
  {
    id: 'herb', home: 'river', name: '百草谷', mark: '药', style: '草木有灵', minRealm: 1, reputation: 5, entryCost: 30,
    culture: '药方须经过辨药与救治验证。愿意传方，也要求弟子承担病人的托付。', preferences: ['救治', '草药', '传方', '照料'],
    description: '一炉烟火养万物。在药圃与诊案中学习草木药性。', bonus: '灵草 +1 / 年 · 丹术 +1 / 年', allowance: 6, annual: { item: 'herb', amount: 1, stats: { alchemy: 1 } }, passive: {},
    mission: mission('护送药材', '照看水路送药的队伍，把药送到需要的人手中。'),
    specialty: specialty('herb', '百草药理', 80, '炼丹成功率增加8个百分点，回春丹和清心丹恢复量增加4；可辨药施救。另得百草药囊。', { craftChance: 0.08, pillPotency: 4 }, ['medicine'], gear('sect-satchel', '百草药囊', '药', '装备后回春丹、清心丹恢复量 +8，炼丹成功率 +4 个百分点。', { pillPotency: 8, craftChance: 0.04 }, 1, 150)),
  },
  {
    id: 'tideguild', home: 'river', name: '渡潮盟', mark: '渡', style: '潮路共济', minRealm: 1, reputation: 8, entryCost: 40,
    culture: '水驿保存契约副本，遇险先保船上的人。航路与信用都是共同积累的家业。', preferences: ['水路', '契约', '护送', '共同撤离'],
    description: '跟着船户辨潮、盘货、经营水驿，在往来奔波中修行。', bonus: '营生 +4 灵石 · 历练灵石 +8%', allowance: 8, annual: { stats: { reputation: 0.4 } }, passive: { workIncome: 4, adventureIncome: 1.08 },
    mission: mission('押舟过潮', '护送货舟并核验水驿契副，路上仍要承担体力消耗。', { health: -7, reputation: 2 }, 26, 22),
    specialty: specialty('tideguild', '渡潮辨路经', 110, '历练灵石收益提高14%；能独自识路，也能核对药库货契。', { adventureIncome: 1.14 }, ['pathfinder', 'ledger'], gear('sect-tide-compass', '渡潮水罗盘', '舟', '装备后历练伤害减少15%，历练灵石收益提高10%。', { adventureDamage: 0.85, adventureIncome: 1.1 })),
  },
  {
    id: 'tidebreath', home: 'river', name: '听潮宫', mark: '潮', style: '息随潮生', minRealm: 1, reputation: 7, entryCost: 35,
    culture: '弟子轮守潮汐石刻，以呼吸与水势互证，不以一次快慢论道行。', preferences: ['潮息', '温养', '耐心', '观测'],
    description: '临潮吐纳，重视经脉的回旋与恢复，善于等待灵息的间隙。', bonus: '修炼 +8% · 静养体魄 +2 · 根基 +0.6 / 年', allowance: 5, annual: { stats: { foundation: 0.6 } }, passive: { cultivation: 0.08, restHealth: 2 },
    mission: mission('校记潮纹', '在水驿观测涨落，校正用于护堤的灵息刻度。', { mind: -5, foundation: 2, reputation: 1 }, 16, 23),
    specialty: specialty('tidebreath', '回潮护脉诀', 100, '突破失败伤害减少20%；能观察秘境中相交的灵息与阵势。', { failureDamage: 0.8 }, ['formation'], gear('sect-tide-shell', '回潮玉贝', '贝', '装备后静养额外恢复5体魄，突破失败伤害减少10%。', { restHealth: 5, failureDamage: 0.9 })),
  },
  {
    id: 'bellisle', home: 'river', name: '沉钟书院', mark: '钟', style: '潮下求真', minRealm: 2, reputation: 12, entryCost: 50,
    culture: '从古岛残刻与潮下遗迹整理失散学问。推测要留下依据，未知允许仍是未知。', preferences: ['古迹', '校勘', '记录', '阵学'],
    description: '以拓碑、辨纹与炼药保存古岛遗学。藏书不多，却多是亲手求得。', bonus: '炼丹成功率 +3% · 悟性 +0.8 / 年', allowance: 5, annual: { stats: { insight: 0.8 } }, passive: { craftChance: 0.03 },
    mission: mission('潮下拓碑', '进入浅潮遗址取拓本，在浪涌前护住残刻。', { health: -5, mind: -3, insight: 2, reputation: 1 }, 20, 25),
    specialty: specialty('bellisle', '沉钟复纹法', 130, '突破失败保留至少80%修为；能解读秘境阵势。', { failureRetention: 0.8 }, ['formation'], gear('sect-bell-rubbing', '沉钟拓纹环', '环', '装备后突破成功率增加2个百分点，炼丹成功率增加5个百分点。', { breakthrough: 0.02, craftChance: 0.05 }, 2, 190)),
  },
  {
    id: 'star', home: 'north', name: '问星阁', mark: '星', style: '观天知命', minRealm: 2, reputation: 20, entryCost: 30,
    culture: '守夜观测冰原星轨，把周天变化记入可以互相复核的图谱。', preferences: ['观测', '守夜', '周天', '论证'],
    description: '观星知运，参悟天地。每一张星图都来自漫长守夜。', bonus: '悟性 +1 / 年 · 突破 +6%', allowance: 6, annual: { stats: { insight: 1 } }, passive: { breakthrough: 0.06 },
    mission: mission('巡护星台', '运送守夜物资，护送观测者穿过冰原。'),
    specialty: specialty('star', '观象诀', 140, '突破成功率增加4个百分点；可辨识阵势。另得问星法印。', { breakthrough: 0.04 }, ['formation'], gear('sect-seal', '问星法印', '星', '装备后突破成功率 +3.5 个百分点。', { breakthrough: 0.035 }, 2, 200)),
  },
  {
    id: 'northforge', home: 'north', name: '北炉会', mark: '炉', style: '共炉炼骨', minRealm: 1, reputation: 5, entryCost: 35,
    culture: '风雪中的炉火由众人轮守。锻体所得先用来搬运、护路，再试兵锋。', preferences: ['锻体', '守炉', '护路', '同行'],
    description: '借冰雪与炉温磨炼筋骨，弟子既练体，也照管北行者的暖炉。', bonus: '历练伤害 −12% · 体魄 +1、战技 +0.5 / 年', allowance: 5, annual: { stats: { health: 1, combat: 0.5 } }, passive: { adventureDamage: 0.88 },
    mission: mission('负薪护炉', '为偏远守夜点送薪材，用肩背护住火种。', { health: -8, combat: 2, reputation: 2 }, 18, 26),
    specialty: specialty('northforge', '北炉护骨法', 100, '静养额外恢复6体魄；炼体本领能顶住救援中的落石。', { restHealth: 6 }, ['body'], gear('sect-forge-bracer', '北炉铜护腕', '腕', '装备后历练伤害减少22%，有效战技 +10。', { adventureDamage: 0.78, adventureCombat: 10 })),
  },
  {
    id: 'nightward', home: 'north', name: '长夜守阵院', mark: '守', style: '长夜有归', minRealm: 1, reputation: 10, entryCost: 35,
    culture: '在长夜关建立新的守阵传统，与断雪剑庭只有研习遗刻的学问往来。撤离顺序须先顾弱者。', preferences: ['守阵', '撤离', '责任', '协作'],
    description: '维护冰原补给点的护阵，练习分担灵压与护住退路。', bonus: '突破失败伤害 −15% · 根基 +1 / 年', allowance: 5, annual: { stats: { foundation: 1 } }, passive: { failureDamage: 0.85 },
    mission: mission('轮守关阵', '检修护阵并守到换班的人抵达。', { health: -4, mind: -4, foundation: 2, reputation: 2 }, 16, 26),
    specialty: specialty('nightward', '长夜承阵术', 115, '年度历练伤害减少25%；能看懂遗迹阵势。', { adventureDamage: 0.75 }, ['formation'], gear('sect-nightward-shield', '长夜阵盾', '盾', '装备后突破失败伤害减少20%，历练伤害减少15%。', { failureDamage: 0.8, adventureDamage: 0.85 })),
  },
  {
    id: 'frostsword', home: 'north', name: '霜河剑庐', mark: '霜', style: '冰锋有度', minRealm: 1, reputation: 9, entryCost: 40,
    culture: '霜河沿岸剑师合建的新山门，承认旧剑庭已逝。以收剑留余地作为第一堂功课。', preferences: ['剑道', '克制', '护送', '磨砺'],
    description: '以寒息磨剑，以冰河行路锻炼出手时机。', bonus: '修炼 +4% · 历练战技 +8 · 战技 +0.7 / 年', allowance: 5, annual: { stats: { combat: 0.7 } }, passive: { cultivation: 0.04, adventureCombat: 8 },
    mission: mission('冰河护渡', '破开渡口薄冰，护送行人越过暗流。', { health: -7, combat: 2, reputation: 2 }, 22, 22),
    specialty: specialty('frostsword', '霜河截锋式', 120, '历练有效战技 +15；能回应剑冢剑意、分担救援冲击。', { adventureCombat: 15 }, ['sword'], gear('sect-frost-blade', '霜河细雪剑', '霜', '装备后历练有效战技 +20，历练修为提高10%。', { adventureCombat: 20, adventureTraining: 1.1 })),
  },
  {
    id: 'emberescort', home: 'desert', name: '烬原盟', mark: '烬', style: '同行不弃', minRealm: 1, reputation: 5, entryCost: 25,
    culture: '名帖不如共同守过一次夜。护行者分享路线，也对带出营地的人负责。', preferences: ['护行', '退路', '互助', '迁徙'],
    description: '在营地与遗迹之间辨路护行，以共同历险换取可靠的供给。', bonus: '历练灵石 +12% · 体魄 +0.8 / 年', allowance: 6, annual: { stats: { health: 0.8 } }, passive: { adventureIncome: 1.12 },
    mission: mission('荒路护行', '带队绕开风口与残阵，把行人送到下一处营地。', { health: -8, reputation: 3 }, 26, 24),
    specialty: specialty('emberescort', '烬原识路法', 100, '年度历练伤害减少18%，历练灵石提高8%；能独自在相应秘境辨路。', { adventureDamage: 0.82, adventureIncome: 1.08 }, ['pathfinder'], gear('sect-ember-lamp', '烬原风灯', '灯', '装备后历练灵石提高18%，静养额外恢复2体魄。', { adventureIncome: 1.18, restHealth: 2 })),
  },
  {
    id: 'redriver', home: 'desert', name: '赤河同修会', mark: '河', style: '薄资共渡', minRealm: 1, reputation: 2, entryCost: 15,
    culture: '散修在赤河营互授谋生与救护本领。少收门资，多做共同事务，离会亦不抹去旧情。', preferences: ['散修', '互助', '救护', '营生'],
    description: '把微薄手艺与药材汇成日常供给，为清贫求道者留一处落脚地。', bonus: '营生 +3 灵石 · 静养体魄 +2 · 道心 +1 / 年', allowance: 3, annual: { stats: { mind: 1 } }, passive: { workIncome: 3, restHealth: 2 },
    mission: mission('营地轮值', '修缮水井，照看病者，把剩余灵草交给下一班。', { health: -4, reputation: 2, alchemy: 1 }, 10, 28, 'herb'),
    specialty: specialty('redriver', '赤河互养方', 70, '回春丹、清心丹恢复量增加7；能辨药施救。', { pillPotency: 7 }, ['medicine'], gear('sect-redriver-pot', '赤河温药壶', '壶', '装备后回春丹、清心丹恢复量增加10，静养额外恢复2道心。', { pillPotency: 10, restMind: 2 }, 1, 130)),
  },
  {
    id: 'sandbody', home: 'desert', name: '赤砂炼身堂', mark: '砂', style: '以行炼身', minRealm: 1, reputation: 7, entryCost: 35,
    culture: '把烈风、负重与实地行路写入功课。强健身体应让自己和同行者都走得更远。', preferences: ['炼体', '实战', '负重', '护行'],
    description: '以荒原长路淬炼肉身，在真正的历练中增长修为。', bonus: '历练修为 +15% · 体魄 +2 / 年', allowance: 4, annual: { stats: { health: 2 } }, passive: { adventureTraining: 1.15 },
    mission: mission('负重穿砂', '背负营地补给穿过砂谷，把功课做在路上。', { health: -10, combat: 3, reputation: 2 }, 24, 25),
    specialty: specialty('sandbody', '赤砂载身诀', 110, '历练修为提高18%；炼体本领能顶住救援中的落石。', { adventureTraining: 1.18 }, ['body'], gear('sect-sand-girdle', '赤砂承山带', '带', '装备后历练修为提高15%，历练伤害减少12%。', { adventureTraining: 1.15, adventureDamage: 0.88 })),
  },
  {
    id: 'ashveil', home: 'desert', name: '照烬观', mark: '照', style: '异息自持', minRealm: 2, reputation: 0, entryCost: 60,
    culture: '研究古战场异息的现世小派，不冒称蚀日道正统。愿接纳异法，也要求知晓维持身体的代价。', preferences: ['异法', '冒险', '自主', '代价自担'],
    description: '借异息强化肉身，靠持续行旅消化所学；供养和世人的戒惧都要承担。', bonus: '历练修为 +22% · 体魄 +1 / 年 · 额外供养3灵石、声望 −0.15 / 年', allowance: 4, annual: {}, passive: { adventureTraining: 1.22, yearHealth: 1, upkeep: 3, yearReputation: -0.15 },
    mission: mission('异息勘验', '进入残阵辨认异息，把有用的记录带回，也承担旁人的戒心。', { health: -6, mind: -5, combat: 2, reputation: -1 }, 32, 27),
    specialty: specialty('ashveil', '照烬养身法', 135, '历练修为提高25%；为稳住异息此生额外供养2灵石／年。炼体本领能顶住救援落石。', { adventureTraining: 1.25, upkeep: 2 }, ['body'], gear('sect-ash-ward', '照烬温脉佩', '烬', '装备后每年恢复2体魄，历练有效战技 +12。', { yearHealth: 2, adventureCombat: 12 }, 2, 200)),
  },
  {
    id: 'lawhall', home: 'central', name: '明律院', mark: '律', style: '明契辨理', minRealm: 1, reputation: 15, entryCost: 60,
    culture: '在玉京议庭之外传授契约与术理。主张先核实证据，再判断出身与功过。', preferences: ['证据', '契约', '调解', '守约'],
    description: '从纠纷、术契与传承名录中求证修行之理。', bonus: '突破 +2.5% · 声望 +1 / 年', allowance: 12, annual: { stats: { reputation: 1 } }, passive: { breakthrough: 0.025 },
    mission: mission('勘验旧契', '为修士与作坊复核术契，不凭一面之词定案。', { mind: -8, insight: 2, reputation: 3 }, 24, 24),
    specialty: specialty('lawhall', '明律验契法', 140, '营生每年多得5灵石，突破成功率增加2个百分点；能独自勘验药库货契。', { workIncome: 5, breakthrough: 0.02 }, ['ledger'], gear('sect-law-tablet', '明律证契简', '简', '装备后营生每年多得10灵石，突破成功率增加2个百分点。', { workIncome: 10, breakthrough: 0.02 }, 1, 210)),
  },
  {
    id: 'thousandseal', home: 'central', name: '千符坊', mark: '符', style: '符成有据', minRealm: 1, reputation: 12, entryCost: 55,
    culture: '作坊与山门合一，每张护阵符都须在真实灵压中验过。惜材，也重视失败记录。', preferences: ['符阵', '试验', '惜材', '护阵'],
    description: '将符阵拆成可以复核的纹路，反复练习分散冲关灵压。', bonus: '突破失败伤害 −10% · 根基 +0.8 / 年', allowance: 8, annual: { stats: { foundation: 0.8 } }, passive: { failureDamage: 0.9 },
    mission: mission('校符护坊', '检修坊市符阵，并记录每一道失效的原因。', { mind: -6, foundation: 2, reputation: 2 }, 20, 25),
    specialty: specialty('thousandseal', '千符回灵术', 125, '炼丹失败回收2株灵草；符阵学问能辨识秘境阵势。', { failedCraftHerbs: 2 }, ['formation'], gear('sect-seal-brush', '千符回灵笔', '笔', '装备后炼丹成功率增加9个百分点，失败再回收1株灵草。', { craftChance: 0.09, failedCraftHerbs: 1 }, 1, 200)),
  },
  {
    id: 'hundredschools', home: 'central', name: '百家道会', mark: '百', style: '诸法互证', minRealm: 1, reputation: 10, entryCost: 45,
    culture: '不同出身的修士互授一技。可以保留分歧，但须愿意听完别人的证据。', preferences: ['论道', '互证', '散修', '求同存异'],
    description: '以百家所长互相校正，参修不拘一家注疏。', bonus: '修炼 +7% · 悟性 +0.8 / 年', allowance: 6, annual: { stats: { insight: 0.8 } }, passive: { cultivation: 0.07 },
    mission: mission('整理论道录', '把相互矛盾的讲法整理清楚，请各家逐条核对。', { mind: -5, insight: 3, reputation: 2 }, 16, 25),
    specialty: specialty('hundredschools', '百家参同篇', 120, '所有年度重心的基础修炼速度提高7%；能从不同记述辨认阵势。', { training: 1.07 }, ['formation'], gear('sect-schools-scroll', '百家互证卷', '卷', '装备后基础修炼速度提高6%，静养额外恢复3道心。', { training: 1.06, restMind: 3 }, 1, 190)),
  },
  {
    id: 'jadeforge', home: 'central', name: '琢玉山庄', mark: '琢', style: '精炼留真', minRealm: 2, reputation: 18, entryCost: 90,
    culture: '以精制传承闻名，器物与功法都要经得起反复琢磨。门资较高，授艺仍看实际功绩。', preferences: ['精炼', '传承', '品质', '耐心'],
    description: '从精制法器的纹路反观经脉，用稳定的材料和细工打磨修行。', bonus: '凝灵丹额外成功率 +2.5% · 根基 +1 / 年', allowance: 4, annual: { stats: { foundation: 1 } }, passive: { pillChance: 0.025 },
    mission: mission('温玉校纹', '长时间校正法器纹路，把返工的细节记入师承簿。', { mind: -7, foundation: 3, reputation: 2 }, 22, 25, 'jade'),
    specialty: specialty('jadeforge', '琢玉定脉法', 160, '使用凝灵丹突破时额外增加6个百分点成功率；能依器纹辨识秘境阵势。', { pillChance: 0.06 }, ['formation'], gear('sect-jade-crown', '琢玉定脉冠', '冠', '装备后突破成功率增加4个百分点，突破失败伤害减少12%。', { breakthrough: 0.04, failureDamage: 0.88 }, 2, 240)),
  },
];

export function sectPassive(g: Game): SectDefinition['passive'] { return SECTS.find(s => s.id === g.sect)?.passive ?? {}; }
export function sectAnnualEffect(g: Game): Effect {
  const sect = SECTS.find(s => s.id === g.sect);
  if (!sect) return {};
  const standing = regionalStanding(g, sect.home);
  if (standing.label === '闭山') return {};
  return { ...sect.annual, stones: Math.round((sect.allowance + g.realm * 5 + g.sectRank * 8 + (sect.annual.stones ?? 0)) * standing.income), contribution: 1 };
}
export function sectMissionEffect(g: Game): Effect {
  const sect = SECTS.find(s => s.id === g.sect), task = sect?.mission;
  return task && sect ? { stones: Math.round((task.baseStones + task.realmStones * g.realm) * regionalStanding(g, sect.home).income), contribution: task.contribution + task.rankContribution * g.sectRank, stats: { ...task.stats }, ...(task.item ? { item: task.item, amount: task.amount ?? 1 } : {}) } : {};
}
export function sectStudyEffect(g: Game): Effect { return { progress: 16 + g.realm * 6, stats: { foundation: 5, insight: 3 } }; }
export function sectEntryReason(g: Game, id: string): string | undefined {
  const sect = SECTS.find(s => s.id === id);
  if (!sect) return '没有这个宗门';
  if (g.sect) return '已在宗门中，需先离宗';
  if (regionalStanding(g, sect.home).label === '闭山') return '山门闭守，暂不收徒';
  if (g.region !== sect.home) return '尚未抵达当地山门';
  if (g.realm < sect.minRealm) return '境界尚未达到入门要求';
  if (g.stats.reputation < sect.reputation) return `入门需要${sect.reputation}声望`;
  if (g.stones < sect.entryCost) return `入门需备${sect.entryCost}灵石`;
}
export function hasSectArt(g: Game, art: SectArt): boolean {
  return SECTS.some(sect => sect.specialty.arts.includes(art) && g.flags.includes(sect.specialty.id));
}
