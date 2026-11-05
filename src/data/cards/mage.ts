import type { CardDef, Element } from '../../engine/types';

const M = 'mage' as const;
const ELEMENT_STATUS: Record<Element, string> = { fire: 'burn', frost: 'frost', lightning: 'shock' };
export const ELEMENT_NAME: Record<Element, string> = { fire: '火', frost: '霜', lightning: '雷' };

export const MAGE_CARDS: CardDef[] = [
  { id: 'mage_spark', name: '火花', cls: M, type: 'attack', rarity: 'basic', cost: 1, target: 'enemy', el: 'fire', art: '🔥',
    v: { d: [6, 9] }, text: '造成 {d} 伤害', play: (x) => x.atk(x.v.d) },
  { id: 'mage_ice_shield', name: '冰盾', cls: M, type: 'skill', rarity: 'basic', cost: 1, target: 'none', el: 'frost', art: '🧊',
    v: { b: [5, 8] }, text: '获得 {b} 格挡', play: (x) => x.block(x.v.b) },
  { id: 'mage_attune', name: '元素调和', cls: M, type: 'skill', rarity: 'basic', cost: 1, upCost: 0, target: 'none', art: '🔮',
    text: '抽 2 张牌；选择一种元素作为「上一元素」',
    play: (x) => {
      x.draw(2);
      x.choose({ action: 'setElement', title: '选择一种元素（下一张同元素牌将共鸣）', min: 1, max: 1,
        options: (['fire', 'frost', 'lightning'] as Element[]).map((e) => ({ key: e, label: ELEMENT_NAME[e] })) });
    } },
  { id: 'mage_fireball', name: '火球术', cls: M, type: 'attack', rarity: 'common', cost: 2, target: 'enemy', el: 'fire', art: '☄️',
    v: { d: [12, 16], n: [3, 4] }, text: '造成 {d} 伤害，施加 {n} 灼烧。共鸣：再施加 {n} 灼烧',
    play: (x) => { x.atk(x.v.d); x.apply('burn', x.v.n); if (x.res) x.apply('burn', x.v.n); } },
  { id: 'mage_frost_ray', name: '霜冻射线', cls: M, type: 'attack', rarity: 'common', cost: 1, target: 'enemy', el: 'frost', art: '❄️',
    v: { d: [6, 8], n: [3, 4] }, text: '造成 {d} 伤害，施加 {n} 寒霜。共鸣：获得 5 格挡',
    play: (x) => { x.atk(x.v.d); x.apply('frost', x.v.n); if (x.res) x.block(5); } },
  { id: 'mage_arc', name: '电弧', cls: M, type: 'attack', rarity: 'common', cost: 1, target: 'enemy', el: 'lightning', art: '⚡',
    v: { d: [5, 7], n: [2, 3] }, text: '造成 {d} 伤害，施加 {n} 感电。共鸣：抽 1 张牌',
    play: (x) => { x.atk(x.v.d); x.apply('shock', x.v.n); if (x.res) x.draw(1); } },
  { id: 'mage_ice_armor', name: '寒冰护甲', cls: M, type: 'skill', rarity: 'common', cost: 1, target: 'none', el: 'frost', art: '🥶',
    v: { b: [8, 11] }, text: '获得 {b} 格挡。共鸣：对所有敌人施加 2 寒霜',
    play: (x) => { x.block(x.v.b); if (x.res) x.apply('frost', 2, 'all'); } },
  { id: 'mage_chain_lightning', name: '链状闪电', cls: M, type: 'attack', rarity: 'common', cost: 2, target: 'none', el: 'lightning', art: '🌩️',
    v: { d: [6, 8], n: [1, 2] }, text: '对所有敌人造成 {d} 伤害，施加 {n} 感电',
    play: (x) => { x.atk(x.v.d, { to: 'all' }); x.apply('shock', x.v.n, 'all'); } },
  { id: 'mage_ember', name: '余烬', cls: M, type: 'attack', rarity: 'common', cost: 0, target: 'enemy', el: 'fire', art: '✨',
    v: { d: [3, 4], n: [2, 3] }, text: '造成 {d} 伤害，施加 {n} 灼烧', play: (x) => { x.atk(x.v.d); x.apply('burn', x.v.n); } },
  { id: 'mage_meditate', name: '冥想', cls: M, type: 'skill', rarity: 'common', cost: 1, target: 'none', art: '🧘',
    v: { n: [2, 3] }, text: '抽 {n} 张牌，弃 1 张牌',
    play: (x) => {
      x.draw(x.v.n);
      x.choose({ action: 'discard', title: '选择 1 张牌弃掉', min: 1, max: 1, options: x.c.hand.map((h) => ({ key: h.uid, card: h })) });
    } },
  { id: 'mage_icicle', name: '冰锥', cls: M, type: 'attack', rarity: 'common', cost: 1, target: 'enemy', el: 'frost', art: '🔱',
    v: { d: [8, 11], e: [4, 5] }, text: '造成 {d} 伤害；目标有寒霜时额外造成 {e} 伤害',
    play: (x) => x.atk(x.v.d + ((x.target?.st.frost ?? 0) > 0 ? x.v.e : 0)) },
  { id: 'mage_static_barrier', name: '静电屏障', cls: M, type: 'skill', rarity: 'common', cost: 1, target: 'none', el: 'lightning', art: '🔋',
    v: { b: [6, 9] }, text: '获得 {b} 格挡，本回合获得 2 荆棘。共鸣：荆棘翻倍',
    play: (x) => { x.block(x.v.b); x.apply('tempThorns', x.res ? 4 : 2, 'self'); } },
  { id: 'mage_flame_touch', name: '烈焰之触', cls: M, type: 'skill', rarity: 'common', cost: 1, target: 'none', el: 'fire', art: '🖐️',
    v: { n: [3, 5] }, text: '对所有敌人施加 {n} 灼烧', play: (x) => x.apply('burn', x.v.n, 'all') },
  { id: 'mage_overload', name: '元素过载', cls: M, type: 'power', rarity: 'uncommon', cost: 1, target: 'none', art: '🌀',
    v: { n: [4, 6] }, text: '每次触发共鸣，获得 {n} 格挡', play: (x) => x.apply('overload', x.v.n, 'self') },
  { id: 'mage_meteor', name: '陨石', cls: M, type: 'attack', rarity: 'uncommon', cost: 3, target: 'enemy', el: 'fire', art: '🌋',
    v: { d: [24, 30], n: [5, 7] }, text: '造成 {d} 伤害，施加 {n} 灼烧', play: (x) => { x.atk(x.v.d); x.apply('burn', x.v.n); } },
  { id: 'mage_absolute_zero', name: '绝对零度', cls: M, type: 'skill', rarity: 'uncommon', cost: 2, upCost: 1, target: 'enemy', el: 'frost', art: '🧊',
    text: '目标寒霜层数翻倍。共鸣：直接冻结目标',
    play: (x) => {
      const t = x.target;
      if (!t) return;
      if (x.res) { x.apply('frost', 99); return; }
      const f = t.st.frost ?? 0;
      if (f > 0) x.apply('frost', f);
    } },
  { id: 'mage_thunderclap', name: '雷霆万钧', cls: M, type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy', el: 'lightning', art: '🌩️',
    v: { n: [4, 5] }, text: '造成 目标感电×{n} 伤害',
    play: (x) => { const s = x.target?.st.shock ?? 0; if (s > 0) x.atk(s * x.v.n); } },
  { id: 'mage_prism', name: '三相棱镜', cls: M, type: 'power', rarity: 'uncommon', cost: 1, target: 'none', art: '🔺', upKw: ['innate'],
    text: '每回合第一张元素牌必定触发共鸣', play: (x) => x.apply('prism', 1, 'self') },
  { id: 'mage_mana_surge', name: '法力涌动', cls: M, type: 'skill', rarity: 'uncommon', cost: 0, target: 'none', art: '💠', kw: ['exhaust'],
    v: { n: [1, 2] }, text: '获得 {n} 能量，抽 1 张牌', play: (x) => { x.energy(x.v.n); x.draw(1); } },
  { id: 'mage_ash_dance', name: '灰烬之舞', cls: M, type: 'attack', rarity: 'uncommon', cost: 1, target: 'none', el: 'fire', art: '💃',
    v: { d: [4, 6], e: [8, 11] }, text: '对所有敌人造成 {d} 伤害；对有灼烧的敌人改为 {e}',
    play: (x) => { for (const e of x.alive()) x.atk((e.st.burn ?? 0) > 0 ? x.v.e : x.v.d, { to: e }); } },
  { id: 'mage_frozen_heart', name: '冰封之心', cls: M, type: 'power', rarity: 'uncommon', cost: 2, upCost: 1, target: 'none', el: 'frost', art: '💠',
    text: '回合结束获得 5 格挡，并对所有敌人施加 1 寒霜', play: (x) => x.apply('frozenHeart', 1, 'self') },
  { id: 'mage_capacitor', name: '电容', cls: M, type: 'power', rarity: 'uncommon', cost: 1, target: 'none', el: 'lightning', art: '🔌',
    v: { n: [2, 3] }, text: '敌人因感电受伤时，抽 1 张牌（每回合至多 {n} 次）', play: (x) => x.apply('capacitor', x.v.n, 'self') },
  { id: 'mage_element_storm', name: '元素风暴', cls: M, type: 'attack', rarity: 'rare', cost: 'X', target: 'none', art: '🌈',
    text: '随机触发 X 次元素冲击（8 伤害 + 对应元素 2 层状态）', upText: '随机触发 X+1 次元素冲击（8 伤害 + 对应元素 2 层状态）',
    play: (x) => {
      const n = x.x + (x.up ? 1 : 0);
      const els: Element[] = ['fire', 'frost', 'lightning'];
      for (let i = 0; i < n; i++) {
        const al = x.alive();
        if (!al.length) return;
        const t = al[Math.floor(x.rand() * al.length)];
        const el = els[Math.floor(x.rand() * 3)];
        x.atk(8, { to: t });
        x.apply(ELEMENT_STATUS[el], 2, t);
      }
    } },
  { id: 'mage_starfall', name: '星辉降临', cls: M, type: 'power', rarity: 'rare', cost: 2, upCost: 1, target: 'none', art: '🌠',
    text: '回合开始时，从抽牌堆选择 1 张元素牌加入手牌', play: (x) => x.apply('starfall', 1, 'self') },
  { id: 'mage_supernova', name: '超新星', cls: M, type: 'attack', rarity: 'rare', cost: 2, target: 'none', el: 'fire', art: '🌟', kw: ['exhaust'],
    v: { n: [2, 3] }, text: '清除所有敌人的灼烧，对每名敌人造成其灼烧×{n} 伤害',
    play: (x) => {
      for (const e of x.alive()) {
        const b = e.st.burn ?? 0;
        delete e.st.burn;
        if (b > 0) x.atk(b * x.v.n, { to: e });
      }
    } },
  { id: 'mage_eternal_winter', name: '永冬', cls: M, type: 'skill', rarity: 'rare', cost: 3, upCost: 2, target: 'none', el: 'frost', art: '🏔️',
    kw: ['exhaust'], text: '冻结所有敌人', play: (x) => x.apply('frost', 99, 'all') },
  { id: 'mage_heaven_thunder', name: '天雷引', cls: M, type: 'attack', rarity: 'rare', cost: 1, target: 'enemy', el: 'lightning', art: '⛈️',
    v: { d: [10, 14] }, text: '造成 {d} 伤害；本回合每打出过 1 张雷牌，重复 1 次',
    play: (x) => x.atk(x.v.d, { times: 1 + x.c.elsPlayed.filter((e) => e === 'lightning').length }) },
  { id: 'mage_element_master', name: '元素宗师', cls: M, type: 'power', rarity: 'rare', cost: 3, upCost: 2, target: 'none', art: '🧙',
    text: '共鸣条件改为「本回合打出过同元素牌」', play: (x) => x.apply('elementMaster', 1, 'self') },
];

