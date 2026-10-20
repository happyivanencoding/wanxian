import type { Game } from '../game/types.ts';
import { fateInfluence } from '../game/fate.ts';
import { storyView } from '../game/story.ts';
import { Icon } from './Art.tsx';
import type { PageId } from './Common.tsx';
import '../pages/JourneyFate.css';

export default function StoryPanel({ game, navigate }: { game: Game; navigate: (page: PageId) => void }) {
  const story = storyView(game), fate = fateInfluence(game);
  const chapters = story.chapters.slice(-3).reverse();
  const person = story.person;
  const personNpc = person && game.npcs.find(npc => npc.id === person.id);
  const fateEffects = [
    fate.training !== 1 && `修炼基准 ×${fate.training.toFixed(2)}`,
    fate.income !== 0 && `每年商盟收入 +${fate.income} 灵石`,
    fate.upkeep !== 0 && `每年额外承担 ${fate.upkeep} 灵石`,
    fate.healthDrain > 0 && `每年额外耗费体魄 ${fate.healthDrain.toFixed(1)}`,
    fate.mindDrain !== 0 && `每年道心${fate.mindDrain > 0 ? '额外耗费' : '恢复'} ${Math.abs(fate.mindDrain).toFixed(1)}`,
    fate.foundationGrowth !== 0 && `每年根基 +${fate.foundationGrowth.toFixed(1)}`,
    fate.reputationGrowth !== 0 && `每年声望 ${fate.reputationGrowth > 0 ? '+' : '−'}${Math.abs(fate.reputationGrowth).toFixed(1)}`,
    fate.chance !== 0 && `破境机缘 +${(fate.chance * 100).toFixed(1)} 个百分点`,
  ].filter(Boolean);

  return <section className="story-panel" data-testid="story-panel" aria-label="此生的故事">
    <div className="story-layout">
      <div className="story-present">
        <span className="eyebrow">此生所系 · 选择留下的回响</span>
        <h2>{story.title}</h2>
        <p className="story-description">{story.description}</p>
        {person && <button className="story-person" data-testid="story-person" onClick={() => navigate('people')}>
          <span className="story-person-mark"><Icon name="people" size={19}/></span>
          <span><small>{person.alive ? '与你的命途相连' : personNpc?.realm === 6 ? '天门另一侧的故人' : '留在此生的故人'}</small><strong>{person.name}</strong></span>
          <span className="story-person-link">{person.alive ? '见故人' : '忆故人'} <Icon name="arrow" size={14}/></span>
        </button>}
      </div>
      {chapters.length > 0 && <div className="story-history">
        <h3>走过的路，仍有回响</h3>
        <ol className="story-chapters" data-testid="story-chapters">{chapters.map((chapter, index) => <li key={`${chapter.age}-${chapter.title}-${index}`}>
          <span className="story-chapter-age">{chapter.age}<small>岁</small></span>
          <div><h4>{chapter.title}</h4><p>{chapter.text}</p></div>
        </li>)}</ol>
        <button className="text-button story-history-link" onClick={() => navigate('chronicle')}>翻看完整年谱 <Icon name="arrow" size={14}/></button>
      </div>}
    </div>
    {story.effects.length > 0 && <div className="story-effects" data-testid="story-effects"><h3>留在生活里的改变</h3><ul>{story.effects.map(effect => <li key={effect}>{effect}</li>)}</ul></div>}
    <details className="fate-arc" data-testid="fate-arc"><summary>修行与收支的变化 <Icon name="chevron" size={13}/></summary>
      {fate.title !== '命途未定' && <p><strong>{fate.title}</strong> · {fate.description}</p>}
      {fateEffects.length > 0 ? <div className="fate-arc-effects">{fateEffects.map(effect => <span key={String(effect)}>{effect}</span>)}</div> : <p>目前尚无命途带来的固定收支或修行加成。</p>}
    </details>
  </section>;
}
