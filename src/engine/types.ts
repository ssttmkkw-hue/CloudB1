import type { RngState } from './rng';

export type ClassId = 'knight' | 'rogue' | 'mage';
export type CardClass = ClassId | 'neutral' | 'curse' | 'status';
export type CardType = 'attack' | 'skill' | 'power' | 'curse' | 'status';
export type Rarity = 'basic' | 'token' | 'common' | 'uncommon' | 'rare' | 'special';
export type Element = 'fire' | 'frost' | 'lightning';
export type Keyword = 'exhaust' | 'ethereal' | 'innate' | 'retain' | 'unplayable';
export type RngStream = 'map' | 'encounter' | 'card' | 'relic' | 'potion' | 'event' | 'shop' | 'combat' | 'ai';

export interface CardInst {
  uid: string;
  id: string;
  up: boolean;
  /** 本回合临时费用（回合结束清除） */
  tmpCost?: number;
}

export interface Unit {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  st: Record<string, number>;
}

export interface EnemyState extends Unit {
  def: string;
  move: string | null;
  hist: string[];
  mem: Record<string, number>;
  dead?: boolean;
  escaped?: boolean;
}

export interface PendingOption {
  key: string;
  label?: string;
  card?: CardInst;
}

export interface Pending {
  action: string;
  title: string;
  options: PendingOption[];
  min: number;
  max: number;
  data?: Record<string, number>;
}

export type CombatKind = 'normal' | 'elite' | 'boss';

export interface Combat {
  turn: number;
  phase: 'player' | 'won' | 'lost';
  kind: CombatKind;
  energy: number;
  maxEnergy: number;
  player: Unit;
  oath: number;
  oathCap: number;
  enemies: EnemyState[];
  draw: CardInst[];
  hand: CardInst[];
  discard: CardInst[];
  exhaust: CardInst[];
  cardsPlayed: number;
  lastEl: Element | null;
  elsPlayed: Element[];
  pending: Pending | null;
  /** 本回合计数器（回合开始清空） */
  tf: Record<string, number>;
  /** 本场战斗计数器 */
  cf: Record<string, number>;
  seq: number;
}

export type MapNodeType = 'fight' | 'elite' | 'event' | 'rest' | 'shop' | 'treasure' | 'boss';

export interface MapNode {
  id: string;
  r: number;
  c: number;
  type: MapNodeType;
  next: string[];
}

export interface GameMap {
  nodes: Record<string, MapNode>;
  starts: string[];
}

export type RewardItem =
  | { k: 'gold'; n: number }
  | { k: 'potion'; id: string }
  | { k: 'relic'; id: string }
  | { k: 'cards'; options: { id: string; up: boolean }[] };

export type SelectPurpose = 'upgrade' | 'remove' | 'duplicate' | 'transform';

export type Screen =
  | { t: 'map' }
  | { t: 'combat' }
  | { t: 'reward'; items: RewardItem[]; boss?: boolean }
  | { t: 'rest'; done?: boolean }
  | { t: 'shop'; cards: { id: string; up: boolean; price: number; sold?: boolean }[]; relics: { id: string; price: number; sold?: boolean }[]; potions: { id: string; price: number; sold?: boolean }[]; removeUsed?: boolean }
  | { t: 'event'; id: string; stage: string; msg?: string }
  | { t: 'treasure'; relic: string; opened?: boolean }
  | { t: 'bossRelic'; options: string[] }
  | { t: 'select'; purpose: SelectPurpose; count: number; title: string; back: Screen; cost?: number }
  | { t: 'over'; win: boolean };

export interface RunStats {
  floors: number;
  kills: number;
  elites: number;
  bosses: number;
  cardsPlayed: number;
  damage: number;
}

export interface RunState {
  v: number;
  seed: string;
  rng: Record<RngStream, RngState>;
  cls: ClassId;
  asc: number;
  hp: number;
  maxHp: number;
  gold: number;
  deck: CardInst[];
  relics: { id: string; n?: number }[];
  potions: (string | null)[];
  act: number;
  floor: number;
  map: GameMap;
  pos: string | null;
  path: string[];
  screen: Screen;
  combat: Combat | null;
  rareOffset: number;
  potionChance: number;
  removeCost: number;
  fightsThisAct: number;
  seenEvents: string[];
  stats: RunStats;
  seq: number;
}

// ---------- 定义（静态数据） ----------

export interface CardDef {
  id: string;
  name: string;
  cls: CardClass;
  type: CardType;
  rarity: Rarity;
  cost: number | 'X' | null;
  upCost?: number;
  target: 'none' | 'enemy';
  el?: Element;
  kw?: Keyword[];
  upKw?: Keyword[];
  v?: Record<string, [number, number]>;
  text: string;
  upText?: string;
  art?: string;
  play?: (c: PlayCtx) => void;
  canPlay?: (c: Combat) => boolean;
  costMod?: (c: Combat, base: number) => number;
}

export type ApplyTo = 'target' | 'all' | 'self' | 'random' | EnemyState;

export interface PlayCtx {
  s: RunState;
  c: Combat;
  card: CardInst;
  def: CardDef;
  up: boolean;
  v: Record<string, number>;
  x: number;
  target: EnemyState | null;
  combo: number;
  res: boolean;
  atk(dmg: number, opt?: { to?: 'target' | 'all' | 'random' | EnemyState; times?: number }): void;
  block(n: number): void;
  draw(n: number): void;
  energy(n: number): void;
  apply(status: string, n: number, to?: ApplyTo): void;
  add(id: string, n: number, pile?: 'hand' | 'draw' | 'discard', up?: boolean): void;
  oath(n: number): void;
  loseHp(n: number): void;
  heal(n: number): void;
  choose(p: Pending): void;
  alive(): EnemyState[];
  rand(): number;
  typeOf(cardId: string): CardType;
  intentOf(e: EnemyState): Intent | null;
}

export type Intent = 'attack' | 'block' | 'buff' | 'debuff' | 'atkDebuff' | 'atkBlock' | 'summon' | 'unknown' | 'escape' | 'sleep';

export interface EnemyCtx {
  s: RunState;
  c: Combat;
  e: EnemyState;
  block(n: number, who?: EnemyState): void;
  apply(status: string, n: number, who: 'player' | 'self' | EnemyState): void;
  addCard(id: string, n: number, pile: 'draw' | 'discard' | 'hand'): void;
  summon(def: string, hp?: number): EnemyState | null;
  heal(n: number, who?: EnemyState): void;
  allies(): EnemyState[];
  /** 上次攻击实际造成的生命损失 */
  lastHpDealt: number;
}

export interface MoveDef {
  id: string;
  name: string;
  intent: Intent;
  dmg?: number;
  hits?: number;
  act?: (x: EnemyCtx) => void;
  /** 每段攻击命中后触发 */
  onHit?: (x: EnemyCtx) => void;
}

export interface EnemyDef {
  id: string;
  name: string;
  tier: 'normal' | 'elite' | 'boss';
  act: number;
  hp: [number, number];
  art: string;
  desc: string;
  moves: MoveDef[];
  next: (e: EnemyState, x: AiCtx) => string;
  onSpawn?: (x: EnemyCtx) => void;
  onDamaged?: (x: EnemyCtx) => void;
  onDeath?: (x: EnemyCtx) => void;
}

export interface AiCtx {
  c: Combat;
  turn: number;
  rand(): number;
  last(n?: number): string | undefined;
  repeats(id: string): number;
}

export type GameEvent =
  | { t: 'dmg'; unit: string; n: number; blocked: number }
  | { t: 'block'; unit: string; n: number }
  | { t: 'heal'; unit: string; n: number }
  | { t: 'status'; unit: string; status: string; n: number }
  | { t: 'text'; unit: string; text: string }
  | { t: 'die'; unit: string }
  | { t: 'play'; id: string }
  | { t: 'shuffle' }
  | { t: 'toast'; text: string };

export interface RelicRef {
  id: string;
  n?: number;
}

export interface RelicDef {
  id: string;
  name: string;
  rarity: 'starter' | 'common' | 'uncommon' | 'rare' | 'boss';
  cls?: ClassId;
  art: string;
  desc: string;
  /** 额外的每回合能量 */
  energy?: number;
  onPickup?(s: RunState): void;
  onCombatStart?(x: PlayCtx, r: RelicRef): void;
  onTurnStart?(x: PlayCtx, r: RelicRef): void;
  onTurnEnd?(x: PlayCtx, r: RelicRef): void;
  onCardPlayed?(x: PlayCtx, r: RelicRef, def: CardDef): void;
  onExhaust?(x: PlayCtx, r: RelicRef): void;
  onCombatEnd?(s: RunState, r: RelicRef): void;
}

export interface PotionDef {
  id: string;
  name: string;
  rarity: 'common' | 'uncommon' | 'rare';
  art: string;
  desc: string;
  target: 'none' | 'enemy';
  /** 被动药水（不可主动使用） */
  passive?: boolean;
  use(x: PlayCtx): void;
}
