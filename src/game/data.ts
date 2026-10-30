import type { Effect, Focus, Stat } from './types.ts';
import { SECTS } from './sects.ts';
export { SECTS } from './sects.ts';

export const REALMS = [
  { name: '凡人', short: '凡', life: 85, need: 48, cost: 12, description: '听见山外的风，尚不知长生为何物。' },
  { name: '炼气', short: '气', life: 120, need: 140, cost: 80, description: '引天地灵气入体，始见修行门径。' },
  { name: '筑基', short: '基', life: 260, need: 340, cost: 260, description: '道基初成，方知山外有山。' },
  { name: '金丹', short: '丹', life: 560, need: 680, cost: 700, description: '一粒金丹凝就，从此世事如烟。' },
  { name: '元婴', short: '婴', life: 1120, need: 1160, cost: 1600, description: '神游万里，旧时故人渐成往事。' },
  { name: '化神', short: '神', life: 2240, need: 2000, cost: 3600, description: '借一缕天地之息，问大道可有尽头。' },
  { name: '飞升', short: '仙', life: 9999, need: 1, cost: 0, description: '山河仍在，已是人间旧客。' },
];
export const ORIGINS = [
  { id: 'village', name: '山野寒门', tag: '白手起家', mark: '山', weight: 38, stones: 12, insight: 6, foundation: 4, aptitude: 0, description: '偏远山村的一户农家。没有传承，只有山路尽头若隐若现的仙门。' },
  { id: 'merchant', name: '行商之家', tag: '家资丰厚', mark: '商', weight: 22, stones: 130, insight: 3, foundation: 0, aptitude: 0, description: '随商队走过千山万水。识人辨物，也懂得机缘有时可以争取。' },
  { id: 'sect', name: '仙门遗孤', tag: '耳濡目染', mark: '门', weight: 15, stones: 42, insight: 10, foundation: 12, aptitude: 6, description: '在山门钟声中长大。尚未入门，却早已熟悉弟子们的晨课。' },
  { id: 'clan', name: '修真世家', tag: '传承有序', mark: '世', weight: 10, stones: 85, insight: 5, foundation: 10, aptitude: 12, description: '族谱里写着先人的名字。家族给予起点，也寄来沉甸甸的期待。' },
  { id: 'wanderer', name: '江湖漂泊', tag: '筋骨坚韧', mark: '游', weight: 15, stones: 25, insight: 3, foundation: 16, aptitude: -3, description: '四海为家，风餐露宿。身上没有护身符，只有一次次活下来的经验。' },
];
export const ERAS = [
  { id: 'peace', name: '承平岁月', mark: '宁', spirit: 1, risk: 1, price: 1, description: '宗门相安，商路畅通。平缓而清晰的一条求道之路。' },
  { id: 'renewal', name: '灵潮初生', mark: '潮', spirit: 1.2, risk: 1.15, price: 1.1, description: '灵气回涌，遗迹重现。修行更快，历练也更危险。' },
  { id: 'chaos', name: '乱世问道', mark: '争', spirit: 1.08, risk: 1.6, price: 1.25, description: '宗门纷争，资源昂贵。险途的回报更高，保全自身却更难。' },
];
export const ROUTES = [
  { id: 'balanced', name: '问道', icon: 'mountain', description: '兼修根基与悟性，修炼增益 +10%。' },
  { id: 'sword', name: '剑修', icon: 'sword', description: '以剑入道，历练所得 +25%，斗法更强。' },
  { id: 'alchemy', name: '丹修', icon: 'flask', description: '以草木养道，炼丹经验与经营收益更高。' },
  { id: 'body', name: '体修', icon: 'shield', description: '以身为炉，无灵根也可修行，受伤减轻。' },
];
export const FOCUSES: { id: Focus; name: string; icon: string; subtitle: string; description: string }[] = [
  { id: 'cultivate', name: '闭关修行', icon: 'mountain', subtitle: '修为 ↑↑ · 道心略耗', description: '专注吐纳，获得最多修为。长期闭关需要出关养心。' },
  { id: 'adventure', name: '出门历练', icon: 'compass', subtitle: '机缘 ↑ · 有受伤风险', description: '探索所在地域，收获灵石与材料。地域、时代、战力影响风险。' },
  { id: 'study', name: '参悟典籍', icon: 'book', subtitle: '悟性 ↑ · 根基 ↑', description: '打磨根基，提高突破成功率，获得少量修为。' },
  { id: 'work', name: '经营营生', icon: 'coins', subtitle: '灵石 ↑↑ · 修行较慢', description: '为坊市提供手艺与劳务，积蓄下一次突破所需灵石。' },
  { id: 'alchemy', name: '采药炼丹', icon: 'flask', subtitle: '丹术 ↑ · 灵草 ↑', description: '辨药练手，获得灵草与丹术经验；炼制成品请前往丹房。' },
  { id: 'rest', name: '静养身心', icon: 'leaf', subtitle: '体魄 ↑↑ · 道心 ↑', description: '恢复伤势与心境。不增加寿元，依然会度过这一年。' },
  { id: 'social', name: '访友论道', icon: 'people', subtitle: '情谊 ↑ · 道心 ↑', description: '拜访同代道友，修复关系，交换修行见闻。' },
];
export const REGIONS = [
  { id: 'qinglan', name: '青岚山', subtitle: '人间烟火，仙门初见', symbol: '岚', spirit: 1, risk: 0.08, minRealm: 0, cost: 12, x: 30, y: 56, description: '薄雾掩着山门，溪畔散落村舍。这里的灵气温和，是求道的起点。' },
  { id: 'river', name: '云泽水乡', subtitle: '药草丰饶，商旅不绝', symbol: '泽', spirit: 1.08, risk: 0.09, minRealm: 0, cost: 25, x: 61, y: 70, description: '千里水网间遍生灵草。药园额外产出，采药更有所得。' },
  { id: 'north', name: '北溟雪域', subtitle: '极寒磨骨，冰魄藏锋', symbol: '溟', spirit: 1.32, risk: 0.19, minRealm: 1, cost: 70, x: 47, y: 23, description: '风雪淬炼肉身，也藏着古老遗迹。体修在此历练更从容。' },
  { id: 'desert', name: '赤霞荒原', subtitle: '古迹长眠，险中求缘', symbol: '霞', spirit: 1.45, risk: 0.27, minRealm: 2, cost: 140, x: 17, y: 31, description: '赤砂之下埋着上古洞府。历练灵石更多，失手的代价也更大。' },
  { id: 'central', name: '玉京仙城', subtitle: '万宗汇聚，大道交锋', symbol: '京', spirit: 1.65, risk: 0.12, minRealm: 3, cost: 320, x: 80, y: 39, description: '玉楼接天，千宗来会。高阶修士在此追寻最后一线天机。' },
];
export const SECT_RANKS = ['外门弟子', '内门弟子', '真传弟子', '传功长老'];
export const HOMES = [
  { id: 'mat', name: '静心蒲团', icon: 'leaf', cost: 45, max: 3, description: '每级让静养多恢复 2 点道心，年度修炼多得 3%。' },
  { id: 'array', name: '聚灵阵', icon: 'spark', cost: 90, max: 3, description: '每级增加 12% 年度修炼收益。' },
  { id: 'furnace', name: '青铜丹炉', icon: 'flask', cost: 75, max: 3, description: '解锁丹药炼制，每级提高 8% 成丹率。' },
  { id: 'library', name: '藏经书架', icon: 'book', cost: 65, max: 3, description: '每级增加 0.4 点年度悟性；参悟时收益翻倍。' },
  { id: 'garden', name: '灵草药圃', icon: 'leaf', cost: 85, max: 3, description: '每级每年产 1 株灵草，云泽再额外产 1 株。' },
];
export interface Item { id: string; name: string; mark: string; kind: 'material' | 'pill' | 'gear' | 'book' | 'relic'; price: number; minRealm: number; description: string; effect?: Effect; market?: boolean; source?: string }
export const gearTier = (item: Item | undefined) => !item || item.kind !== 'gear' ? 0 : item.source ? Math.min(5, 2 + item.minRealm) : item.id === 'talisman' ? 2 : 1;
export const ITEMS: Item[] = [
  { id: 'relic-jade', name: '裂纹玉片', mark: '珏', kind: 'relic', price: 0, minRealm: 0, market: false, description: '泉下拾得。夜里微温，断口有细密刻痕。' },
  { id: 'relic-bell', name: '听潮铃', mark: '铃', kind: 'relic', price: 0, minRealm: 0, market: false, description: '船上的旧铃。铜舌不动，海风吹过时偶有微声。' },
  { id: 'relic-stardust', name: '照夜星砂', mark: '砂', kind: 'relic', price: 0, minRealm: 0, market: false, description: '剑冢里带出的细砂，暗处泛起星光。' },
  { id: 'relic-scabbard', name: '残鞘', mark: '鞘', kind: 'relic', price: 0, minRealm: 0, market: false, description: '鞘口留着一道剑痕，里面早已没有剑。' },
  { id: 'relic-seal', name: '无字铜牌', mark: '牌', kind: 'relic', price: 0, minRealm: 0, market: false, description: '只有浅浅旧印，难以辨认。' },
  { id: 'herb', name: '青灵草', mark: '草', kind: 'material', price: 8, minRealm: 0, description: '炼丹常用材料。采药、历练与药圃均可产出。' },
  { id: 'jade', name: '温润灵玉', mark: '玉', kind: 'material', price: 24, minRealm: 0, description: '凝灵丹的辅材，可在历练中偶得。' },
  { id: 'heal', name: '回春丹', mark: '春', kind: 'pill', price: 28, minRealm: 0, description: '服用恢复 24 点体魄。', effect: { stats: { health: 24 } } },
  { id: 'calm', name: '清心丹', mark: '心', kind: 'pill', price: 26, minRealm: 0, description: '服用恢复 22 点道心。', effect: { stats: { mind: 22 } } },
  { id: 'foundation', name: '培元丹', mark: '元', kind: 'pill', price: 55, minRealm: 1, description: '服用增加 9 点根基与 6 点修为。', effect: { stats: { foundation: 9 }, progress: 6 } },
  { id: 'breakpill', name: '凝灵丹', mark: '灵', kind: 'pill', price: 95, minRealm: 1, description: '突破时使用，成功率增加 13 个百分点；无论成败都会消耗。' },
  { id: 'longevity', name: '延寿丹', mark: '寿', kind: 'pill', price: 320, minRealm: 2, description: '增加寿元上限 30 年。一生最多服用三枚。', effect: { lifespan: 30 } },
  { id: 'sword', name: '秋水剑', mark: '剑', kind: 'gear', price: 95, minRealm: 1, description: '装备后历练有效战技 +15；不永久改变基础战技。' },
  { id: 'talisman', name: '玄龟护符', mark: '符', kind: 'gear', price: 120, minRealm: 1, description: '装备后历练受伤概率降低 40%。与兵器共用一个法宝位。' },
  ...SECTS.map(sect => ({ ...sect.specialty.gear, kind: 'gear' as const, market: false, source: `学会${sect.specialty.name}时授予，每世一件`, description: `${sect.specialty.gear.description} 仅一个法宝位；出售后不会补发。` })),
  { id: 'manual', name: '太素养气篇', mark: '经', kind: 'book', price: 70, minRealm: 0, description: '研读增加悟性 12、根基 8。此书一生只可领悟一次。', effect: { stats: { insight: 12, foundation: 8 }, flag: 'read-manual' } },
  { id: 'swordbook', name: '问剑十三式', mark: '诀', kind: 'book', price: 110, minRealm: 1, description: '研读增加战技 18。一生只可领悟一次。', effect: { stats: { combat: 18 }, flag: 'read-swordbook' } },
];
export const RECIPES = [
  { id: 'heal', name: '回春丹', level: 0, materials: { herb: 3 } as Record<string, number>, fee: 3 },
  { id: 'calm', name: '清心丹', level: 10, materials: { herb: 3 } as Record<string, number>, fee: 4 },
  { id: 'foundation', name: '培元丹', level: 25, materials: { herb: 5, jade: 1 } as Record<string, number>, fee: 8 },
  { id: 'breakpill', name: '凝灵丹', level: 45, materials: { herb: 7, jade: 2 } as Record<string, number>, fee: 15 },
];
export const STAT_NAMES: Record<Stat, string> = { health: '体魄', mind: '道心', insight: '悟性', foundation: '根基', reputation: '声望', alchemy: '丹术', combat: '战技' };
export const WORLD_PHASES = [
  { name: '山河清晏', description: '商路通畅，修士各安其业。经营收益增加 15%。', spirit: 1, income: 1.15, risk: 1 },
  { name: '灵潮涌动', description: '群山灵气复苏，修炼收益增加 20%。', spirit: 1.2, income: 1, risk: 1 },
  { name: '宗门纷争', description: '山外纷争再起，历练风险增加 35%。', spirit: 1, income: 1, risk: 1.35 },
  { name: '百草丰年', description: '草木生发，药圃与采药额外产出。', spirit: 1.05, income: 1, risk: 1 },
];
export const ACHIEVEMENTS = [
  { id: 'first', name: '叩问仙门', description: '第一次踏入炼气境。', mark: '启' },
  { id: 'foundation', name: '道基初成', description: '达到筑基境。', mark: '基' },
  { id: 'gold', name: '金丹有成', description: '结成金丹。', mark: '丹' },
  { id: 'soul', name: '神游万里', description: '达到元婴境。', mark: '神' },
  { id: 'ascend', name: '白日飞升', description: '成功渡过最后一劫。', mark: '仙' },
  { id: 'friend', name: '山海知己', description: '与同道缔结道侣关系。', mark: '缘' },
  { id: 'wealth', name: '灵石满囊', description: '累计获得 3,000 灵石。', mark: '丰' },
  { id: 'traveller', name: '踏遍山河', description: '到访全部五个地域。', mark: '游' },
  { id: 'master', name: '薪火相传', description: '成为宗门传功长老。', mark: '传' },
  { id: 'life', name: '浮生一卷', description: '完成第一段人生。', mark: '生' },
];
export const SURNAMES = ['林', '沈', '顾', '陆', '苏', '叶', '温', '谢', '江', '许', '云', '白'];
export const GIVEN_NAMES = ['知微', '照尘', '听澜', '归舟', '青衍', '见山', '长宁', '寻溪', '望舒', '砚秋', '怀瑾', '行远', '清和', '映雪', '若水', '疏桐'];
