import { useState } from 'react';
import { ITEMS, REALMS, RECIPES } from '../game/data.ts';
import { craftChance, itemPrice } from '../game/engine.ts';
import { storyView } from '../game/story.ts';
import { companionTraits } from '../game/progression.ts';
import { relationshipLabel } from '../game/relationships.ts';
import { Icon, Portrait } from '../components/Art.tsx';
import GameItemIcon from '../components/GameItemIcon.tsx';
import { Empty, Notice, SectionTitle, StatBar, numberText, type PageProps } from '../components/Common.tsx';

const kindNames: Record<string, string> = { material: '材料', pill: '丹药', gear: '法宝', book: '典籍', relic: '旧物' };
export function InventoryPage({ game: g, act, navigate, openBreakthrough }: PageProps) {
  const [filter, setFilter] = useState('all'), [search, setSearch] = useState('');
  const locked = !g.alive || Boolean(g.pending) || Boolean(g.expeditions?.active) || g.age < 16 || g.actionsLeft === 0;
  const matches = (item: typeof ITEMS[number]) => (filter === 'all' || item.kind === filter) && (item.name + item.description).includes(search);
  const bag = ITEMS.filter(item => (g.inventory[item.id] || 0) > 0 && matches(item));
  const card = (item: typeof ITEMS[number], market = false) => {
    const owned = g.inventory[item.id] || 0, read = item.effect?.flag && g.flags.includes(item.effect.flag);
    return <article className="panel item-card" key={item.id} data-testid={`item-${item.id}`}>
      <div className="item-top"><div className={`item-mark ${item.kind}`}><GameItemIcon id={item.id}/></div><div><span className="eyebrow">{kindNames[item.kind]}{g.equipped === item.id ? ' · 随身' : read ? ' · 已领悟' : ''}</span><h3>{item.name}</h3></div><span className="item-count">×{owned}</span></div>
      <p>{item.description}</p>
      {market ? <button className="button full" disabled={locked || g.stones < itemPrice(g, item.id) || g.realm < item.minRealm || Boolean(read)} onClick={() => act({ type: 'buy', id: item.id })} data-testid={`buy-${item.id}`}>购入 · {itemPrice(g, item.id)} 灵石{g.realm < item.minRealm ? ` · 需${REALMS[item.minRealm].name}` : ''}</button>
      : item.kind === 'relic' ? (g.flags.includes(`relic-known:${item.id}`) && <span className="relic-known">已辨来历</span>)
      : <div className="item-buttons">{item.kind === 'gear' || item.effect ? <button className="button primary" disabled={locked || Boolean(read)} onClick={() => act({ type: 'use', id: item.id })} data-testid={`use-${item.id}`}>{item.kind === 'gear' ? g.equipped === item.id ? '卸下' : '装备' : item.kind === 'book' ? read ? '已领悟' : '研读' : '服用'}</button> : item.id === 'breakpill' ? <button className="button" onClick={openBreakthrough}>用于突破</button> : null}
        <button className="text-button" disabled={locked || (g.equipped === item.id && owned === 1)} onClick={() => act({ type: 'sell', id: item.id })} data-testid={`sell-${item.id}`}>售出 · {Math.floor(itemPrice(g, item.id) * .5)}</button>
      </div>}
    </article>;
  };
  return <div className="inventory-inline">
    <div className="inventory-toolbar"><input className="search-input" aria-label="搜索物品" placeholder="搜索物品" value={search} onChange={e => setSearch(e.target.value)}/><div className="filter-chips">{[['all', '全部'], ['pill', '丹药'], ['material', '材料'], ['gear', '法宝'], ['book', '典籍'], ['relic', '旧物']].map(([id, label]) => <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)} aria-pressed={filter === id}>{label}</button>)}</div></div>
    <div className="equipped-line"><Icon name="sword" size={18}/><span>随身</span><strong>{ITEMS.find(item => item.id === g.equipped)?.name ?? '暂无'}</strong></div>
    {bag.length ? <div className="item-grid">{bag.map(item => card(item))}</div> : <p className="quiet">暂无物品</p>}
    {ITEMS.some(item => item.kind === 'book' && item.effect?.flag && g.flags.includes(item.effect.flag)) && <details className="inventory-section"><summary>已研习</summary>{ITEMS.filter(item => item.kind === 'book' && item.effect?.flag && g.flags.includes(item.effect.flag)).map(item => <p key={item.id}>{item.name}</p>)}</details>}
    <details className="inventory-section"><summary data-testid="market-toggle">坊市</summary><div className="item-grid">{ITEMS.filter(item => item.market !== false && matches(item)).map(item => card(item, true))}</div></details>
    <details className="inventory-section"><summary data-testid="craft-toggle">丹房 · 成丹率 {Math.round(craftChance(g) * 100)}%</summary>
      {!g.home.furnace && <button className="button" onClick={() => navigate('home')}>建造丹炉</button>}
      <p className="quiet">失败仍消耗药材与炉费。</p><div className="recipe-grid">{RECIPES.map(recipe => {
        const enough = Object.entries(recipe.materials).every(([id, qty]) => (g.inventory[id] || 0) >= qty);
        return <section key={recipe.id} className="panel recipe-card"><h3>{recipe.name}</h3><p>{ITEMS.find(item => item.id === recipe.id)!.description}</p><div className="recipe-materials">{Object.entries(recipe.materials).map(([id, qty]) => <span key={id}>{ITEMS.find(item => item.id === id)!.name}<strong>{g.inventory[id] || 0} / {qty}</strong></span>)}</div><div className="recipe-requirement">丹术 {recipe.level} · {recipe.fee} 灵石</div><button className="button primary full" disabled={locked || !g.home.furnace || g.stats.alchemy < recipe.level || !enough || g.stones < recipe.fee} onClick={() => act({ type: 'craft', id: recipe.id })} data-testid={`craft-${recipe.id}`}>开炉</button></section>;
      })}</div>
    </details>
    {g.pending && <p className="quiet">先回应眼前的抉择。</p>}
  </div>;
}
export function PeoplePage({ game: g, act, prefetchAction }: PageProps) {
  const alive = g.npcs.filter(n => n.alive).length;
  const story = storyView(g);
  const traits = companionTraits(g);
  const locked = !g.alive || Boolean(g.pending) || Boolean(g.expeditions?.active) || g.age < 16 || g.actionsLeft === 0;
  return <div className="page-enter"><SectionTitle title="相识的人" aside={<span className="soft-badge">{alive} 位仍在人间</span>}/>
    {!g.npcs.length && <p className="quiet">尚未相识</p>}<div className="people-grid">{g.npcs.map((npc, index) => { const spent = npc.lastInteraction === g.age || npc.role === 'enemy'; const bond = npc.role === 'companion'; const trait = traits.find(item => item.id === npc.id); return <article className={`panel person-card ${!npc.alive ? 'person-departed' : ''}`} key={npc.id}><div className="person-top"><Portrait name={npc.name} index={index} departed={!npc.alive}/><div><span className="eyebrow">{npc.title}</span><h2>{npc.name}</h2><div className="person-tags"><span>{npc.alive ? REALMS[npc.realm].name : npc.realm === 6 ? '已飞升' : '已故'}</span><span>{npc.age}岁</span><span>{relationshipLabel(npc)}</span></div></div>{bond && <span className="bond-badge">道侣</span>}</div><p className="person-story">{npc.story}</p>{npc.meeting && <p className="quiet">{npc.metAt}岁 · {npc.meeting}</p>}{npc.gear && <p className="person-gear">{npc.gear.name}</p>}{npc.role === 'enemy' && <p className="danger-text">{npc.grievance ?? '旧怨未了'}</p>}{trait && <div className="companion-trait" data-testid={`companion-trait-${npc.id}`}><h3>{trait.traitName}{trait.shared && <span>曾并肩同行</span>}</h3><p>{trait.description}</p>{!trait.available && <small>{trait.reason}</small>}</div>}{story.person?.id === npc.id && <div className="person-story-link" data-testid={`story-person-connection-${npc.id}`}><Icon name="leaf" size={16}/><span><strong>此生所系 · {story.title}</strong><br/>{story.description}</span></div>}<StatBar name={npc.alive ? npc.relation >= 75 ? '相知' : npc.relation >= 50 ? '相熟' : '情谊' : '留在记忆里的情谊'} value={npc.relation} tone="gold"/>
      {npc.alive && npc.role !== 'enemy' ? <><div className="person-metrics"><span>资质 <b>{npc.aptitude}</b></span><span>寿元上限 <b>{npc.lifespan}年</b></span><span>境界进度 <b>{Math.min(100, Math.round(npc.progress / REALMS[npc.realm].need * 100))}%</b></span></div><div className="person-actions"><button className="button" disabled={locked || spent} onPointerEnter={() => prefetchAction({ type: 'npc', id: npc.id, interaction: 'talk' })} onFocus={() => prefetchAction({ type: 'npc', id: npc.id, interaction: 'talk' })} onPointerDown={() => prefetchAction({ type: 'npc', id: npc.id, interaction: 'talk' })} onClick={() => act({ type: 'npc', id: npc.id, interaction: 'talk' })} data-testid={`talk-${npc.id}`}><Icon name="people" size={15}/>论道</button><button className="button" disabled={locked || spent || g.stones < 12 + npc.realm * 8} onPointerEnter={() => prefetchAction({ type: 'npc', id: npc.id, interaction: 'gift' })} onFocus={() => prefetchAction({ type: 'npc', id: npc.id, interaction: 'gift' })} onPointerDown={() => prefetchAction({ type: 'npc', id: npc.id, interaction: 'gift' })} onClick={() => act({ type: 'npc', id: npc.id, interaction: 'gift' })}>赠礼 · {12 + npc.realm * 8}</button><button className="button" disabled={locked || spent} onPointerEnter={() => prefetchAction({ type: 'npc', id: npc.id, interaction: 'duel' })} onFocus={() => prefetchAction({ type: 'npc', id: npc.id, interaction: 'duel' })} onPointerDown={() => prefetchAction({ type: 'npc', id: npc.id, interaction: 'duel' })} onClick={() => act({ type: 'npc', id: npc.id, interaction: 'duel' })}>切磋</button></div><button className={`bond-button ${bond ? 'bonded' : ''}`} disabled={locked || spent || bond || npc.relation < 75 || g.age < 18 || npc.age < 18 || g.npcs.some(n => n.alive && n.role === 'companion')} onClick={() => act({ type: 'npc', id: npc.id, interaction: 'bond' })}>{bond ? '已许此生，同看山河' : npc.relation < 75 ? '情谊75可结为道侣' : '与君结为道侣'}</button>{spent && <small className="quiet">今年已相聚</small>}</> : <div className="memorial-note"><Icon name="leaf" size={17}/>{npc.alive ? '可能再次追来' : npc.realm === 6 ? '已飞升离界' : '往事仍在'}</div>}</article>; })}</div>
  </div>;
}
