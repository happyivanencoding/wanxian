import { ORIGINS, ROUTES, SECTS, SECT_RANKS } from '../game/data.ts';
import { realmName } from '../game/engine.ts';
import { lifeIdentity } from '../game/world.ts';
import { Icon } from '../components/Art.tsx';
import StoryPanel from '../components/StoryPanel.tsx';
import { Attainments } from '../components/PreparationPanel.tsx';
import { TrainingInsight } from '../components/CultivationInsight.tsx';
import { LogRow, type PageProps } from '../components/Common.tsx';

export default function Life({ game, act, navigate }: PageProps) {
  const identity = lifeIdentity(game);
  return <div className="page-enter life-page"><section className="panel life-identity"><span className="eyebrow">浮生一卷 · {game.age}岁</span><h1>{game.name}<small>{realmName(game)}</small></h1><p>{ORIGINS.find(item => item.id === game.origin)?.name} · {ROUTES.find(item => item.id === game.route)?.name} · {game.sect ? `${SECTS.find(item => item.id === game.sect)?.name} ${SECT_RANKS[game.sectRank]}` : '山野散修'}</p><div><span>灵根 <strong>{game.root}</strong></span><span>资质 <strong>{game.aptitude}</strong></span><span>天赋 <strong>{game.talent}</strong></span></div></section>
    <section className="panel life-world-identity" data-testid="life-identity"><span className="eyebrow">山河间，你走成了怎样的人</span><h2>{identity.title}</h2><p>{identity.description}</p><div>{identity.facets.map(facet => <span key={facet}>{facet}</span>)}</div></section><StoryPanel game={game} navigate={navigate}/><Attainments game={game}/><section className="panel life-training"><TrainingInsight game={game}/></section>
    <section className="panel life-recent"><div className="compact-panel-title"><h2>最近留下的片语</h2><button className="text-button" onClick={() => navigate('chronicle')}>年谱 <Icon name="arrow" size={17}/></button></div>{game.logs.slice(-3).reverse().map(entry => <LogRow key={entry.id} entry={entry} onStar={() => act({ type: 'star', id: entry.id })}/>)}</section>
  </div>;
}
