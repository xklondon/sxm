import globalWisdom from './wisdom.global.json';
import blackjackWisdom from './wisdom.blackjack.json';
import pokerWisdom from './wisdom.poker.json';
import zilchWisdom from './wisdom.zilch.json';
import rareWisdom from './wisdom.rare.json';

export type Magic8GameType = 'blackjack' | 'poker' | 'zilch';

export type Magic8WisdomPool = 'global' | 'game' | 'rare';

export interface GetMagic8WisdomOptions {
  gameType?: Magic8GameType;
  includeRare?: boolean;
  /** Skip immediate repeat when the pool has other entries. */
  previousAnswer?: string | null;
}

const GAME_WISDOM: Record<Magic8GameType, readonly string[]> = {
  blackjack: blackjackWisdom,
  poker: pokerWisdom,
  zilch: zilchWisdom,
};

const FALLBACK_WISDOM = 'The eight ball is silent.';

const WEIGHT_RARE = 5;
const WEIGHT_GAME = 25;
const WEIGHT_GLOBAL = 70;

function normalizePool(entries: readonly string[]): string[] {
  return entries.filter((entry) => typeof entry === 'string' && entry.trim().length > 0);
}

function pickFromPool(pool: readonly string[], previousAnswer?: string | null): string | null {
  const normalized = normalizePool(pool);
  if (normalized.length === 0) {
    return null;
  }
  const candidates =
    previousAnswer && normalized.length > 1
      ? normalized.filter((entry) => entry !== previousAnswer)
      : normalized;
  if (candidates.length === 0) {
    return null;
  }
  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index] ?? null;
}

function resolveTargetPool(
  roll: number,
  gameType: Magic8GameType | undefined,
  includeRare: boolean,
): Magic8WisdomPool {
  if (roll < WEIGHT_RARE && includeRare) {
    return 'rare';
  }
  if (roll < WEIGHT_RARE + WEIGHT_GAME && gameType) {
    return 'game';
  }
  return 'global';
}

function poolForTarget(
  target: Magic8WisdomPool,
  gameType: Magic8GameType | undefined,
): readonly string[] {
  switch (target) {
    case 'rare':
      return rareWisdom;
    case 'game':
      return gameType ? (GAME_WISDOM[gameType] ?? []) : [];
    case 'global':
      return globalWisdom;
    default:
      return globalWisdom;
  }
}

function fallbackOrder(
  target: Magic8WisdomPool,
  gameType: Magic8GameType | undefined,
  includeRare: boolean,
): Magic8WisdomPool[] {
  const order: Magic8WisdomPool[] = [];
  if (target !== 'global') {
    order.push('global');
  }
  if (target !== 'game' && gameType) {
    order.push('game');
  }
  if (target !== 'rare' && includeRare) {
    order.push('rare');
  }
  if (!order.includes('global')) {
    order.push('global');
  }
  return order;
}

/** Repository-backed Magic 8 Ball wisdom picker (70% global / 25% game / 5% rare). */
export function getMagic8Wisdom(options: GetMagic8WisdomOptions = {}): string {
  const { gameType, includeRare = true, previousAnswer = null } = options;
  const roll = Math.random() * (WEIGHT_RARE + WEIGHT_GAME + WEIGHT_GLOBAL);
  const target = resolveTargetPool(roll, gameType, includeRare);
  const poolsToTry = [target, ...fallbackOrder(target, gameType, includeRare)];

  for (const poolName of poolsToTry) {
    const picked = pickFromPool(poolForTarget(poolName, gameType), previousAnswer);
    if (picked) {
      return picked;
    }
  }

  const anyPool = [
    ...normalizePool(globalWisdom),
    ...(gameType ? normalizePool(GAME_WISDOM[gameType] ?? []) : []),
    ...(includeRare ? normalizePool(rareWisdom) : []),
  ];
  if (anyPool.length > 0) {
    const index = Math.floor(Math.random() * anyPool.length);
    return anyPool[index] ?? FALLBACK_WISDOM;
  }

  return FALLBACK_WISDOM;
}

/** Expose normalized pools for tests, tooling, and future admin surfaces. */
export function listMagic8WisdomPools(gameType?: Magic8GameType): {
  global: string[];
  game: string[];
  rare: string[];
} {
  return {
    global: normalizePool(globalWisdom),
    game: gameType ? normalizePool(GAME_WISDOM[gameType] ?? []) : [],
    rare: normalizePool(rareWisdom),
  };
}
