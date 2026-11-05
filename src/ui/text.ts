import { calcAttack, calcBlock, cardDef, kwOf, valuesOf } from '../engine/combat';
import { STATUSES } from '../engine/statuses';
import type { CardInst, Combat, EnemyState, Keyword } from '../engine/types';

export type TextPart = { t: string; c?: 'up' | 'down' | 'kw' | 'num' };

const KW_NAME: Record<Keyword, string> = { exhaust: '消耗', ethereal: '虚无', innate: '固有', retain: '保留', unplayable: '不可打出' };
export const TYPE_NAME: Record<string, string> = { attack: '攻击', skill: '技能', power: '能力', curse: '诅咒', status: '状态' };
export const RARITY_NAME: Record<string, string> = { basic: '基础', token: '衍生', common: '普通', uncommon: '罕见', rare: '稀有', special: '特殊' };
export const EL_ICON: Record<string, string> = { fire: '🔥', frost: '❄️', lightning: '⚡' };

export const GLOSSARY: Record<string, string> = {
  消耗: '打出后移出本场战斗',
  虚无: '回合结束时若仍在手牌则消耗',
  固有: '战斗开始时必定在初始手牌中',
  保留: '回合结束时不会被弃置',
  不可打出: '无法主动打出',
  格挡: '抵挡伤害，回合开始时清零',
  誓约: '骑士专属资源，战斗内保留，默认上限 10',
  连击: '本回合在这张牌之前已打出的牌数',
  共鸣: '上一张打出的牌与本牌元素相同时触发',
  飞刀: '0 费攻击牌：造成 3 伤害，消耗',
  X: '消耗全部剩余能量',
};
for (const st of Object.values(STATUSES)) if (st.kind !== 'power' && st.kind !== 'hidden') GLOSSARY[st.name] = st.desc;

export function cardName(card: { id: string; up: boolean }) {
  return cardDef(card.id).name + (card.up ? '+' : '');
}

export function cardText(card: { id: string; up: boolean }, c?: Combat | null, target?: EnemyState | null): TextPart[] {
  const def = cardDef(card.id);
  const tpl = (card.up && def.upText) || def.text;
  const v = valuesOf(def, card.up);
  const parts: TextPart[] = [];
  const re = /\{(\w+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tpl))) {
    if (m.index > last) parts.push({ t: tpl.slice(last, m.index) });
    const k = m[1];
    const base = v[k] ?? 0;
    let val = base;
    if (c && k.startsWith('d')) val = calcAttack(c.player, target ?? null, base + (def.type === 'attack' ? c.player.st.nextAtk ?? 0 : 0));
    else if (c && k.startsWith('b')) val = calcBlock(c.player, base);
    parts.push({ t: String(val), c: val > base ? 'up' : val < base ? 'down' : 'num' });
    last = m.index + m[0].length;
  }
  if (last < tpl.length) parts.push({ t: tpl.slice(last) });
  const kws = kwOf(def, card.up).filter((k) => k !== 'unplayable' || def.cost === null);
  if (kws.length) {
    if (parts.length && tpl) parts.push({ t: '。' });
    parts.push({ t: kws.map((k) => KW_NAME[k]).join('。'), c: 'kw' });
  }
  return parts;
}

export function glossaryFor(card: CardInst | { id: string; up: boolean }): [string, string][] {
  const def = cardDef(card.id);
  const txt = ((card.up && def.upText) || def.text) + kwOf(def, card.up).map((k) => KW_NAME[k]).join('');
  const out: [string, string][] = [];
  for (const [k, d] of Object.entries(GLOSSARY)) if (txt.includes(k) && !out.some(([o]) => o === k)) out.push([k, d]);
  if (def.el) out.push(['元素', `${EL_ICON[def.el]} 本牌属于${{ fire: '火', frost: '霜', lightning: '雷' }[def.el]}元素`]);
  return out;
}
