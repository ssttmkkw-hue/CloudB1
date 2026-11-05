import { ACTS, ALL_CARDS, CLASS_MAP, EVENTS, EVENT_LIST, POTION_LIST, RELICS, RELIC_LIST } from '../data';
import * as C from './combat';
import { hashSeed, next, pick, randInt, shuffle, weighted } from './rng';
import type {
  CardDef, CardInst, ClassId, CombatKind, GameMap, MapNode, MapNodeType, RewardItem, RngStream, RunState, Screen, SelectPurpose,
} from './types';

export const SAVE_VERSION = 1;
const STREAMS: RngStream[] = ['map', 'encounter', 'card', 'relic', 'potion', 'event', 'shop', 'combat', 'ai'];
export const MAP_ROWS = 15;
export const MAP_COLS = 7;

// ---------------- 新开一局 ----------------
export function newRun(cls: ClassId, seed?: string): RunState {
  seed = seed ?? Math.random().toString(36).slice(2, 10).toUpperCase();
  const def = CLASS_MAP[cls];
  const rng = Object.fromEntries(STREAMS.map((k) => [k, hashSeed(`${seed}:${k}`)])) as RunState['rng'];
  const s: RunState = {
    v: SAVE_VERSION, seed, rng, cls, asc: 0,
    hp: def.hp, maxHp: def.hp, gold: 99,
    deck: [], relics: [], potions: [null, null, null],
    act: 1, floor: 0, map: { nodes: {}, starts: [] }, pos: null, path: [],
    screen: { t: 'map' }, combat: null,
    rareOffset: -5, potionChance: 40, removeCost: 75, fightsThisAct: 0, seenEvents: [],
    stats: { floors: 0, kills: 0, elites: 0, bosses: 0, cardsPlayed: 0, damage: 0 },
    seq: 0,
  };
  for (const [id, n] of def.deck) for (let i = 0; i < n; i++) s.deck.push(C.newCard(s, id));
  gainRelic(s, def.relic);
  s.map = genMap(s);
  return s;
}

// ---------------- 地图 ----------------
export function genMap(s: RunState): GameMap {
  for (let attempt = 0; attempt < 50; attempt++) {
    const m = tryGenMap(s);
    if (m) return m;
  }
  return tryGenMap(s, true)!;
}

function tryGenMap(s: RunState, force = false): GameMap | null {
  const r = s.rng.map;
  const nodes: Record<string, MapNode> = {};
  const key = (row: number, col: number) => `${row}-${col}`;
  const ensure = (row: number, col: number) =>
    (nodes[key(row, col)] ??= { id: key(row, col), r: row, c: col, type: 'fight', next: [] });
  const starts = new Set<string>();
  let firstStart = -1;
  for (let p = 0; p < 6; p++) {
    let col = randInt(r, 0, MAP_COLS - 1);
    if (p === 1) while (col === firstStart) col = randInt(r, 0, MAP_COLS - 1);
    if (p === 0) firstStart = col;
    starts.add(key(0, col));
    for (let row = 0; row < MAP_ROWS - 1; row++) {
      const n = ensure(row, col);
      const cands = shuffle(r, [col - 1, col, col + 1].filter((x) => x >= 0 && x < MAP_COLS));
      let chosen = col;
      for (const nc of cands) {
        // 禁止交叉：若存在 (row,nc)->(row+1,col) 的边，则 col->nc 与其交叉
        const crossing = nc !== col && nodes[key(row, nc)]?.next.includes(key(row + 1, col));
        if (!crossing) { chosen = nc; break; }
      }
      const to = key(row + 1, chosen);
      ensure(row + 1, chosen);
      if (!n.next.includes(to)) n.next.push(to);
      col = chosen;
    }
    const last = ensure(MAP_ROWS - 1, col);
    if (!last.next.includes('boss')) last.next.push('boss');
  }
  nodes.boss = { id: 'boss', r: MAP_ROWS, c: 3, type: 'boss', next: [] };
  // 父节点
  const parents: Record<string, MapNode[]> = {};
  for (const n of Object.values(nodes)) for (const t of n.next) (parents[t] ??= []).push(n);
  const ordered = Object.values(nodes).filter((n) => n.type !== 'boss').sort((a, b) => a.r - b.r);
  for (const n of ordered) {
    if (n.r === 0) { n.type = 'fight'; continue; }
    if (n.r === 8) { n.type = 'treasure'; continue; }
    if (n.r === MAP_ROWS - 1) { n.type = 'rest'; continue; }
    const ps = parents[n.id] ?? [];
    const opts: [MapNodeType, number][] = [['fight', 45], ['event', 22]];
    const ok = (t: MapNodeType) => !ps.some((p) => p.type === t);
    if (n.r >= 5 && ok('elite')) opts.push(['elite', 8 * (s.asc >= 1 ? 1.6 : 1)]);
    if (n.r >= 5 && n.r < MAP_ROWS - 2 && ok('rest')) opts.push(['rest', 12]);
    if (n.r >= 2 && ok('shop')) opts.push(['shop', 5]);
    n.type = weighted(r, opts);
  }
  const count = (t: MapNodeType) => Object.values(nodes).filter((n) => n.type === t).length;
  if (!force && (count('elite') < 2 || count('rest') < 3 || count('shop') < 1)) return null;
  return { nodes, starts: [...starts] };
}

export function availableNodes(s: RunState): string[] {
  if (s.screen.t !== 'map') return [];
  if (!s.pos) return s.map.starts;
  return s.map.nodes[s.pos]?.next ?? [];
}

export function chooseNode(s: RunState, id: string) {
  if (!availableNodes(s).includes(id)) return;
  const n = s.map.nodes[id];
  s.pos = id;
  s.path.push(id);
  s.floor = n.r + 1;
  s.stats.floors++;
  switch (n.type) {
    case 'fight': return startFight(s);
    case 'elite': return startElite(s);
    case 'boss': return C.startCombat(s, ACTS[s.act - 1].boss, 'boss');
    case 'rest': s.screen = { t: 'rest' }; return;
    case 'shop': s.screen = genShop(s); return;
    case 'treasure': s.screen = { t: 'treasure', relic: randomRelic(s) }; return;
    case 'event': {
      const roll = next(s.rng.event);
      if (roll < 0.1) return startFight(s);
      const pool = EVENT_LIST.filter((e) => e.acts.includes(s.act) && !s.seenEvents.includes(e.id) && (!e.can || e.can(s)));
      if (!pool.length) return startFight(s);
      const ev = pick(s.rng.event, pool);
      s.seenEvents.push(ev.id);
      s.screen = { t: 'event', id: ev.id, stage: 'start' };
      return;
    }
  }
}

function startFight(s: RunState) {
  const act = ACTS[s.act - 1];
  const pool = s.fightsThisAct < 3 ? act.weak : act.strong;
  s.fightsThisAct++;
  const enc = weighted(s.rng.encounter, pool.map((e) => [e, e.w] as const));
  C.startCombat(s, enc.ids, 'normal');
}

export function startElite(s: RunState, bonusRelic = false) {
  const act = ACTS[s.act - 1];
  const enc = weighted(s.rng.encounter, act.elites.map((e) => [e, e.w] as const));
  C.startCombat(s, enc.ids, 'elite');
  if (bonusRelic) s.combat!.cf.bonusRelic = 1;
}

// ---------------- 战斗指令（UI 调用） ----------------
export function cmdPlay(s: RunState, uid: string, target?: string) {
  if (!s.combat) return false;
  const ok = C.playCard(s, uid, target);
  afterCombatCmd(s);
  return ok;
}
export function cmdEndTurn(s: RunState) {
  if (!s.combat) return false;
  C.endTurn(s);
  afterCombatCmd(s);
}
export function cmdPotion(s: RunState, slot: number, target?: string) {
  if (!s.combat) return false;
  const ok = C.usePotion(s, slot, target);
  afterCombatCmd(s);
  return ok;
}
export function cmdPending(s: RunState, keys: string[]) {
  if (!s.combat) return false;
  C.resolvePending(s, keys);
  afterCombatCmd(s);
}
export function discardPotion(s: RunState, slot: number) {
  s.potions[slot] = null;
}

function afterCombatCmd(s: RunState) {
  const c = s.combat;
  if (!c) return;
  if (c.phase === 'lost') {
    s.hp = 0;
    s.screen = { t: 'over', win: false };
  } else if (c.phase === 'won') {
    finishCombat(s);
  }
}

function finishCombat(s: RunState) {
  const c = s.combat!;
  s.hp = Math.max(1, Math.min(s.maxHp, c.player.hp));
  for (const r of s.relics) RELICS[r.id]?.onCombatEnd?.(s, r);
  const items: RewardItem[] = [];
  const [gmin, gmax] = c.kind === 'boss' ? [95, 105] : c.kind === 'elite' ? [25, 35] : [10, 20];
  let gold = randInt(s.rng.card, gmin, gmax);
  for (const e of c.enemies) if (e.dead && e.mem.stolen) gold += e.mem.stolen;
  items.push({ k: 'gold', n: gold });
  if (c.kind !== 'boss') {
    const roll = randInt(s.rng.potion, 0, 99);
    if (roll < s.potionChance) {
      items.push({ k: 'potion', id: randomPotion(s) });
      s.potionChance -= 10;
    } else s.potionChance += 10;
  }
  if (c.kind === 'elite') {
    s.stats.elites++;
    items.push({ k: 'relic', id: randomRelic(s) });
    if (C.hasRelic(s, 'crown_shard')) items.push({ k: 'relic', id: randomRelic(s) });
    if (c.cf.bonusRelic) items.push({ k: 'relic', id: randomRelic(s) });
  }
  if (c.kind === 'boss') s.stats.bosses++;
  items.push({ k: 'cards', options: rollCardReward(s, c.kind) });
  s.combat = null;
  s.screen = { t: 'reward', items, boss: c.kind === 'boss' };
}

// ---------------- 奖励 ----------------
type Rar = 'common' | 'uncommon' | 'rare';
export function rollRarity(s: RunState, src: CombatKind | 'shop'): Rar {
  if (src === 'boss') return 'rare';
  const base = src === 'elite' ? { r: 10, u: 40 } : src === 'shop' ? { r: 9, u: 37 } : { r: 3, u: 37 };
  const roll = next(s.rng.card) * 100;
  const rareP = Math.max(0, base.r + s.rareOffset);
  if (roll < rareP) { s.rareOffset = -5; return 'rare'; }
  if (roll < rareP + base.u) return 'uncommon';
  s.rareOffset = Math.min(40, s.rareOffset + 1);
  return 'common';
}

export function classPool(cls: string, rarity?: Rar): CardDef[] {
  return ALL_CARDS.filter((d) => d.cls === cls && (rarity ? d.rarity === rarity : ['common', 'uncommon', 'rare'].includes(d.rarity)));
}

export function rollCardReward(s: RunState, kind: CombatKind): { id: string; up: boolean }[] {
  let n = 3;
  if (C.hasRelic(s, 'silver_scale')) n++;
  if (C.hasRelic(s, 'greedy_maw')) n--;
  const out: { id: string; up: boolean }[] = [];
  const upChance = s.act === 2 ? 0.125 : s.act >= 3 ? 0.25 : 0;
  let guard = 0;
  while (out.length < n && guard++ < 100) {
    const pool = classPool(s.cls, rollRarity(s, kind));
    const d = pick(s.rng.card, pool);
    if (out.some((o) => o.id === d.id)) continue;
    out.push({ id: d.id, up: next(s.rng.card) < upChance });
  }
  return out;
}

export function randomPotion(s: RunState): string {
  const rar = weighted(s.rng.potion, [['common', 65], ['uncommon', 25], ['rare', 10]] as const);
  return pick(s.rng.potion, POTION_LIST.filter((p) => p.rarity === rar)).id;
}

export function randomRelic(s: RunState, rarity?: 'common' | 'uncommon' | 'rare'): string {
  const rar = rarity ?? weighted(s.rng.relic, [['common', 50], ['uncommon', 33], ['rare', 17]] as const);
  const owned = new Set(s.relics.map((r) => r.id));
  let pool = RELIC_LIST.filter((r) => r.rarity === rar && !owned.has(r.id));
  if (!pool.length) pool = RELIC_LIST.filter((r) => ['common', 'uncommon', 'rare'].includes(r.rarity) && !owned.has(r.id));
  if (!pool.length) return 'blood_vial';
  return pick(s.rng.relic, pool).id;
}

export function gainRelic(s: RunState, id: string) {
  s.relics.push({ id });
  const def = RELICS[id];
  def.onPickup?.(s);
  if (id === 'whetstone') {
    const atks = shuffle(s.rng.relic, s.deck.filter((d) => !d.up && C.cardDef(d.id).type === 'attack'));
    for (const d of atks.slice(0, 2)) d.up = true;
  }
  if (id === 'fate_loom') {
    const basics = shuffle(s.rng.relic, s.deck.filter((d) => C.cardDef(d.id).rarity === 'basic'));
    for (const d of basics.slice(0, 2)) s.deck.splice(s.deck.indexOf(d), 1);
  }
}

export function gainPotion(s: RunState, id: string): boolean {
  const slot = s.potions.indexOf(null);
  if (slot < 0) return false;
  s.potions[slot] = id;
  return true;
}

export function addToDeck(s: RunState, id: string, up = false) {
  s.deck.push(C.newCard(s, id, up));
}

export function claimReward(s: RunState, idx: number, cardIdx?: number) {
  if (s.screen.t !== 'reward') return;
  const it = s.screen.items[idx];
  if (!it) return;
  if (it.k === 'gold') s.gold += it.n;
  else if (it.k === 'relic') gainRelic(s, it.id);
  else if (it.k === 'potion') { if (!gainPotion(s, it.id)) return; }
  else if (it.k === 'cards') {
    if (cardIdx === undefined) return;
    const o = it.options[cardIdx];
    if (!o) return;
    addToDeck(s, o.id, o.up);
  }
  s.screen.items.splice(idx, 1);
}

export function leaveReward(s: RunState) {
  if (s.screen.t !== 'reward') return;
  if (s.screen.boss) {
    if (ACTS[s.act]) {
      const owned = new Set(s.relics.map((r) => r.id));
      const pool = shuffle(s.rng.relic, RELIC_LIST.filter((r) => r.rarity === 'boss' && !owned.has(r.id)));
      s.screen = { t: 'bossRelic', options: pool.slice(0, 3).map((r) => r.id) };
    } else {
      s.screen = { t: 'over', win: true };
    }
    return;
  }
  s.screen = { t: 'map' };
}

export function pickBossRelic(s: RunState, id: string | null) {
  if (s.screen.t !== 'bossRelic') return;
  if (id && s.screen.options.includes(id)) gainRelic(s, id);
  s.act++;
  s.floor = 0;
  s.pos = null;
  s.path = [];
  s.fightsThisAct = 0;
  const lost = s.maxHp - s.hp;
  s.hp += s.asc >= 5 ? Math.floor(lost * 0.75) : lost;
  s.map = genMap(s);
  s.screen = { t: 'map' };
}

// ---------------- 宝箱 ----------------
export function openTreasure(s: RunState) {
  if (s.screen.t !== 'treasure' || s.screen.opened) return;
  gainRelic(s, s.screen.relic);
  s.screen.opened = true;
}

// ---------------- 休息点 ----------------
export function restHealAmount(s: RunState) {
  if (C.hasRelic(s, 'obsidian_throne')) return 0;
  const pct = 0.3 + (C.hasRelic(s, 'campfire_ember') ? 0.15 : 0);
  return Math.floor(s.maxHp * pct);
}

export function rest(s: RunState, choice: 'heal' | 'upgrade') {
  if (s.screen.t !== 'rest') return;
  if (choice === 'heal') {
    s.hp = Math.min(s.maxHp, s.hp + restHealAmount(s));
    s.screen = { t: 'map' };
  } else {
    gotoSelect(s, 'upgrade', 1, '选择 1 张牌升级');
  }
}

// ---------------- 选牌（升级 / 移除 / 复制 / 变化） ----------------
export function gotoSelect(s: RunState, purpose: SelectPurpose, count: number, title: string, cost?: number) {
  s.screen = { t: 'select', purpose, count, title, back: s.screen, cost };
}

export function selectable(s: RunState, purpose: SelectPurpose): CardInst[] {
  if (purpose === 'upgrade') return s.deck.filter((d) => !d.up && !['curse', 'status'].includes(C.cardDef(d.id).cls));
  if (purpose === 'transform') return s.deck.filter((d) => C.cardDef(d.id).cls !== 'status');
  return s.deck;
}

export function resolveSelect(s: RunState, uids: string[]) {
  const sc = s.screen;
  if (sc.t !== 'select' || uids.length !== Math.min(sc.count, selectable(s, sc.purpose).length)) return;
  const cards = uids.map((u) => s.deck.find((d) => d.uid === u)).filter(Boolean) as CardInst[];
  for (const cd of cards) {
    if (sc.purpose === 'upgrade') cd.up = true;
    else if (sc.purpose === 'remove') s.deck.splice(s.deck.indexOf(cd), 1);
    else if (sc.purpose === 'duplicate') addToDeck(s, cd.id, cd.up);
    else if (sc.purpose === 'transform') {
      const pool = classPool(s.cls).filter((d) => d.id !== cd.id);
      s.deck.splice(s.deck.indexOf(cd), 1, C.newCard(s, pick(s.rng.event, pool).id));
    }
  }
  if (sc.cost) s.gold -= sc.cost;
  const back: Screen = sc.back;
  if (back.t === 'shop') {
    if (sc.purpose === 'remove') { back.removeUsed = true; s.removeCost += 25; }
    s.screen = back;
  } else if (back.t === 'event') {
    s.screen = { t: 'event', id: back.id, stage: 'done', msg: '完成了。' };
  } else {
    s.screen = { t: 'map' };
  }
}

export function cancelSelect(s: RunState) {
  if (s.screen.t === 'select') s.screen = s.screen.back;
}

// ---------------- 商店 ----------------
const priceMod = (s: RunState) => (C.hasRelic(s, 'lucky_coin') ? 0.95 : 1);

export function genShop(s: RunState): Screen {
  const r = s.rng.shop;
  const m = priceMod(s);
  const cards: { id: string; up: boolean; price: number }[] = [];
  const used = new Set<string>();
  const range: Record<Rar, [number, number]> = { common: [45, 55], uncommon: [68, 82], rare: [135, 165] };
  while (cards.length < 5) {
    const rar = rollRarity(s, 'shop');
    const d = pick(r, classPool(s.cls, rar));
    if (used.has(d.id)) continue;
    used.add(d.id);
    cards.push({ id: d.id, up: false, price: Math.round(randInt(r, ...range[rar]) * m) });
  }
  const sale = randInt(r, 0, 4);
  cards[sale].price = Math.floor(cards[sale].price / 2);
  const neutrals = shuffle(r, ALL_CARDS.filter((d) => d.cls === 'neutral'));
  for (const d of neutrals.slice(0, 2)) {
    const base = d.rarity === 'rare' ? randInt(r, 160, 190) : randInt(r, 80, 95);
    cards.push({ id: d.id, up: false, price: Math.round(base * m) });
  }
  const relics: { id: string; price: number }[] = [];
  const relicPrice = { common: 150, uncommon: 250, rare: 300 } as Record<string, number>;
  const owned = new Set(s.relics.map((x) => x.id));
  for (const d of shuffle(r, RELIC_LIST.filter((x) => ['common', 'uncommon', 'rare'].includes(x.rarity) && !owned.has(x.id))).slice(0, 3)) {
    relics.push({ id: d.id, price: Math.round(relicPrice[d.rarity] * (0.95 + next(r) * 0.1) * m) });
  }
  const potPrice = { common: 50, uncommon: 75, rare: 100 } as Record<string, number>;
  const potions: { id: string; price: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const id = randomPotion(s);
    potions.push({ id, price: Math.round(potPrice[POTION_LIST.find((p) => p.id === id)!.rarity] * m) });
  }
  return { t: 'shop', cards, relics, potions };
}

export function shopBuy(s: RunState, kind: 'card' | 'relic' | 'potion', idx: number) {
  const sc = s.screen;
  if (sc.t !== 'shop') return;
  const list = kind === 'card' ? sc.cards : kind === 'relic' ? sc.relics : sc.potions;
  const it = list[idx];
  if (!it || it.sold || it.price > s.gold) return;
  if (kind === 'potion' && !s.potions.includes(null)) return;
  s.gold -= it.price;
  it.sold = true;
  if (kind === 'card') addToDeck(s, it.id, 'up' in it && !!it.up);
  else if (kind === 'relic') gainRelic(s, it.id);
  else gainPotion(s, it.id);
}

export function shopRemove(s: RunState) {
  const sc = s.screen;
  if (sc.t !== 'shop' || sc.removeUsed || s.gold < s.removeCost) return;
  gotoSelect(s, 'remove', 1, `选择 1 张牌移除（${s.removeCost} 金币）`, s.removeCost);
}

export function leaveToMap(s: RunState) {
  s.screen = { t: 'map' };
}

// ---------------- 事件 ----------------
export function eventChoose(s: RunState, optIdx: number) {
  const sc = s.screen;
  if (sc.t !== 'event') return;
  const ev = EVENTS[sc.id];
  const stage = ev.stages[sc.stage] ?? DONE_STAGE;
  const opt = stage.options[optIdx];
  if (!opt || opt.disabled?.(s)) return;
  const res = opt.run(s);
  // run 可能已切换界面（战斗、选牌等）
  if (s.screen !== sc) return;
  if (typeof res === 'string') sc.stage = res;
  else if (res && typeof res === 'object') { sc.stage = 'done'; sc.msg = res.msg; }
  else s.screen = { t: 'map' };
}

export const DONE_STAGE = { text: '', options: [{ label: '离开', run: () => undefined }] };

