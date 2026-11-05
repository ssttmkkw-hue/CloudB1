// 简单贪心机器人：粗略评估第一层难度（npx vite-node tests/balance.ts）
import * as R from '../src/engine/run';
import * as C from '../src/engine/combat';
import { EVENTS } from '../src/data';
import type { ClassId } from '../src/engine/types';

const rarScore: Record<string, number> = { rare: 3, uncommon: 2, common: 1 };
function run(cls: ClassId, seed: string) {
  const s = R.newRun(cls, seed);
  let lastFight = '';
  for (let step = 0; step < 20000; step++) {
    const sc = s.screen;
    if (sc.t === 'over') return { win: sc.win, floor: s.floor, hp: s.hp, killer: lastFight };
    if (sc.t === 'map') {
      const av = R.availableNodes(s);
      const pref = (id: string) => { const t = s.map.nodes[id].type; return t === 'rest' && s.hp < s.maxHp * 0.6 ? 0 : t === 'elite' && s.hp < s.maxHp * 0.7 ? 9 : t === 'shop' && s.gold < 100 ? 8 : { fight: 2, event: 1, elite: 3, rest: 4, shop: 3, treasure: 0, boss: 0 }[t]; };
      R.chooseNode(s, [...av].sort((a, b) => pref(a) - pref(b))[0]);
    } else if (sc.t === 'combat') {
      const c = s.combat!;
      lastFight = c.enemies.filter((e) => e.def !== 'lantern' && e.def !== 'small_slime').map((e) => e.def).join('+');
      if (c.pending) { R.cmdPending(s, c.pending.options.slice(0, c.pending.min).map((o) => o.key)); continue; }
      if (c.player.hp < c.player.maxHp * 0.4) { const i = s.potions.findIndex(Boolean); if (i >= 0) { R.cmdPotion(s, i, C.alive(c)[0]?.id); s.potions[i] = null; continue; } }
      const incoming = C.alive(c).reduce((a, e) => { const d = C.intentDamage(s, e); return a + (d ? d.dmg * d.hits : 0); }, 0);
      const playable = c.hand.filter((h) => C.canPlay(c, h));
      if (!playable.length) { R.cmdEndTurn(s); continue; }
      const needBlock = incoming - c.player.block >= 5 || (incoming > c.player.block && c.player.hp < c.player.maxHp * 0.35);
      const score = (id: string) => { const d = C.cardDef(id); if (d.type === 'power') return 5; if (needBlock && d.type === 'skill') return 4; if (d.type === 'attack') return 3; return 2; };
      const card = playable.sort((a, b) => score(b.id) - score(a.id))[0];
      const tgt = C.alive(c).sort((a, b) => a.hp - b.hp)[0];
      R.cmdPlay(s, card.uid, tgt?.id);
    } else if (sc.t === 'reward') {
      const i = sc.items.findIndex((it) => it.k !== 'cards' && !(it.k === 'potion' && !s.potions.includes(null)));
      if (i >= 0) { R.claimReward(s, i); continue; }
      const ci = sc.items.findIndex((it) => it.k === 'cards');
      if (ci >= 0) {
        const it = sc.items[ci] as { k: 'cards'; options: { id: string }[] };
        let best = 0; it.options.forEach((o, k) => { if (rarScore[C.cardDef(o.id).rarity] > rarScore[C.cardDef(it.options[best].id).rarity]) best = k; });
        R.claimReward(s, ci, best); continue;
      }
      R.leaveReward(s);
    } else if (sc.t === 'rest') R.rest(s, s.hp < s.maxHp * 0.6 ? 'heal' : 'upgrade');
    else if (sc.t === 'select') { const o = R.selectable(s, sc.purpose); R.resolveSelect(s, o.slice(0, Math.min(sc.count, o.length)).map((d) => d.uid)); }
    else if (sc.t === 'shop') { if (!sc.removeUsed && s.gold >= s.removeCost) { R.shopRemove(s); continue; } R.leaveToMap(s); }
    else if (sc.t === 'event') { const st = EVENTS[sc.id].stages[sc.stage] ?? R.DONE_STAGE; const opts = st.options.map((o, i) => [o, i] as const).filter(([o]) => !('disabled' in o && o.disabled?.(s))); R.eventChoose(s, opts[opts.length > 1 ? opts.length - 2 : 0][1]); }
    else if (sc.t === 'treasure') { R.openTreasure(s); R.leaveToMap(s); }
    else if (sc.t === 'bossRelic') R.pickBossRelic(s, sc.options[0] ?? null);
    C.drainEvents();
  }
  const c = s.combat; throw new Error('stuck ' + s.screen.t + ' ' + cls + ' ' + seed + ' ' + (c ? c.hand.map((h) => h.id + ':' + C.canPlay(c, h)).join(',') + ' E' + c.energy + ' turn' + c.turn + ' pend' + !!c.pending + ' enemies ' + JSON.stringify(c.enemies.map((e) => [e.def, e.hp, e.dead, e.escaped])) : ''));
}
for (const cls of ['knight', 'rogue', 'mage'] as ClassId[]) {
  let win = 0, floors = 0; const N = 300; const killers: Record<string, number> = {};
  for (let i = 0; i < N; i++) { const r = run(cls, 'B' + i); if (r.win) win++; else killers[r.killer] = (killers[r.killer] ?? 0) + 1; floors += r.floor; }
  console.log(Object.entries(killers).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => k + ':' + v).join('  '));
  console.log(cls, '通关第一层', ((win / N) * 100).toFixed(1) + '%', '平均楼层', (floors / N).toFixed(1));
}
