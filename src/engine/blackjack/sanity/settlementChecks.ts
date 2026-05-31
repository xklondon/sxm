import type { GameState } from '../../../types';
import type { BlackjackRound } from '../../../types/blackjack';
import { derivePlayerBalanceFromLedger } from '../../ledger/ledger';
import {
  getAvailableChipsForBankrollOwner,
  getLedgerBalanceForBankrollOwner,
  getTotalBettingExposureForBankrollOwner,
} from '../../session/bankroll';
import { buildTablePeopleRows } from '../../session/tablePeople';
import { resolveBankrollOwnerIdForBox } from '../../session/bankroll';
import { bankrollContextFromState } from '../../session/bankroll';
import { resolveBlackjackRound } from '../round';
import {
  completeBankingOnState,
  ensureBlackjackRoundSettled,
  placeBlackjackBetOnState,
  startBlackjackRound,
  startNextRoundOnState,
} from '../gameState';
import { check, type SanitySuiteResult } from './types';
import {
  boxPlayerId,
  findCardId,
  tableWithClaimedBox,
} from './fixtures';

function setOpenStake(state: GameState, boxPlayerId: string, amount: number): GameState {
  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      boxStakes: {
        ...state.tableMeta.boxStakes,
        [boxPlayerId]: { amount, chips: [], confirmed: true },
      },
    },
  };
}

function bankingRound(state: GameState, boxId: string, playerCards: string[], dealerCards: string[], bet: number): BlackjackRound {
  return {
    ...state.blackjack!,
    status: 'banking',
    dealerCardIds: dealerCards,
    dealerHoleHidden: false,
    playerHands: {
      [`${boxId}:0`]: {
        playerId: boxId,
        handIndex: 0,
        cardIds: playerCards,
        currentBet: bet,
        actionStatus: 'stood',
        doubled: false,
        fromSplit: false,
      },
    },
  };
}

export function runSettlementSanityChecks(): SanitySuiteResult {
  const results = [];

  let state = tableWithClaimedBox(1);
  const personId = resolveBankrollOwnerIdForBox(state, boxPlayerId(state, 1)!);
  const people = buildTablePeopleRows(state);
  const personRow = people.find((p) => p.key === personId);
  results.push(
    check(
      'initial allocation visible on This Table',
      Boolean(personRow && personRow.available === 500),
      `available=${personRow?.available}`,
    ),
  );

  const boxId = boxPlayerId(state, 1)!;
  state = setOpenStake(state, boxId, 65);
  const exposure = getTotalBettingExposureForBankrollOwner(state, personId);
  const available = getAvailableChipsForBankrollOwner(state, personId);
  results.push(check('bet exposure subtracts open stake', exposure === 65, `exposure=${exposure}`));
  results.push(check('available after open stake', available === 435, `available=${available}`));

  state = tableWithClaimedBox(1);
  const deck = state.deck!;
  let bId = boxPlayerId(state, 1)!;
  let oId = resolveBankrollOwnerIdForBox(state, bId);
  const bankLossId = state.session.bankPlayerId!;
  state = startBlackjackRound(state);
  state = placeBlackjackBetOnState(state, bId, 5);
  const playerBefore = getLedgerBalanceForBankrollOwner(state, oId);
  const bankBefore = derivePlayerBalanceFromLedger(bankLossId, state.ledger);
  const lossRound = bankingRound(
    state,
    bId,
    [findCardId(deck, '10'), findCardId(deck, '9')],
    [findCardId(deck, 'K'), findCardId(deck, 'A')],
    5,
  );
  const lossResolved = resolveBlackjackRound(
    state.session,
    state.players,
    state.ledger,
    deck,
    lossRound,
    state.blackjackSettings,
    bankrollContextFromState(state),
  );
  const playerAfterLoss = derivePlayerBalanceFromLedger(oId, lossResolved.ledger);
  const bankAfterLoss = derivePlayerBalanceFromLedger(bankLossId, lossResolved.ledger);
  results.push(
    check(
      'loss settlement: player unchanged after loss (bet already deducted)',
      playerAfterLoss === playerBefore,
      `before=${playerBefore} after=${playerAfterLoss}`,
    ),
  );
  results.push(
    check(
      'loss settlement: bank +5',
      bankAfterLoss === bankBefore + 5,
      `before=${bankBefore} after=${bankAfterLoss}`,
    ),
  );

  state = tableWithClaimedBox(1);
  bId = boxPlayerId(state, 1)!;
  oId = resolveBankrollOwnerIdForBox(state, bId);
  const bankWinId = state.session.bankPlayerId!;
  state = startBlackjackRound(state);
  state = placeBlackjackBetOnState(state, bId, 5);
  const winBefore = getLedgerBalanceForBankrollOwner(state, oId);
  const bankWinBefore = derivePlayerBalanceFromLedger(bankWinId, state.ledger);
  const winRound = bankingRound(
    state,
    bId,
    [findCardId(deck, 'K'), findCardId(deck, '9')],
    [findCardId(deck, '10'), findCardId(deck, '8')],
    5,
  );
  const winResolved = resolveBlackjackRound(
    state.session,
    state.players,
    state.ledger,
    deck,
    winRound,
    state.blackjackSettings,
    bankrollContextFromState(state),
  );
  const winAfter = derivePlayerBalanceFromLedger(oId, winResolved.ledger);
  const bankWinAfter = derivePlayerBalanceFromLedger(bankWinId, winResolved.ledger);
  results.push(
    check(
      'win settlement: player receives bet + winnings',
      winAfter === winBefore + 10,
      `before=${winBefore} after=${winAfter}`,
    ),
  );
  results.push(
    check(
      'win settlement: bank -5',
      bankWinAfter === bankWinBefore - 5,
      `before=${bankWinBefore} after=${bankWinAfter}`,
    ),
  );

  state = tableWithClaimedBox(1);
  bId = boxPlayerId(state, 1)!;
  oId = resolveBankrollOwnerIdForBox(state, bId);
  state = startBlackjackRound(state);
  state = placeBlackjackBetOnState(state, bId, 5);
  const pushBefore = getLedgerBalanceForBankrollOwner(state, oId);
  const pushRound = bankingRound(
    state,
    bId,
    [findCardId(deck, 'K'), findCardId(deck, 'Q')],
    [findCardId(deck, '10'), findCardId(deck, 'J')],
    5,
  );
  const pushResolved = resolveBlackjackRound(
    state.session,
    state.players,
    state.ledger,
    deck,
    pushRound,
    state.blackjackSettings,
    bankrollContextFromState(state),
  );
  const pushAfter = derivePlayerBalanceFromLedger(oId, pushResolved.ledger);
  results.push(
    check(
      'push settlement: player balance restored',
      pushAfter === pushBefore + 5,
      `before=${pushBefore} after=${pushAfter}`,
    ),
  );

  state = tableWithClaimedBox(1);
  bId = boxPlayerId(state, 1)!;
  oId = resolveBankrollOwnerIdForBox(state, bId);
  state = startBlackjackRound(state);
  state = placeBlackjackBetOnState(state, bId, 10);
  const bjBefore = getLedgerBalanceForBankrollOwner(state, oId);
  const bjRound = bankingRound(
    state,
    bId,
    [findCardId(deck, 'A'), findCardId(deck, 'K')],
    [findCardId(deck, '10'), findCardId(deck, '8')],
    10,
  );
  const bjResolved = resolveBlackjackRound(
    state.session,
    state.players,
    state.ledger,
    deck,
    bjRound,
    state.blackjackSettings,
    bankrollContextFromState(state),
  );
  const bjAfter = derivePlayerBalanceFromLedger(oId, bjResolved.ledger);
  results.push(
    check(
      'blackjack 3:2 settlement: player receives bet + winnings',
      bjAfter === bjBefore + 25,
      `before=${bjBefore} after=${bjAfter}`,
    ),
  );

  state = tableWithClaimedBox(1);
  bId = boxPlayerId(state, 1)!;
  oId = resolveBankrollOwnerIdForBox(state, bId);
  state = startBlackjackRound(state);
  state = placeBlackjackBetOnState(state, bId, 5);
  state = {
    ...state,
    blackjack: bankingRound(state, bId, [findCardId(deck, '10'), findCardId(deck, '7')], [findCardId(deck, 'K'), findCardId(deck, '9')], 5),
  };
  state = completeBankingOnState(state);
  const settledBal = derivePlayerBalanceFromLedger(oId, state.ledger);
  const entryCount = state.ledger.entries.length;
  const again = ensureBlackjackRoundSettled(state);
  const againBal = derivePlayerBalanceFromLedger(oId, again.ledger);
  const againCount = again.ledger.entries.length;
  results.push(
    check(
      'settlement idempotent — no double pay',
      settledBal === againBal && entryCount === againCount,
      `entries ${entryCount}->${againCount}`,
    ),
  );

  state = {
    ...state,
    tableMeta: { ...state.tableMeta, awaitingNextRound: true },
  };
  const next1 = startNextRoundOnState(state);
  const next1Bal = derivePlayerBalanceFromLedger(oId, next1.ledger);
  results.push(
    check(
      'Next Round clears awaiting flag',
      !next1.tableMeta.awaitingNextRound && next1.blackjack?.status === 'betting',
    ),
  );
  results.push(
    check(
      'Next Round preserves settled balances',
      next1Bal === settledBal,
      `balance=${next1Bal}`,
    ),
  );

  return { passed: results.every((r) => r.passed), results };
}
