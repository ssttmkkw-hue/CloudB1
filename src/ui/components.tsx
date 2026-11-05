import type { ComponentChildren } from 'preact';
import { cardDef, effCost } from '../engine/combat';
import { STATUSES } from '../engine/statuses';
import { POTIONS, RELICS } from '../data';
import type { CardInst, Combat, EnemyState, Unit } from '../engine/types';
import { act, peek, setOverlay, store, useStore } from './store';
import { cardName, cardText, EL_ICON, glossaryFor, RARITY_NAME, TYPE_NAME } from './text';
import * as R from '../engine/run';
import { CLASS_MAP } from '../data';

// ---------------- 卡牌 ----------------
interface CardProps {
  card: CardInst | { id: string; up: boolean };
  combat?: Combat | null;
  target?: EnemyState | null;
  dim?: boolean;
  size?: 'sm' | 'md' | 'lg';
  selected?: boolean;
  onClick?: () => void;
  badge?: ComponentChildren;
}

export function Card({ card, combat, target, dim, size = 'md', selected, onClick, badge }: CardProps) {
  const def = cardDef(card.id);
  let cost: string | null = def.cost === null ? null : def.cost === 'X' ? 'X' : String(card.up && def.upCost !== undefined ? def.upCost : def.cost);
  let costCls = '';
  if (combat && 'uid' in card && def.cost !== null) {
    const ec = effCost(combat, card as CardInst);
    if (ec !== null && ec !== 'X') {
      const base = card.up && def.upCost !== undefined ? def.upCost : (def.cost as number);
      if (ec < base) costCls = 'cost-down';
      if (ec > base) costCls = 'cost-up';
      cost = String(ec);
    }
  }
  return (
    <div class={`card-box card-${size}`} onClick={onClick}>
    <div class={`card t-${def.type} r-${def.rarity} cls-${def.cls} ${dim ? 'dim' : ''} ${selected ? 'selected' : ''} ${card.up ? 'upgraded' : ''}`}>
      {cost !== null && <div class={`card-cost ${costCls}`}>{cost}</div>}
      {def.el && <div class="card-el">{EL_ICON[def.el]}</div>}
      <div class="card-name">{cardName(card)}</div>
      <div class="card-art">{def.art ?? '🃏'}</div>
      <div class="card-type">{TYPE_NAME[def.type]}</div>
      <div class="card-text">
        <div>{cardText(card, combat, target).map((p) => <span class={p.c ? 'tx-' + p.c : ''}>{p.t}</span>)}</div>
      </div>
      {badge}
    </div>
    </div>
  );
}

export function CardDetail({ card }: { card: CardInst | { id: string; up: boolean } }) {
  const def = cardDef(card.id);
  const showUp = !card.up && !['curse', 'status'].includes(def.cls);
  return (
    <div class="card-detail" onClick={(e) => e.stopPropagation()}>
      <div class="card-detail-row">
        <Card card={card} size="lg" />
        {showUp && <Card card={{ id: card.id, up: true }} size="lg" />}
      </div>
      <div class="muted center">{RARITY_NAME[def.rarity]} · {TYPE_NAME[def.type]}{showUp ? ' · 右为升级后' : ''}</div>
      <div class="glossary">
        {glossaryFor(card).map(([k, d]) => <div><b>{k}</b>：{d}</div>)}
      </div>
    </div>
  );
}

// ---------------- 状态 / 血条 ----------------
export function StatusRow({ u }: { u: Unit }) {
  const entries = Object.entries(u.st).filter(([k, v]) => v && STATUSES[k] && STATUSES[k].kind !== 'hidden');
  return (
    <div class="status-row">
      {entries.map(([k, v]) => (
        <span class={`st st-${STATUSES[k].kind}`} title={`${STATUSES[k].name}：${STATUSES[k].desc}`}>
          {STATUSES[k].icon}
          {v > 1 && v < 90 ? <small>{v}</small> : null}
        </span>
      ))}
    </div>
  );
}

export function HpBar({ hp, max, block }: { hp: number; max: number; block?: number }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  return (
    <div class={`hpbar ${block ? 'has-block' : ''}`}>
      <div class="hpbar-fill" style={{ width: pct + '%' }} />
      <div class="hpbar-text">{hp}/{max}</div>
      {block ? <div class="block-badge">🛡{block}</div> : null}
    </div>
  );
}

export function Floaters({ unit }: { unit: string }) {
  const s = useStore();
  return (
    <div class="floaters">
      {s.floaters.filter((f) => f.unit === unit).map((f) => (
        <div key={f.id} class={`floater ${f.cls}`} style={{ animationDelay: f.delay + 'ms', marginLeft: ((f.id * 37) % 48) - 24 + 'px', marginTop: ((f.id * 53) % 30) - 15 + 'px' }}>{f.text}</div>
      ))}
    </div>
  );
}

// ---------------- 顶栏 ----------------
export function TopBar() {
  const s = useStore();
  const run = s.run!;
  const hp = run.combat ? run.combat.player.hp : run.hp;
  const maxHp = run.combat ? run.combat.player.maxHp : run.maxHp;
  return (
    <div class="topbar">
      <div class="topbar-row">
        <span class="tb-item tb-class">{CLASS_MAP[run.cls].art}</span>
        <span class="tb-item tb-hp">❤️ {hp}/{maxHp}</span>
        <span class="tb-item tb-gold">💰 {run.gold}</span>
        <span class="tb-potions">
          {run.potions.map((p, i) => (
            <button class={`potion-slot ${p ? '' : 'empty'} ${s.potionTargeting === i ? 'active' : ''}`}
              onClick={() => p && setOverlay({ t: 'potion', slot: i })}>
              {p ? POTIONS[p].art : ''}
            </button>
          ))}
        </span>
        <span class="tb-spacer" />
        <button class="tb-btn" onClick={() => setOverlay({ t: 'deck' })}>🂠{run.deck.length}</button>
        <button class="tb-btn" onClick={() => setOverlay({ t: 'menu' })}>⚙</button>
      </div>
      <div class="topbar-row relic-row">
        <span class="tb-floor">第{run.act}层·{run.floor}楼</span>
        {run.relics.map((r) => (
          <button class="relic" onClick={() => setOverlay({ t: 'relic', id: r.id })}>
            {RELICS[r.id].art}
            {r.id === 'ink_bottle' && r.n ? <small>{r.n}</small> : null}
            {r.id === 'phoenix' && r.n ? <small>✕</small> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------- 弹窗 ----------------
export function Modal({ children, onClose, title }: { children: ComponentChildren; onClose?: () => void; title?: string }) {
  return (
    <div class="modal-bg" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        {title && <div class="modal-title">{title}</div>}
        {children}
        {onClose && <button class="btn btn-ghost modal-close" onClick={onClose}>关闭</button>}
      </div>
    </div>
  );
}

export function CardGrid({ cards, onPick, selected, combat }: {
  cards: (CardInst | { id: string; up: boolean })[];
  onPick?: (c: CardInst | { id: string; up: boolean }, i: number) => void;
  selected?: (c: CardInst | { id: string; up: boolean }) => boolean;
  combat?: Combat | null;
}) {
  return (
    <div class="card-grid">
      {cards.map((c, i) => (
        <Card card={c} size="sm" combat={combat} selected={selected?.(c)}
          onClick={() => (onPick ? onPick(c, i) : peek(c))} />
      ))}
      {!cards.length && <div class="muted center">（空）</div>}
    </div>
  );
}

export function sortDeck<T extends { id: string; up: boolean }>(cards: T[]): T[] {
  const order = { attack: 0, skill: 1, power: 2, status: 3, curse: 4 } as Record<string, number>;
  return [...cards].sort((a, b) => {
    const da = cardDef(a.id), db = cardDef(b.id);
    return order[da.type] - order[db.type] || da.name.localeCompare(db.name, 'zh') || Number(a.up) - Number(b.up);
  });
}

export function PeekLayer() {
  const s = useStore();
  if (!s.peek) return null;
  return <div class="modal-bg peek" onClick={() => peek(null)}><CardDetail card={s.peek} /></div>;
}

export function Overlays() {
  const s = useStore();
  const o = s.overlay;
  const run = s.run;
  if (!o) return null;
  const close = () => setOverlay(null);
  switch (o.t) {
    case 'deck':
      return <Modal title={`牌组（${run!.deck.length}）`} onClose={close}><CardGrid cards={sortDeck(run!.deck)} /></Modal>;
    case 'pile': {
      const c = run!.combat!;
      const name = { draw: '抽牌堆', discard: '弃牌堆', exhaust: '消耗堆' }[o.which];
      const cards = o.which === 'draw' ? sortDeck(c.draw) : [...c[o.which]].reverse();
      return <Modal title={`${name}（${cards.length}）${o.which === 'draw' ? '· 顺序已隐藏' : ''}`} onClose={close}><CardGrid cards={cards} combat={c} /></Modal>;
    }
    case 'relic': {
      const d = RELICS[o.id];
      return <Modal title={`${d.art} ${d.name}`} onClose={close}><p class="center">{d.desc}</p></Modal>;
    }
    case 'potion': {
      const id = run!.potions[o.slot];
      if (!id) return null;
      const d = POTIONS[id];
      const c = run!.combat;
      const canUse = !!c && c.phase === 'player' && !c.pending && !d.passive;
      const use = () => {
        if (d.target === 'enemy' && c && c.enemies.filter((e) => !e.dead && !e.escaped).length > 1) {
          store.potionTargeting = o.slot;
          setOverlay(null);
          return;
        }
        setOverlay(null);
        act((r) => R.cmdPotion(r, o.slot));
      };
      return (
        <Modal title={`${d.art} ${d.name}`} onClose={close}>
          <p class="center">{d.desc}</p>
          <div class="btn-row">
            <button class="btn" disabled={!canUse} onClick={use}>{d.passive ? '自动生效' : c ? '使用' : '仅战斗中可用'}</button>
            <button class="btn btn-danger" onClick={() => { setOverlay(null); act((r) => R.discardPotion(r, o.slot)); }}>丢弃</button>
          </div>
        </Modal>
      );
    }
    default:
      return null;
  }
}
