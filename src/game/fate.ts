import type { Game } from './types.ts';

export function fateInfluence(g: Pick<Game, 'flags'>) {
  const flags = g.flags;
  const has = (flag: string) => flags.includes(flag);
  let title = '命途未定';
  let description = '二十八岁左右，山河会向你提出一次不能轻易撤回的选择。';
  let training = 1, income = 0, upkeep = 0, healthDrain = 0, mindDrain = 0;
  let foundationGrowth = 0, reputationGrowth = 0, chance = 0;
  if (has('fate-guardian')) {
    title = has('fate-city-defended') ? '山城守望者' : has('fate-city-abandoned') ? '失约的守望者' : '守望人间';
    description = has('fate-city-defended') ? '山城得以留存；你仍需维持护城阵，也从守护中学会扎实的根基。'
      : has('fate-city-abandoned') ? '城池失守，你收回资源，但旧誓的重量仍留在心上。'
      : '你承担护城之责，每年要为凡人的安稳支付灵石。';
    upkeep = has('fate-city-abandoned') ? 0 : has('fate-city-defended') ? 4 : 8;
    foundationGrowth = has('fate-city-defended') ? 0.5 : 0;
    reputationGrowth = has('fate-city-abandoned') ? -0.6 : 0.45;
    mindDrain = has('fate-city-abandoned') ? 0.4 : 0;
  } else if (has('fate-lone')) {
    title = has('fate-shared') ? '开山传道' : has('fate-secluded') ? '绝壁独修' : '孤峰问道';
    description = has('fate-shared') ? '你允许弟子分担寂寞，修行虽慢些，心境逐渐平稳。'
      : has('fate-secluded') ? '封山换来更迅疾的修为，长年的孤绝却会磨损身心。'
      : '远离人间专注修炼，修为加快，但体魄与道心需要格外照顾。';
    training = has('fate-shared') ? 1.06 : has('fate-secluded') ? 1.25 : 1.16;
    healthDrain = has('fate-shared') ? 0.3 : has('fate-secluded') ? 1.35 : 0.8;
    mindDrain = has('fate-shared') ? 0 : has('fate-secluded') ? 0.9 : 0.4;
    reputationGrowth = has('fate-shared') ? 0.4 : 0;
  } else if (has('fate-contract')) {
    title = has('fate-honest') ? '商路清算' : has('fate-magnate') ? '灵石权盟' : '山河盟约';
    description = has('fate-honest') ? '你揭开商会旧账，收入收缩，却重新赢得信任。'
      : has('fate-magnate') ? '你掌握了灵石流通的命脉，收益颇丰，代价是纷争和心魔。'
      : '商盟提供每年的财富，但契约与奔忙减缓了个人修行。';
    income = has('fate-honest') ? 5 : has('fate-magnate') ? 22 : 14;
    training = has('fate-honest') ? 0.97 : 0.92;
    mindDrain = has('fate-honest') ? 0 : has('fate-magnate') ? 1.25 : 0.35;
    reputationGrowth = has('fate-magnate') ? -0.8 : has('fate-honest') ? 0.3 : 0;
  }
  if (has('fate-legacy')) { chance += 0.055; upkeep += 6; description += ' 你也背负传承众人的长期供奉。'; }
  if (has('fate-insight')) { chance += 0.09; healthDrain += 0.7; description += ' 你以肉身承载更锋利的天机。'; }
  if (has('fate-balanced')) { training *= 0.96; mindDrain = Math.max(-0.6, mindDrain - 0.6); description += ' 你留出时光整理身心。'; }
  return { title, description, training, income, upkeep, healthDrain, mindDrain, foundationGrowth, reputationGrowth, chance };
}
