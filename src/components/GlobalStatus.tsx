import { useState } from 'react';
import type { Game, Stat } from '../game/types.ts';
import { REALMS, STAT_NAMES } from '../game/data.ts';
import { realmName } from '../game/engine.ts';
import { numberText } from './Common.tsx';
import './GlobalStatus.css';

const VISIBLE_STATS: Stat[] = ['health', 'mind', 'foundation', 'insight', 'reputation', 'alchemy', 'combat'];

export default function GlobalStatus({ game }: { game: Game }) {
  const [expanded, setExpanded] = useState(false);
  return <section className={`global-status ${expanded ? 'status-expanded' : ''}`} aria-label="常驻人物与资源状态" data-testid="global-status">
    <div className="status-person">
      <div className="status-name">
        <strong title={game.name}>{game.name}</strong>
        <span>{realmName(game)}</span>
      </div>
      <small className="status-desktop-progress">修为 {numberText(game.progress)} / {numberText(REALMS[game.realm].need)}</small><small className="status-mobile-age">{game.age}岁 · 寿元尚余 {Math.max(0, game.lifespan - game.age)}年</small>
    </div>
    <div className="status-calendar">
      <span className="status-kicker">现世纪年</span>
      <strong>{game.yearName} · {2300 + game.age}年</strong>
      <small>{game.age}岁 / 寿元 {game.lifespan}岁</small>
    </div>
    <div className="status-resources">
      <div className="status-resource">
        <span>灵石</span>
        <strong data-testid="status-stones">{numberText(game.stones)}</strong>
      </div>
      <div className={`status-resource ${game.actionsLeft === 0 ? 'exhausted' : ''}`}>
        <span>今年行动</span>
        <strong data-testid="status-actions">{game.actionsLeft}<small> / 3</small></strong>
      </div>
    </div>
    <button className={`status-expand ${game.stats.health < 35 && game.alive ? 'status-critical' : ''}`} data-testid="status-expand" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? '收起属性' : `体魄 ${Math.round(game.stats.health)} · 道心 ${Math.round(game.stats.mind)} · 全部属性`}</button>
    <div className="status-attributes" aria-label="人物属性">
      {VISIBLE_STATS.map(stat => <div
        className={`status-attribute ${stat === 'health' && game.stats.health < 35 ? 'critical' : ''}`}
        key={stat}
        title={`${STAT_NAMES[stat]}：${Math.round(game.stats[stat])}`}
        data-testid={`status-stat-${stat}`}
      >
        <span>{STAT_NAMES[stat]}</span>
        <strong>{Math.round(game.stats[stat])}</strong>
        <i aria-hidden="true"><b style={{ width: `${Math.max(0, Math.min(100, game.stats[stat]))}%` }}/></i>
      </div>)}
    </div>
  </section>;
}
