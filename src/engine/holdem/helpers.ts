import type { GameSession } from '../../types/session';
import type { HoldemRound, HoldemPlayerState } from '../../types/holdem';
import { computeHoldemPot } from '../../types/holdem';
import { buildHoldemSidePots, type HoldemContribution } from './sidePots';

export function isPlayerAllIn(ps: HoldemPlayerState | undefined): boolean {
  return ps?.actionStatus === 'all-in';
}

export function isPlayerInHand(ps: HoldemPlayerState | undefined): boolean {
  return Boolean(ps && ps.actionStatus !== 'folded');
}

export function getBettingEligiblePlayers(round: HoldemRound): string[] {
  return Object.entries(round.playerStates)
    .filter(([, ps]) => isPlayerInHand(ps) && !isPlayerAllIn(ps))
    .map(([id]) => id);
}

export function getHoldemPlayerOrder(session: GameSession): string[] {
  return [...session.playerIds];
}

export function getSeatAfter(
  session: GameSession,
  playerId: string,
  steps = 1,
): string {
  const order = getHoldemPlayerOrder(session);
  const index = order.indexOf(playerId);
  if (index === -1) {
    throw new Error(`Player ${playerId} not at table`);
  }
  return order[(index + steps) % order.length];
}

function isHeadsUp(session: GameSession): boolean {
  return session.playerIds.length === 2;
}

/** Heads-up: dealer/button posts small blind. 3+: seat after dealer. */
export function getSmallBlindSeat(session: GameSession, dealerId: string): string {
  if (isHeadsUp(session)) {
    return dealerId;
  }
  return getSeatAfter(session, dealerId, 1);
}

/** Heads-up: non-dealer posts big blind. 3+: two seats after dealer. */
export function getBigBlindSeat(session: GameSession, dealerId: string): string {
  if (isHeadsUp(session)) {
    const other = session.playerIds.find((id) => id !== dealerId);
    if (!other) {
      throw new Error('Heads-up requires two distinct seats');
    }
    return other;
  }
  return getSeatAfter(session, dealerId, 2);
}

/**
 * Preflop first actor: heads-up dealer/SB acts first; 3+ UTG (seat after BB).
 */
export function getFirstPreflopActor(
  session: GameSession,
  bigBlindId: string,
  dealerId?: string,
): string {
  if (isHeadsUp(session)) {
    return dealerId ?? getSmallBlindSeat(session, bigBlindId);
  }
  return getSeatAfter(session, bigBlindId, 1);
}

export function getFirstPostflopActor(
  session: GameSession,
  dealerId: string,
  round: HoldemRound,
): string | null {
  const order = getHoldemPlayerOrder(session);
  const dealerIndex = order.indexOf(dealerId);
  for (let i = 1; i <= order.length; i += 1) {
    const id = order[(dealerIndex + i) % order.length];
    const ps = round.playerStates[id];
    if (ps && isPlayerInHand(ps) && !isPlayerAllIn(ps)) {
      return id;
    }
  }
  return null;
}

export function getActivePlayers(round: HoldemRound): string[] {
  return Object.entries(round.playerStates)
    .filter(([, ps]) => isPlayerInHand(ps))
    .map(([id]) => id);
}

export function contributionsFromRound(round: HoldemRound): HoldemContribution[] {
  return Object.entries(round.playerStates).map(([seatId, ps]) => ({
    seatId,
    amount: ps.playerTotalCommitted,
    isFolded: ps.actionStatus === 'folded',
  }));
}

export function recomputeHoldemSidePots(round: HoldemRound): HoldemRound {
  return {
    ...round,
    sidePots: buildHoldemSidePots(contributionsFromRound(round)),
  };
}

export function initHoldemPlayerStates(
  session: GameSession,
): Record<string, HoldemPlayerState> {
  const states: Record<string, HoldemPlayerState> = {};
  for (const playerId of session.playerIds) {
    states[playerId] = {
      holeCardIds: [],
      actionStatus: 'waiting',
      playerBetsThisStreet: 0,
      playerTotalCommitted: 0,
      hasActedThisStreet: false,
    };
  }
  return states;
}

export function syncHoldemPot(round: HoldemRound): HoldemRound {
  const withSidePots = recomputeHoldemSidePots(round);
  return { ...withSidePots, pot: computeHoldemPot(round) };
}

export function resetStreetBets(round: HoldemRound): HoldemRound {
  const playerStates: Record<string, HoldemPlayerState> = {};
  for (const [id, ps] of Object.entries(round.playerStates)) {
    playerStates[id] = {
      ...ps,
      playerBetsThisStreet: 0,
      hasActedThisStreet: false,
      actionStatus:
        ps.actionStatus === 'folded'
          ? 'folded'
          : ps.actionStatus === 'all-in'
            ? 'all-in'
            : 'active',
    };
  }
  return syncHoldemPot({
    ...round,
    playerStates,
    currentBet: 0,
    lastRaiseSize: round.bigBlind,
  });
}

export function appendActionLog(round: HoldemRound, message: string): HoldemRound {
  return {
    ...round,
    actionLog: [...round.actionLog, message],
  };
}

export function assertMinHoldemPlayers(session: GameSession): void {
  if (session.playerIds.length < 2) {
    throw new Error('Texas Hold\'em requires at least 2 players');
  }
}

export function rotateDealerButton(session: GameSession): string {
  const current = session.dealerButtonPlayerId ?? session.playerIds[0];
  return getSeatAfter(session, current, 1);
}
