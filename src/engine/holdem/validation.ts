import type { GameSession } from '../../types/session';
import type { Ledger } from '../../types/ledger';
import type { Deck } from '../../types/deck';
import type { HoldemRound } from '../../types/holdem';
import { createEmptyHoldemRound } from '../../types/holdem';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import { assertMinHoldemPlayers } from './helpers';

export function canCheckHoldem(round: HoldemRound, playerId: string): boolean {
  if (round.activePlayerId !== playerId) {
    return false;
  }
  const ps = round.playerStates[playerId];
  if (!ps || ps.actionStatus === 'folded') {
    return false;
  }
  return round.currentBet - ps.playerBetsThisStreet === 0;
}

export function canCallHoldem(
  ledger: Ledger,
  round: HoldemRound,
  playerId: string,
): boolean {
  if (round.activePlayerId !== playerId) {
    return false;
  }
  const ps = round.playerStates[playerId];
  if (!ps || ps.actionStatus === 'folded') {
    return false;
  }
  const toCall = round.currentBet - ps.playerBetsThisStreet;
  if (toCall <= 0) {
    return false;
  }
  return derivePlayerBalanceFromLedger(playerId, ledger) >= toCall;
}

export function canBetHoldem(
  ledger: Ledger,
  round: HoldemRound,
  playerId: string,
  amount: number,
): boolean {
  if (round.activePlayerId !== playerId || round.currentBet > 0) {
    return false;
  }
  if (amount < round.bigBlind) {
    return false;
  }
  return derivePlayerBalanceFromLedger(playerId, ledger) >= amount;
}

export function canRaiseHoldem(
  ledger: Ledger,
  round: HoldemRound,
  playerId: string,
  targetTotal: number,
): boolean {
  if (round.activePlayerId !== playerId) {
    return false;
  }
  const ps = round.playerStates[playerId];
  if (!ps || ps.actionStatus === 'folded') {
    return false;
  }
  const minRaiseTo = round.currentBet + round.lastRaiseSize;
  if (targetTotal < minRaiseTo) {
    return false;
  }
  const additional = targetTotal - ps.playerBetsThisStreet;
  return derivePlayerBalanceFromLedger(playerId, ledger) >= additional;
}

export function canFoldHoldem(round: HoldemRound, playerId: string): boolean {
  return round.activePlayerId === playerId &&
    round.playerStates[playerId]?.actionStatus !== 'folded';
}

export function hasEnoughCardsForHoldemStart(
  deck: Deck | null,
  playerCount: number,
): boolean {
  if (!deck) {
    return false;
  }
  const needed = playerCount * 2 + 5;
  return deck.drawOrder.length >= needed;
}

export interface HoldemCheckResult {
  name: string;
  passed: boolean;
}

export function runHoldemEngineChecks(): { passed: boolean; results: HoldemCheckResult[] } {
  const results: HoldemCheckResult[] = [];

  try {
    assertMinHoldemPlayers({ playerIds: ['a'] } as GameSession);
    results.push({ name: 'min 2 players enforced', passed: false });
  } catch {
    results.push({ name: 'min 2 players enforced', passed: true });
  }

  results.push({
    name: 'cannot check behind bet',
    passed: !canCheckHoldem(
      {
        ...createEmptyHoldemRound('d', 's', 'b'),
        activePlayerId: 'a',
        currentBet: 10,
        playerStates: {
          a: {
            playerBetsThisStreet: 0,
            actionStatus: 'active',
            holeCardIds: [],
            playerTotalCommitted: 0,
            hasActedThisStreet: false,
          },
        },
      },
      'a',
    ),
  });

  const passed = results.every((r) => r.passed);
  return { passed, results };
}
