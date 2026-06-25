import type { GameState } from '../../types';
import type { HoldemRound, HoldemRoundStatus } from '../../types/holdem';
import type { HoldemPhase } from './holdemState';
import { getBigBlindSeat, getSmallBlindSeat } from './helpers';

/**
 * True when a holdem round is in progress (cards dealt or betting open).
 * Blinds may be edited only when this is false.
 */
export function isHoldemHandInProgress(state: GameState): boolean {
  const holdem = state.holdem;
  if (!holdem) {
    return false;
  }
  return holdem.status !== 'setup' && holdem.status !== 'resolved';
}

/** Blinds editable only before the current hand starts (no active in-progress round). */
export function canEditHoldemBlinds(state: GameState): boolean {
  return !isHoldemHandInProgress(state);
}

function isActiveHoldemRound(holdem: HoldemRound): boolean {
  return holdem.status !== 'setup' && holdem.status !== 'resolved';
}

/**
 * Dealer seat id priority:
 * 1. Active in-progress holdem round (`holdem.dealerButtonPlayerId`)
 * 2. `tableMeta.pokerConfig.dealerSeatId` (between hands)
 * 3. `session.dealerButtonPlayerId`
 * 4. First seated player
 */
export function getHoldemDealerSeatId(state: GameState): string | null {
  const { holdem, session, tableMeta } = state;
  if (holdem && isActiveHoldemRound(holdem)) {
    return holdem.dealerButtonPlayerId;
  }
  return (
    tableMeta.pokerConfig?.dealerSeatId ??
    session.dealerButtonPlayerId ??
    session.playerIds[0] ??
    null
  );
}

/**
 * Small blind seat id priority:
 * 1. Active in-progress holdem round (`holdem.smallBlindPlayerId`)
 * 2. Computed from dealer seat + seat order (pre-hand / setup)
 */
export function getHoldemSmallBlindSeatId(state: GameState): string | null {
  const { holdem, session } = state;
  if (holdem && isActiveHoldemRound(holdem)) {
    return holdem.smallBlindPlayerId;
  }
  const dealerId = getHoldemDealerSeatId(state);
  if (!dealerId || session.playerIds.length < 2) {
    return null;
  }
  try {
    return getSmallBlindSeat(session, dealerId);
  } catch {
    return null;
  }
}

/**
 * Big blind seat id priority:
 * 1. Active in-progress holdem round (`holdem.bigBlindPlayerId`)
 * 2. Computed from dealer seat + seat order (pre-hand / setup)
 */
export function getHoldemBigBlindSeatId(state: GameState): string | null {
  const { holdem, session } = state;
  if (holdem && isActiveHoldemRound(holdem)) {
    return holdem.bigBlindPlayerId;
  }
  const dealerId = getHoldemDealerSeatId(state);
  if (!dealerId || session.playerIds.length < 2) {
    return null;
  }
  try {
    return getBigBlindSeat(session, dealerId);
  } catch {
    return null;
  }
}

/** Acting seat during an in-progress hand; null between hands or when no actor. */
export function getHoldemActingSeatId(state: GameState): string | null {
  const holdem = state.holdem;
  if (!holdem || !isActiveHoldemRound(holdem)) {
    return null;
  }
  return holdem.activePlayerId;
}

function mapLegacyStatusToPhase(status: HoldemRoundStatus | undefined): HoldemPhase {
  switch (status) {
    case 'setup':
      return 'hand-start';
    case 'blinds':
      return 'post-blinds';
    case 'preflop':
      return 'preflop-betting';
    case 'flop':
      return 'flop-betting';
    case 'turn':
      return 'turn-betting';
    case 'river':
      return 'river-betting';
    case 'showdown':
      return 'showdown';
    case 'resolved':
      return 'hand-complete';
    default:
      return 'waiting-for-players';
  }
}

/**
 * Canonical phase derived from legacy `holdem.status`.
 * When no round exists, returns `waiting-for-players`.
 */
export function getHoldemPhase(state: GameState): HoldemPhase {
  if (!state.holdem) {
    return 'waiting-for-players';
  }
  return mapLegacyStatusToPhase(state.holdem.status);
}
