import type { GameState } from '../../../types';
import type { Deck, Rank, Suit } from '../../../types/deck';
import type { BlackjackRound } from '../../../types/blackjack';
import { createNewBlackjackTable, confirmTableAgreement } from '../../session/table';
import { assignBankBot, claimBoxSlot, setControllerName } from '../../session/boxOps';
import { setTableOwner } from '../../session/invites';
import { ensureTableOwnerPersonBankroll } from '../../session/ownerBankroll';
import { createBlackjackShoe, shuffleBlackjackShoe } from '../shoe';
import { createBlackjackPlayerHand } from '../../../types/blackjack';
import { blackjackHandKey } from '../handKeys';
import { resolveBankrollOwnerIdForBox } from '../../session/bankroll';
import { createInitialBlackjackRound } from '../helpers';
import {
  completeStepwiseInitialDealIfNeeded,
  declineInsuranceOnState,
  resolveBankTurnAuto,
  shuffleToStartOnState,
} from '../gameState';
import { applyBlackjackActionToState, type BlackjackActorContext } from '../applyBlackjackAction';
import { isInsuranceBoxDecisionResolved } from '../insurance';
import { getBlackjackProtocolForState } from '../protocolState';
import { getInsuranceEligibleBoxIds } from '../protocols/activeRules';

export function tableAfterStartPlaying(seatChips = 500, bankChips?: number): GameState {
  const bank = bankChips ?? seatChips;
  let state = createNewBlackjackTable();
  state = {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      agreement: {
        stakeDescription: 'QA test',
        defaultChips: seatChips,
        agreedAt: new Date().toISOString(),
      },
      showStakeSetup: false,
      controllerName: 'Alice',
      startingChipsEachSeat: seatChips,
      startingChipsBank: bank,
      owner: { ownerName: 'Alice', ownerEmail: '', createdAt: new Date().toISOString() },
    },
    deck: shuffleBlackjackShoe(createBlackjackShoe(6), 'qa-seed'),
  };
  state = confirmTableAgreement(state, 'QA test', seatChips, bank);
  state = setTableOwner(state, 'Alice', '');
  state = assignBankBot(state, bank);
  state = setControllerName(state, 'Alice');
  state = ensureTableOwnerPersonBankroll(state);
  return state;
}

/** Skip paced natural-deal empty visibility on first paint (SSR/tests, mid-round snapshots). */
export function withInstantInitialDeal(state: GameState): GameState {
  return {
    ...state,
    blackjackFlowSettings: {
      ...state.blackjackFlowSettings,
      initialDealMode: 'instant',
    },
  };
}

export function baseTestTable(): GameState {
  return tableAfterStartPlaying(500);
}

export function tableWithClaimedBox(slotNumber = 1): GameState {
  let state = baseTestTable();
  state = claimBoxSlot(state, slotNumber);
  return state;
}

export function tableWithTwoBoxesSamePerson(): GameState {
  let state = tableWithClaimedBox(1);
  state = claimBoxSlot(state, 2);
  return state;
}

export function boxPlayerId(state: GameState, slotNumber: number): string | null {
  return state.tableMeta.boxSlots.find((s) => s.slotNumber === slotNumber)?.playerId ?? null;
}

/** Test helper — open stake with canonical staker metadata (StakePayerInvariant). */
export function setSanityOpenStake(
  state: GameState,
  boxPlayerId: string,
  amount: number,
  bettorPersonId?: string,
): GameState {
  const payer =
    bettorPersonId ??
    resolveBankrollOwnerIdForBox(state, boxPlayerId) ??
    state.tableMeta.ownerPersonId ??
    '';
  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      boxStakes: {
        ...state.tableMeta.boxStakes,
        [boxPlayerId]: {
          amount,
          chips: [],
          confirmed: true,
          callerPersonId: payer,
          stakerPersonIds: [payer],
          stakerAmountsByPersonId: { [payer]: amount },
        },
      },
    },
  };
}

export function actingRound(
  state: GameState,
  boxId: string,
  cardIds: string[],
  bet = 50,
): BlackjackRound {
  const handKey = blackjackHandKey(boxId, 0);
  const base = state.blackjack ?? createInitialBlackjackRound(state.session);
  return {
    ...base,
    status: 'player-turns',
    activeHandKey: handKey,
    activePlayerId: boxId,
    playerHands: {
      ...base.playerHands,
      [handKey]: {
        ...createBlackjackPlayerHand(boxId, 0),
        cardIds,
        currentBet: bet,
        actionStatus: 'acting',
      },
    },
  };
}

export function findCardId(deck: Deck, rank: Rank, suit?: Suit): string {
  const card = deck.cards.find((c) => c.rank === rank && (!suit || c.suit === suit));
  if (!card) {
    throw new Error(`Card not found: ${rank}${suit ? ` ${suit}` : ''}`);
  }
  return card.id;
}

export function deckWithAceUp(): Deck {
  const deck = shuffleBlackjackShoe(createBlackjackShoe(1), 'insurance-test');
  const aceId = findCardId(deck, 'A');
  const idx = deck.cards.findIndex((c) => c.id === aceId);
  const drawOrder = [idx, ...deck.drawOrder.filter((i) => i !== idx)];
  return { ...deck, drawOrder };
}

export function deckWithTenUp(): Deck {
  const deck = shuffleBlackjackShoe(createBlackjackShoe(1), 'no-insurance-test');
  const tenId = findCardId(deck, '10');
  const idx = deck.cards.findIndex((c) => c.id === tenId);
  const drawOrder = [idx, ...deck.drawOrder.filter((i) => i !== idx)];
  return { ...deck, drawOrder };
}

/**
 * Deterministic pre-deal shuffle for tests. `shuffleToStartOnState` reshuffles with
 * unseeded Math.random — batched vitest runs consume the global PRNG and change
 * which hands (insurance / even-money) appear across files.
 */
export function shuffleTableForDeal(state: GameState, seed = 'test-deal-seed'): GameState {
  const started = shuffleToStartOnState(state);
  const deckCount = started.blackjackSettings?.numberOfDecks ?? 6;
  return withInstantInitialDeal({
    ...started,
    deck: shuffleBlackjackShoe(createBlackjackShoe(deckCount, started.deck?.id), seed),
  });
}

export function blackjackTestActorContext(
  state: GameState,
  resolveBankAuto = true,
): BlackjackActorContext {
  return {
    personId: state.tableMeta.ownerPersonId ?? 'host',
    payload: {},
    resolveBankAuto,
  };
}

/** Play deal → insurance/even-money → stands → bank → resolved for ownership/settlement tests. */
export function settleBlackjackRoundForTest(state: GameState, seed = 'test-deal-seed'): GameState {
  const actor = blackjackTestActorContext(state);
  let s = applyBlackjackActionToState(shuffleTableForDeal(state, seed), 'dealCards', actor);
  let guard = 0;
  while (s.blackjack && s.blackjack.status !== 'resolved' && guard < 100) {
    guard += 1;
    const round = s.blackjack;

    if (round.status === 'initial-deal') {
      s = completeStepwiseInitialDealIfNeeded(s);
      continue;
    }

    if (round.insuranceOfferPending) {
      const protocol = getBlackjackProtocolForState(s);
      for (const boxId of getInsuranceEligibleBoxIds(s.session, round, protocol)) {
        if (!isInsuranceBoxDecisionResolved(s, round, protocol, boxId)) {
          s = declineInsuranceOnState(s, boxId);
        }
      }
      continue;
    }

    if (round.evenMoneyOfferHandKey) {
      s = applyBlackjackActionToState(s, 'waitFor3to2', {
        ...actor,
        payload: { handKey: round.evenMoneyOfferHandKey },
      });
      continue;
    }

    if (round.status === 'player-turns' && round.activeHandKey) {
      const hand = round.playerHands[round.activeHandKey];
      if (hand?.actionStatus === 'acting') {
        s = applyBlackjackActionToState(s, 'stand', actor);
        continue;
      }
    }

    s = resolveBankTurnAuto(s);
  }
  return s;
}
