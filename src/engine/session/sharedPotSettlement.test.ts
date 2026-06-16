import { describe, expect, it } from 'vitest';

import type { GameState } from '../../types';
import { createBlackjackPlayerHand } from '../../types/blackjack';
import { settleBustHandOnState } from '../blackjack/bustSettlement';
import { resolveNaturalsAfterInitialDeal } from '../blackjack/naturalBlackjack';
import {
  bankrollContextFromState,
  getLedgerBalanceForBankrollOwner,
} from './bankroll';
import { assignBankPerson, claimBoxSlot, ensureTableOwnerPersonBankroll } from './index';
import { confirmTableAgreement, createNewBlackjackTable } from './table';
import { setTableOwner } from './invites';
import { setControllerName } from './boxOps';
import { addPlayer, mergeSessionUpdate } from './session';
import { allocateChipsToBankrollOwner } from './allocation';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import { resolveBlackjackRound } from '../blackjack/round';
import { blackjackHandKey } from '../blackjack/handKeys';
import { createInitialBlackjackRound } from '../blackjack/helpers';
import { findCardId, tableAfterStartPlaying } from '../blackjack/sanity/fixtures';
import { shuffleBlackjackShoe, createBlackjackShoe } from '../blackjack/shoe';
import { totalCanonicalChipsInPlay } from './sharedPotSettlement';
import { appendBoxLedgerEntry } from './boxLedger';

function ownerAsBankTable(seatChips = 500) {
  let state = createNewBlackjackTable();
  state = confirmTableAgreement(state, 'Challenge', seatChips, seatChips);
  state = setTableOwner(state, 'Alice', '');
  state = setControllerName(state, 'Alice');
  state = assignBankPerson(state, 'Alice', seatChips);
  state = ensureTableOwnerPersonBankroll(state);
  state = {
    ...state,
    deck: shuffleBlackjackShoe(createBlackjackShoe(6), 'shared-pot-settlement'),
  };
  const bankId = state.session.bankPlayerId!;
  const ownerId = state.tableMeta.ownerPersonId!;
  return { state, bankId, ownerId };
}

function sumAllLedgerBalances(state: GameState): number {
  const ids = new Set(state.ledger.entries.map((e) => e.playerId));
  let total = 0;
  for (const id of ids) {
    total += derivePlayerBalanceFromLedger(id, state.ledger);
  }
  return total;
}

function placeBetOnBox(state: GameState, boxId: string, amount: number): GameState {
  const ctx = bankrollContextFromState(state);
  const bet = appendBoxLedgerEntry(
    state.session,
    state.ledger,
    ctx,
    boxId,
    'bet-placed',
    -amount,
    `test bet: ${amount} chips`,
    state.session.currentRound,
  );
  return {
    ...state,
    session: bet.session,
    ledger: bet.ledger,
  };
}

function roundReadyToResolve(
  state: GameState,
  boxId: string,
  playerRanks: string[],
  dealerRanks: string[],
  bet: number,
) {
  const deck = state.deck!;
  const handKey = blackjackHandKey(boxId, 0);
  const playerCardIds = playerRanks.map((r) => findCardId(deck, r as '10' | '9' | '8' | '7' | 'A' | 'K' | 'Q' | 'J'));
  const dealerCardIds = dealerRanks.map((r) => findCardId(deck, r as '10' | '9' | '8' | '7' | 'A' | 'K' | 'Q' | 'J'));
  const round = {
    ...createInitialBlackjackRound(state.session),
    status: 'bank-turn' as const,
    dealerCardIds,
    playerHands: {
      [handKey]: {
        ...createBlackjackPlayerHand(boxId, 0),
        cardIds: playerCardIds,
        currentBet: bet,
        actionStatus: 'done' as const,
      },
    },
  };
  return { ...state, blackjack: round };
}

describe('shared pot settlement — bank and player same person', () => {
  it('win vs own bank: canonical bankroll and total chips unchanged', () => {
    let { state, ownerId } = ownerAsBankTable();
    state = claimBoxSlot(state, 1);
    const boxId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)!.playerId!;
    const baselineTotal = sumAllLedgerBalances(state);
    const baselineCanonical = getLedgerBalanceForBankrollOwner(state, ownerId);
    state = placeBetOnBox(state, boxId, 50);

    state = roundReadyToResolve(state, boxId, ['10', '9'], ['10', '8'], 50);
    const ctx = bankrollContextFromState(state);
    const resolved = resolveBlackjackRound(
      state.session,
      state.players,
      state.ledger,
      state.deck!,
      state.blackjack!,
      state.blackjackSettings,
      ctx,
    );
    state = { ...state, session: resolved.session, ledger: resolved.ledger, blackjack: resolved.round };

    expect(getLedgerBalanceForBankrollOwner(state, ownerId)).toBe(baselineCanonical);
    expect(sumAllLedgerBalances(state)).toBe(baselineTotal);
    expect(totalCanonicalChipsInPlay(state)).toBe(baselineCanonical);
  });

  it('loss vs own bank: canonical bankroll and total chips unchanged', () => {
    let { state, ownerId } = ownerAsBankTable();
    state = claimBoxSlot(state, 1);
    const boxId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)!.playerId!;
    const baselineTotal = sumAllLedgerBalances(state);
    const baselineCanonical = getLedgerBalanceForBankrollOwner(state, ownerId);
    state = placeBetOnBox(state, boxId, 50);

    state = roundReadyToResolve(state, boxId, ['10', '7'], ['10', '9'], 50);
    const ctx = bankrollContextFromState(state);
    const resolved = resolveBlackjackRound(
      state.session,
      state.players,
      state.ledger,
      state.deck!,
      state.blackjack!,
      state.blackjackSettings,
      ctx,
    );
    state = { ...state, session: resolved.session, ledger: resolved.ledger, blackjack: resolved.round };

    expect(getLedgerBalanceForBankrollOwner(state, ownerId)).toBe(baselineCanonical);
    expect(sumAllLedgerBalances(state)).toBe(baselineTotal);
  });

  it('natural blackjack 3:2 vs own bank does not mint chips', () => {
    let { state, ownerId } = ownerAsBankTable();
    state = claimBoxSlot(state, 1);
    const boxId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)!.playerId!;
    const handKey = blackjackHandKey(boxId, 0);
    const deck = state.deck!;
    const baselineTotal = sumAllLedgerBalances(state);
    const baselineCanonical = getLedgerBalanceForBankrollOwner(state, ownerId);

    state = placeBetOnBox(state, boxId, 50);
    state = {
      ...state,
      blackjack: {
        ...createInitialBlackjackRound(state.session),
        status: 'player-turns',
        dealerCardIds: [findCardId(deck, '6'), findCardId(deck, '9')],
        playerHands: {
          [handKey]: {
            ...createBlackjackPlayerHand(boxId, 0),
            cardIds: [findCardId(deck, 'A'), findCardId(deck, 'K')],
            currentBet: 50,
            actionStatus: 'acting',
          },
        },
      },
    };

    state = resolveNaturalsAfterInitialDeal(state);

    expect(getLedgerBalanceForBankrollOwner(state, ownerId)).toBe(baselineCanonical);
    expect(sumAllLedgerBalances(state)).toBe(baselineTotal);
  });

  it('bust vs own bank does not mint or burn chips', () => {
    let { state, ownerId } = ownerAsBankTable();
    state = claimBoxSlot(state, 1);
    const boxId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)!.playerId!;
    const handKey = blackjackHandKey(boxId, 0);
    const deck = state.deck!;
    const baselineTotal = sumAllLedgerBalances(state);
    const baselineCanonical = getLedgerBalanceForBankrollOwner(state, ownerId);
    state = placeBetOnBox(state, boxId, 50);

    const round = {
      ...createInitialBlackjackRound(state.session),
      status: 'player-turns' as const,
      activeHandKey: handKey,
      playerHands: {
        [handKey]: {
          ...createBlackjackPlayerHand(boxId, 0),
          cardIds: [findCardId(deck, '10'), findCardId(deck, '9'), findCardId(deck, '5')],
          currentBet: 50,
          actionStatus: 'busted' as const,
        },
      },
    };
    state = { ...state, blackjack: round };
    state = settleBustHandOnState(state, handKey);

    expect(getLedgerBalanceForBankrollOwner(state, ownerId)).toBe(baselineCanonical);
    expect(sumAllLedgerBalances(state)).toBe(baselineTotal);
  });

  it('double win vs own bank does not mint chips', () => {
    let { state, ownerId } = ownerAsBankTable();
    state = claimBoxSlot(state, 1);
    const boxId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)!.playerId!;
    const deck = state.deck!;
    const ctx = bankrollContextFromState(state);
    const baselineTotal = sumAllLedgerBalances(state);
    const baselineCanonical = getLedgerBalanceForBankrollOwner(state, ownerId);

    state = placeBetOnBox(state, boxId, 50);
    const doubleBet = appendBoxLedgerEntry(
      state.session,
      state.ledger,
      ctx,
      boxId,
      'bet-increased',
      -50,
      'test double',
      state.session.currentRound,
    );
    state = { ...state, session: doubleBet.session, ledger: doubleBet.ledger };

    state = roundReadyToResolve(state, boxId, ['10', '9', '2'], ['10', '8'], 100);

    const resolved = resolveBlackjackRound(
      state.session,
      state.players,
      state.ledger,
      deck,
      state.blackjack!,
      state.blackjackSettings,
      bankrollContextFromState(state),
    );
    state = { ...state, session: resolved.session, ledger: resolved.ledger };

    expect(getLedgerBalanceForBankrollOwner(state, ownerId)).toBe(baselineCanonical);
    expect(sumAllLedgerBalances(state)).toBe(baselineTotal);
  });
});

describe('shared pot settlement — other players vs bank', () => {
  it('guest beating bank receives payout; bank loses chips', () => {
    let { state, bankId, ownerId } = ownerAsBankTable();
    const guestSpl = addPlayer(state.session, state.players, state.ledger, {
      displayName: 'Bob',
      controllerName: 'Bob',
      role: 'person',
      startingChips: 0,
    });
    state = mergeSessionUpdate(state, guestSpl);
    const guestId = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;
    state = allocateChipsToBankrollOwner(state, {
      bankrollOwnerId: guestId,
      amount: 500,
      reason: 'initial-player',
      source: 'setup',
    });
    state = setControllerName(state, 'Bob');
    state = claimBoxSlot(state, 2);
    const boxId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 2)!.playerId!;
    const baselineTotal = sumAllLedgerBalances(state);
    const guestStart = derivePlayerBalanceFromLedger(guestId, state.ledger);
    const bankStart = derivePlayerBalanceFromLedger(bankId, state.ledger);
    state = placeBetOnBox(state, boxId, 50);

    state = roundReadyToResolve(state, boxId, ['10', '9'], ['10', '8'], 50);
    const resolved = resolveBlackjackRound(
      state.session,
      state.players,
      state.ledger,
      state.deck!,
      state.blackjack!,
      state.blackjackSettings,
      bankrollContextFromState(state),
    );
    state = { ...state, session: resolved.session, ledger: resolved.ledger };

    expect(derivePlayerBalanceFromLedger(guestId, state.ledger)).toBe(guestStart + 50);
    expect(derivePlayerBalanceFromLedger(bankId, state.ledger)).toBe(bankStart - 50);
    expect(sumAllLedgerBalances(state)).toBe(baselineTotal);
    expect(getLedgerBalanceForBankrollOwner(state, ownerId)).toBe(
      derivePlayerBalanceFromLedger(bankId, state.ledger),
    );
  });

  it('bank beating guest collects normally', () => {
    let state = tableAfterStartPlaying(500);
    const bankId = state.session.bankPlayerId!;
    state = claimBoxSlot(state, 1);
    const boxId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)!.playerId!;
    const baselineTotal = sumAllLedgerBalances(state);
    const bankStart = derivePlayerBalanceFromLedger(bankId, state.ledger);
    const boxOwnerId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)!.bankrollOwnerId!;
    const guestStart = derivePlayerBalanceFromLedger(boxOwnerId, state.ledger);
    state = placeBetOnBox(state, boxId, 50);

    state = roundReadyToResolve(state, boxId, ['10', '7'], ['10', '9'], 50);
    const resolved = resolveBlackjackRound(
      state.session,
      state.players,
      state.ledger,
      state.deck!,
      state.blackjack!,
      state.blackjackSettings,
      bankrollContextFromState(state),
    );
    state = { ...state, session: resolved.session, ledger: resolved.ledger };

    expect(derivePlayerBalanceFromLedger(bankId, state.ledger)).toBe(bankStart + 50);
    expect(derivePlayerBalanceFromLedger(boxOwnerId, state.ledger)).toBe(guestStart - 50);
    expect(sumAllLedgerBalances(state)).toBe(baselineTotal);
  });
});
