import type { CardDef } from '../../engine/types';

const R = 'rogue' as const;

export const ROGUE_CARDS: CardDef[] = [
  { id: 'rogue_stab', name: '刺击', cls: R, type: 'attack', rarity: 'basic', cost: 1, target: 'enemy', art: '🔪',
    v: { d: [6, 9] }, text: '造成 {d} 伤害', play: (x) => x.atk(x.v.d) },
  { id: 'rogue_dodge', name: '闪避', cls: R, type: 'skill', rarity: 'basic', cost: 1, target: 'none', art: '💨',
    v: { b: [5, 8] }, text: '获得 {b} 格挡', play: (x) => x.block(x.v.b) },
  { id: 'rogue_shadow_step', name: '暗影步', cls: R, type: 'skill', rarity: 'basic', cost: 0, target: 'none', art: '🌑',
    v: { n: [3, 5] }, text: '抽 1 张牌；本回合下一张攻击牌每段伤害 +{n}',
    play: (x) => { x.draw(1); x.apply('nextAtk', x.v.n, 'self'); } },
  { id: 'rogue_shiv', name: '飞刀', cls: R, type: 'attack', rarity: 'token', cost: 0, target: 'enemy', art: '🗡️', kw: ['exhaust'],
    v: { d: [3, 5] }, text: '造成 {d} 伤害', play: (x) => x.atk(x.v.d) },
  { id: 'rogue_twin_blades', name: '双刃', cls: R, type: 'attack', rarity: 'common', cost: 1, target: 'enemy', art: '⚔️',
    v: { d: [4, 6] }, text: '造成 {d} 伤害 2 次', play: (x) => x.atk(x.v.d, { times: 2 }) },
  { id: 'rogue_envenom', name: '淬毒', cls: R, type: 'skill', rarity: 'common', cost: 1, target: 'enemy', art: '🧪',
    v: { p: [5, 7] }, text: '施加 {p} 中毒', play: (x) => x.apply('poison', x.v.p) },
  { id: 'rogue_throw_knives', name: '抛掷飞刀', cls: R, type: 'skill', rarity: 'common', cost: 1, target: 'none', art: '🎯',
    v: { n: [2, 3] }, text: '将 {n} 张飞刀加入手牌', play: (x) => x.add('rogue_shiv', x.v.n, 'hand') },
  { id: 'rogue_dash', name: '疾行', cls: R, type: 'skill', rarity: 'common', cost: 0, target: 'none', art: '🏃',
    v: { b: [3, 5] }, text: '获得 {b} 格挡，抽 1 张牌', play: (x) => { x.block(x.v.b); x.draw(1); } },
  { id: 'rogue_throat_cut', name: '割喉', cls: R, type: 'attack', rarity: 'common', cost: 1, target: 'enemy', art: '🩸',
    v: { d: [7, 9], e: [7, 9] }, text: '造成 {d} 伤害；连击 ≥3 时额外造成 {e} 伤害',
    play: (x) => x.atk(x.v.d + (x.combo >= 3 ? x.v.e : 0)) },
  { id: 'rogue_smoke', name: '烟雾弹', cls: R, type: 'skill', rarity: 'common', cost: 1, target: 'none', art: '💭',
    v: { b: [7, 10] }, text: '获得 {b} 格挡，对所有敌人施加 1 虚弱',
    play: (x) => { x.block(x.v.b); x.apply('weak', 1, 'all'); } },
  { id: 'rogue_poison_blade', name: '毒刃', cls: R, type: 'attack', rarity: 'common', cost: 1, target: 'enemy', art: '🐍',
    v: { d: [5, 7], p: [3, 4] }, text: '造成 {d} 伤害，施加 {p} 中毒', play: (x) => { x.atk(x.v.d); x.apply('poison', x.v.p); } },
  { id: 'rogue_mark', name: '标记目标', cls: R, type: 'skill', rarity: 'common', cost: 0, target: 'enemy', art: '🎯',
    v: { n: [2, 3] }, text: '施加 {n} 标记', play: (x) => x.apply('mark', x.v.n) },
  { id: 'rogue_roll', name: '翻滚', cls: R, type: 'skill', rarity: 'common', cost: 1, target: 'none', art: '🤸',
    v: { b: [6, 9] }, text: '获得 {b} 格挡；下回合额外抽 1 张牌',
    play: (x) => { x.block(x.v.b); x.apply('nextDraw', 1, 'self'); } },
  { id: 'rogue_combo_kick', name: '连环踢', cls: R, type: 'attack', rarity: 'common', cost: 0, target: 'enemy', art: '🦵',
    v: { d: [3, 4] }, text: '造成 {d} 伤害；连击 ≥2 时再造成 {d} 伤害',
    play: (x) => x.atk(x.v.d, { times: x.combo >= 2 ? 2 : 1 }) },
  { id: 'rogue_poison_cloud', name: '毒雾', cls: R, type: 'skill', rarity: 'uncommon', cost: 2, target: 'none', art: '☁️',
    v: { p: [6, 8] }, text: '对所有敌人施加 {p} 中毒', play: (x) => x.apply('poison', x.v.p, 'all') },
  { id: 'rogue_blade_storm', name: '刀刃风暴', cls: R, type: 'attack', rarity: 'uncommon', cost: 1, target: 'none', art: '🌀',
    v: { n: [2, 3] }, text: '对所有敌人造成 连击×{n} 伤害',
    play: (x) => { if (x.combo > 0) x.atk(x.combo * x.v.n, { to: 'all' }); } },
  { id: 'rogue_knife_master', name: '暗器大师', cls: R, type: 'power', rarity: 'uncommon', cost: 1, target: 'none', art: '🗡️',
    v: { n: [1, 2] }, text: '回合开始时将 {n} 张飞刀加入手牌', play: (x) => x.apply('knifeMaster', x.v.n, 'self') },
  { id: 'rogue_rhythm', name: '致命节奏', cls: R, type: 'power', rarity: 'uncommon', cost: 1, upCost: 0, target: 'none', art: '🥁',
    text: '每回合打出第 4 张牌后，获得 1 能量', play: (x) => x.apply('rhythm', 1, 'self') },
  { id: 'rogue_catalyst', name: '毒性催化', cls: R, type: 'skill', rarity: 'uncommon', cost: 1, target: 'enemy', art: '⚗️',
    kw: ['exhaust'], upKw: [], text: '使目标中毒层数翻倍',
    play: (x) => { const t = x.target; if (t && t.st.poison) t.st.poison *= 2; } },
  { id: 'rogue_shadow_clone', name: '影分身', cls: R, type: 'skill', rarity: 'uncommon', cost: 2, upCost: 1, target: 'none', art: '👥',
    text: '选择手牌中 1 张攻击牌，将 2 张复制加入手牌',
    play: (x) => {
      const opts = x.c.hand.filter((h) => x.typeOf(h.id) === 'attack');
      x.choose({ action: 'shadowClone', title: '选择要复制的攻击牌', min: 1, max: 1, options: opts.map((h) => ({ key: h.uid, card: h })) });
    } },
  { id: 'rogue_backstab', name: '背刺', cls: R, type: 'attack', rarity: 'uncommon', cost: 0, target: 'enemy', art: '🔪', kw: ['innate', 'exhaust'],
    v: { d: [10, 14] }, text: '造成 {d} 伤害', play: (x) => x.atk(x.v.d) },
  { id: 'rogue_foresight', name: '预判', cls: R, type: 'skill', rarity: 'uncommon', cost: 1, target: 'enemy', art: '👁️',
    v: { b: [8, 11] }, text: '获得 {b} 格挡；若目标意图为攻击，抽 2 张牌',
    play: (x) => { x.block(x.v.b); const it = x.target ? x.intentOf(x.target) : null; if (it === 'attack' || it === 'atkDebuff' || it === 'atkBlock') x.draw(2); } },
  { id: 'rogue_thousand_blades', name: '千刃', cls: R, type: 'attack', rarity: 'rare', cost: 1, target: 'none', art: '✴️',
    v: { d: [3, 4] }, text: '对随机敌人造成 {d} 伤害，次数等于连击',
    play: (x) => { if (x.combo > 0) x.atk(x.v.d, { to: 'random', times: x.combo }); } },
  { id: 'rogue_toxic_heart', name: '剧毒之心', cls: R, type: 'power', rarity: 'rare', cost: 2, upCost: 1, target: 'none', art: '🖤',
    text: '你施加的中毒 +1；回合开始对所有敌人施加 2 中毒', play: (x) => x.apply('toxicHeart', 1, 'self') },
  { id: 'rogue_nightfall', name: '夜幕降临', cls: R, type: 'skill', rarity: 'rare', cost: 1, target: 'none', art: '🌙',
    kw: ['exhaust'], upKw: ['exhaust', 'retain'], text: '本回合你的攻击牌费用变为 0', play: (x) => x.apply('nightfall', 1, 'self') },
  { id: 'rogue_execute', name: '处决', cls: R, type: 'attack', rarity: 'rare', cost: 2, target: 'enemy', art: '💀', kw: ['exhaust'],
    v: { d: [15, 20] }, text: '造成 {d} 伤害；若目标生命低于 30%（非 Boss）直接击杀',
    play: (x) => {
      x.atk(x.v.d);
      const t = x.target;
      if (t && !t.dead && x.c.kind !== 'boss' && t.hp < t.maxHp * 0.3) x.atk(t.hp + t.block + 999, { to: t });
    } },
  { id: 'rogue_shadowless', name: '无影', cls: R, type: 'power', rarity: 'rare', cost: 3, upCost: 2, target: 'none', art: '👤',
    text: '每打出一张 0 费牌，获得 2 格挡并对随机敌人造成 2 伤害', play: (x) => x.apply('shadowless', 1, 'self') },
  { id: 'rogue_detonate', name: '毒爆', cls: R, type: 'attack', rarity: 'rare', cost: 1, target: 'enemy', art: '💥', kw: ['exhaust'],
    v: { n: [2, 3] }, text: '清除目标所有中毒，造成 层数×{n} 伤害',
    play: (x) => {
      const t = x.target;
      if (!t) return;
      const p = t.st.poison ?? 0;
      delete t.st.poison;
      if (p > 0) x.atk(p * x.v.n);
    } },
];

