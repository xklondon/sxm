import type { GameState } from '../../types';
import { isHoldemChallengeTable } from './challengeWinner';

/**
 * True when a Poker Challenge has started (participant snapshot or active hand)
 * and new invite joins must be blocked.
 */
export function isHoldemChallengeJoinLocked(state: GameState): boolean {
  if (!isHoldemChallengeTable(state)) {
    return false;
  }

  const config = state.tableMeta.pokerConfig;
  if (config?.challengeParticipants && config.challengeParticipants.length > 0) {
    return true;
  }

  if ((config?.handNumber ?? 0) > 0) {
    return true;
  }

  const holdem = state.holdem;
  if (holdem && holdem.status !== 'setup' && holdem.status !== 'resolved') {
    return true;
  }

  return false;
}

export const HOLDEM_CHALLENGE_JOIN_BLOCKED_MESSAGE =
  'This Poker challenge has already started. New players cannot join.';
