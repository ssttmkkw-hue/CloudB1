import { useState } from 'preact/hooks';
import * as R from '../engine/run';
import { cardDef } from '../engine/combat';
import { ALL_CARDS, CLASSES, EVENTS, POTIONS, RELICS } from '../data';
import type { CardInst, ClassId } from '../engine/types';
import { Card, CardGrid, Modal, sortDeck } from './components';
import { abandonRun, act, peek, refresh, saveSettings, setOverlay, startRun, store, useStore } from './store';

// ---------------- 主菜单 ----------------
export function MenuScreen() {
  const s = useStore();
  return (
    <div class="menu-screen">
      <div class="logo">
        <div class="logo-icon">🗝️</div>
        <h1>深渊牌誓</h1>
        <div class="muted">卡牌地下城 · Roguelike</div>
      </div>
      <div class="btn-col menu-btns">
        {s.run && <button class="btn btn-primary btn-lg" onClick={() => { store.view = 'game'; refresh(); }}>继续游戏</button>}
        <button class={`btn btn-lg ${s.run ? '' : 'btn-primary'}`} onClick={() => {
          if (s.run && !confirm('开始新游戏会放弃当前进度，确定吗？')) return;
          store.view = 'classSelect';
          refresh();
        }}>新游戏</button>
        <button class="btn btn-lg" onClick={() => setOverlay({ t: 'codex' })}>卡牌图鉴</button>
      </div>
      <div class="muted small center">v0.1 · 第一层内容</div>
    </div>
  );
}

// ---------------- 职业选择 ----------------
export function ClassSelectScreen() {
  const [idx, setIdx] = useState(0);
  const [seed, setSeed] = useState('');
  const cls = CLASSES[idx];
  const relic = RELICS[cls.relic];
  return (
    <div class="class-screen" style={{ '--cls': cls.color }}>
      <div class="class-header">
        <button class="btn btn-ghost" onClick={() => { store.view = 'menu'; refresh(); }}>← 返回</button>
        <span>选择职业</span>
        <span />
      </div>
      <div class="class-tabs">
        {CLASSES.map((c, i) => (
          <button class={`class-tab ${i === idx ? 'on' : ''}`} style={{ '--cls': c.color }} onClick={() => setIdx(i)}>
            <span>{c.art}</span>{c.name}
          </button>
        ))}
      </div>
      <div class="class-card">
        <div class="class-art">{cls.art}</div>
        <h2>{cls.name}</h2>
        <div class="muted">{cls.title}</div>
        <p>{cls.desc}</p>
        <div class="class-stats">
          <span>❤️ {cls.hp}</span>
          <span>难度 {'★'.repeat(cls.difficulty)}{'☆'.repeat(3 - cls.difficulty)}</span>
        </div>
        <div class="class-relic">{relic.art} <b>{relic.name}</b>：{relic.desc}</div>
        <div class="class-styles">{cls.styles.map((x) => <span class="tag">{x}</span>)}</div>
        <div class="class-deck">
          {cls.deck.map(([id, n]) => <span class="tag">{cardDef(id).name} ×{n}</span>)}
        </div>
      </div>
      <input class="seed-input" placeholder="种子（可选，留空随机）" value={seed}
        onInput={(e) => setSeed((e.target as HTMLInputElement).value.trim().toUpperCase())} />
      <button class="btn btn-primary btn-lg" onClick={() => startRun(R.newRun(cls.id as ClassId, seed || undefined))}>开始冒险</button>
    </div>
  );
}

// ---------------- 奖励 ----------------
export function RewardScreen() {
  const s = useStore();
  const run = s.run!;
  const sc = run.screen;
  const [cardsOpen, setCardsOpen] = useState<number | null>(null);
  if (sc.t !== 'reward') return null;
  const fullPotions = !run.potions.includes(null);
  return (
    <div class="panel-screen">
      <h2 class="screen-title">{sc.boss ? '👑 击败 Boss！' : '⚔️ 战斗胜利'}</h2>
      <div class="reward-list">
        {sc.items.map((it, i) => {
          if (it.k === 'gold') return <button class="reward-item" onClick={() => act((r) => R.claimReward(r, i))}>💰 {it.n} 金币</button>;
          if (it.k === 'relic') return <button class="reward-item" onClick={() => act((r) => R.claimReward(r, i))}>{RELICS[it.id].art} {RELICS[it.id].name}<small>{RELICS[it.id].desc}</small></button>;
          if (it.k === 'potion') return (
            <button class="reward-item" disabled={fullPotions} onClick={() => act((r) => R.claimReward(r, i))}>
              {POTIONS[it.id].art} {POTIONS[it.id].name}<small>{fullPotions ? '药水栏已满（可在顶栏丢弃）' : POTIONS[it.id].desc}</small>
            </button>
          );
          return <button class="reward-item" onClick={() => setCardsOpen(i)}>🃏 选择一张卡牌加入牌组</button>;
        })}
      </div>
      <button class="btn btn-primary btn-lg" onClick={() => act((r) => R.leaveReward(r))}>
        {sc.items.length ? '跳过剩余奖励，继续' : '继续'}
      </button>
      {cardsOpen !== null && sc.items[cardsOpen]?.k === 'cards' && (() => {
        const it = sc.items[cardsOpen] as { k: 'cards'; options: { id: string; up: boolean }[] };
        return (
          <Modal title="选择一张卡牌（长按查看详情）">
            <div class="card-choice">
              {it.options.map((o, ci) => (
                <Card card={o} size="lg" onClick={() => { setCardsOpen(null); act((r) => R.claimReward(r, cardsOpen, ci)); }} />
              ))}
            </div>
            <div class="btn-row">
              <button class="btn btn-ghost" onClick={() => setCardsOpen(null)}>返回</button>
              <button class="btn" onClick={() => { setCardsOpen(null); act((r) => { if (r.screen.t === 'reward') r.screen.items.splice(cardsOpen, 1); }); }}>跳过</button>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

// ---------------- 休息 ----------------
export function RestScreen() {
  const run = useStore().run!;
  const heal = R.restHealAmount(run);
  const canUp = R.selectable(run, 'upgrade').length > 0;
  return (
    <div class="panel-screen rest-screen">
      <div class="big-art">🔥</div>
      <h2 class="screen-title">篝火</h2>
      <div class="muted center">温暖的火光驱散了墓窟的寒意。</div>
      <div class="rest-options">
        <button class="rest-btn" disabled={heal === 0} onClick={() => act((r) => R.rest(r, 'heal'))}>
          <span>💤</span><b>休息</b><small>{heal ? `回复 ${heal} 生命` : '黑曜石王座：无法回复'}</small>
        </button>
        <button class="rest-btn" disabled={!canUp} onClick={() => act((r) => R.rest(r, 'upgrade'))}>
          <span>⚒️</span><b>锻造</b><small>升级 1 张牌</small>
        </button>
      </div>
    </div>
  );
}

// ---------------- 商店 ----------------
export function ShopScreen() {
  const run = useStore().run!;
  const sc = run.screen;
  if (sc.t !== 'shop') return null;
  return (
    <div class="panel-screen shop-screen">
      <h2 class="screen-title">💰 地下商人</h2>
      <div class="muted center">「随便看看，童叟无欺。」</div>
      <div class="shop-cards">
        {sc.cards.map((it, i) => (
          <div class={`shop-item ${it.sold ? 'sold' : ''}`}>
            {!it.sold && <Card card={it} size="sm" onClick={() => peek(it)} />}
            <button class="price" disabled={it.sold || it.price > run.gold} onClick={() => act((r) => R.shopBuy(r, 'card', i))}>
              {it.sold ? '已售' : `💰${it.price}`}
            </button>
          </div>
        ))}
      </div>
      <div class="shop-row">
        {sc.relics.map((it, i) => (
          <div class={`shop-relic ${it.sold ? 'sold' : ''}`}>
            <div class="relic-big" onClick={() => setOverlay({ t: 'relic', id: it.id })}>{RELICS[it.id].art}</div>
            <small>{RELICS[it.id].name}</small>
            <button class="price" disabled={it.sold || it.price > run.gold} onClick={() => act((r) => R.shopBuy(r, 'relic', i))}>
              {it.sold ? '已售' : `💰${it.price}`}
            </button>
          </div>
        ))}
        {sc.potions.map((it, i) => (
          <div class={`shop-relic ${it.sold ? 'sold' : ''}`}>
            <div class="relic-big" title={POTIONS[it.id].desc}>{POTIONS[it.id].art}</div>
            <small>{POTIONS[it.id].name}</small>
            <button class="price" disabled={it.sold || it.price > run.gold || !run.potions.includes(null)} onClick={() => act((r) => R.shopBuy(r, 'potion', i))}>
              {it.sold ? '已售' : `💰${it.price}`}
            </button>
          </div>
        ))}
      </div>
      <button class="btn" disabled={sc.removeUsed || run.gold < run.removeCost} onClick={() => act((r) => R.shopRemove(r))}>
        🗑️ 移除一张牌（{sc.removeUsed ? '已使用' : `💰${run.removeCost}`}）
      </button>
      <button class="btn btn-primary btn-lg" onClick={() => act((r) => R.leaveToMap(r))}>离开商店</button>
    </div>
  );
}

// ---------------- 事件 ----------------
export function EventScreen() {
  const run = useStore().run!;
  const sc = run.screen;
  if (sc.t !== 'event') return null;
  const ev = EVENTS[sc.id];
  const stage = ev.stages[sc.stage] ?? R.DONE_STAGE;
  const text = sc.msg ?? (typeof stage.text === 'function' ? stage.text(run) : stage.text);
  return (
    <div class="panel-screen event-screen">
      <div class="big-art">{ev.art}</div>
      <h2 class="screen-title">{ev.name}</h2>
      <p class="event-text">{text}</p>
      <div class="btn-col">
        {stage.options.map((o, i) => {
          const dis = 'disabled' in o && o.disabled ? o.disabled(run) : false;
          const label = typeof o.label === 'function' ? o.label(run) : o.label;
          return <button class="btn event-opt" disabled={dis} onClick={() => act((r) => R.eventChoose(r, i))}>{label}</button>;
        })}
      </div>
    </div>
  );
}

// ---------------- 宝箱 ----------------
export function TreasureScreen() {
  const run = useStore().run!;
  const sc = run.screen;
  if (sc.t !== 'treasure') return null;
  const d = RELICS[sc.relic];
  return (
    <div class="panel-screen center-col">
      <div class={`big-art chest ${sc.opened ? 'open' : ''}`} onClick={() => act((r) => R.openTreasure(r))}>{sc.opened ? d.art : '📦'}</div>
      <h2 class="screen-title">{sc.opened ? d.name : '宝箱'}</h2>
      <p class="center">{sc.opened ? d.desc : '点击打开宝箱'}</p>
      {sc.opened
        ? <button class="btn btn-primary btn-lg" onClick={() => act((r) => R.leaveToMap(r))}>继续</button>
        : <button class="btn btn-primary btn-lg" onClick={() => act((r) => R.openTreasure(r))}>打开</button>}
    </div>
  );
}

// ---------------- Boss 遗物 ----------------
export function BossRelicScreen() {
  const run = useStore().run!;
  const sc = run.screen;
  if (sc.t !== 'bossRelic') return null;
  return (
    <div class="panel-screen">
      <h2 class="screen-title">👑 选择一件 Boss 遗物</h2>
      <div class="btn-col">
        {sc.options.map((id) => (
          <button class="reward-item" onClick={() => act((r) => R.pickBossRelic(r, id))}>
            {RELICS[id].art} {RELICS[id].name}<small>{RELICS[id].desc}</small>
          </button>
        ))}
      </div>
      <button class="btn btn-ghost" onClick={() => act((r) => R.pickBossRelic(r, null))}>跳过</button>
    </div>
  );
}

// ---------------- 选牌 ----------------
export function SelectScreen() {
  const run = useStore().run!;
  const sc = run.screen;
  const [picked, setPicked] = useState<string[]>([]);
  if (sc.t !== 'select') return null;
  const cards = sortDeck(R.selectable(run, sc.purpose));
  const need = Math.min(sc.count, cards.length);
  const toggle = (c: CardInst) => {
    if (picked.includes(c.uid)) setPicked(picked.filter((x) => x !== c.uid));
    else if (sc.count === 1) setPicked([c.uid]);
    else if (picked.length < sc.count) setPicked([...picked, c.uid]);
  };
  const preview = sc.purpose === 'upgrade' && picked.length === 1 ? cards.find((c) => c.uid === picked[0]) : null;
  return (
    <div class="panel-screen select-screen">
      <h2 class="screen-title">{sc.title}</h2>
      {preview && (
        <div class="card-choice">
          <Card card={preview} size="md" />
          <span class="arrow">➜</span>
          <Card card={{ id: preview.id, up: true }} size="md" />
        </div>
      )}
      <div class="select-grid">
        <CardGrid cards={cards} onPick={(c) => toggle(c as CardInst)} selected={(c) => picked.includes((c as CardInst).uid)} />
      </div>
      <div class="btn-row sticky-bottom">
        <button class="btn btn-ghost" onClick={() => { setPicked([]); act((r) => R.cancelSelect(r)); }}>取消</button>
        <button class="btn btn-primary" disabled={picked.length !== need}
          onClick={() => { const p = picked; setPicked([]); act((r) => R.resolveSelect(r, p)); }}>
          确定（{picked.length}/{need}）
        </button>
      </div>
    </div>
  );
}

// ---------------- 结算 ----------------
export function OverScreen() {
  const run = useStore().run!;
  const sc = run.screen;
  if (sc.t !== 'over') return null;
  const st = run.stats;
  const score = run.floor * 100 + st.elites * 25 + st.bosses * 100 + Math.floor(run.gold / 10);
  return (
    <div class="panel-screen center-col">
      <div class="big-art">{sc.win ? '🏆' : '🪦'}</div>
      <h2 class="screen-title">{sc.win ? '第一层通关！' : '你倒下了……'}</h2>
      {sc.win && <p class="center muted">当前版本内容到此为止，更深的层将在后续版本开放。</p>}
      <div class="stats">
        <div>到达：第 {run.act} 层 {run.floor} 楼</div>
        <div>击杀：{st.kills}（精英 {st.elites} · Boss {st.bosses}）</div>
        <div>打出卡牌：{st.cardsPlayed}</div>
        <div>造成伤害：{st.damage}</div>
        <div>牌组：{run.deck.length} 张 · 遗物 {run.relics.length} 件</div>
        <div>种子：{run.seed}</div>
        <div class="score">积分 {score}</div>
      </div>
      <button class="btn btn-primary btn-lg" onClick={abandonRun}>返回主菜单</button>
    </div>
  );
}

// ---------------- 菜单 / 图鉴 弹窗 ----------------
export function MenuOverlay() {
  const s = useStore();
  if (s.overlay?.t !== 'menu') return null;
  const st = s.settings;
  const toggle = (k: 'vibrate' | 'fast') => { st[k] = !st[k]; saveSettings(); refresh(); };
  return (
    <Modal title="菜单" onClose={() => setOverlay(null)}>
      <div class="btn-col">
        <button class="btn" onClick={() => toggle('vibrate')}>震动反馈：{st.vibrate ? '开' : '关'}</button>
        <button class="btn" onClick={() => toggle('fast')}>快速动画：{st.fast ? '开' : '关'}</button>
        <button class="btn" onClick={() => { store.overlay = null; store.view = 'menu'; refresh(); }}>保存并返回主菜单</button>
        <button class="btn btn-danger" onClick={() => { if (confirm('确定放弃本局吗？')) abandonRun(); }}>放弃本局</button>
      </div>
      {s.run && <p class="muted small center">种子：{s.run.seed}</p>}
    </Modal>
  );
}

export function CodexOverlay() {
  const s = useStore();
  const [tab, setTab] = useState<string>('knight');
  if (s.overlay?.t !== 'codex') return null;
  const tabs: [string, string][] = [['knight', '骑士'], ['rogue', '夜行者'], ['mage', '术士'], ['neutral', '中立'], ['curse', '诅咒/状态']];
  const cards = ALL_CARDS.filter((c) => (tab === 'curse' ? ['curse', 'status'].includes(c.cls) : c.cls === tab)).map((c) => ({ id: c.id, up: false }));
  return (
    <Modal title={`卡牌图鉴（共 ${ALL_CARDS.length} 张）`} onClose={() => setOverlay(null)}>
      <div class="tabs">
        {tabs.map(([k, n]) => <button class={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{n}</button>)}
      </div>
      <CardGrid cards={cards} />
    </Modal>
  );
}
