import { useEffect, useRef, useState } from 'preact/hooks';
import { alive, canPlay, cardDef, getMove, intentDamage } from '../engine/combat';
import * as R from '../engine/run';
import { ENEMIES, CLASS_MAP } from '../data';
import { STATUSES } from '../engine/statuses';
import type { CardInst, EnemyState, Intent, RunState } from '../engine/types';
import { Card, CardGrid, Floaters, HpBar, Modal, StatusRow } from './components';
import { act, peek, refresh, setOverlay, store, useStore } from './store';
import { EL_ICON } from './text';

const INTENT_ICON: Record<Intent, string> = {
  attack: '⚔️', block: '🛡️', buff: '⬆️', debuff: '🌀', atkDebuff: '⚔️🌀', atkBlock: '⚔️🛡️',
  summon: '🔮', unknown: '❓', escape: '💨', sleep: '💤',
};

export function CombatScreen() {
  const s = useStore();
  const run = s.run!;
  const c = run.combat!;
  const [sel, setSel] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ uid: string; dx: number; dy: number; over: string | null; up: boolean } | null>(null);
  const handRef = useRef<HTMLDivElement>(null);
  const [handW, setHandW] = useState(360);

  useEffect(() => {
    const measure = () => handRef.current && setHandW(handRef.current.clientWidth);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // 卡牌离开手牌后清除选中
  if (sel && !c.hand.some((h) => h.uid === sel)) setTimeout(() => setSel(null));

  const selCard = c.hand.find((h) => h.uid === sel) ?? null;
  const selDef = selCard ? cardDef(selCard.id) : null;
  const enemies = c.enemies.filter((e) => !e.dead && !e.escaped);

  const play = (uid: string, target?: string) => {
    setSel(null);
    act((r) => R.cmdPlay(r, uid, target));
  };

  const onEnemyTap = (e: EnemyState) => {
    if (store.potionTargeting !== null) {
      const slot = store.potionTargeting;
      store.potionTargeting = null;
      act((r) => R.cmdPotion(r, slot, e.id));
      return;
    }
    if (selCard && selDef?.target === 'enemy') {
      if (canPlay(c, selCard)) play(selCard.uid, e.id);
      return;
    }
    setOverlay({ t: 'enemy', id: e.id });
  };

  const onCardTap = (cd: CardInst) => {
    const def = cardDef(cd.id);
    if (sel !== cd.uid) { setSel(cd.uid); return; }
    if (!canPlay(c, cd)) return;
    if (def.target === 'none') play(cd.uid);
    else if (enemies.length === 1) play(cd.uid, enemies[0].id);
  };

  // ---------- 拖拽 ----------
  const pd = useRef<{ uid: string; x: number; y: number; moved: boolean; timer: number } | null>(null);
  const onPointerDown = (ev: PointerEvent, cd: CardInst) => {
    (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
    const timer = window.setTimeout(() => {
      if (pd.current && !pd.current.moved) {
        pd.current = null;
        setDrag(null);
        peek(cd);
      }
    }, 550);
    pd.current = { uid: cd.uid, x: ev.clientX, y: ev.clientY, moved: false, timer };
  };
  const onPointerMove = (ev: PointerEvent) => {
    const p = pd.current;
    if (!p) return;
    const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
    if (!p.moved && Math.hypot(dx, dy) < 10) return;
    p.moved = true;
    clearTimeout(p.timer);
    const handTop = handRef.current?.getBoundingClientRect().top ?? 0;
    const over = document.elementsFromPoint(ev.clientX, ev.clientY)
      .map((el) => (el as HTMLElement).dataset?.enemy).find(Boolean) ?? null;
    setSel(p.uid);
    setDrag({ uid: p.uid, dx, dy, over, up: ev.clientY < handTop - 20 });
  };
  const onPointerUp = (cd: CardInst) => {
    const p = pd.current;
    pd.current = null;
    if (!p) return;
    clearTimeout(p.timer);
    if (!p.moved) { setDrag(null); onCardTap(cd); return; }
    const d = drag;
    setDrag(null);
    if (!d || !canPlay(c, cd)) return;
    const def = cardDef(cd.id);
    if (def.target === 'enemy') {
      if (d.over) play(cd.uid, d.over);
      else if (d.up && enemies.length === 1) play(cd.uid, enemies[0].id);
    } else if (d.up) play(cd.uid);
  };

  // ---------- 手牌布局 ----------
  const n = c.hand.length;
  const cw = Math.min(84, handW / 4.6);
  const gap = n > 1 ? Math.min(cw * 0.95, (handW - cw - 8) / (n - 1)) : 0;
  const totalW = cw + gap * (n - 1);
  const startX = (handW - totalW) / 2;

  const p = c.player;
  const cls = CLASS_MAP[run.cls];
  const targetForPreview = drag?.over ? enemies.find((e) => e.id === drag.over) ?? null : null;

  return (
    <div class="combat" onClick={() => { if (!drag) setSel(null); }}>
      <div class="enemy-area">
        {enemies.map((e) => (
          <EnemyView key={e.id} run={run} e={e}
            targetable={(!!selDef && selDef.target === 'enemy') || store.potionTargeting !== null}
            hovered={drag?.over === e.id}
            onTap={(ev) => { ev.stopPropagation(); onEnemyTap(e); }} />
        ))}
      </div>
      {store.potionTargeting !== null && <div class="hint">选择药水的目标 <button class="btn btn-sm" onClick={(e) => { e.stopPropagation(); store.potionTargeting = null; refresh(); }}>取消</button></div>}
      {selDef?.target === 'enemy' && !drag && enemies.length > 1 && <div class="hint">点击敌人打出</div>}
      <div class="player-area">
        <div class="unit player-unit" data-unit="player">
          <Floaters unit="player" />
          <div class="unit-art">{cls.art}</div>
          <HpBar hp={p.hp} max={p.maxHp} block={p.block} />
          <StatusRow u={p} />
        </div>
        <div class="class-res">
          {run.cls === 'knight' && <div class="res-pill oath">⚜️ 誓约 {c.oath}/{c.oathCap}</div>}
          {run.cls === 'rogue' && <div class="res-pill combo">🔗 连击 {c.cardsPlayed}</div>}
          {run.cls === 'mage' && <div class="res-pill el">上一元素 {c.lastEl ? EL_ICON[c.lastEl] : '—'}</div>}
        </div>
      </div>
      <div class="control-row">
        <div class="energy-orb">{c.energy}<small>/{c.maxEnergy}</small></div>
        <button class="pile-btn" onClick={(e) => { e.stopPropagation(); setOverlay({ t: 'pile', which: 'draw' }); }}>抽 {c.draw.length}</button>
        <button class="pile-btn" onClick={(e) => { e.stopPropagation(); setOverlay({ t: 'pile', which: 'discard' }); }}>弃 {c.discard.length}</button>
        {c.exhaust.length > 0 && <button class="pile-btn" onClick={(e) => { e.stopPropagation(); setOverlay({ t: 'pile', which: 'exhaust' }); }}>耗 {c.exhaust.length}</button>}
        <span class="tb-spacer" />
        <button class={`btn end-turn ${!c.hand.some((h) => canPlay(c, h)) ? 'pulse' : ''}`}
          onClick={(e) => { e.stopPropagation(); setSel(null); act((r) => R.cmdEndTurn(r)); }}>结束回合</button>
      </div>
      <div class={`hand ${drag?.up ? 'release-zone' : ''}`} ref={handRef} onClick={(e) => e.stopPropagation()}>
        {c.hand.map((cd, i) => {
          const isSel = sel === cd.uid;
          const isDrag = drag?.uid === cd.uid;
          const mid = (n - 1) / 2;
          const rot = isSel ? 0 : (i - mid) * Math.min(4, 24 / Math.max(n, 1));
          const lift = isSel ? -50 : -(mid * mid - (i - mid) * (i - mid)) * 1.6 - 4;
          let tx = startX + gap * i + (isDrag ? drag!.dx : 0);
          if (isSel && !isDrag) tx = Math.max(cw * 0.15, Math.min(handW - cw * 1.15, tx));
          const ty = lift + (isDrag ? drag!.dy + 46 : 0);
          const playable = canPlay(c, cd);
          return (
            <div key={cd.uid} class={`hand-card ${isSel ? 'sel' : ''} ${isDrag ? 'dragging' : ''}`}
              style={{ width: cw + 'px', transform: `translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(${isSel ? 1.25 : 1})`, zIndex: isSel ? 50 : i }}
              onPointerDown={(e) => onPointerDown(e as PointerEvent, cd)}
              onPointerMove={(e) => onPointerMove(e as PointerEvent)}
              onPointerUp={() => onPointerUp(cd)}
              onPointerCancel={() => { pd.current = null; setDrag(null); }}>
              <Card card={cd} combat={c} target={isDrag ? targetForPreview : enemies.length === 1 ? enemies[0] : null} dim={!playable} />
            </div>
          );
        })}
      </div>
      {c.pending && <PendingModal run={run} />}
      <EnemyInfo run={run} />
    </div>
  );
}

function EnemyView({ run, e, targetable, hovered, onTap }: { run: RunState; e: EnemyState; targetable: boolean; hovered: boolean; onTap: (ev: MouseEvent) => void }) {
  const def = ENEMIES[e.def];
  const m = e.move ? getMove(e) : null;
  const dmg = intentDamage(run, e);
  return (
    <div class={`unit enemy tier-${def.tier} ${targetable ? 'targetable' : ''} ${hovered ? 'hovered' : ''}`} data-enemy={e.id} onClick={onTap}>
      <Floaters unit={e.id} />
      <div class="intent">
        {e.st.frozen ? '🧊' : m ? INTENT_ICON[m.intent] : ''}
        {!e.st.frozen && dmg && <b>{dmg.dmg}{dmg.hits > 1 ? `×${dmg.hits}` : ''}</b>}
      </div>
      <div class="unit-art">{def.art}</div>
      <div class="unit-name">{e.name}</div>
      <HpBar hp={e.hp} max={e.maxHp} block={e.block} />
      <StatusRow u={e} />
    </div>
  );
}

function EnemyInfo({ run }: { run: RunState }) {
  const s = useStore();
  const o = s.overlay;
  if (!o || o.t !== 'enemy') return null;
  const e = run.combat?.enemies.find((x) => x.id === o.id);
  if (!e) return null;
  const def = ENEMIES[e.def];
  const m = e.move ? getMove(e) : null;
  const dmg = intentDamage(run, e);
  return (
    <Modal title={`${def.art} ${e.name}`} onClose={() => setOverlay(null)}>
      <p class="muted">{def.desc}</p>
      {m && <p>下一步：<b>{INTENT_ICON[m.intent]} {m.name}</b>{dmg ? ` · ${dmg.dmg}${dmg.hits > 1 ? '×' + dmg.hits : ''} 伤害` : ''}</p>}
      {Object.entries(e.st).filter(([k, v]) => v && STATUSES[k]).map(([k, v]) => (
        <div class="status-desc">{STATUSES[k].icon} <b>{STATUSES[k].name}{v < 90 ? ' ' + v : ''}</b>：{STATUSES[k].desc}</div>
      ))}
    </Modal>
  );
}

function PendingModal({ run }: { run: RunState }) {
  const p = run.combat!.pending!;
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (k: string) => {
    if (picked.includes(k)) setPicked(picked.filter((x) => x !== k));
    else if (p.max === 1) setPicked([k]);
    else if (picked.length < p.max) setPicked([...picked, k]);
  };
  const confirm = () => { act((r) => R.cmdPending(r, picked)); setPicked([]); };
  const hasCards = p.options.some((o) => o.card);
  return (
    <Modal title={p.title}>
      {hasCards ? (
        <CardGrid cards={p.options.map((o) => o.card!)} onPick={(_c, i) => toggle(p.options[i].key)}
          selected={(c) => picked.includes(p.options.find((o) => o.card === c)!.key)} />
      ) : (
        <div class="btn-col">
          {p.options.map((o) => (
            <button class={`btn ${picked.includes(o.key) ? 'btn-on' : ''}`} onClick={() => toggle(o.key)}>
              {EL_ICON[o.key] ?? ''} {o.label}
            </button>
          ))}
        </div>
      )}
      <button class="btn btn-primary" disabled={picked.length < p.min} onClick={confirm}>确定</button>
    </Modal>
  );
}

export { alive };
