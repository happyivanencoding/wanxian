import { useState } from 'react';
import { preparationView } from '../game/progression.ts';
import type { Action, Game } from '../game/types.ts';
import { FOCUSES } from '../game/data.ts';
import { Icon } from './Art.tsx';
import { Modal } from './Common.tsx';

export default function PreparationPanel({ game, act, pauseTime }: { game: Game; act: (action: Action) => void; pauseTime: () => void }) {
  const [choosing, setChoosing] = useState(false);
  const view = preparationView(game);
  const selected = view.methods.find(method => method.id === view.selected);
  if (game.realm >= 6 || !game.alive) return null;
  return <section className="panel preparation-panel" data-testid="preparation-panel">
    <div className="compact-panel-title"><div><span className="eyebrow">为下一境做准备</span><h2>{view.title}</h2></div><button className="button preparation-manage" data-testid="preparation-methods" aria-label={selected ? '调整准备方法' : '选择准备方法'} onClick={() => { pauseTime(); setChoosing(true); }}>{selected ? '调整' : '选方法'}<Icon name="chevron" size={16}/></button></div>

    {selected ? <div className="preparation-current" data-testid="preparation-current">
      <div><strong>{selected.name}</strong><span>{Number(selected.progress.toFixed(1))} / {selected.target}</span></div>
      <progress max={selected.target} value={selected.progress} aria-label={`${selected.name}准备进度`}/>
      <p>{selected.progress >= selected.target ? '准备已成，成功破境后留下这一门修行本领。' : selected.working ? `正随${selected.focus.map(id => FOCUSES.find(focus => focus.id === id)?.name).join('、')}积累。` : selected.pauseReason || '选择相应重心，准备便会随岁月积累。'}</p>
      <small>本次突破准备贡献 +{(view.chanceBonus * 100).toFixed(1)} 个百分点</small>
      {!selected.focus.includes(game.focus) && selected.progress < selected.target && <button className="button full preparation-focus" onClick={() => act({ type: 'focus', focus: selected.focus[0] })} disabled={Boolean(game.pending || game.expeditions?.active)} data-testid="preparation-focus">转为{FOCUSES.find(focus => focus.id === selected.focus[0])?.name} <Icon name="arrow" size={17}/></button>}
    </div> : <p className="preparation-empty">尚未选择准备方法</p>}
    {choosing && <Modal title="选择准备方法" onClose={() => setChoosing(false)}><div className="preparation-options">
      {view.methods.map(method => <article key={method.id} className={`preparation-option ${view.selected === method.id ? 'selected' : ''}`}>
        <header><h3>{method.name}</h3><span>{Number(method.progress.toFixed(1))} / {method.target}</span></header>
        <p className="method-cost"><strong>对应重心 · {method.focus.map(id => FOCUSES.find(focus => focus.id === id)?.name).join('、')}</strong>{method.cost}</p><p className="method-benefit"><strong>可练成的本领</strong>{method.benefit}</p>
        <button className="button full" disabled={!method.available || view.selected === method.id} onClick={() => { act({ type: 'prepare', method: method.id }); setChoosing(false); }} data-testid={`prepare-${method.id}`}>{view.selected === method.id ? '正在准备' : '选定此法'}</button>
        {!method.available && method.reason && <small>{method.reason}</small>}
      </article>)}
    </div>{selected && <button className="text-button preparation-cancel" disabled={Boolean(game.pending || game.expeditions?.active)} onClick={() => { act({ type: 'prepare', method: null }); setChoosing(false); }} data-testid="prepare-cancel">暂缓准备，已积累的进度保留</button>}</Modal>}
  </section>;
}

export function Attainments({ game }: { game: Game }) {
  const items = preparationView(game).attainments;
  if (!items.length) return null;
  return <section className="panel attainments-panel" data-testid="attainments"><div className="compact-panel-title"><h2>这一世练成的本领</h2><Icon name="book" size={21}/></div><div className="attainments-list">{items.map(item => <article key={item.id}><h3>{item.name}</h3><p>{item.description}</p></article>)}</div></section>;
}

export function BreakthroughPreparation({ game }: { game: Game }) {
  const view = preparationView(game), selected = view.methods.find(method => method.id === view.selected);
  return <div className="breakthrough-preparation" data-testid="breakthrough-preparation"><h3>本次准备</h3>{selected ? <><p>{selected.name} · {Number(selected.progress.toFixed(1))} / {selected.target}</p><p>实际贡献：成功率 +{(view.chanceBonus * 100).toFixed(1)} 个百分点。</p><p>{selected.progress >= selected.target ? '本次成功后可获得：' : '准备完成并成功破境后可获得：'}{selected.benefit}</p></> : <p>本次按普通条件突破，未选定额外准备。</p>}</div>;
}
