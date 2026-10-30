import type { Effect, Game, LogKind } from './types.ts';

interface CultivationHooks {
  random: (cursor: { rng: number }) => number;
  gain: (g: Game, effect: Effect) => void;
  log: (g: Game, title: string, text: string, kind: LogKind, important?: boolean) => void;
}

export function cultivationFlow(g: Game) {
  return g.fortune && g.age < g.fortune.until ? g.fortune.flow : 1;
}

export function cultivationInsight(g: Game) {
  if (!g.fortune) return 0;
  return g.fortune.insight - (g.age < g.fortune.impasseUntil ? 0.12 : 0);
}

export function advanceCultivation(g: Game, hooks: CultivationHooks) {
  if (g.age < 16) return;
  const draw = () => hooks.random(g);
  g.fortune ??= { flow: 1, until: g.age, nextAt: g.age + 9 + Math.floor(draw() * 17), insight: 0, impasseUntil: 0 };
  const fortune = g.fortune;
  if (g.age < fortune.nextAt) return;
  fortune.nextAt = g.age + 18 + Math.floor(draw() * 35);
  const roll = draw();
  const discovery = (g.focus === 'study' || g.focus === 'adventure' ? 0.12 : 0) + g.stats.insight / 1000;
  if (roll < 0.15 + discovery) {
    fortune.flow = 1.4 + draw() * 1.1;
    fortune.until = g.age + 5 + Math.floor(draw() * 11);
    fortune.insight = Math.min(0.24, fortune.insight + 0.08);
    fortune.impasseUntil = 0;
    hooks.gain(g, { progress: 12 + g.realm * 10, stats: { insight: 3 } });
    const scene = g.focus === 'adventure' ? '行经石壁时，一道旧剑痕解开了你困惑多年的行气之处。' : g.focus === 'study' ? '旧书里一段不起眼的批注，终于与你自己的经历相合。' : '一次入定中，原本断续的气息忽然贯通。';
    hooks.log(g, '一朝有所悟', `${scene}此后一段岁月修炼更顺，也为下一次冲关留下了真正的积累。`, 'cultivation', true);
  } else if (roll > 0.84 && g.realm > 0) {
    fortune.flow = 0.45 + draw() * 0.2;
    fortune.until = g.age + 7 + Math.floor(draw() * (9 + g.realm * 3));
    fortune.impasseUntil = fortune.until;
    hooks.log(g, '旧法到了尽头', '熟悉的周天不再顺畅。这一段修炼变慢、冲关更难；积累根基、准备丹药仍然有效，也可能在新的见闻中找到突破口。', 'cultivation', true);
  } else if (fortune.flow < 1 && fortune.until <= g.age) {
    fortune.flow = 1;
    hooks.log(g, '重新接上气息', '经年的积累终于使气息稳定。修炼回到正常速度，旧瓶颈不再额外压低冲关机会。', 'cultivation');
  }
}

export function cultivationState(g: Game) {
  if (!g.fortune) return '稳步修行';
  if (g.age < g.fortune.impasseUntil) return '遇到瓶颈';
  if (g.age < g.fortune.until && g.fortune.flow > 1) return '有所顿悟';
  return '稳步修行';
}
