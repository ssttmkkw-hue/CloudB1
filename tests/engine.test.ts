import { describe, expect, it } from 'vitest';
import { ALL_CARDS, CARDS, ENEMY_LIST } from '../src/data';
import * as C from '../src/engine/combat';
import * as R from '../src/engine/run';
import type { ClassId, RunState } from '../src/engine/types';
import { playRun } from './bot';

function combatWith(cls: ClassId, enemies: string[], hand: string[] = []): RunState {
  const s = R.newRun(cls, 'TEST');
  C.startCombat(s, enemies, 'normal');
  const c = s.combat!;
  c.discard.push(...c.hand.splice(0));
  for (const id of hand) c.hand.push(C.newCard(s, id));
  c.energy = 10;
  C.drainEvents();
  return s;
}

describe('数据', () => {
  it('共 100 张卡牌，id 唯一', () => {
    expect(ALL_CARDS.length).toBe(100);
    expect(Object.keys(CARDS).length).toBe(100);
  });
  it('每职业 28 张', () => {
    for (const cls of ['knight', 'rogue', 'mage']) expect(ALL_CARDS.filter((c) => c.cls === cls).length).toBe(28);
  });
  it('卡面占位符都有数值', () => {
    for (const c of ALL_CARDS) {
      for (const m of (c.text + (c.upText ?? '')).matchAll(/\{(\w+)\}/g)) expect(c.v?.[m[1]], `${c.id} 缺少 ${m[1]}`).toBeDefined();
    }
  });
  it('第一层敌人齐全', () => {
    expect(ENEMY_LIST.filter((e) => e.act === 1 && e.id !== 'lantern').length).toBe(13);
  });
});

describe('战斗规则', () => {
  it('斩击 6 伤害，易伤 ×1.5，虚弱 ×0.75', () => {
    const s = combatWith('knight', ['skeleton'], ['knight_strike', 'knight_strike', 'knight_strike']);
    const c = s.combat!;
    const e = c.enemies[0];
    const hp = e.hp;
    R.cmdPlay(s, c.hand[0].uid, e.id);
    expect(hp - e.hp).toBe(6);
    e.st.vulnerable = 1;
    R.cmdPlay(s, c.hand[0].uid, e.id);
    expect(hp - e.hp).toBe(6 + 9);
    c.player.st.weak = 1;
    R.cmdPlay(s, c.hand[0].uid, e.id);
    expect(hp - e.hp).toBe(6 + 9 + Math.floor(6 * 0.75 * 1.5));
  });

  it('格挡先于生命扣除', () => {
    const s = combatWith('knight', ['skeleton'], ['knight_strike']);
    const e = s.combat!.enemies[0];
    e.block = 4;
    const hp = e.hp;
    R.cmdPlay(s, s.combat!.hand[0].uid, e.id);
    expect(e.block).toBe(0);
    expect(hp - e.hp).toBe(2);
  });

  it('审判消耗全部誓约', () => {
    const s = combatWith('knight', ['skeleton'], ['knight_judgment']);
    const c = s.combat!;
    c.oath = 4;
    const e = c.enemies[0];
    const hp = e.hp;
    R.cmdPlay(s, c.hand[0].uid, e.id);
    expect(c.oath).toBe(0);
    expect(hp - e.hp).toBe(20);
  });

  it('割喉在连击 ≥3 时追加伤害', () => {
    const s = combatWith('rogue', ['ghoul'], ['rogue_dash', 'rogue_dash', 'rogue_dash', 'rogue_throat_cut']);
    const c = s.combat!;
    c.draw = [];
    c.discard = [];
    const e = c.enemies[0];
    for (let i = 0; i < 3; i++) R.cmdPlay(s, c.hand.find((h) => h.id === 'rogue_dash')!.uid);
    const hp = e.hp;
    R.cmdPlay(s, c.hand.find((h) => h.id === 'rogue_throat_cut')!.uid, e.id);
    expect(hp - e.hp).toBe(14);
  });

  it('连续同元素触发共鸣', () => {
    const s = combatWith('mage', ['ghoul'], ['mage_spark', 'mage_fireball']);
    const c = s.combat!;
    c.cf.firstEl = 1; // 跳过初始遗物效果
    const e = c.enemies[0];
    R.cmdPlay(s, c.hand[0].uid, e.id);
    R.cmdPlay(s, c.hand[0].uid, e.id);
    expect(e.st.burn).toBe(6);
  });

  it('寒霜 10 层冻结普通敌人', () => {
    const s = combatWith('mage', ['skeleton'], []);
    const e = s.combat!.enemies[0];
    C.applyStatus(s, e, 'frost', 10, true);
    expect(e.st.frozen).toBe(1);
    expect(e.st.frost).toBeUndefined();
  });

  it('中毒在敌人回合开始结算并衰减', () => {
    const s = combatWith('rogue', ['skeleton'], []);
    const e = s.combat!.enemies[0];
    e.st.poison = 5;
    const hp = e.hp;
    R.cmdEndTurn(s);
    expect(hp - e.hp).toBe(5);
    expect(e.st.poison).toBe(4);
  });

  it('黏菌团半血分裂', () => {
    const s = combatWith('knight', ['slime'], ['knight_final_verdict']);
    const c = s.combat!;
    R.cmdPlay(s, c.hand[0].uid, c.enemies[0].id);
    expect(C.alive(c).map((e) => e.def)).toEqual(['small_slime', 'small_slime']);
  });

  it('敌人全部逃跑时战斗结束', () => {
    const s = combatWith('knight', ['thief'], []);
    const e = s.combat!.enemies[0];
    e.move = 'flee';
    R.cmdEndTurn(s);
    expect(e.escaped).toBe(true);
    expect(s.screen.t).toBe('reward');
  });

  it('击败所有敌人后进入奖励界面', () => {
    const s = combatWith('knight', ['rat'], ['knight_final_verdict']);
    R.cmdPlay(s, s.combat!.hand[0].uid, s.combat!.enemies[0].id);
    expect(s.screen.t).toBe('reward');
  });
});

describe('地图', () => {
  it('第 1 行为战斗、第 9 行为宝箱、第 15 行为休息', () => {
    const s = R.newRun('knight', 'MAP');
    const nodes = Object.values(s.map.nodes);
    expect(nodes.filter((n) => n.r === 0).every((n) => n.type === 'fight')).toBe(true);
    expect(nodes.filter((n) => n.r === 8).every((n) => n.type === 'treasure')).toBe(true);
    expect(nodes.filter((n) => n.r === 14).every((n) => n.type === 'rest')).toBe(true);
    expect(nodes.filter((n) => n.r === 14).every((n) => n.next.includes('boss'))).toBe(true);
  });
  it('相同种子生成相同地图', () => {
    expect(JSON.stringify(R.newRun('rogue', 'SAME').map)).toBe(JSON.stringify(R.newRun('rogue', 'SAME').map));
  });
});

describe('自动对局冒烟测试', () => {
  it('三职业各 80 局无异常且能结束', () => {
    const results: Record<string, { win: number; floors: number }> = {};
    for (const cls of ['knight', 'rogue', 'mage'] as ClassId[]) {
      results[cls] = { win: 0, floors: 0 };
      for (let i = 0; i < 80; i++) {
        const s = playRun(cls, `SIM${i}`);
        expect(s.screen.t).toBe('over');
        if (s.screen.t === 'over' && s.screen.win) results[cls].win++;
        results[cls].floors += s.floor;
      }
    }
    console.log('随机机器人结果', results);
  }, 60000);

  it('同种子同操作结果确定', () => {
    const a = playRun('mage', 'DET');
    const b = playRun('mage', 'DET');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
