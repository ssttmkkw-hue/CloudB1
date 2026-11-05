import type { CardDef } from '../../engine/types';
import { KNIGHT_CARDS } from './knight';
import { ROGUE_CARDS } from './rogue';
import { MAGE_CARDS } from './mage';
import { NEUTRAL_CARDS, CURSE_CARDS } from './neutral';

export const ALL_CARDS: CardDef[] = [...KNIGHT_CARDS, ...ROGUE_CARDS, ...MAGE_CARDS, ...NEUTRAL_CARDS, ...CURSE_CARDS];
export const CARDS: Record<string, CardDef> = Object.fromEntries(ALL_CARDS.map((c) => [c.id, c]));
