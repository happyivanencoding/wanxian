import { useState } from 'react';
import type { BirthConfig } from '../game/types.ts';
import { ERAS, GIVEN_NAMES, ORIGINS, REGIONS, ROUTES, SURNAMES } from '../game/data.ts';
import { Icon } from './Art.tsx';
import { PixelPortrait, PixelScene, PixelSprite } from './PixelArt.tsx';
import { secondsPerYear, YEARS_PER_LIFE_ESTIMATE } from './YearClock.tsx';
import { regionWorld } from '../game/world.ts';
import './PixelBirth.css';

const freshSeed = () => String(crypto.getRandomValues(new Uint32Array(1))[0]);
export function Landing({ onStart, onHelp }: { onStart: () => void; onHelp: () => void }) {
  return <div className="pixel-landing">
    <section className="pixel-title-screen">
      <div className="pixel-title-landscape"><PixelScene/><div className="pixel-title-copy"><span className="pixel-title-kicker">单机修仙 · 人生模拟</span><h1>万仙之一</h1><p>浮 生 问 道</p></div><span className="pixel-title-location"><Icon name="mountain" size={14}/> 山门初见 · 仙途未启</span></div>
      <div className="pixel-title-menu"><div className="pixel-menu-intro"><span className="eyebrow">一念入山 · 一世问道</span><h2>从山脚，走向你的仙途。</h2><p>有人叩门一百年，有人一剑破青云。<br/>在修行、机缘与人情之间，写下自己的这一生。</p></div><button className="button primary pixel-start-button" onClick={onStart} data-testid="start-life"><PixelSprite name="sword" size={28}/><span>开始此生<small>择出身 · 定命途 · 入山河</small></span><Icon name="arrow" size={20}/></button><button className="button pixel-help-button" onClick={onHelp}><Icon name="book" size={17}/> 初入仙途 · 玩法说明</button><p className="pixel-local-caption"><span className="live-dot"/> 本地单机 · 无需账号 · 自动存档</p></div>
    </section>
    <div className="pixel-landing-features"><article><PixelSprite name="map" size={36}/><div><h3>五域游历</h3><p>五种出身，二十仙门</p></div></article><article><PixelSprite name="jade" size={36}/><div><h3>因缘相随</h3><p>相识故人，重逢旧事</p></div></article><article><PixelSprite name="scroll" size={36}/><div><h3>一生一卷</h3><p>成仙归隐，皆入年谱</p></div></article></div>
    <footer className="pixel-landing-footer">山中无甲子，世上已千年。<span>万仙之一 · 本地版</span></footer>
  </div>;
}
export function BirthForm({ onCreate, durationMinutes, onDurationChange }: { onCreate: (config: BirthConfig) => void; durationMinutes: 30 | 60; onDurationChange: (value: 30 | 60) => void }) {
  const [config, setConfig] = useState<BirthConfig>({ name: '', gender: '随缘', origin: 'random', era: 'peace', route: 'balanced', region: 'random', mode: 'seeker', fastStart: true, seed: freshSeed() });
  const update = <K extends keyof BirthConfig,>(key: K, value: BirthConfig[K]) => setConfig(c => ({ ...c, [key]: value }));
  const chosenEra = ERAS.find(e => e.id === config.era)!;
  const chosenOrigin = ORIGINS.find(o => o.id === config.origin);
  function randomName() { const n = crypto.getRandomValues(new Uint32Array(2)); update('name', SURNAMES[n[0] % SURNAMES.length] + GIVEN_NAMES[n[1] % GIVEN_NAMES.length]); }
  return <form className="pixel-birth" onSubmit={event => { event.preventDefault(); onCreate({ ...config, seed: config.seed.trim() || freshSeed() }); }}>
    <div className="pixel-birth-preview"><PixelPortrait name={config.name || '初入仙途'} gender={config.gender}/><div><span className="eyebrow">即将启程</span><strong>{config.name || '无名修士'}</strong><p>{config.gender} · {chosenOrigin?.name || '家世随缘'} · {chosenEra.name}</p><small>名字是第一笔，余下的由你来写。</small></div><PixelSprite name="scroll" size={42}/></div>
    <h3 className="pixel-birth-section"><span>01</span> 此生身份</h3>
    <div className="form-grid"><label className="form-field">此生姓名<div className="input-with-button"><input value={config.name} maxLength={12} placeholder="留空，让命运为你取名" onChange={e => update('name', e.target.value)} data-testid="birth-name"/><button type="button" title="随机取名" onClick={randomName}><Icon name="rebirth" size={18}/></button></div></label><label className="form-field">人物称谓<select value={config.gender} onChange={e => update('gender', e.target.value)}><option>随缘</option><option>男修</option><option>女修</option></select></label></div>
    <label className="field-label">选择一条命途</label><div className="choice-grid two"><button type="button" className={`select-card ${config.mode === 'seeker' ? 'selected' : ''}`} onClick={() => update('mode', 'seeker')} aria-pressed={config.mode === 'seeker'}><strong>修行者</strong><span>必有灵根</span></button><button type="button" className={`select-card ${config.mode === 'all' ? 'selected' : ''}`} onClick={() => update('mode', 'all')} aria-pressed={config.mode === 'all'}><strong>众生轮回</strong><span>灵根随机，可能成为体修</span></button></div>
    <h3 className="pixel-birth-section"><span>02</span> 家世与山河</h3>
    <div className="form-grid"><label className="form-field">家世出身<select value={config.origin} onChange={e => update('origin', e.target.value)} data-testid="birth-origin"><option value="random">让命运决定 · 加权随机</option>{ORIGINS.map(o => <option key={o.id} value={o.id}>{o.name} · {o.tag}</option>)}</select><small>{chosenOrigin?.description || '寒门38% · 行商22% · 遗孤15% · 世家10% · 漂泊15%'}</small></label><label className="form-field">身逢何世<select value={config.era} onChange={e => update('era', e.target.value)}>{ERAS.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select><small>{chosenEra.description}</small></label></div>
    <label className="form-field">生于哪片山河<select value={config.region ?? 'random'} onChange={e => update('region', e.target.value)} data-testid="birth-region"><option value="random">让命运决定 · 五域随机</option>{REGIONS.map(region => <option value={region.id} key={region.id}>{region.name} · {region.subtitle}</option>)}</select><small>{config.region && config.region !== 'random' ? `${regionWorld(config.region).continent} · ${regionWorld(config.region).culture}` : '故乡会影响早年的见闻、修行条件与近处的宗门。出生后仍可选择远行。'}</small></label>
    <h3 className="pixel-birth-section"><span>03</span> 修行道路与节奏</h3>
    <label className="field-label">想走的修行道路</label><div className="choice-grid four">{ROUTES.map(route => <button type="button" key={route.id} className={`select-card route-card ${config.route === route.id ? 'selected' : ''}`} onClick={() => update('route', route.id)} aria-pressed={config.route === route.id}><PixelSprite name={route.icon} size={36}/><strong>{route.name}</strong><span>{route.description}</span></button>)}</div>
    <label className="form-field">预计一局的现实时间<select value={durationMinutes} onChange={e => onDurationChange(Number(e.target.value) as 30 | 60)} data-testid="birth-duration"><option value={30}>预计半小时 · 1× 每年约{secondsPerYear(30, 1).toFixed(1)}秒</option><option value={60}>预计一小时 · 1× 每年约{secondsPerYear(60, 1).toFixed(1)}秒</option></select><small>按{YEARS_PER_LIFE_ESTIMATE}年估算，可在设置中调整。</small></label>
    <div className="birth-bottom"><label className="check-label"><input type="checkbox" checked={config.fastStart} onChange={e => update('fastStart', e.target.checked)} data-testid="fast-start"/><span>从十六岁启程<small>童年由稳健选择代行，经历仍保留在年谱。取消可从零岁观看。</small></span></label><details className="seed-details"><summary>命运种子 · 可复现人生</summary><label className="form-field">相同设置、种子与选择会得到相同结果<input value={config.seed} maxLength={80} onChange={e => update('seed', e.target.value)} data-testid="birth-seed"/></label></details></div>
    <button className="button primary full" type="submit" data-testid="create-life">落笔，入世 <Icon name="arrow"/></button>
  </form>;
}
