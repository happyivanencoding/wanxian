import type { Game } from '../game/types.ts';
import { FACTIONS, FAMILIES, factionName, historyView, worldYear } from '../game/history.ts';
import { REGIONS } from '../game/data.ts';
import { Icon } from './Art.tsx';

export function WorldPulse({ game, onOpen }: { game: Game; onOpen: () => void }) {
  const history = historyView(game), last = history.resolved.at(-1);
  return <button className="world-pulse panel" onClick={onOpen} data-testid="world-pulse">
    <span className="world-pulse-date">天下 · {worldYear(game)}年 <Icon name="chevron" size={15}/></span>
    <strong>{history.current?.title ?? last?.title ?? '五洲初见'}</strong>
    <span>{history.current?.opening ?? (last ? `${last.winner}取得先机，诸门仍在余波中寻找自己的路。` : '山门开课，渡口行船。街巷之外，各人有各人的去处。')}</span>
  </button>;
}

export default function WorldHistory({ game }: { game: Game }) {
  const history = historyView(game);
  return <section className="world-history" data-testid="world-history">
    <h3>天下 · {history.year}年</h3>
    {history.current && <article className="history-current"><h4>{history.current.title}</h4><p>{history.current.opening}</p></article>}
    <div className="world-factions">{history.factions.map(faction => <div key={faction.id} data-testid={`faction-${faction.id}`}>
      <span>{faction.name}</span><strong>{faction.label}</strong>
      <meter min={10} max={95} value={faction.strength} aria-label={`${faction.name}势力`}/>
    </div>)}</div>
    <details><summary>五洲与世家</summary>{FACTIONS.map(faction => <article key={faction.id} className="world-family">
      <h4>{REGIONS.find(region => region.id === faction.region)!.name}</h4><p>{faction.aim}</p>
      <dl>{FAMILIES[faction.region].map(family => <div key={family.name}><dt>{family.name}{game.family === family.name ? ' · 本家' : ''}</dt><dd>{family.story}</dd></div>)}</dl>
    </article>)}</details>
    {history.resolved.length > 0 && <details><summary>已发生的变局 · {history.resolved.length}</summary><ol className="history-records">{[...history.resolved].reverse().map(record => <li key={record.id}>
      <time>{record.year}</time><div><h4>{record.title}</h4><p>{record.winner}占据先机。</p>
      {record.involvement && <small>{record.involvement === 'watch' ? '你没有介入' : record.involvement === 'self' ? '你取走了自己的所得' : record.involvement === 'open' ? '你公开了线索' : `你曾支持${factionName(record.involvement)}`}</small>}</div>
    </li>)}</ol></details>}
  </section>;
}
