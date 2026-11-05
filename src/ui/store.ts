import { useEffect, useState } from 'preact/hooks';
import { drainEvents } from '../engine/combat';
import { SAVE_VERSION } from '../engine/run';
import { STATUSES } from '../engine/statuses';
import type { CardInst, GameEvent, RunState } from '../engine/types';

const SAVE_KEY = 'abyss-oath-save';
const SETTINGS_KEY = 'abyss-oath-settings';

export type Overlay =
  | null
  | { t: 'deck' }
  | { t: 'pile'; which: 'draw' | 'discard' | 'exhaust' }
  | { t: 'relic'; id: string }
  | { t: 'potion'; slot: number }
  | { t: 'enemy'; id: string }
  | { t: 'codex' }
  | { t: 'menu' };

export interface Floater {
  id: number;
  unit: string;
  text: string;
  cls: string;
  delay: number;
}

export interface Settings {
  vibrate: boolean;
  fast: boolean;
}

interface Store {
  run: RunState | null;
  view: 'menu' | 'classSelect' | 'game';
  overlay: Overlay;
  floaters: Floater[];
  toasts: { id: number; text: string }[];
  potionTargeting: number | null;
  peek: CardInst | { id: string; up: boolean } | null;
  settings: Settings;
}

function safeGet(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function safeSet(k: string, v: string | null) {
  try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* 存储不可用时忽略 */ }
}

function loadRun(): RunState | null {
  const raw = safeGet(SAVE_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as RunState;
    if (s.v !== SAVE_VERSION) return null;
    s.path ??= [];
    return s;
  } catch {
    return null;
  }
}

function loadSettings(): Settings {
  try { return { vibrate: true, fast: false, ...JSON.parse(safeGet(SETTINGS_KEY) ?? '{}') }; } catch { return { vibrate: true, fast: false }; }
}

export const store: Store = {
  run: loadRun(),
  view: 'menu',
  overlay: null,
  floaters: [],
  toasts: [],
  potionTargeting: null,
  peek: null,
  settings: loadSettings(),
};

const listeners = new Set<() => void>();

export function useStore(): Store {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return store;
}

export function refresh() {
  listeners.forEach((l) => l());
}

export function save() {
  const s = store.run;
  if (!s || s.screen.t === 'over') safeSet(SAVE_KEY, null);
  else safeSet(SAVE_KEY, JSON.stringify(s));
}

export function saveSettings() {
  safeSet(SETTINGS_KEY, JSON.stringify(store.settings));
}

/** 执行一个引擎指令：结算事件 → 存档 → 重绘 */
export function act(fn: (s: RunState) => void) {
  if (!store.run) return;
  fn(store.run);
  handleEvents(drainEvents());
  save();
  refresh();
}

/** 查看卡牌详情（叠加在其他弹窗之上） */
export function peek(card: Store['peek']) {
  store.peek = card;
  refresh();
}

export function setOverlay(o: Overlay) {
  store.overlay = o;
  refresh();
}

let fid = 0;
export function toast(text: string) {
  const id = ++fid;
  store.toasts.push({ id, text });
  refresh();
  setTimeout(() => {
    store.toasts = store.toasts.filter((t) => t.id !== id);
    refresh();
  }, 2200);
}

function handleEvents(evs: GameEvent[]) {
  const step = store.settings.fast ? 40 : 110;
  let i = 0;
  let hurt = false;
  for (const e of evs) {
    let f: Omit<Floater, 'id' | 'delay'> | null = null;
    if (e.t === 'dmg') {
      f = { unit: e.unit, text: e.n > 0 ? `-${e.n}` : e.blocked > 0 ? '格挡' : '0', cls: e.n > 0 ? 'f-dmg' : 'f-block' };
      if (e.unit === 'player' && e.n > 0) hurt = true;
    } else if (e.t === 'block') f = { unit: e.unit, text: `+${e.n}🛡`, cls: 'f-block' };
    else if (e.t === 'heal') f = { unit: e.unit, text: `+${e.n}`, cls: 'f-heal' };
    else if (e.t === 'status' && e.n > 0 && STATUSES[e.status]) {
      const sd = STATUSES[e.status];
      f = { unit: e.unit, text: `${sd.icon}${sd.name}${e.n > 1 && e.n < 90 ? ' ' + e.n : ''}`, cls: sd.kind === 'debuff' ? 'f-debuff' : 'f-buff' };
    } else if (e.t === 'text') f = { unit: e.unit, text: e.text, cls: 'f-text' };
    else if (e.t === 'toast') toast(e.text);
    if (!f) continue;
    const fl: Floater = { ...f, id: ++fid, delay: Math.min(i++, 14) * step };
    store.floaters.push(fl);
    setTimeout(() => {
      store.floaters = store.floaters.filter((x) => x.id !== fl.id);
      refresh();
    }, fl.delay + 1100);
  }
  if (hurt && store.settings.vibrate) {
    try { navigator.vibrate?.(30); } catch { /* 不支持震动 */ }
  }
}

export function startRun(run: RunState) {
  store.run = run;
  store.view = 'game';
  store.overlay = null;
  save();
  refresh();
}

export function abandonRun() {
  store.run = null;
  store.view = 'menu';
  store.overlay = null;
  save();
  refresh();
}
