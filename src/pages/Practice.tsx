import { FOCUSES, ITEMS, REALMS } from '../game/data.ts';
import { breakthroughChance, realmName, trainingRate } from '../game/engine.ts';
import { cultivationState } from '../game/cultivation.ts';
import { TrainingInsight } from '../components/CultivationInsight.tsx';
import PreparationPanel from '../components/PreparationPanel.tsx';
import type { PageProps } from '../components/Common.tsx';

export default function Practice({ game: g, act, openBreakthrough, pauseTime, navigate }: PageProps) {
  const realm = REALMS[g.realm], equipped = ITEMS.find(item => item.id === g.equipped);
  return <div className="practice-content" data-testid="cultivation-details">
    <div className="life-practice-status"><strong>{realmName(g)}</strong><span>{cultivationState(g)}</span></div>
    <progress max={realm.need} value={Math.min(g.progress, realm.need)} aria-label="当前修为"/>
    <div className="life-practice-status"><span>{g.progress.toFixed(1)} / {realm.need}</span><span>修炼基准 +{trainingRate(g)} / 年</span></div>
    {g.realm < 6 && <button className="button primary full" disabled={!g.alive || !!g.pending || g.age < 16 || g.progress < realm.need} onClick={openBreakthrough} data-testid="practice-breakthrough">{REALMS[g.realm + 1].name} · {realm.cost} 灵石 · {Math.round(breakthroughChance(g) * 100)}%</button>}
    <PreparationPanel game={g} act={act} pauseTime={pauseTime}/>
    <details className="manual-focus"><summary>年度重心</summary><div className="focus-picker-grid">{FOCUSES.map(item => <button key={item.id} className={`focus-picker-option ${g.focus === item.id ? 'active' : ''}`} disabled={!g.alive || g.age < 6 || !!g.pending || !!g.expeditions?.active} onClick={() => act({ type: 'focus', focus: item.id })} data-testid={`focus-${item.id}`}><strong>{item.name}</strong><small>{item.subtitle}</small></button>)}</div></details>
    <button className="text-button" data-testid="journey-equipment" onClick={() => navigate('inventory')}>{equipped?.name ?? '查看行囊'}</button>
    <TrainingInsight game={g}/>
  </div>;
}
