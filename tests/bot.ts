import * as R from '../src/engine/run';
import * as C from '../src/engine/combat';
import { EVENTS } from '../src/data';
import { hashSeed, next } from '../src/engine/rng';
import type { ClassId, RunState } from '../src/engine/types';

/** 随机（偏贪心）机器人，用于冒烟与平衡模拟 */
export function playRun(cls: ClassId, seed: string, maxSteps = 20000): RunState {
  const s = R.newRun(cls, seed);
  const br = hashSeed('bot:' + seed);
  const rnd = () => next(br);
  const pickOne = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
  let steps = 0;
  let actionsThisTurn = 0;
  let lastTurn = -1;
  while (steps++ < maxSteps) {
    check(s);
    const sc = s.screen;
    switch (sc.t) {
      case 'over':
        return s;
      case 'map':
        R.chooseNode(s, pickOne(R.availableNodes(s)));
        break;
      case 'combat': {
        const c = s.combat!;
        if (c.turn !== lastTurn) { lastTurn = c.turn; actionsThisTurn = 0; }
        if (c.pending) {
          R.cmdPending(s, c.pending.options.slice(0, c.pending.min).map((o) => o.key));
          break;
        }
        const playable = c.hand.filter((h) => C.canPlay(c, h));
        if (playable.length && actionsThisTurn++ < 40 && rnd() < 0.9) {
          const card = pickOne(playable);
          const tgt = pickOne(C.alive(c));
          R.cmdPlay(s, card.uid, tgt?.id);
        } else if (s.potions.some(Boolean) && rnd() < 0.05) {
          const slot = s.potions.findIndex(Boolean);
          R.cmdPotion(s, slot, pickOne(C.alive(c))?.id);
          if (s.potions[slot]) R.discardPotion(s, slot);
        } else {
          R.cmdEndTurn(s);
        }
        if (c.turn > 200) throw new Error('战斗回合过多');
        break;
      }
      case 'reward': {
        const items = sc.items;
        const i = items.findIndex((it) => it.k !== 'cards' && !(it.k === 'potion' && !s.potions.includes(null)));
        if (i >= 0) { R.claimReward(s, i); break; }
        const ci = items.findIndex((it) => it.k === 'cards');
        if (ci >= 0 && rnd() < 0.7) {
          const it = items[ci] as { k: 'cards'; options: unknown[] };
          R.claimReward(s, ci, Math.floor(rnd() * it.options.length));
          break;
        }
        R.leaveReward(s);
        break;
      }
      case 'rest':
        R.rest(s, s.hp < s.maxHp * 0.5 ? 'heal' : 'upgrade');
        break;
      case 'select': {
        const opts = R.selectable(s, sc.purpose);
        R.resolveSelect(s, opts.slice(0, Math.min(sc.count, opts.length)).map((d) => d.uid));
        break;
      }
      case 'shop': {
        const before = s.gold;
        const i = sc.cards.findIndex((c) => !c.sold && c.price <= s.gold);
        if (i >= 0 && rnd() < 0.5) R.shopBuy(s, 'card', i);
        else if (!sc.removeUsed && s.gold >= s.removeCost && rnd() < 0.3) R.shopRemove(s);
        if (s.gold === before && s.screen.t === 'shop') R.leaveToMap(s);
        break;
      }
      case 'event': {
        const ev = EVENTS[sc.id];
        const stage = ev.stages[sc.stage] ?? R.DONE_STAGE;
        const enabled = stage.options.map((o, i) => [o, i] as const).filter(([o]) => !('disabled' in o && o.disabled?.(s)));
        R.eventChoose(s, pickOne(enabled)[1]);
        break;
      }
      case 'treasure':
        R.openTreasure(s);
        R.leaveToMap(s);
        break;
      case 'bossRelic':
        R.pickBossRelic(s, sc.options[0] ?? null);
        break;
    }
    C.drainEvents();
  }
  throw new Error('超出最大步数：' + s.screen.t);
}

function check(s: RunState) {
  if (s.hp > s.maxHp) throw new Error(`生命超过上限 ${s.hp}/${s.maxHp}`);
  const c = s.combat;
  if (c) {
    if (c.energy < 0) throw new Error('能量为负');
    if (c.player.hp > c.player.maxHp) throw new Error('战斗中生命超过上限');
    for (const e of c.enemies) if (!e.dead && Number.isNaN(e.hp)) throw new Error('敌人生命 NaN');
  }
}
