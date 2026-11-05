import type { RelicDef } from '../engine/types';

export const RELIC_LIST: RelicDef[] = [
  // ---- 初始 ----
  { id: 'oath_badge', name: '誓约徽章', rarity: 'starter', cls: 'knight', art: '🎖️', desc: '战斗结束时回复 6 生命',
    onCombatEnd: (s) => { s.hp = Math.min(s.maxHp, s.hp + 6); } },
  { id: 'shadow_cloak', name: '影之斗篷', rarity: 'starter', cls: 'rogue', art: '🧥', desc: '每场战斗第一回合额外抽 2 张牌' },
  { id: 'element_prism', name: '元素棱晶', rarity: 'starter', cls: 'mage', art: '💎', desc: '每场战斗第一张元素牌必定触发共鸣' },
  // ---- 普通 ----
  { id: 'whetstone', name: '磨刀石', rarity: 'common', art: '🪨', desc: '拾取时随机升级 2 张攻击牌' },
  { id: 'anchor', name: '旧铁锚', rarity: 'common', art: '⚓', desc: '每场战斗第一回合获得 10 格挡',
    onCombatStart: (x) => x.block(10) },
  { id: 'blood_vial', name: '血瓶挂坠', rarity: 'common', art: '🩸', desc: '最大生命 +7',
    onPickup: (s) => { s.maxHp += 7; s.hp += 7; } },
  { id: 'lucky_coin', name: '幸运铜币', rarity: 'common', art: '🪙', desc: '获得时 +100 金币；商店价格 -5%',
    onPickup: (s) => { s.gold += 100; } },
  { id: 'war_drum', name: '战鼓', rarity: 'common', art: '🥁', desc: '每场战斗第一回合获得 1 能量',
    onTurnStart: (x) => { if (x.c.turn === 1) x.energy(1); } },
  { id: 'bone_charm', name: '碎骨护符', rarity: 'common', art: '🦴', desc: '每场战斗开始获得 1 力量',
    onCombatStart: (x) => x.apply('strength', 1, 'self') },
  { id: 'wormwood', name: '苦艾草', rarity: 'common', art: '🌿', desc: '每场战斗开始对所有敌人施加 1 易伤',
    onCombatStart: (x) => x.apply('vulnerable', 1, 'all') },
  { id: 'campfire_ember', name: '篝火余烬', rarity: 'common', art: '🔥', desc: '休息点回复量额外 +15% 最大生命' },
  { id: 'slingshot', name: '弹弓', rarity: 'common', art: '🪃', desc: '每回合打出第 1 张攻击牌时，额外对随机敌人造成 3 伤害',
    onCardPlayed: (x, _r, def) => {
      if (def.type !== 'attack' || x.c.tf.sling) return;
      x.c.tf.sling = 1;
      const al = x.alive();
      if (al.length) x.atk(3, { to: al[Math.floor(x.rand() * al.length)] });
    } },
  { id: 'silver_scale', name: '银质天平', rarity: 'common', art: '⚖️', desc: '卡牌奖励变为四选一' },
  // ---- 罕见 ----
  { id: 'hourglass', name: '沙漏', rarity: 'uncommon', art: '⌛', desc: '每 3 回合，抽 1 张牌并获得 1 能量',
    onTurnStart: (x) => { if (x.c.turn % 3 === 0) { x.draw(1); x.energy(1); } } },
  { id: 'ink_bottle', name: '墨水瓶', rarity: 'uncommon', art: '🖋️', desc: '每打出 10 张牌，抽 1 张牌',
    onCardPlayed: (x, r) => { r.n = (r.n ?? 0) + 1; if (r.n >= 10) { r.n = 0; x.draw(1); } } },
  { id: 'guard_brooch', name: '守卫胸针', rarity: 'uncommon', art: '📌', desc: '回合结束时若无格挡，获得 6 格挡',
    onTurnEnd: (x) => { if (x.c.player.block === 0) x.block(6); } },
  { id: 'viper_fang', name: '毒蛇牙', rarity: 'uncommon', art: '🐍', desc: '你施加的中毒额外 +1 层' },
  { id: 'frost_crystal', name: '冰晶石', rarity: 'uncommon', art: '❄️', desc: '每场战斗开始对所有敌人施加 2 寒霜',
    onCombatStart: (x) => x.apply('frost', 2, 'all') },
  { id: 'crown_shard', name: '王冠碎片', rarity: 'uncommon', art: '👑', desc: '精英战奖励额外一件遗物' },
  { id: 'alchemy_belt', name: '炼金腰带', rarity: 'uncommon', art: '🎒', desc: '药水栏 +2',
    onPickup: (s) => { s.potions.push(null, null); } },
  // ---- 稀有 ----
  { id: 'phoenix', name: '凤凰羽', rarity: 'rare', art: '🪶', desc: '死亡时以 30% 最大生命复活一次' },
  { id: 'astrolabe', name: '星盘', rarity: 'rare', art: '🧭', desc: '手牌上限 +2，每回合多抽 1 张' },
  { id: 'dark_ring', name: '暗金戒指', rarity: 'rare', art: '💍', desc: '每打出 3 张技能牌，获得 1 力量（本场战斗）',
    onCardPlayed: (x, _r, def) => {
      if (def.type !== 'skill') return;
      x.c.cf.ring = (x.c.cf.ring ?? 0) + 1;
      if (x.c.cf.ring % 3 === 0) x.apply('strength', 1, 'self');
    } },
  { id: 'vow_sword', name: '誓者之剑', rarity: 'rare', art: '🗡️', desc: '每回合首次消耗卡牌时，对所有敌人造成 5 伤害',
    onExhaust: (x) => { if (x.c.tf.vowSword) return; x.c.tf.vowSword = 1; for (const e of x.alive()) x.atk(5, { to: e }); } },
  { id: 'pocket_watch', name: '时光怀表', rarity: 'rare', art: '⏱️', desc: '回合结束时若手牌 ≤1 张，下回合额外抽 2 张',
    onTurnEnd: (x) => { if (x.c.hand.length <= 1) x.apply('nextDraw', 2, 'self'); } },
  // ---- Boss ----
  { id: 'abyss_core', name: '深渊之核', rarity: 'boss', art: '🌑', energy: 1, desc: '每回合能量 +1；每场战斗开始将 2 张眩晕洗入抽牌堆',
    onCombatStart: (x) => x.add('status_dazed', 2, 'draw') },
  { id: 'obsidian_throne', name: '黑曜石王座', rarity: 'boss', art: '🪑', energy: 1, desc: '每回合能量 +1；休息点无法回复生命' },
  { id: 'greedy_maw', name: '贪婪之口', rarity: 'boss', art: '👄', energy: 1, desc: '每回合能量 +1；卡牌奖励只能看到 2 张' },
  { id: 'fate_loom', name: '命运织机', rarity: 'boss', art: '🧶', desc: '拾取时随机移除牌组中 2 张基础牌' },
];

export const RELICS: Record<string, RelicDef> = Object.fromEntries(RELIC_LIST.map((r) => [r.id, r]));
