import { CARDS, ENEMIES, RELICS, POTIONS } from '../data';
import { hashSeed, next, pick, randInt, shuffle } from './rng';
import { DEBUFFS } from './statuses';
import type {
  ApplyTo, CardDef, CardInst, Combat, CombatKind, Element, EnemyCtx, EnemyState, GameEvent,
  Keyword, MoveDef, Pending, PlayCtx, RunState, Unit,
} from './types';

// ---------------- 事件流 ----------------
const EV: GameEvent[] = [];
export const emit = (e: GameEvent) => { EV.push(e); };
export const drainEvents = () => EV.splice(0);

// ---------------- 工具 ----------------
export const HAND_LIMIT = 10;
export const hasRelic = (s: RunState, id: string) => s.relics.some((r) => r.id === id);
export function cardDef(id: string): CardDef {
  const d = CARDS[id];
  if (!d) throw new Error('未知卡牌 ' + id);
  return d;
}
export function newCard(s: RunState, id: string, up = false): CardInst {
  return { uid: 'c' + ++s.seq, id, up };
}
export const kwOf = (def: CardDef, up: boolean): Keyword[] => (up && def.upKw ? def.upKw : def.kw) ?? [];
export const hasKw = (card: CardInst, k: Keyword) => kwOf(cardDef(card.id), card.up).includes(k);
export const alive = (c: Combat) => c.enemies.filter((e) => !e.dead && !e.escaped);
export const handLimit = (s: RunState) => HAND_LIMIT + (hasRelic(s, 'astrolabe') ? 2 : 0);
export function valuesOf(def: CardDef, up: boolean): Record<string, number> {
  const v: Record<string, number> = {};
  for (const k in def.v ?? {}) v[k] = def.v![k][up ? 1 : 0];
  return v;
}

const st = (u: Unit, k: string) => u.st[k] ?? 0;
function addSt(u: Unit, k: string, n: number) {
  const v = (u.st[k] ?? 0) + n;
  if (v === 0) delete u.st[k];
  else u.st[k] = v;
}
function setSt(u: Unit, k: string, n: number) {
  if (n === 0) delete u.st[k];
  else u.st[k] = n;
}

// ---------------- 战斗开始 ----------------
export function startCombat(s: RunState, enemyIds: string[], kind: CombatKind) {
  s.rng.combat = hashSeed(`${s.seed}:combat:${s.act}:${s.floor}`);
  s.rng.ai = hashSeed(`${s.seed}:ai:${s.act}:${s.floor}`);
  const cards = s.deck.map((d) => ({ uid: d.uid, id: d.id, up: d.up }));
  shuffle(s.rng.combat, cards);
  const innate = cards.filter((x) => hasKw(x, 'innate'));
  const rest = cards.filter((x) => !hasKw(x, 'innate'));
  let maxEnergy = 3;
  for (const r of s.relics) if (RELICS[r.id]?.energy) maxEnergy += RELICS[r.id].energy!;
  const c: Combat = {
    turn: 0,
    phase: 'player',
    kind,
    energy: 0,
    maxEnergy,
    player: { id: 'player', name: '你', hp: s.hp, maxHp: s.maxHp, block: 0, st: {} },
    oath: 0,
    oathCap: 10,
    enemies: [],
    draw: [...rest, ...innate], // 抽牌从末尾取 → 固有牌最先抽到
    hand: [],
    discard: [],
    exhaust: [],
    cardsPlayed: 0,
    lastEl: null,
    elsPlayed: [],
    pending: null,
    tf: {},
    cf: {},
    seq: 0,
  };
  s.combat = c;
  s.screen = { t: 'combat' };
  for (const id of enemyIds) spawnEnemy(s, id);
  const x = makeCtx(s, null, null);
  for (const r of s.relics) RELICS[r.id]?.onCombatStart?.(x, r);
  chooseIntents(s);
  startPlayerTurn(s);
}

export function spawnEnemy(s: RunState, id: string, hp?: number): EnemyState | null {
  const c = s.combat!;
  if (alive(c).length >= 5) return null;
  const def = ENEMIES[id];
  if (!def) throw new Error('未知敌人 ' + id);
  const mhp = hp ?? randInt(s.rng.ai, def.hp[0], def.hp[1]);
  const e: EnemyState = {
    id: 'e' + ++c.seq, def: id, name: def.name, hp: mhp, maxHp: mhp, block: 0, st: {}, move: null, hist: [], mem: {},
  };
  c.enemies.push(e);
  def.onSpawn?.(enemyCtx(s, e));
  if (c.turn > 0) chooseIntent(s, e, false);
  return e;
}

// ---------------- 回合 ----------------
export function startPlayerTurn(s: RunState) {
  const c = s.combat!;
  const p = c.player;
  c.turn++;
  c.tf = {};
  c.cardsPlayed = 0;
  c.lastEl = null;
  c.elsPlayed = [];
  const keep = st(p, 'bulwark');
  if (c.turn > 1) p.block = keep ? Math.min(p.block, keep) : 0;
  setSt(p, 'standFirm', 0);
  setSt(p, 'divine', 0);
  if (st(p, 'poison') > 0) {
    loseHp(s, p, st(p, 'poison'));
    addSt(p, 'poison', -1);
    if (c.phase !== 'player') return;
  }
  c.energy = c.maxEnergy + st(p, 'nextEnergy');
  setSt(p, 'nextEnergy', 0);
  if (st(p, 'nextBlock')) {
    p.block += st(p, 'nextBlock');
    emit({ t: 'block', unit: 'player', n: st(p, 'nextBlock') });
    setSt(p, 'nextBlock', 0);
  }
  const x = makeCtx(s, null, null);
  if (st(p, 'oathAvatar')) gainOath(s, st(p, 'oathAvatar'));
  if (st(p, 'knifeMaster')) x.add('rogue_shiv', st(p, 'knifeMaster'), 'hand');
  if (st(p, 'toxicHeart')) for (const e of alive(c)) applyStatus(s, e, 'poison', 2 * st(p, 'toxicHeart'), true);
  for (const r of s.relics) RELICS[r.id]?.onTurnStart?.(x, r);
  if (c.phase !== 'player') return;
  let n = 5 + st(p, 'nextDraw');
  if (c.turn === 1 && hasRelic(s, 'shadow_cloak')) n += 2;
  if (hasRelic(s, 'astrolabe')) n += 1;
  setSt(p, 'nextDraw', 0);
  drawCards(s, n);
  if (st(p, 'starfall')) {
    const opts = c.draw.filter((cd) => cardDef(cd.id).el);
    if (opts.length) {
      c.pending = {
        action: 'starfall', title: '星辉降临：选择 1 张元素牌加入手牌', min: 1, max: 1,
        options: opts.map((cd) => ({ key: cd.uid, card: cd })),
      };
    }
  }
}

export function endTurn(s: RunState) {
  const c = s.combat!;
  if (c.phase !== 'player' || c.pending) return;
  const p = c.player;
  const x = makeCtx(s, null, null);
  // 手牌中的诅咒/状态
  for (const cd of [...c.hand]) {
    if (cd.id === 'curse_rot') loseHp(s, p, 1);
    if (cd.id === 'status_burn') dealDamage(s, null, p, 2, false);
    if (c.phase !== 'player') return;
  }
  if (st(p, 'unyield') && p.block > 0) gainOath(s, st(p, 'unyield'));
  if (st(p, 'frozenHeart')) {
    gainBlock(s, 5 * st(p, 'frozenHeart'));
    for (const e of alive(c)) applyStatus(s, e, 'frost', st(p, 'frozenHeart'), true);
  }
  for (const r of s.relics) RELICS[r.id]?.onTurnEnd?.(x, r);
  endOfTurnStatuses(s, p);
  if (c.phase !== 'player') return;
  // 弃手牌
  for (const cd of c.hand.splice(0)) {
    delete cd.tmpCost;
    if (hasKw(cd, 'retain')) c.hand.push(cd);
    else if (hasKw(cd, 'ethereal')) moveToExhaust(s, cd);
    else c.discard.push(cd);
  }
  setSt(p, 'tempThorns', 0);
  setSt(p, 'nightfall', 0);
  for (const k of ['vulnerable', 'weak', 'frail']) if (st(p, k) > 0) addSt(p, k, -1);
  enemyTurn(s);
  checkWin(s); // 敌人可能全部逃跑
  if (c.phase !== 'player') return;
  chooseIntents(s);
  startPlayerTurn(s);
}

function endOfTurnStatuses(s: RunState, u: Unit) {
  if (st(u, 'burn') > 0) {
    dealDamage(s, null, u, st(u, 'burn'), false);
    setSt(u, 'burn', Math.floor(st(u, 'burn') / 2));
  }
  if (u.hp > 0 && st(u, 'regen') > 0) {
    healUnit(u, st(u, 'regen'));
    addSt(u, 'regen', -1);
  }
}

function enemyTurn(s: RunState) {
  const c = s.combat!;
  for (const e of [...c.enemies]) {
    if (e.dead || e.escaped) continue;
    if (c.phase !== 'player') return;
    e.block = 0;
    if (st(e, 'poison') > 0) {
      loseHp(s, e, st(e, 'poison'));
      addSt(e, 'poison', -1);
      if (e.dead || c.phase !== 'player') continue;
    }
    if (st(e, 'frozen')) {
      setSt(e, 'frozen', 0);
      emit({ t: 'text', unit: e.id, text: '冻结中' });
    } else if (e.move) {
      runMove(s, e, getMove(e));
    }
    if (c.phase !== 'player') return;
    if (e.dead || e.escaped) continue;
    endOfTurnStatuses(s, e);
    if (e.dead) continue;
    if (st(e, 'ritual')) {
      if (e.mem.ritualFresh) e.mem.ritualFresh = 0;
      else applyStatus(s, e, 'strength', st(e, 'ritual'), false);
    }
    for (const k of ['vulnerable', 'weak', 'frail']) if (st(e, k) > 0) addSt(e, k, -1);
  }
}

export function getMove(e: EnemyState): MoveDef {
  const def = ENEMIES[e.def];
  return def.moves.find((m) => m.id === e.move) ?? def.moves[0];
}

function runMove(s: RunState, e: EnemyState, m: MoveDef) {
  const c = s.combat!;
  const x = enemyCtx(s, e);
  if (m.dmg !== undefined) {
    const hits = m.hits ?? 1;
    for (let i = 0; i < hits; i++) {
      if (c.phase !== 'player' || e.dead) return;
      x.lastHpDealt = dealDamage(s, e, c.player, m.dmg, true);
      m.onHit?.(x);
    }
    setSt(e, 'frost', 0);
  }
  if (c.phase !== 'player' || e.dead) return;
  m.act?.(x);
}

export function chooseIntents(s: RunState) {
  for (const e of alive(s.combat!)) chooseIntent(s, e, true);
}

function chooseIntent(s: RunState, e: EnemyState, push: boolean) {
  const c = s.combat!;
  const def = ENEMIES[e.def];
  e.move = def.next(e, {
    c,
    turn: c.turn,
    rand: () => next(s.rng.ai),
    last: (n = 1) => e.hist[e.hist.length - n],
    repeats: (id) => {
      let k = 0;
      for (let i = e.hist.length - 1; i >= 0 && e.hist[i] === id; i--) k++;
      return k;
    },
  });
  if (push) e.hist.push(e.move);
}

/** 意图显示的伤害（已计算修正） */
export function intentDamage(s: RunState, e: EnemyState): { dmg: number; hits: number } | null {
  const m = getMove(e);
  if (m.dmg === undefined) return null;
  return { dmg: calcAttack(e, s.combat!.player, m.dmg), hits: m.hits ?? 1 };
}

// ---------------- 伤害 / 格挡 / 状态 ----------------
export function calcAttack(src: Unit | null, tgt: Unit | null, base: number): number {
  let d = base + (src ? st(src, 'strength') : 0);
  if (src && st(src, 'weak') > 0) d *= 0.75;
  if (tgt && st(tgt, 'vulnerable') > 0) d *= 1.5;
  d = Math.floor(d);
  if (src && src.id !== 'player') d -= st(src, 'frost');
  return Math.max(0, d);
}

export function calcBlock(u: Unit, base: number): number {
  let b = base + st(u, 'dexterity');
  if (st(u, 'frail') > 0) b *= 0.75;
  return Math.max(0, Math.floor(b));
}

export function dealDamage(s: RunState, src: Unit | null, tgt: Unit, base: number, attack: boolean): number {
  const c = s.combat!;
  if (tgt.hp <= 0 || c.phase !== 'player') return 0;
  let total = attack ? calcAttack(src, tgt, base) : Math.max(0, base);
  if (attack) {
    total += st(tgt, 'mark');
    const sh = st(tgt, 'shock');
    if (sh > 0) {
      total += sh;
      addSt(tgt, 'shock', -1);
      const cap = st(c.player, 'capacitor');
      if (tgt.id !== 'player' && cap && (c.tf.cap ?? 0) < cap) {
        c.tf.cap = (c.tf.cap ?? 0) + 1;
        drawCards(s, 1);
      }
    }
  }
  const blocked = Math.min(tgt.block, total);
  tgt.block -= blocked;
  let loss = total - blocked;
  if (tgt.id === 'player' && st(tgt, 'divine') && loss > 1) loss = 1;
  tgt.hp -= loss;
  emit({ t: 'dmg', unit: tgt.id, n: loss, blocked });
  if (src?.id === 'player') s.stats.damage += loss;
  if (tgt.hp <= 0) {
    onUnitDeath(s, tgt);
  } else if (tgt.id !== 'player') {
    const e = tgt as EnemyState;
    if (loss > 0) ENEMIES[e.def].onDamaged?.(enemyCtx(s, e));
  }
  if (attack && src && src.hp > 0) {
    const th = st(tgt, 'thorns') + st(tgt, 'tempThorns');
    if (th > 0) dealDamage(s, tgt, src, th, false);
    if (tgt.id === 'player' && st(tgt, 'standFirm') && c.phase === 'player') gainOath(s, 1);
  }
  return loss;
}

export function loseHp(s: RunState, u: Unit, n: number) {
  if (n <= 0 || u.hp <= 0) return;
  const c = s.combat!;
  if (u.id === 'player' && st(u, 'divine') && n > 1) n = 1;
  u.hp -= n;
  emit({ t: 'dmg', unit: u.id, n, blocked: 0 });
  if (u.hp <= 0) onUnitDeath(s, u);
  else if (u.id !== 'player') ENEMIES[(u as EnemyState).def].onDamaged?.(enemyCtx(s, u as EnemyState));
  void c;
}

function healUnit(u: Unit, n: number) {
  const h = Math.min(n, u.maxHp - u.hp);
  if (h > 0) {
    u.hp += h;
    emit({ t: 'heal', unit: u.id, n: h });
  }
}

function onUnitDeath(s: RunState, u: Unit) {
  const c = s.combat!;
  if (u.id === 'player') {
    const fairy = s.potions.indexOf('fairy');
    if (fairy >= 0) {
      s.potions[fairy] = null;
      u.hp = Math.max(1, Math.floor(u.maxHp * 0.3));
      emit({ t: 'toast', text: '精灵瓶救了你一命！' });
      return;
    }
    const ph = s.relics.find((r) => r.id === 'phoenix' && !r.n);
    if (ph) {
      ph.n = 1;
      u.hp = Math.max(1, Math.floor(u.maxHp * 0.3));
      emit({ t: 'toast', text: '凤凰羽燃起，你复活了！' });
      return;
    }
    u.hp = 0;
    c.phase = 'lost';
    return;
  }
  killEnemy(s, u as EnemyState);
}

export function killEnemy(s: RunState, e: EnemyState) {
  if (e.dead) return;
  e.hp = 0;
  e.dead = true;
  e.block = 0;
  s.stats.kills++;
  emit({ t: 'die', unit: e.id });
  ENEMIES[e.def].onDeath?.(enemyCtx(s, e));
  checkWin(s);
}

export function checkWin(s: RunState) {
  const c = s.combat!;
  if (c.phase === 'player' && alive(c).length === 0) c.phase = 'won';
}

export function gainBlock(s: RunState, base: number, raw = false) {
  const p = s.combat!.player;
  const n = raw ? base : calcBlock(p, base);
  p.block += n;
  if (n > 0) emit({ t: 'block', unit: 'player', n });
}

export function applyStatus(s: RunState, u: Unit, status: string, n: number, fromPlayer: boolean) {
  if (n === 0 || u.hp <= 0) return;
  if (n > 0 && DEBUFFS.has(status) && st(u, 'artifact') > 0) {
    addSt(u, 'artifact', -1);
    emit({ t: 'text', unit: u.id, text: '护符抵消' });
    return;
  }
  if (status === 'poison' && fromPlayer && u.id !== 'player') {
    n += st(s.combat!.player, 'toxicHeart') > 0 ? 1 : 0;
    n += hasRelic(s, 'viper_fang') ? 1 : 0;
  }
  addSt(u, status, n);
  emit({ t: 'status', unit: u.id, status, n });
  if (status === 'frost' && st(u, 'frost') >= 10 && u.id !== 'player') freeze(s, u as EnemyState);
}

export function freeze(s: RunState, e: EnemyState) {
  setSt(e, 'frost', 0);
  if (ENEMIES[e.def].tier === 'boss') {
    applyStatus(s, e, 'weak', 2, true);
    emit({ t: 'text', unit: e.id, text: '抵抗冻结' });
  } else {
    setSt(e, 'frozen', 1);
    emit({ t: 'text', unit: e.id, text: '冻结！' });
  }
}

export function gainOath(s: RunState, n: number) {
  const c = s.combat!;
  if (n > 0) {
    const before = c.oath;
    c.oath = Math.min(c.oathCap, c.oath + n);
    const g = c.oath - before;
    if (g > 0) {
      emit({ t: 'text', unit: 'player', text: `誓约 +${g}` });
      const w = st(c.player, 'oathWrath');
      if (w) {
        const t = alive(c);
        if (t.length) dealDamage(s, c.player, pick(s.rng.combat, t), w, false);
      }
    }
  } else if (n < 0) {
    c.oath = Math.max(0, c.oath + n);
  }
}

// ---------------- 牌堆 ----------------
export function drawCards(s: RunState, n: number) {
  const c = s.combat!;
  for (let i = 0; i < n; i++) {
    if (c.draw.length === 0) {
      if (c.discard.length === 0) return;
      c.draw = shuffle(s.rng.combat, c.discard.splice(0));
      emit({ t: 'shuffle' });
    }
    const cd = c.draw.pop()!;
    if (c.hand.length >= handLimit(s)) {
      c.discard.push(cd);
      continue;
    }
    c.hand.push(cd);
    if (cd.id === 'curse_fear') {
      const others = c.hand.filter((h) => h !== cd);
      if (others.length) {
        const victim = pick(s.rng.combat, others);
        c.hand.splice(c.hand.indexOf(victim), 1);
        c.discard.push(victim);
        emit({ t: 'toast', text: `恐惧：弃掉了「${cardDef(victim.id).name}」` });
      }
    }
  }
}

function moveToExhaust(s: RunState, cd: CardInst) {
  const c = s.combat!;
  c.exhaust.push(cd);
  const x = makeCtx(s, null, null);
  for (const r of s.relics) RELICS[r.id]?.onExhaust?.(x, r);
}

// ---------------- 打出卡牌 ----------------
export function effCost(c: Combat, card: CardInst): number | 'X' | null {
  const d = cardDef(card.id);
  if (d.cost === null) return null;
  if (d.cost === 'X') return 'X';
  let base = card.up && d.upCost !== undefined ? d.upCost : d.cost;
  if (card.tmpCost !== undefined) base = card.tmpCost;
  if (d.costMod) base = d.costMod(c, base);
  if (d.type === 'attack' && st(c.player, 'nightfall')) base = 0;
  if (c.cardsPlayed === 0 && c.hand.some((h) => h.id === 'curse_hesitation' && h !== card)) base += 1;
  return Math.max(0, base);
}

export function canPlay(c: Combat, card: CardInst): boolean {
  if (c.phase !== 'player' || c.pending) return false;
  const cost = effCost(c, card);
  if (cost === null) return false;
  if (cost !== 'X' && cost > c.energy) return false;
  const d = cardDef(card.id);
  if (d.canPlay && !d.canPlay(c)) return false;
  return true;
}

export function resonates(s: RunState, c: Combat, def: CardDef): boolean {
  if (!def.el) return false;
  if (c.lastEl === def.el) return true;
  if (st(c.player, 'elementMaster') && c.elsPlayed.includes(def.el)) return true;
  if (st(c.player, 'prism') && c.elsPlayed.length === 0) return true;
  if (hasRelic(s, 'element_prism') && !c.cf.firstEl) return true;
  return false;
}

export function playCard(s: RunState, uid: string, targetId?: string): boolean {
  const c = s.combat!;
  const card = c.hand.find((h) => h.uid === uid);
  if (!card || !canPlay(c, card)) return false;
  const def = cardDef(card.id);
  let target: EnemyState | null = null;
  if (def.target === 'enemy') {
    const al = alive(c);
    target = al.find((e) => e.id === targetId) ?? (al.length === 1 ? al[0] : null);
    if (!target) return false;
  }
  const cost = effCost(c, card)!;
  const x = cost === 'X' ? c.energy : 0;
  const paid = cost === 'X' ? x : cost;
  c.energy -= paid;
  c.hand.splice(c.hand.indexOf(card), 1);
  const res = resonates(s, c, def);
  if (def.el) c.cf.firstEl = 1;
  let bonus = 0;
  if (def.type === 'attack') {
    bonus = st(c.player, 'nextAtk');
    setSt(c.player, 'nextAtk', 0);
  }
  const ctx = makeCtx(s, card, target, { x, combo: c.cardsPlayed, res, bonus });
  emit({ t: 'play', id: card.id });
  if (res) emit({ t: 'text', unit: 'player', text: '共鸣！' });
  def.play?.(ctx);
  if (res && st(c.player, 'overload')) gainBlock(s, st(c.player, 'overload'), true);
  delete card.tmpCost;
  if (def.type !== 'power') {
    if (kwOf(def, card.up).includes('exhaust')) moveToExhaust(s, card);
    else c.discard.push(card);
  }
  c.cardsPlayed++;
  c.lastEl = def.el ?? null;
  if (def.el) c.elsPlayed.push(def.el);
  s.stats.cardsPlayed++;
  if (c.phase !== 'player') return true;
  const p = c.player;
  if (st(p, 'rhythm') && c.cardsPlayed === 4) c.energy += st(p, 'rhythm');
  if (st(p, 'shadowless') && paid === 0) {
    const n = st(p, 'shadowless');
    gainBlock(s, 2 * n, true);
    const t = alive(c);
    if (t.length) dealDamage(s, p, pick(s.rng.combat, t), 2 * n, false);
  }
  const rx = makeCtx(s, card, target);
  for (const r of s.relics) RELICS[r.id]?.onCardPlayed?.(rx, r, def);
  checkWin(s);
  return true;
}

export function usePotion(s: RunState, slot: number, targetId?: string): boolean {
  const c = s.combat;
  const id = s.potions[slot];
  if (!c || !id || c.phase !== 'player' || c.pending) return false;
  const def = POTIONS[id];
  if (def.passive) return false;
  let target: EnemyState | null = null;
  if (def.target === 'enemy') {
    const al = alive(c);
    target = al.find((e) => e.id === targetId) ?? (al.length === 1 ? al[0] : null);
    if (!target) return false;
  }
  s.potions[slot] = null;
  def.use(makeCtx(s, null, target));
  checkWin(s);
  return true;
}

export function resolvePending(s: RunState, keys: string[]) {
  const c = s.combat!;
  const p = c.pending;
  if (!p) return;
  if (keys.length < p.min || keys.length > p.max) return;
  c.pending = null;
  const x = makeCtx(s, null, null);
  switch (p.action) {
    case 'setElement':
      if (keys[0]) c.lastEl = keys[0] as Element;
      break;
    case 'discard':
      for (const k of keys) {
        const i = c.hand.findIndex((h) => h.uid === k);
        if (i >= 0) c.discard.push(...c.hand.splice(i, 1));
      }
      break;
    case 'shadowClone': {
      const src = c.hand.find((h) => h.uid === keys[0]);
      if (src) x.add(src.id, 2, 'hand', src.up);
      break;
    }
    case 'scry':
    case 'starfall':
      for (const k of keys) {
        const i = c.draw.findIndex((h) => h.uid === k);
        if (i >= 0) {
          const [cd] = c.draw.splice(i, 1);
          if (c.hand.length < handLimit(s)) c.hand.push(cd);
          else c.discard.push(cd);
        }
      }
      break;
    case 'inspire':
      if (keys[0] && c.hand.length < handLimit(s)) {
        const cd = newCard(s, keys[0]);
        cd.tmpCost = 0;
        c.hand.push(cd);
      }
      break;
  }
  checkWin(s);
}

// ---------------- 上下文 ----------------
export function makeCtx(
  s: RunState, card: CardInst | null, target: EnemyState | null,
  o: { x?: number; combo?: number; res?: boolean; bonus?: number } = {},
): PlayCtx {
  const c = s.combat!;
  const def = card ? cardDef(card.id) : (null as unknown as CardDef);
  const up = card?.up ?? false;
  const resolveTo = (to: ApplyTo | undefined): EnemyState[] => {
    const al = alive(c);
    if (to === 'all') return al;
    if (to === 'random') return al.length ? [pick(s.rng.combat, al)] : [];
    if (to === 'self') return [];
    if (to && typeof to === 'object') return to.dead || to.escaped ? [] : [to];
    return target && !target.dead && !target.escaped ? [target] : [];
  };
  const ctx: PlayCtx = {
    s, c, card: card!, def, up,
    v: def ? valuesOf(def, up) : {},
    x: o.x ?? 0,
    target,
    combo: o.combo ?? c.cardsPlayed,
    res: o.res ?? false,
    atk(dmg, opt = {}) {
      const times = opt.times ?? 1;
      for (let i = 0; i < times; i++) {
        for (const t of resolveTo(opt.to)) {
          if (c.phase !== 'player') return;
          dealDamage(s, c.player, t, dmg + (o.bonus ?? 0), true);
        }
      }
    },
    block(n) { gainBlock(s, n); },
    draw(n) { drawCards(s, n); },
    energy(n) { c.energy += n; },
    apply(status, n, to) {
      if (to === 'self') applyStatus(s, c.player, status, n, true);
      else for (const t of resolveTo(to)) applyStatus(s, t, status, n, true);
    },
    add(id, n, pile = 'hand', upg = false) {
      for (let i = 0; i < n; i++) {
        const cd = newCard(s, id, upg);
        if (pile === 'hand' && c.hand.length < handLimit(s)) c.hand.push(cd);
        else if (pile === 'draw') c.draw.splice(Math.floor(next(s.rng.combat) * (c.draw.length + 1)), 0, cd);
        else c.discard.push(cd);
      }
    },
    oath(n) { gainOath(s, n); },
    loseHp(n) { loseHp(s, c.player, n); },
    heal(n) { healUnit(c.player, n); },
    choose(p: Pending) { if (p.options.length) c.pending = p; },
    alive: () => alive(c),
    rand: () => next(s.rng.combat),
    typeOf: (id) => cardDef(id).type,
    intentOf: (e) => (e.move ? getMove(e).intent : null),
  };
  return ctx;
}

export function enemyCtx(s: RunState, e: EnemyState): EnemyCtx {
  const c = s.combat!;
  return {
    s, c, e,
    lastHpDealt: 0,
    block(n, who = e) {
      who.block += n;
      emit({ t: 'block', unit: who.id, n });
    },
    apply(status, n, who) {
      const u = who === 'player' ? c.player : who === 'self' ? e : who;
      applyStatus(s, u, status, n, false);
    },
    addCard(id, n, pile) {
      for (let i = 0; i < n; i++) {
        const cd = newCard(s, id);
        if (pile === 'hand' && c.hand.length < handLimit(s)) c.hand.push(cd);
        else if (pile === 'draw') c.draw.splice(Math.floor(next(s.rng.combat) * (c.draw.length + 1)), 0, cd);
        else c.discard.push(cd);
      }
    },
    summon: (def, hp) => spawnEnemy(s, def, hp),
    heal(n, who = e) { healUnit(who, n); },
    allies: () => alive(c),
  };
}
