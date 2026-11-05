import type { AiCtx, EnemyDef, EnemyState } from '../engine/types';

/** 按顺序循环 */
const cycle = (ids: string[], offset = 0) => (e: EnemyState) => ids[(e.hist.length + offset) % ids.length];
/** 交替且首个随机 */
const alternate = (a: string, b: string) => (e: EnemyState, x: AiCtx) => {
  if (!e.hist.length) return x.rand() < 0.5 ? a : b;
  return x.last() === a ? b : a;
};

export const ENEMY_LIST: EnemyDef[] = [
  // ================= 第一层 · 沉骨墓窟 =================
  {
    id: 'rat', name: '腐骨鼠', tier: 'normal', act: 1, hp: [12, 15], art: '🐀', desc: '成群出没，啃咬与尖叫交替。',
    moves: [
      { id: 'bite', name: '啃咬', intent: 'attack', dmg: 4 },
      { id: 'screech', name: '尖叫', intent: 'debuff', act: (x) => x.apply('weak', 1, 'player') },
    ],
    next: alternate('bite', 'screech'),
  },
  {
    id: 'bat', name: '墓穴蝙蝠', tier: 'normal', act: 1, hp: [14, 18], art: '🦇', desc: '俯冲两次；每 3 回合吸血一次。',
    moves: [
      { id: 'dive', name: '俯冲', intent: 'attack', dmg: 3, hits: 2 },
      { id: 'drain', name: '吸血', intent: 'attack', dmg: 5, onHit: (x) => x.heal(x.lastHpDealt) },
    ],
    next: (e) => (e.hist.length % 3 === 2 ? 'drain' : 'dive'),
  },
  {
    id: 'skeleton', name: '骸骨步兵', tier: 'normal', act: 1, hp: [38, 42], art: '💀', desc: '先举盾，再连续劈砍两次。',
    moves: [
      { id: 'guard', name: '盾防', intent: 'block', act: (x) => x.block(8) },
      { id: 'slash', name: '劈砍', intent: 'attack', dmg: 9 },
    ],
    next: cycle(['guard', 'slash', 'slash']),
  },
  {
    id: 'slime', name: '黏菌团', tier: 'normal', act: 1, hp: [45, 50], art: '🟢', desc: '攻击会塞入眩晕；生命降至一半时分裂。',
    moves: [
      { id: 'goo', name: '黏液攻击', intent: 'atkDebuff', dmg: 7, act: (x) => x.addCard('status_dazed', 1, 'discard') },
      { id: 'lick', name: '舔舐', intent: 'debuff', act: (x) => x.apply('frail', 1, 'player') },
    ],
    next: (_e, x) => (x.repeats('goo') >= 2 ? 'lick' : x.rand() < 0.7 ? 'goo' : 'lick'),
    onDamaged: (x) => {
      const e = x.e;
      if (e.mem.split || e.hp > e.maxHp / 2) return;
      e.mem.split = 1;
      const hp = Math.max(5, Math.floor(e.hp * 0.7));
      e.dead = true;
      e.hp = 0;
      x.summon('small_slime', hp);
      x.summon('small_slime', hp);
    },
  },
  {
    id: 'small_slime', name: '小黏菌', tier: 'normal', act: 1, hp: [10, 12], art: '🟩', desc: '由黏菌团分裂而来。',
    moves: [
      { id: 'tackle', name: '撞击', intent: 'attack', dmg: 4 },
      { id: 'spit', name: '吐酸', intent: 'debuff', act: (x) => x.apply('frail', 1, 'player') },
    ],
    next: alternate('tackle', 'spit'),
  },
  {
    id: 'thief', name: '盗墓贼', tier: 'normal', act: 1, hp: [30, 34], art: '🥷', desc: '偷走金币后放烟雾逃跑。击杀可夺回金币。',
    moves: [
      { id: 'steal', name: '偷窃', intent: 'attack', dmg: 6,
        onHit: (x) => { const n = Math.min(15, x.s.gold); x.s.gold -= n; x.e.mem.stolen = (x.e.mem.stolen ?? 0) + n; } },
      { id: 'smoke', name: '烟雾', intent: 'block', act: (x) => x.block(6) },
      { id: 'flee', name: '逃跑', intent: 'escape', act: (x) => { x.e.escaped = true; } },
    ],
    next: cycle(['steal', 'steal', 'smoke', 'flee']),
  },
  {
    id: 'cultist', name: '邪教侍僧', tier: 'normal', act: 1, hp: [46, 50], art: '🧙‍♂️', desc: '先进行仪式，之后每回合变得更强。',
    moves: [
      { id: 'ritual', name: '仪式', intent: 'buff', act: (x) => { x.e.mem.ritualFresh = 1; x.apply('ritual', 2, 'self'); } },
      { id: 'strike', name: '暗刃', intent: 'attack', dmg: 6 },
    ],
    next: (e) => (e.hist.length === 0 ? 'ritual' : 'strike'),
  },
  {
    id: 'spider', name: '蛛网潜伏者', tier: 'normal', act: 1, hp: [32, 36], art: '🕷️', desc: '吐丝削弱你，再狠狠撕咬。',
    moves: [
      { id: 'web', name: '吐丝', intent: 'debuff', act: (x) => { x.apply('frail', 2, 'player'); x.apply('weak', 2, 'player'); } },
      { id: 'bite', name: '撕咬', intent: 'attack', dmg: 11 },
    ],
    next: cycle(['web', 'bite']),
  },
  {
    id: 'gargoyle', name: '石像鬼雏', tier: 'normal', act: 1, hp: [28, 30], art: '🗿', desc: '石化获得格挡与力量，再出爪。',
    moves: [
      { id: 'petrify', name: '石化', intent: 'block', act: (x) => { x.block(12); x.apply('strength', 1, 'self'); } },
      { id: 'claw', name: '爪击', intent: 'attack', dmg: 7 },
    ],
    next: cycle(['petrify', 'claw']),
  },
  // ---- 精英 ----
  {
    id: 'bone_captain', name: '骸骨骑士长', tier: 'elite', act: 1, hp: [82, 86], art: '☠️', desc: '战吼强化全体，重斩，举盾反击。',
    moves: [
      { id: 'warcry', name: '战吼', intent: 'buff', act: (x) => { for (const a of x.allies()) x.apply('strength', 2, a); } },
      { id: 'heavy', name: '重斩', intent: 'attack', dmg: 14 },
      { id: 'guard', name: '盾反', intent: 'block', act: (x) => { x.block(15); x.e.st.thorns = 3; } },
    ],
    next: cycle(['warcry', 'heavy', 'guard', 'heavy']),
  },
  {
    id: 'ghoul', name: '双头食尸鬼', tier: 'elite', act: 1, hp: [106, 110], art: '👹', desc: '撕咬与嚎叫；生命过半后狂暴。',
    moves: [
      { id: 'bite', name: '左头撕咬', intent: 'attack', dmg: 8, hits: 2 },
      { id: 'howl', name: '右头嚎叫', intent: 'debuff', act: (x) => x.apply('vulnerable', 2, 'player') },
      { id: 'maul', name: '双头猛击', intent: 'attack', dmg: 16 },
    ],
    next: (e, x) => {
      if (e.hist.length === 0) return 'howl';
      if (x.last() === 'howl') return x.rand() < 0.5 ? 'bite' : 'maul';
      return x.repeats('bite') + x.repeats('maul') >= 2 || x.rand() < 0.3 ? 'howl' : x.last() === 'bite' ? 'maul' : 'bite';
    },
    onDamaged: (x) => {
      if (!x.e.mem.enraged && x.e.hp <= x.e.maxHp / 2) {
        x.e.mem.enraged = 1;
        x.apply('strength', 5, 'self');
      }
    },
  },
  {
    id: 'lantern_guard', name: '诅咒灯笼守卫', tier: 'elite', act: 1, hp: [72, 76], art: '🧟', desc: '灯笼为其提供格挡；灯笼全碎后陷入虚弱。',
    onSpawn: (x) => { x.summon('lantern'); x.summon('lantern'); x.summon('lantern'); },
    moves: [
      { id: 'smash', name: '重击', intent: 'attack', dmg: 16 },
      { id: 'curse', name: '灯下诅咒', intent: 'atkDebuff', dmg: 8, act: (x) => x.addCard('curse_fear', 1, 'discard') },
    ],
    next: (_e, x) => (x.repeats('smash') >= 2 ? 'curse' : x.rand() < 0.65 ? 'smash' : 'curse'),
  },
  {
    id: 'lantern', name: '诅咒灯笼', tier: 'normal', act: 1, hp: [20, 20], art: '🏮', desc: '为守卫提供格挡。',
    moves: [
      { id: 'shield', name: '幽光', intent: 'block',
        act: (x) => { const g = x.allies().find((a) => a.def === 'lantern_guard'); if (g) x.block(6, g); } },
    ],
    next: () => 'shield',
    onDeath: (x) => {
      const rest = x.allies().filter((a) => a.def === 'lantern');
      const g = x.allies().find((a) => a.def === 'lantern_guard');
      if (!rest.length && g) x.apply('weak', 99, g);
    },
  },
  // ---- Boss ----
  {
    id: 'gross', name: '墓穴之主·葛罗斯', tier: 'boss', act: 1, hp: [220, 220], art: '🧛', desc: '召唤骸骨、收割灵魂、散播腐朽。生命低于 40% 时召唤更频繁。',
    moves: [
      { id: 'summon', name: '亡者召唤', intent: 'summon',
        act: (x) => { const n = x.allies().filter((a) => a.def === 'skeleton').length; for (let i = n; i < 2; i++) x.summon('skeleton', 24); } },
      { id: 'reap', name: '灵魂收割', intent: 'attack', dmg: 6, hits: 3 },
      { id: 'decay', name: '腐朽之息', intent: 'debuff', act: (x) => { x.addCard('status_dazed', 2, 'draw'); x.apply('weak', 2, 'player'); } },
      { id: 'slam', name: '墓碑重压', intent: 'attack', dmg: 18 },
    ],
    next: (e, x) => {
      const minions = x.c.enemies.filter((a) => !a.dead && a.def === 'skeleton').length;
      const low = e.hp <= e.maxHp * 0.4;
      const seq = low ? ['summon', 'reap', 'slam'] : ['summon', 'reap', 'decay', 'slam'];
      let m = seq[e.hist.length % seq.length];
      if (m === 'summon' && minions >= 2) m = 'reap';
      return m;
    },
  },
];

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(ENEMY_LIST.map((e) => [e.id, e]));

export interface Encounter {
  ids: string[];
  w: number;
}

export const ACTS: { name: string; weak: Encounter[]; strong: Encounter[]; elites: Encounter[]; boss: string[] }[] = [
  {
    name: '沉骨墓窟',
    weak: [
      { ids: ['rat', 'rat', 'rat'], w: 2 },
      { ids: ['bat', 'bat'], w: 2 },
      { ids: ['skeleton'], w: 1 },
      { ids: ['cultist'], w: 2 },
    ],
    strong: [
      { ids: ['slime', 'rat'], w: 2 },
      { ids: ['thief', 'thief'], w: 1 },
      { ids: ['spider', 'bat'], w: 2 },
      { ids: ['gargoyle', 'gargoyle'], w: 2 },
      { ids: ['skeleton', 'cultist'], w: 1 },
      { ids: ['slime'], w: 1 },
    ],
    elites: [
      { ids: ['bone_captain'], w: 1 },
      { ids: ['ghoul'], w: 1 },
      { ids: ['lantern_guard'], w: 1 },
    ],
    boss: ['gross'],
  },
];
