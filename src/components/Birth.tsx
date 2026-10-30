import { useState } from 'react';
import type { BirthConfig } from '../game/types.ts';
import { ERAS, ORIGINS, REGIONS, ROUTES } from '../game/data.ts';
import { Icon } from './Art.tsx';
import { PixelScene } from './PixelArt.tsx';
import './PixelBirth.css';

const freshSeed = () => String(crypto.getRandomValues(new Uint32Array(1))[0]);
export function Landing({ onStart, onHelp }: { onStart: () => void; onHelp: () => void }) {
  return <div className="pixel-landing life-landing"><section className="pixel-title-screen"><div className="pixel-title-landscape"><PixelScene/><div className="pixel-title-copy"><h1>万仙之一</h1><p>浮 生 问 道</p></div></div><div className="pixel-title-menu"><button className="button primary pixel-start-button" onClick={onStart} data-testid="start-life"><span>开始此生</span><Icon name="arrow" size={20}/></button><button className="button pixel-help-button" onClick={onHelp}><Icon name="book" size={17}/> 玩法与存档</button><p className="pixel-local-caption">无需账号 · 自动保存于此浏览器</p></div></section></div>;
}
export function BirthForm({ onCreate, durationMinutes, onDurationChange }: { onCreate: (config: BirthConfig) => void; durationMinutes: 30 | 60; onDurationChange: (value: 30 | 60) => void }) {
  const [config, setConfig] = useState<BirthConfig>({ name: '', gender: '随缘', origin: 'random', era: 'peace', route: 'balanced', region: 'random', mode: 'seeker', fastStart: false, seed: freshSeed(), guided: true });
  const update = <K extends keyof BirthConfig,>(key: K, value: BirthConfig[K]) => setConfig(c => ({ ...c, [key]: value }));
  return <form className="pixel-birth simple-birth" onSubmit={event => { event.preventDefault(); onCreate({ ...config, seed: config.seed.trim() || freshSeed() }); }}>
    <label className="form-field">此生姓名<input value={config.name} maxLength={12} placeholder="留空，随缘取名" onChange={event => update('name', event.target.value)} data-testid="birth-name"/></label>
    <label className="form-field">一生的节奏<select value={durationMinutes} onChange={event => onDurationChange(Number(event.target.value) as 30 | 60)} data-testid="birth-duration"><option value={30}>约半小时</option><option value={60}>约一小时</option></select></label>
    <button className="button primary full" type="submit" data-testid="create-life">出生，开始这一生 <Icon name="arrow"/></button>
    <details className="birth-advanced" data-testid="birth-advanced"><summary>自选出身与开局</summary><div className="birth-advanced-body">
      <div className="form-grid"><label className="form-field">人物称谓<select value={config.gender} onChange={event => update('gender', event.target.value)}><option>随缘</option><option>男修</option><option>女修</option></select></label><label className="form-field">家世<select value={config.origin} onChange={event => update('origin', event.target.value)} data-testid="birth-origin"><option value="random">让命运决定</option>{ORIGINS.map(origin => <option key={origin.id} value={origin.id}>{origin.name}</option>)}</select></label></div>
      <div className="form-grid"><label className="form-field">时代<select value={config.era} onChange={event => update('era', event.target.value)}>{ERAS.map(era => <option key={era.id} value={era.id}>{era.name}</option>)}</select></label><label className="form-field">出生地<select value={config.region} onChange={event => update('region', event.target.value)} data-testid="birth-region"><option value="random">让命运决定</option>{REGIONS.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}</select></label></div>
      <label className="form-field">修行道路<select value={config.route} onChange={event => update('route', event.target.value)}>{ROUTES.map(route => <option key={route.id} value={route.id}>{route.name}</option>)}</select></label>
      <label className="form-field">灵根<select value={config.mode} onChange={event => update('mode', event.target.value as BirthConfig['mode'])}><option value="seeker">必有灵根</option><option value="all">众生轮回，可能以武入道</option></select></label>
      <label className="check-label"><input type="checkbox" checked={config.fastStart} onChange={event => update('fastStart', event.target.checked)} data-testid="fast-start"/><span>从十六岁启程<small>代行童年选择，经历仍保留。</small></span></label>
      <label className="check-label"><input type="checkbox" checked={config.guided} onChange={event => update('guided', event.target.checked)} data-testid="guided-start"/><span>自动照料日常<small>安排修炼、生计与休养，按真实概率尝试普通突破。</small></span></label>
      <label className="form-field">命运种子<input value={config.seed} maxLength={80} onChange={event => update('seed', event.target.value)} data-testid="birth-seed"/></label>
      <p className="quiet">时长按800年估算；寿命与阅读停顿会改变实际用时。</p>
    </div></details>
  </form>;
}
