import type { RunState } from '../engine/types';
import * as R from '../engine/run';
import { cardDef } from '../engine/combat';
import { next, pick } from '../engine/rng';
import { ALL_CARDS } from './cards/index';
import { RELICS } from './relics';
import { POTIONS } from './potions';

export interface EventOption {
  label: string | ((s: RunState) => string);
  disabled?: (s: RunState) => boolean;
  /** 返回下一阶段 id；返回 {msg} 显示结果；返回 undefined 离开 */
  run: (s: RunState) => string | { msg: string } | undefined | void;
}

export interface EventDef {
  id: string;
  name: string;
  art: string;
  acts: number[];
  can?: (s: RunState) => boolean;
  stages: Record<string, { text: string | ((s: RunState) => string); options: EventOption[] }>;
}

const leave: EventOption = { label: '离开', run: () => undefined };
const loseHp = (s: RunState, n: number) => { s.hp = Math.max(1, s.hp - n); };

export const EVENT_LIST: EventDef[] = [
  {
    id: 'altar', name: '遗忘的祭坛', art: '🕯️', acts: [1],
    stages: {
      start: {
        text: '墓窟深处，一座落满灰尘的祭坛仍散发着暗红的光。祭坛上刻着：「以血换赐」。',
        options: [
          { label: '献祭 10 生命，获得 1 件随机遗物', disabled: (s) => s.hp <= 10,
            run: (s) => { loseHp(s, 10); const id = R.randomRelic(s); R.gainRelic(s, id); return { msg: `鲜血渗入石缝……你获得了「${RELICS[id].name}」。` }; } },
          leave,
        ],
      },
    },
  },
  {
    id: 'merchant', name: '迷路的商人', art: '🧳', acts: [1, 2],
    stages: {
      start: {
        text: '一个背着巨大行囊的商人在岔路口踱步。「旅人！我只剩一件好东西了，50 金币就卖给你。」',
        options: [
          { label: '支付 50 金币：获得 1 张随机稀有卡', disabled: (s) => s.gold < 50,
            run: (s) => {
              s.gold -= 50;
              const d = pick(s.rng.event, R.classPool(s.cls, 'rare'));
              R.addToDeck(s, d.id);
              return { msg: `商人递给你一张泛着金光的卡牌：「${d.name}」。` };
            } },
          leave,
        ],
      },
    },
  },
  {
    id: 'mirror', name: '镜之间', art: '🪞', acts: [1, 2, 3],
    stages: {
      start: {
        text: '无数镜面映出你的身影。其中一面镜子里，你手中的卡牌似乎多了一张……',
        options: [
          { label: '凝视镜子：复制牌组中 1 张牌', run: (s) => { R.gotoSelect(s, 'duplicate', 1, '选择 1 张牌复制'); } },
          leave,
        ],
      },
    },
  },
  {
    id: 'gambler', name: '骷髅赌徒', art: '🎲', acts: [1, 2],
    stages: {
      start: {
        text: '一具骷髅坐在木桶上摇着骰子，咔哒作响。「来一把？猜对了，双倍奉还。」',
        options: [
          { label: '押 25 金币', disabled: (s) => s.gold < 25, run: (s) => gamble(s, 25) },
          { label: '押 50 金币', disabled: (s) => s.gold < 50, run: (s) => gamble(s, 50) },
          { label: '押 100 金币', disabled: (s) => s.gold < 100, run: (s) => gamble(s, 100) },
          leave,
        ],
      },
    },
  },
  {
    id: 'smithy', name: '古老的铁匠铺', art: '⚒️', acts: [1, 2, 3],
    stages: {
      start: {
        text: '一座废弃的铁匠铺，炉火竟然还未熄灭。铁砧旁放着一把磨损的锤子。',
        options: [
          { label: '锻造：升级 1 张牌', run: (s) => { R.gotoSelect(s, 'upgrade', 1, '选择 1 张牌升级'); } },
          { label: '全力锻造：失去 6 生命，升级 2 张牌', disabled: (s) => s.hp <= 6,
            run: (s) => { loseHp(s, 6); R.gotoSelect(s, 'upgrade', 2, '选择 2 张牌升级'); } },
          leave,
        ],
      },
    },
  },
  {
    id: 'wounded', name: '受伤的冒险者', art: '🤕', acts: [1],
    stages: {
      start: {
        text: '一名冒险者倚墙而坐，腹部的伤口还在渗血。「求你……有药吗？」',
        options: [
          { label: (s) => '给他一瓶药水：获得 1 件遗物' + (s.potions.some(Boolean) ? '' : '（没有药水）'),
            disabled: (s) => !s.potions.some(Boolean),
            run: (s) => {
              const i = s.potions.findIndex(Boolean);
              const p = POTIONS[s.potions[i]!].name;
              s.potions[i] = null;
              const id = R.randomRelic(s);
              R.gainRelic(s, id);
              return { msg: `你给了他「${p}」。他感激地塞给你「${RELICS[id].name}」。` };
            } },
          { label: '搜刮他的背包：获得 70 金币，获得诅咒「迟疑」',
            run: (s) => { s.gold += 70; R.addToDeck(s, 'curse_hesitation'); return { msg: '你拿走了金币。他的目光让你久久无法释怀……' }; } },
          leave,
        ],
      },
    },
  },
  {
    id: 'spring', name: '圣泉', art: '⛲', acts: [1, 2, 3],
    stages: {
      start: {
        text: '清澈的泉水从石缝中涌出，周围的空气都变得宁静。',
        options: [
          { label: '净化：移除 1 张诅咒', disabled: (s) => !s.deck.some((d) => cardDef(d.id).cls === 'curse'),
            run: (s) => {
              const cur = s.deck.find((d) => cardDef(d.id).cls === 'curse')!;
              s.deck.splice(s.deck.indexOf(cur), 1);
              return { msg: `「${cardDef(cur.id).name}」随泉水消散了。` };
            } },
          { label: '饮用：回复全部生命，最大生命 -5',
            run: (s) => { s.maxHp -= 5; s.hp = s.maxHp; return { msg: '泉水冰凉刺骨，你的伤口全部愈合了。' }; } },
          leave,
        ],
      },
    },
  },
  {
    id: 'echo', name: '深渊回响', art: '🌀', acts: [1, 2, 3],
    stages: {
      start: {
        text: '黑暗中传来另一个冒险者的低语，三张陌生的卡牌在你面前浮现。',
        options: [
          { label: '倾听：从其他职业的 3 张牌中选 1 张',
            run: (s) => {
              const pool = ALL_CARDS.filter((d) => d.cls !== s.cls && ['knight', 'rogue', 'mage'].includes(d.cls) && ['common', 'uncommon', 'rare'].includes(d.rarity));
              const opts: { id: string; up: boolean }[] = [];
              while (opts.length < 3) {
                const d = pick(s.rng.event, pool);
                if (!opts.some((o) => o.id === d.id)) opts.push({ id: d.id, up: false });
              }
              s.screen = { t: 'reward', items: [{ k: 'cards', options: opts }] };
            } },
          leave,
        ],
      },
    },
  },
  {
    id: 'gravekeeper', name: '守墓人的请求', art: '⚰️', acts: [1],
    stages: {
      start: {
        text: '佝偻的守墓人提着灯：「有个怪物占据了我守护的墓室。替我除掉它，我会给你两件宝物。」',
        options: [
          { label: '接受考验：进行精英战斗，胜利后额外获得遗物', run: (s) => { R.startElite(s, true); } },
          leave,
        ],
      },
    },
  },
];

function gamble(s: RunState, bet: number) {
  const win = next(s.rng.event) < 0.5;
  s.gold += win ? bet : -bet;
  return { msg: win ? `骰子停在你猜的那面！你赢得 ${bet} 金币。` : `骷髅咔咔大笑，你输掉了 ${bet} 金币。` };
}

export const EVENTS: Record<string, EventDef> = Object.fromEntries(EVENT_LIST.map((e) => [e.id, e]));
