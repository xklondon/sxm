import type { GameSession } from '../../types/session';
import type { HoldemRound, HoldemPlayerState } from '../../types/holdem';
import { computeHoldemPot } from '../../types/holdem';

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

export function getSmallBlindSeat(session: GameSession, dealerId: string): string {
  return getSeatAfter(session, dealerId, 1);
}

export function getBigBlindSeat(session: GameSession, dealerId: string): string {
  return getSeatAfter(session, dealerId, 2);
}

export function getFirstPreflopActor(
  session: GameSession,
  bigBlindId: string,
): string {
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
    if (ps && ps.actionStatus !== 'folded') {
      return id;
    }
  }
  return null;
}

export function getActivePlayers(round: HoldemRound): string[] {
  return Object.entries(round.playerStates)
    .filter(([, ps]) => ps.actionStatus !== 'folded')
    .map(([id]) => id);
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
  return { ...round, pot: computeHoldemPot(round) };
}

export function resetStreetBets(round: HoldemRound): HoldemRound {
  const playerStates: Record<string, HoldemPlayerState> = {};
  for (const [id, ps] of Object.entries(round.playerStates)) {
    playerStates[id] = {
      ...ps,
      playerBetsThisStreet: 0,
      hasActedThisStreet: false,
      actionStatus: ps.actionStatus === 'folded' ? 'folded' : 'active',
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
