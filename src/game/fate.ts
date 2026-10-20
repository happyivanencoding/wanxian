import type { Game } from './types.ts';

export type StoryPath = 'guardian' | 'lone' | 'contract';
export function currentStoryPath(g: Pick<Game, 'flags'>): StoryPath | undefined {
  const paths: StoryPath[] = ['guardian', 'lone', 'contract'];
  return paths.find(path => g.flags.includes(`story-active-${path}`))
    ?? paths.find(path => g.flags.includes(`fate-${path}`));
}

export function fateInfluence(g: Pick<Game, 'flags'>) {
  const flags = g.flags;
  const has = (flag: string) => flags.includes(flag);
  const path = currentStoryPath(g);
  const newGuardian = ['story-clinic', 'story-care-network', 'story-watch'].some(has);
  const abandoned = has('fate-city-abandoned') && !newGuardian;
  const defended = has('fate-city-defended') || newGuardian;
  const newShared = has('story-fieldnotes') || has('story-school');
  const newSecluded = has('story-research') || has('story-private');
  const shared = newShared || (!newSecluded && has('fate-shared'));
  const secluded = newSecluded || (!newShared && has('fate-secluded'));
  const newHonest = has('story-ledger') || has('story-fairtrade') || has('story-contract-common');
  const newMagnate = has('story-market') && !has('story-contract-common');
  const magnate = !newHonest && (newMagnate || has('fate-magnate'));
  const honest = newHonest || (!newMagnate && has('fate-honest'));
  let title = '命途未定';
  let description = '出身、志向、同行者与眼前处境，正在把不同的机缘带到你面前。';
  let training = 1, income = 0, upkeep = 0, healthDrain = 0, mindDrain = 0;
  let foundationGrowth = 0, reputationGrowth = 0, chance = 0;
  if (path === 'guardian') {
    title = defended ? '山城守望者' : abandoned ? '失约的守望者' : '守望人间';
    description = defended ? '山城得以留存；你仍需维持护城阵，也从守护中学会扎实的根基。'
      : abandoned ? '城池失守，你收回资源，但旧誓的重量仍留在心上。'
      : '你承担护城之责，每年要为凡人的安稳支付灵石。';
    upkeep = abandoned ? 0 : defended ? 4 : 8;
    foundationGrowth = defended ? 0.5 : 0;
    reputationGrowth = abandoned ? -0.6 : 0.45;
    mindDrain = abandoned ? 0.4 : 0;
  } else if (path === 'lone') {
    title = shared ? '开山传道' : secluded ? '绝壁独修' : '孤峰问道';
    description = shared ? '你允许弟子分担寂寞，修行虽慢些，心境逐渐平稳。'
      : secluded ? '封山换来更迅疾的修为，长年的孤绝却会磨损身心。'
      : '远离人间专注修炼，修为加快，但体魄与道心需要格外照顾。';
    training = shared ? 1.06 : secluded ? 1.25 : 1.16;
    healthDrain = shared ? 0.3 : secluded ? 1.35 : 0.8;
    mindDrain = shared ? 0 : secluded ? 0.9 : 0.4;
    reputationGrowth = shared ? 0.4 : 0;
  } else if (path === 'contract') {
    title = honest ? '商路共营' : magnate ? '灵石权盟' : '山河盟约';
    description = has('story-contract-common') ? '沿途经营者共同决定契约，收入回归薄利守信，旧日欠契不再继续榨取。'
      : has('fate-honest') ? '你揭开商会旧账，收入收缩，却重新赢得信任。'
      : magnate ? '你掌握了灵石流通的命脉，收益颇丰，代价是纷争和心魔。'
      : '商盟提供每年的财富，但契约与奔忙减缓了个人修行。';
    income = honest ? 5 : magnate ? 22 : 14;
    training = honest ? 0.97 : 0.92;
    mindDrain = honest ? 0 : magnate ? 1.25 : 0.35;
    reputationGrowth = magnate ? -0.8 : honest ? 0.3 : 0;
  }
  if (has('fate-legacy')) { chance += 0.055; upkeep += 6; description += ' 你也背负传承众人的长期供奉。'; }
  if (has('fate-insight')) { chance += 0.09; healthDrain += 0.7; description += ' 你以肉身承载更锋利的天机。'; }
  if (has('fate-balanced')) { training *= 0.96; mindDrain = Math.max(-0.6, mindDrain - 0.6); description += ' 你留出时光整理身心。'; }
  if (path === 'guardian' && has('story-clinic')) upkeep += 3;
  // New lives reuse the numerical commitments, but describe what actually happened.
  if (path === 'guardian' && has('story-clinic')) { title = '一城药香'; description = '你持续供给药堂，旧医方与日常照应把你和山城连在一起。'; }
  else if (path === 'guardian' && has('story-care-network')) { title = '邻里互助'; description = '你把简单医方交给各家，人们逐渐学会互相照料，守望之约仍在继续。'; }
  else if (path === 'guardian' && has('story-watch')) { title = '故土守望'; description = '你留在旧城修复道路，承担供养，也让安居得以继续。'; }
  else if (path === 'lone' && has('story-fieldnotes')) { title = '山河求证'; description = '你带着残卷下山，用行旅印证问题；修行放缓一些，心境更平稳。'; }
  else if (path === 'lone' && has('story-school')) { title = '孤峰共学'; description = '求学者可以自行讨论和推演，新的问题持续进入你的生活。'; }
  else if (path === 'lone' && (has('story-research') || has('story-private'))) { title = '终日求索'; description = '你把大部分时间留给残卷的疑问，修炼加快，也要照顾独修消耗的身心。'; }
  else if (path === 'contract' && has('story-fairtrade') && !has('story-contract-common')) { title = '药材长约'; description = '你与产药人直接订下长约，少取中转利润，让供应稳定地延续。'; }
  else if (path === 'contract' && has('story-waystations') && !has('story-contract-common')) { title = '驿路相连'; description = '沿途驿站共同维持补给，旅行费用减少，商路收入继续支撑修行。'; }
  else if (path === 'contract' && has('story-caravan') && !has('story-ledger') && !has('story-market') && !has('story-contract-common')) { title = '迁居领路人'; description = '你带愿意同行的人离开旧城，以商路收入与行旅补给安顿新的生活；旧日守望没有被遗忘。'; }
  return { title, description, training, income, upkeep, healthDrain, mindDrain, foundationGrowth, reputationGrowth, chance };
}
