import { buildTableBankRow, buildTablePeopleRows } from '../../session/tablePeople';
import {
  applyTableGameEndIfNeeded,
  evaluateTableGameEnd,
  isTableGameActive,
} from '../../session/tableGameEnd';
import { getLedgerBalanceForBankrollOwner } from '../../session/bankroll';
import { resolveBlackjackRound } from '../round';
import { completeBankingOnState, placeBlackjackBetOnState, startBlackjackRound, startNextRoundOnState } from '../gameState';
import { bankrollContextFromState } from '../../session/bankroll';
import { resolveBankrollOwnerIdForBox } from '../../session/bankroll';
import { check, type SanitySuiteResult } from './types';
import {
  boxPlayerId,
  findCardId,
  tableWithClaimedBox,
} from './fixtures';

function bankingRound(
  state: ReturnType<typeof tableWithClaimedBox>,
  boxId: string,
  playerCards: string[],
  dealerCards: string[],
  bet: number,
) {
  return {
    ...state.blackjack!,
    status: 'banking' as const,
    dealerCardIds: dealerCards,
    dealerHoleHidden: false,
    playerHands: {
      [`${boxId}:0`]: {
        playerId: boxId,
        handIndex: 0,
        cardIds: playerCards,
        currentBet: bet,
        actionStatus: 'stood' as const,
        doubled: false,
        fromSplit: false,
      },
    },
  };
}

export function runTableBalanceSanityChecks(): SanitySuiteResult {
  const results = [];

  const claimed = tableWithClaimedBox(1);
  const personId = resolveBankrollOwnerIdForBox(claimed, boxPlayerId(claimed, 1)!);
  const people = buildTablePeopleRows(claimed);
  const personRow = people.find((p) => p.personId === personId);
  results.push(
    check(
      'player balance visible after allocation',
      Boolean(personRow?.showBalance && personRow.available === 500),
      `available=${personRow?.available}`,
    ),
  );

  const bank = buildTableBankRow(claimed);
  results.push(check('bank row exists with name', Boolean(bank?.bankName)));
  results.push(
    check(
      'bank row balance data',
      Boolean(bank && bank.balance === 500 && bank.bankName.length > 0),
      `balance=${bank?.balance}`,
    ),
  );

  let state = tableWithClaimedBox(1);
  const bankId = state.session.bankPlayerId!;
  const bId = boxPlayerId(state, 1)!;
  const deck = state.deck!;
  state = startBlackjackRound(state);
  state = placeBlackjackBetOnState(state, bId, 500);
  const lossRound = bankingRound(
    state,
    bId,
    [findCardId(deck, '10'), findCardId(deck, '9')],
    [findCardId(deck, 'K'), findCardId(deck, 'A')],
    500,
  );
  const resolved = resolveBlackjackRound(
    state.session,
    state.players,
    state.ledger,
    deck,
    lossRound,
    state.blackjackSettings,
    bankrollContextFromState(state),
  );
  state = applyTableGameEndIfNeeded({
    ...state,
    session: resolved.session,
    ledger: resolved.ledger,
    blackjack: resolved.round,
    tableMeta: { ...state.tableMeta, bettingLocked: true },
  });
  const endEval = evaluateTableGameEnd(state);
  results.push(
    check(
      'end condition when bank has all chips',
      state.tableMeta.gameStatus === 'ended' && endEval.winnerId === bankId,
      `status=${state.tableMeta.gameStatus}`,
    ),
  );

  state = tableWithClaimedBox(1);
  const winBoxId = boxPlayerId(state, 1)!;
  const winPersonId = resolveBankrollOwnerIdForBox(state, winBoxId)!;
  state = startBlackjackRound(state);
  state = placeBlackjackBetOnState(state, winBoxId, 500);
  const winRound = bankingRound(
    state,
    winBoxId,
    [findCardId(deck, 'K'), findCardId(deck, '9')],
    [findCardId(deck, '10'), findCardId(deck, '8')],
    500,
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
  state = applyTableGameEndIfNeeded({
    ...state,
    session: winResolved.session,
    ledger: winResolved.ledger,
    blackjack: winResolved.round,
    tableMeta: { ...state.tableMeta, bettingLocked: true },
  });
  const personBal = getLedgerBalanceForBankrollOwner(state, winPersonId);
  results.push(
    check(
      'end condition when player has all chips',
      state.tableMeta.gameStatus === 'ended' &&
        state.tableMeta.winnerId === winPersonId &&
        personBal >= 1000,
      `personBal=${personBal} winner=${state.tableMeta.winnerId}`,
    ),
  );

  state = tableWithClaimedBox(1);
  const endBoxId = boxPlayerId(state, 1)!;
  state = startBlackjackRound(state);
  state = placeBlackjackBetOnState(state, endBoxId, 500);
  state = {
    ...state,
    blackjack: bankingRound(state, endBoxId, [findCardId(deck, '10'), findCardId(deck, '7')], [findCardId(deck, 'K'), findCardId(deck, '9')], 500),
  };
  state = completeBankingOnState(state);
  if (state.tableMeta.gameStatus !== 'ended') {
    state = applyTableGameEndIfNeeded(state);
  }
  results.push(
    check(
      'no next round when game ended',
      state.tableMeta.gameStatus === 'ended' && !isTableGameActive(state),
    ),
  );
  let threw = false;
  try {
    startNextRoundOnState({
      ...state,
      tableMeta: { ...state.tableMeta, awaitingNextRound: true },
    });
  } catch {
    threw = true;
  }
  results.push(check('startNextRound throws when ended', threw));

  return { passed: results.every((r) => r.passed), results };
}
