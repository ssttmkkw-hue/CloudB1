import type { PotionDef } from '../engine/types';

export const POTION_LIST: PotionDef[] = [
  { id: 'fire', name: '火焰药水', rarity: 'common', art: '🧨', target: 'enemy', desc: '对目标造成 20 伤害', use: (x) => x.atk(20, { to: x.target! }) },
  { id: 'shield', name: '护盾药水', rarity: 'common', art: '🛡️', target: 'none', desc: '获得 12 格挡', use: (x) => x.block(12) },
  { id: 'strength', name: '力量药水', rarity: 'common', art: '💪', target: 'none', desc: '获得 2 力量', use: (x) => x.apply('strength', 2, 'self') },
  { id: 'dexterity', name: '敏捷药水', rarity: 'common', art: '🦶', target: 'none', desc: '获得 2 敏捷', use: (x) => x.apply('dexterity', 2, 'self') },
  { id: 'energy', name: '能量药水', rarity: 'common', art: '🔋', target: 'none', desc: '获得 2 能量', use: (x) => x.energy(2) },
  { id: 'swift', name: '迅捷药水', rarity: 'common', art: '🌀', target: 'none', desc: '抽 3 张牌', use: (x) => x.draw(3) },
  { id: 'poison', name: '剧毒药水', rarity: 'uncommon', art: '☠️', target: 'enemy', desc: '施加 8 中毒', use: (x) => x.apply('poison', 8) },
  { id: 'fear', name: '恐惧药水', rarity: 'uncommon', art: '😨', target: 'enemy', desc: '施加 3 易伤', use: (x) => x.apply('vulnerable', 3) },
  { id: 'regen', name: '再生药水', rarity: 'uncommon', art: '💚', target: 'none', desc: '获得 5 再生', use: (x) => x.apply('regen', 5, 'self') },
  { id: 'cleanse', name: '清净药水', rarity: 'uncommon', art: '💧', target: 'none', desc: '移除自身所有减益，获得 1 护符',
    use: (x) => {
      const p = x.c.player;
      for (const k of ['vulnerable', 'weak', 'frail', 'poison', 'burn']) delete p.st[k];
      x.apply('artifact', 1, 'self');
    } },
  { id: 'fairy', name: '精灵瓶', rarity: 'rare', art: '🧚', target: 'none', passive: true, desc: '死亡时自动使用：以 30% 最大生命复活', use: () => {} },
  { id: 'forge', name: '熔炉药水', rarity: 'rare', art: '⚒️', target: 'none', desc: '本场战斗中升级手牌中所有牌',
    use: (x) => { for (const h of x.c.hand) h.up = true; } },
];

export const POTIONS: Record<string, PotionDef> = Object.fromEntries(POTION_LIST.map((p) => [p.id, p]));
