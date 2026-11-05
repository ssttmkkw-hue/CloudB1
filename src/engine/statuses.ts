export interface StatusDef {
  name: string;
  icon: string;
  kind: 'buff' | 'debuff' | 'power' | 'hidden';
  desc: string;
}

export const STATUSES: Record<string, StatusDef> = {
  strength: { name: '力量', icon: '💪', kind: 'buff', desc: '攻击伤害 +N（每段）' },
  dexterity: { name: '敏捷', icon: '🦶', kind: 'buff', desc: '卡牌获得的格挡 +N' },
  thorns: { name: '荆棘', icon: '🌵', kind: 'buff', desc: '被攻击时，对攻击者造成 N 点伤害' },
  tempThorns: { name: '临时荆棘', icon: '🌿', kind: 'buff', desc: '本回合内被攻击时，对攻击者造成 N 点伤害' },
  regen: { name: '再生', icon: '💚', kind: 'buff', desc: '回合结束回复 N 生命，层数 -1' },
  artifact: { name: '护符', icon: '🔰', kind: 'buff', desc: '抵消下一次负面状态' },
  vulnerable: { name: '易伤', icon: '💔', kind: 'debuff', desc: '受到的攻击伤害 +50%' },
  weak: { name: '虚弱', icon: '🥀', kind: 'debuff', desc: '造成的攻击伤害 -25%' },
  frail: { name: '脆弱', icon: '🩹', kind: 'debuff', desc: '获得的格挡 -25%' },
  poison: { name: '中毒', icon: '☠️', kind: 'debuff', desc: '回合开始失去 N 生命，层数 -1' },
  burn: { name: '灼烧', icon: '🔥', kind: 'debuff', desc: '回合结束受到 N 点伤害，随后层数减半' },
  frost: { name: '寒霜', icon: '❄️', kind: 'debuff', desc: '下一次攻击伤害 -N；达到 10 层时冻结' },
  shock: { name: '感电', icon: '⚡', kind: 'debuff', desc: '受到攻击时额外受到 N 点伤害，随后层数 -1' },
  mark: { name: '标记', icon: '🎯', kind: 'debuff', desc: '受到攻击时额外受到 N 点伤害' },
  frozen: { name: '冻结', icon: '🧊', kind: 'debuff', desc: '跳过下一个行动' },
  ritual: { name: '仪式', icon: '🕯️', kind: 'buff', desc: '回合结束获得 N 点力量' },
  // 玩家能力 / 临时效果
  nextBlock: { name: '后备格挡', icon: '🛡️', kind: 'power', desc: '下回合开始获得 N 格挡' },
  nextDraw: { name: '准备', icon: '🃏', kind: 'power', desc: '下回合额外抽 N 张牌' },
  nextEnergy: { name: '蓄能', icon: '🔋', kind: 'power', desc: '下回合额外获得 N 能量' },
  nextAtk: { name: '暗影', icon: '🌑', kind: 'power', desc: '下一张攻击牌每段伤害 +N' },
  unyield: { name: '不屈', icon: '🗿', kind: 'power', desc: '回合结束时若有格挡，获得 N 誓约' },
  oathWrath: { name: '守誓者之怒', icon: '⚜️', kind: 'power', desc: '每当获得誓约，对随机敌人造成 N 伤害' },
  standFirm: { name: '屹立', icon: '🏰', kind: 'power', desc: '直到下回合，每受到一次攻击获得 1 誓约' },
  bulwark: { name: '不灭壁垒', icon: '🧱', kind: 'power', desc: '回合开始时最多保留 N 点格挡' },
  oathAvatar: { name: '誓约化身', icon: '👑', kind: 'power', desc: '回合开始获得 N 誓约' },
  divine: { name: '神圣护佑', icon: '😇', kind: 'power', desc: '直到下回合，每次生命损失至多为 1' },
  knifeMaster: { name: '暗器大师', icon: '🗡️', kind: 'power', desc: '回合开始将 N 张飞刀加入手牌' },
  rhythm: { name: '致命节奏', icon: '🥁', kind: 'power', desc: '每回合打出第 4 张牌后获得 N 能量' },
  toxicHeart: { name: '剧毒之心', icon: '🖤', kind: 'power', desc: '施加的中毒 +1；回合开始对所有敌人施加 2×N 中毒' },
  nightfall: { name: '夜幕', icon: '🌙', kind: 'power', desc: '本回合攻击牌费用为 0' },
  shadowless: { name: '无影', icon: '👤', kind: 'power', desc: '每打出 0 费牌，获得 2×N 格挡并造成 2×N 伤害' },
  overload: { name: '元素过载', icon: '🌀', kind: 'power', desc: '每次触发共鸣，获得 N 格挡' },
  prism: { name: '三相棱镜', icon: '🔺', kind: 'power', desc: '每回合第一张元素牌必定共鸣' },
  frozenHeart: { name: '冰封之心', icon: '💠', kind: 'power', desc: '回合结束获得 5×N 格挡，对所有敌人施加 N 寒霜' },
  capacitor: { name: '电容', icon: '🔌', kind: 'power', desc: '敌人因感电受伤时抽 1 张牌（每回合至多 N 次）' },
  starfall: { name: '星辉降临', icon: '🌠', kind: 'power', desc: '回合开始时从抽牌堆选 1 张元素牌加入手牌' },
  elementMaster: { name: '元素宗师', icon: '🔮', kind: 'power', desc: '本回合打出过同元素牌即可共鸣' },
};

export const DEBUFFS = new Set(['vulnerable', 'weak', 'frail', 'poison', 'burn', 'frost', 'shock', 'mark', 'frozen']);
