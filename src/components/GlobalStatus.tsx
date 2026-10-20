import { useState } from 'react';
import type { Game, Stat } from '../game/types.ts';
import { REALMS, SECTS, SECT_RANKS, STAT_NAMES } from '../game/data.ts';
import { realmName } from '../game/engine.ts';
import { numberText } from './Common.tsx';
import { PixelPortrait, PixelSprite } from './PixelArt.tsx';
import './GlobalStatus.css';

const DETAIL_STATS: Stat[] = ['foundation', 'insight', 'reputation', 'alchemy', 'combat'];
const percent = (value: number, max: number) => `${Math.max(0, Math.min(100, value / max * 100))}%`;

export default function GlobalStatus({ game }: { game: Game }) {
  const [expanded, setExpanded] = useState(false);
  const sect = SECTS.find(item => item.id === game.sect);
  const remainingLife = Math.max(0, game.lifespan - game.age);
  const meters = [
    { id: 'progress', label: '修为', value: numberText(game.progress), total: numberText(REALMS[game.realm].need), width: percent(game.progress, REALMS[game.realm].need) },
    { id: 'health', label: '体魄', value: Math.round(game.stats.health), total: '100', width: percent(game.stats.health, 100) },
    { id: 'mind', label: '道心', value: Math.round(game.stats.mind), total: '100', width: percent(game.stats.mind, 100) },
    { id: 'lifespan', label: '余寿', value: remainingLife, total: `${game.lifespan}年`, width: percent(remainingLife, game.lifespan) },
  ];
  return <section className={`global-status ${expanded ? 'status-expanded' : ''}`} aria-label="常驻人物与资源状态" data-testid="global-status">
    <div className="status-person">
      <PixelPortrait name={game.name} gender={game.gender} departed={!game.alive} className="status-portrait"/>
      <div className="status-identity"><div className="status-name">
        <strong title={game.name}>{game.name}</strong><span>{realmName(game)}</span>
      </div>
      <small className="status-affiliation" title={sect ? `${sect.name} · ${SECT_RANKS[game.sectRank]}` : '无门无派 · 自在散修'}>{sect ? `${sect.name} · ${SECT_RANKS[game.sectRank]}` : '无门无派 · 自在散修'}</small><small className="status-age">{game.age}岁 · {game.yearName}{2300 + game.age}年</small></div>
    </div>
    <div className="status-calendar">
      <span className="status-kicker">现世纪年</span>
      <strong>{game.yearName} · {2300 + game.age}年</strong>
      <small>{game.age}岁 / 寿元 {game.lifespan}岁</small>
    </div>
    <div className="status-resources">
      <div className="status-resource">
        <span><PixelSprite name="stones" size={16}/>灵石</span>
        <strong data-testid="status-stones">{numberText(game.stones)}</strong>
      </div>
      <div className="status-resource"><span><PixelSprite name="herb" size={16}/>灵草</span><strong>{numberText(game.inventory.herb || 0)}</strong></div>
      <div className={`status-resource ${game.actionsLeft === 0 ? 'exhausted' : ''}`}>
        <span>行动</span>
        <strong data-testid="status-actions">{game.actionsLeft}<small> / 3</small></strong>
      </div>
    </div>
    <div className="status-meters" aria-label="修为、身心与寿元">{meters.map(meter => <div key={meter.id} className={`status-meter status-meter-${meter.id} ${meter.id === 'health' && game.stats.health < 35 ? 'critical' : ''}`} data-testid={meter.id === 'health' || meter.id === 'mind' ? `status-stat-${meter.id}` : undefined}>
      <span>{meter.label}</span><div className="status-meter-track"><i style={{ width: meter.width }}/></div><div className="status-meter-value"><strong>{meter.value}</strong><small>/{meter.total}</small></div>
    </div>)}</div>
    <button className={`status-expand ${game.stats.health < 35 && game.alive ? 'status-critical' : ''}`} data-testid="status-expand" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? '收起属性 ▴' : '体魄 · 道心常显，展开全部属性 ▾'}</button>
    <div className="status-attributes" aria-label="人物属性">
      {DETAIL_STATS.map(stat => <div
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
