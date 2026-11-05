import type { CardDef } from '../../engine/types';
import { CARDS } from './index';
import { POTIONS } from '../potions';

const N = 'neutral' as const;

export const NEUTRAL_CARDS: CardDef[] = [
  { id: 'n_bandage', name: '应急绷带', cls: N, type: 'skill', rarity: 'uncommon', cost: 0, target: 'none', art: '🩹', kw: ['exhaust'],
    v: { n: [4, 6] }, text: '回复 {n} 生命', play: (x) => x.heal(x.v.n) },
  { id: 'n_frenzy', name: '狂热', cls: N, type: 'skill', rarity: 'uncommon', cost: 0, target: 'none', art: '🔥', kw: ['exhaust'],
    v: { n: [2, 3] }, text: '抽 {n} 张牌', play: (x) => x.draw(x.v.n) },
  { id: 'n_alchemy', name: '炼金药剂', cls: N, type: 'skill', rarity: 'uncommon', cost: 1, upCost: 0, target: 'none', art: '⚗️', kw: ['exhaust'],
    text: '获得 1 瓶随机药水',
    play: (x) => {
      const slot = x.s.potions.indexOf(null);
      if (slot < 0) return;
      const ids = Object.keys(POTIONS);
      x.s.potions[slot] = ids[Math.floor(x.rand() * ids.length)];
    } },
  { id: 'n_insight', name: '洞察', cls: N, type: 'skill', rarity: 'uncommon', cost: 0, target: 'none', art: '🔍',
    v: { n: [3, 5] }, text: '查看抽牌堆顶 {n} 张，选 1 张加入手牌',
    play: (x) => {
      const top = x.c.draw.slice(-x.v.n).reverse();
      x.choose({ action: 'scry', title: '选择 1 张加入手牌', min: 1, max: 1, options: top.map((h) => ({ key: h.uid, card: h })) });
    } },
  { id: 'n_quick_strike', name: '迅捷之击', cls: N, type: 'attack', rarity: 'uncommon', cost: 0, target: 'enemy', art: '⚡', kw: ['exhaust'],
    v: { d: [6, 9] }, text: '造成 {d} 伤害', play: (x) => x.atk(x.v.d) },
  { id: 'n_mithril', name: '秘银护符', cls: N, type: 'skill', rarity: 'uncommon', cost: 1, target: 'none', art: '🔰',
    v: { b: [4, 7] }, text: '获得 {b} 格挡，获得 1 护符', play: (x) => { x.block(x.v.b); x.apply('artifact', 1, 'self'); } },
  { id: 'n_inspiration', name: '灵光一闪', cls: N, type: 'skill', rarity: 'rare', cost: 1, upCost: 0, target: 'none', art: '💡', kw: ['exhaust'],
    text: '从 3 张随机本职业牌中选 1 张加入手牌，本回合费用为 0',
    play: (x) => {
      const pool = Object.values(CARDS).filter((d) => d.cls === x.s.cls && ['common', 'uncommon', 'rare'].includes(d.rarity));
      const picks: CardDef[] = [];
      while (picks.length < 3 && picks.length < pool.length) {
        const d = pool[Math.floor(x.rand() * pool.length)];
        if (!picks.includes(d)) picks.push(d);
      }
      x.choose({ action: 'inspire', title: '选择 1 张加入手牌（本回合 0 费）', min: 1, max: 1,
        options: picks.map((d, i) => ({ key: d.id, card: { uid: 'preview' + i, id: d.id, up: false } })) });
    } },
  { id: 'n_sands', name: '时之沙', cls: N, type: 'skill', rarity: 'rare', cost: 2, upCost: 1, target: 'none', art: '⏳', kw: ['exhaust'],
    text: '下回合额外抽 3 张牌并获得 1 能量', play: (x) => { x.apply('nextDraw', 3, 'self'); x.apply('nextEnergy', 1, 'self'); } },
  { id: 'n_fate_dice', name: '命运骰子', cls: N, type: 'skill', rarity: 'rare', cost: 1, target: 'none', art: '🎲',
    v: { n: [1, 2] }, text: '弃掉所有手牌，抽等量 +{n} 张牌',
    play: (x) => { const k = x.c.hand.length; x.c.discard.push(...x.c.hand.splice(0)); x.draw(k + x.v.n); } },
  { id: 'n_philosopher', name: '贤者之石', cls: N, type: 'skill', rarity: 'rare', cost: 0, target: 'none', art: '💎',
    kw: ['exhaust'], upKw: ['exhaust', 'innate'], text: '本场战斗中升级手牌中所有牌',
    play: (x) => { for (const h of x.c.hand) h.up = true; } },
];

export const CURSE_CARDS: CardDef[] = [
  { id: 'curse_rot', name: '腐蚀', cls: 'curse', type: 'curse', rarity: 'special', cost: null, target: 'none', art: '🦠',
    kw: ['unplayable'], text: '回合结束时若在手牌，失去 1 生命' },
  { id: 'curse_hesitation', name: '迟疑', cls: 'curse', type: 'curse', rarity: 'special', cost: null, target: 'none', art: '🌫️',
    kw: ['unplayable'], text: '在手牌中时，你每回合第一张牌费用 +1' },
  { id: 'curse_fear', name: '恐惧', cls: 'curse', type: 'curse', rarity: 'special', cost: null, target: 'none', art: '😱',
    kw: ['unplayable'], text: '抽到时随机弃 1 张手牌' },
  { id: 'curse_shackles', name: '枷锁', cls: 'curse', type: 'curse', rarity: 'special', cost: 2, target: 'none', art: '⛓️',
    kw: ['exhaust'], text: '占据手牌。可花费 2 能量将其消耗' },
  { id: 'status_dazed', name: '眩晕', cls: 'status', type: 'status', rarity: 'special', cost: null, target: 'none', art: '💫',
    kw: ['unplayable', 'ethereal'], text: '' },
  { id: 'status_burn', name: '灼伤', cls: 'status', type: 'status', rarity: 'special', cost: null, target: 'none', art: '♨️',
    kw: ['unplayable'], text: '回合结束时若在手牌，受到 2 伤害' },
];
