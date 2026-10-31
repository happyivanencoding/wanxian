import WorldHistory from '../components/WorldHistory.tsx';
import { regionalStanding } from '../game/history.ts';
import { useState } from 'react';
import { HOMES, REALMS, REGIONS, SECTS, SECT_RANKS } from '../game/data.ts';
import { currentEra, currentRegion, homePrice, travelPrice, worldPhase } from '../game/engine.ts';
import { sectSpecialty } from '../game/progression.ts';
import { sectAnnualEffect } from '../game/sects.ts';
import { sectLifeSnapshot } from '../game/sect-life.ts';
import { regionWorld } from '../game/world.ts';
import { Icon, MountainScene } from '../components/Art.tsx';
import { PixelScene, PixelSprite } from '../components/PixelArt.tsx';
import { LogRow, SectionTitle, numberText, type PageProps } from '../components/Common.tsx';
import type { Game } from '../game/types.ts';
const locked = (g: Game) => !g.alive || Boolean(g.pending) || Boolean(g.expeditions?.active) || g.age < 16 || g.actionsLeft < 1;
function ActionNote({ game: g }: { game: Game }) {
  return g.pending ? <p className="quiet">先回应眼前的抉择。</p> : g.age < 16 ? <p className="quiet">十六岁后可独自行事。</p> : g.actionsLeft === 0 ? <p className="quiet">今年的行动已用尽。</p> : null;
}
export function WorldPage({ game: g, act }: PageProps) {
  const [selected, setSelected] = useState(g.region);
  const region = REGIONS.find(r => r.id === selected)!;
  const fare = travelPrice(g, region.id);
  const world = regionWorld(region.id);
  return <div className="page-enter"><SectionTitle title="山河万里" aside={<span className="soft-badge">已至 {g.visited.length} / 5 域</span>}/>
    <div className="world-layout"><section className="world-map panel"><MountainScene/><div className="map-label">修 真 五 域 图<small>山川相望 · 各有因缘</small></div><svg className="map-routes" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"><path d="M300 560 610 700 800 390 470 230 170 310 300 560 800 390M470 230 300 560"/></svg>{REGIONS.map(r => <button key={r.id} className={`map-node ${selected === r.id ? 'selected' : ''} ${g.region === r.id ? 'here' : ''} ${g.realm < r.minRealm ? 'locked' : ''}`} style={{ left: `${r.x}%`, top: `${r.y}%` }} onClick={() => setSelected(r.id)} aria-pressed={selected === r.id} data-testid={`region-${r.id}`}><span>{r.symbol}</span><strong>{r.name}</strong><small>{g.region === r.id ? '你在这里' : g.realm < r.minRealm ? REALMS[r.minRealm].name + '可至' : g.visited.includes(r.id) ? '曾经到访' : '尚未到访'}</small></button>)}<div className="map-footer"><span><i/> 已至</span></div></section>
    <section className="panel region-detail"><span className="eyebrow">{world.continent} · 远方的一页</span><div className="region-symbol">{region.symbol}</div><h2>{region.name}</h2><p className="region-subtitle">{region.subtitle}</p><p>{region.description}</p><div className="region-lore" data-testid="region-lore"><p>{world.culture}</p><p><strong>当地修行</strong>{world.practice}</p><p><strong>往来势力</strong>{world.factions.join('、')}</p></div><div className="metric-pairs"><div><span>地域灵气</span><strong>× {region.spirit.toFixed(2)}</strong></div><div><span>基础历练风险</span><strong>{Math.round(region.risk * 100)}%</strong></div><div><span>境界要求</span><strong>{REALMS[region.minRealm].name}</strong></div><div><span>路费{fare < region.cost ? ' · 驿站照应' : ''}</span><strong data-testid="travel-price">{fare} 灵石</strong></div></div><button className="button primary full" disabled={locked(g) || region.id === g.region || g.realm < region.minRealm || g.stones < fare} onClick={() => act({ type: 'travel', id: region.id })} data-testid="travel-selected">{region.id === g.region ? '此刻，身在此处' : g.realm < region.minRealm ? '尚需更高境界' : '动身前往'}<Icon name="arrow" size={17}/></button></section></div>
    <WorldHistory game={g}/><ActionNote game={g}/></div>;
}
export function SectPage({ game: g, act }: PageProps) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  const sect = SECTS.find(item => item.id === g.sect);
  const record = sectLifeSnapshot(g);
  const specialty = sectSpecialty(g);
  const allowance = sectAnnualEffect(g).stones ?? 0;
  if (!sect) return <div className="sect-life-page">
    <SectionTitle title="师承"/>
    <p className="quiet">目前在山野修行。往后若有相识的人引荐，便会遇见新的门路。</p>
    <details className="sect-school-index"><summary>五洲山门</summary>
      {REGIONS.map(region => <section key={region.id}><h3>{region.name}</h3>
        <p>{SECTS.filter(item => item.home === region.id).map(item => item.name).join(' · ')}</p>
      </section>)}
    </details>
  </div>;
  return <div className="sect-life-page" data-testid="sect-life-page">
    <header className="sect-life-heading">
      <span className="eyebrow">{sect.style}</span>
      <h2>{sect.name}</h2>
      <div className="sect-life-facts"><span>{SECT_RANKS[g.sectRank]}</span><span>贡献 <strong data-testid="sect-contribution">{g.contribution}</strong></span><span data-testid="sect-allowance">年例 {allowance} 灵石</span><span>{regionalStanding(g, sect.home).label}</span></div>
      <p>{sect.culture}</p>
    </header>
    {record?.mentor && <div className="sect-mentor">
      <Icon name="people" size={17}/><span>{record.mentor.name}</span><small>{record.mentor.alive ? '门中传功人' : '故去的传功人'}</small>
    </div>}
    {record?.last.length ? <section className="sect-life-chronicle"><h3>门中近事</h3>
      {record.last.map(entry => <LogRow key={entry.id} entry={entry}/>)}
    </section> : null}
    {g.flags.includes(sect.specialty.id) && <p className="sect-learned">已学会 {sect.specialty.name} · {sect.specialty.gear.name}</p>}
    <details className="sect-life-manual" data-testid="sect-manual"><summary>自行处理门务</summary>
      <div className="sect-manual-actions">
        <button className="button" disabled={locked(g)} onClick={() => act({ type: 'sect', job: 'mission' })} data-testid="sect-mission">{sect.mission.name}</button>
        <button className="button" disabled={locked(g) || g.contribution < 20} onClick={() => act({ type: 'sect', job: 'study' })}>去藏经阁参修</button>
        <button className="button" disabled={locked(g) || g.sectRank >= 3} onClick={() => act({ type: 'sect', job: 'promote' })}>请授新职</button>
        {specialty && <button className="button" disabled={!specialty.available} onClick={() => act({ type: 'sect', job: 'learn' })} data-testid="learn-specialty">{specialty.owned ? '已学会' : '请教师门所学'}</button>}
      </div>
      <details className="sect-leave"><summary>告别山门</summary>
        <p className="quiet">离开后不再领取月例，职务和贡献会清零，已学的本领仍在。</p>
        <button className="text-button danger-text" disabled={locked(g)} onClick={() => {
          if (confirmLeave) { act({ type: 'sect', job: 'leave' }); setConfirmLeave(false); }
          else setConfirmLeave(true);
        }}>{confirmLeave ? '确定离开' : '离开师门'}</button>
        {confirmLeave && <button className="text-button" onClick={() => setConfirmLeave(false)}>暂且留下</button>}
      </details>
    </details>
  </div>;
}
export function HomePage({ game: g, act }: PageProps) {
  const levels = Object.values(g.home).reduce((a, b) => a + b, 0);
  return <div className="page-enter"><SectionTitle title="山居一隅" aside={<span className="soft-badge">{currentRegion(g).name} · 洞府</span>}/>
    <section className="home-preview panel"><div className="home-copy"><span className="eyebrow">{levels < 5 ? '竹舍初成' : levels < 10 ? '山居渐盛' : '一方清境'}</span><h2>半窗山色，<br/>一室清风。</h2><p>蒲团、药圃、丹炉与书卷，<br/>这里的每一处布置都参与修行。</p><div className="home-score"><strong>{levels}</strong><span> / 15 设施等级</span></div></div><div className="home-diorama"><PixelScene className="pixel-home-scene" region={g.region}/><div className="home-furniture furniture-mat"><span className={g.home.mat ? 'built' : ''}><Icon name="leaf" size={26}/></span><small>蒲团 Lv.{g.home.mat}</small></div><div className="home-furniture furniture-array"><span className={g.home.array ? 'built' : ''}><Icon name="spark" size={29}/></span><small>聚灵阵 Lv.{g.home.array}</small></div><div className="home-furniture furniture-furnace"><span className={g.home.furnace ? 'built' : ''}><Icon name="flask" size={29}/></span><small>丹炉 Lv.{g.home.furnace}</small></div><div className="home-furniture furniture-library"><span className={g.home.library ? 'built' : ''}><Icon name="book" size={26}/></span><small>书架 Lv.{g.home.library}</small></div><div className="home-furniture furniture-garden"><span className={g.home.garden ? 'built' : ''}><Icon name="leaf" size={28}/></span><small>药圃 Lv.{g.home.garden}</small></div></div></section>
    <div className="facility-grid">{HOMES.map(home => <section className="panel facility-card" key={home.id}><div className="facility-top"><span className="facility-icon"><PixelSprite name={home.id === 'garden' ? 'herb' : home.id === 'furnace' ? 'furnace' : home.id === 'library' ? 'book' : home.id === 'array' ? 'array' : 'home'} size={46}/></span><span className="level-badge">{g.home[home.id] ? `Lv.${g.home[home.id]}` : '未建造'}</span></div><h3>{home.name}</h3><p>{home.description}</p><div className="level-dots">{[1, 2, 3].map(n => <i className={g.home[home.id] >= n ? 'filled' : ''} key={n}/>)}</div><button className="button full" disabled={locked(g) || g.home[home.id] >= home.max || g.stones < homePrice(g, home.id)} onClick={() => act({ type: 'home', id: home.id })} data-testid={`home-${home.id}`}>{g.home[home.id] >= home.max ? '已至圆满' : `${g.home[home.id] ? '修缮升级' : '建造'} · ${numberText(homePrice(g, home.id))} 灵石`}<Icon name={g.home[home.id] >= home.max ? 'check' : 'arrow'} size={16}/></button></section>)}</div><ActionNote game={g}/></div>;
}
