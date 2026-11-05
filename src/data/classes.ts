import type { ClassId } from '../engine/types';

export interface ClassDef {
  id: ClassId;
  name: string;
  title: string;
  hp: number;
  relic: string;
  deck: [string, number][];
  art: string;
  color: string;
  desc: string;
  styles: string[];
  difficulty: number;
}

export const CLASSES: ClassDef[] = [
  {
    id: 'knight', name: '铁誓骑士', title: '以盾为誓的守护者', hp: 80, relic: 'oath_badge', art: '🛡️', color: '#e0b45a', difficulty: 1,
    deck: [['knight_strike', 5], ['knight_defend', 4], ['knight_vow', 1]],
    desc: '通过防御积累「誓约」，在关键回合一次性释放审判。',
    styles: ['誓约爆发', '荆棘反击', '铁壁格挡'],
  },
  {
    id: 'rogue', name: '夜行者', title: '行走暗影的刺客', hp: 70, relic: 'shadow_cloak', art: '🗡️', color: '#a56cf0', difficulty: 2,
    deck: [['rogue_stab', 5], ['rogue_dodge', 4], ['rogue_shadow_step', 1]],
    desc: '大量低费牌制造「连击」，用毒与飞刀蚕食敌人。',
    styles: ['剧毒', '飞刀', '连击爆发'],
  },
  {
    id: 'mage', name: '星辉术士', title: '驾驭元素的学者', hp: 65, relic: 'element_prism', art: '🔮', color: '#4fc8e8', difficulty: 3,
    deck: [['mage_spark', 5], ['mage_ice_shield', 4], ['mage_attune', 1]],
    desc: '连续打出同元素牌触发「共鸣」，出牌顺序决定威力。',
    styles: ['烈焰', '冰封', '雷霆', '全元素'],
  },
];

export const CLASS_MAP = Object.fromEntries(CLASSES.map((c) => [c.id, c])) as Record<ClassId, ClassDef>;
