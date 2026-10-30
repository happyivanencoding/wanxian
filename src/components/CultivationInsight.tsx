import type { Game } from '../game/types.ts';
import { breakthroughChance, breakthroughFactors, currentEra, currentRegion, trainingFactors, trainingRate, worldPhase } from '../game/engine.ts';
import { REALMS } from '../game/data.ts';
import './CultivationInsight.css';

const decimal = (n: number) => n.toFixed(2).replace(/\.?0+$/, '');
const points = (n: number) => `${n >= 0 ? '+' : '−'}${decimal(Math.abs(n) * 100)} 个百分点`;

export function TrainingInsight({ game: g }: { game: Game }) {
  const f = trainingFactors(g);
  if (!g.alive) return null;
  const rows = [
    ['资质对应基础值', `${decimal(f.base)} 修为`],
    [`境界 · ${REALMS[g.realm].name}`, `×${decimal(f.realm)}`],
    [`地域 · ${currentRegion(g).name}`, `×${decimal(f.region)}`],
    [`时代 · ${currentEra(g).name}`, `×${decimal(f.era)}`],
    [`时运 · ${worldPhase(g).name}`, `×${decimal(f.phase)}`],
    ['洞府、道路与宗门', `×${decimal(f.preparation)}`],
    [`道心 · ${Math.round(g.stats.mind)}`, `×${decimal(f.mind)}`],
    [`体魄 · ${Math.round(g.stats.health)}`, `×${decimal(f.health)}`],
    ['重大抉择留下的道路', `×${decimal(f.fate)}`],
    ['此生练成的本领', `×${decimal(f.attainments)}`],
    ['长期承诺占用的光阴', `×${decimal(f.life)}`],
    ['当前修行际遇', `×${decimal(f.fortune)}`],
  ];
  return <details className="cultivation-insight" data-testid="training-insight">
    <summary>修炼明细</summary>
    <dl>{rows.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
    <div className="insight-total"><span>当前闭关基准</span><strong>{trainingRate(g)} / 年</strong></div>
    <p>以上因子相乘，最终保留一位小数。其他重心按比例获得修为；圆满后不继续累积。</p>
  </details>;
}

export function BreakthroughInsight({ game: g, usePill }: { game: Game; usePill: boolean }) {
  const factors = breakthroughFactors(g, usePill);
  return <details className="cultivation-insight breakthrough-insight" data-testid="breakthrough-insight">
    <summary>突破明细</summary>
    <dl>{factors.map(f => <div key={f.label}><dt>{f.label}</dt><dd className={f.value < 0 ? 'insight-negative' : ''}>{points(f.value)}</dd></div>)}</dl>
    <div className="insight-total"><span>本次实际成功率</span><strong data-testid="explained-breakthrough-chance">{Math.round(breakthroughChance(g, usePill) * 100)}%</strong></div>
    <p>各项相加，按现有规则限制在单次 7%—90%。这不是一生的飞升率，也不参考其他人物的结局。</p>
  </details>;
}
