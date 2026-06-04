import { describe, expect, it } from 'vitest';
import type { GameState } from '../../types';
import type { BlackjackRound } from '../../types/blackjack';
import { createBlackjackPlayerHand } from '../../types/blackjack';
import {
  activateInsuranceOfferIfNeeded,
  shouldOfferInsurance,
} from './insurance';
import {
  canOfferInsuranceAfterInitialDeal,
  hasPlayerActionsStarted,
  isInitialDealRoundComplete,
} from './initialDealGuards';
import { getBlackjackProtocolPhase } from './protocol';
import {
  beginInitialDealOnState,
  dealNextInitialCardOnState,
  lockBetsAndStartRoundOnState,
  shuffleToStartOnState,
} from './gameState';
import { findCardId, tableWithClaimedBox, boxPlayerId } from './sanity/fixtures';
import { claimBoxSlot } from '../session/boxOps';
import { addChipToBoxStake, confirmBoxStake } from './stakes';
import { resolveControllerPersonId } from '../session';
import { createBlackjackShoe, shuffleBlackjackShoe } from './shoe';
import { blackjackHandKey } from './handKeys';
import { getCardById } from '../deck/deck';
function readyOneBox(seed: string) {
  let state = tableWithClaimedBox(1);
  const boxId = boxPlayerId(state, 1)!;
  const personId = resolveControllerPersonId(state, 'Alice') ?? undefined;
  state = addChipToBoxStake(state, boxId, 50, personId);
  state = confirmBoxStake(state, boxId);
  state = shuffleToStartOnState(state);
  state = lockBetsAndStartRoundOnState(state);
  return { ...state, deck: shuffleBlackjackShoe(createBlackjackShoe(6), seed) };
}

function hand(
  boxId: string,
  cardIds: string[],
  bet = 50,
): ReturnType<typeof createBlackjackPlayerHand> {
  return {
    ...createBlackjackPlayerHand(boxId, 0),
    cardIds,
    currentBet: bet,
    actionStatus: 'acting',
  };
}

function syntheticRound(
  state: GameState,
  partial: Partial<BlackjackRound> & { playerHands?: BlackjackRound['playerHands'] },
): BlackjackRound {
  const base = state.blackjack!;
  return {
    ...base,
    status: 'player-turns',
    activeHandKey: null,
    ...partial,
    playerHands: partial.playerHands ?? base.playerHands,
  };
}

describe('insurance timing guards', () => {
  it('does not offer insurance during initial-deal status', () => {
    const state = readyOneBox('ins-mid-deal');
    const begun = beginInitialDealOnState(state);
    expect(begun.blackjack?.status).toBe('initial-deal');
    expect(canOfferInsuranceAfterInitialDeal(begun.session, begun.blackjack!)).toBe(false);
    const activated = activateInsuranceOfferIfNeeded(
      begun.blackjack!,
      begun.deck!,
      begun.blackjackSettings,
      begun.session,
    );
    expect(activated.insuranceOfferPending).not.toBe(true);
    expect(getBlackjackProtocolPhase(begun)).toBe('dealing');
  });

  it('offers insurance only after full initial deal with dealer Ace', () => {
    const state = readyOneBox('ins-full-ace');
    let current = beginInitialDealOnState(state);
    let guard = 0;
    while (current.blackjack?.status === 'initial-deal' && guard < 20) {
      guard += 1;
      const mid = dealNextInitialCardOnState(current);
      if (!mid.blackjack) {
        break;
      }
      if (
        mid.blackjack.dealerCardIds.filter(Boolean).length === 1 &&
        getCardById(mid.deck!, mid.blackjack.dealerCardIds[0]!)?.rank === 'A'
      ) {
        expect(canOfferInsuranceAfterInitialDeal(mid.session, mid.blackjack)).toBe(false);
        expect(getBlackjackProtocolPhase(mid)).toBe('dealing');
      }
      current = mid;
    }
    expect(isInitialDealRoundComplete(current.session, current.blackjack!)).toBe(true);
    const round = current.blackjack!;
    if (shouldOfferInsurance(round, current.deck!, current.blackjackSettings)) {
      expect(round.insuranceOfferPending).toBe(true);
      expect(getBlackjackProtocolPhase(current)).toBe('insurance');
    }
  });

  it('no insurance when dealer upcard is not Ace after full deal', () => {
    const state = readyOneBox('ins-no-ace');
    const boxId = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(boxId, 0);
    const tenId = findCardId(state.deck!, '10');
    const round = syntheticRound(state, {
      dealerCardIds: [tenId, findCardId(state.deck!, '9')],
      playerHands: {
        [handKey]: hand(boxId, [findCardId(state.deck!, '6'), findCardId(state.deck!, '7')]),
      },
    });
    expect(isInitialDealRoundComplete(state.session, round)).toBe(true);
    expect(shouldOfferInsurance(round, state.deck!, state.blackjackSettings)).toBe(false);
    const activated = activateInsuranceOfferIfNeeded(
      round,
      state.deck!,
      state.blackjackSettings,
      state.session,
    );
    expect(activated.insuranceOfferPending).not.toBe(true);
  });

  it('no insurance when an active box is missing its second card', () => {
    let state = tableWithClaimedBox(1);
    state = claimBoxSlot(state, 2);
    const box1 = boxPlayerId(state, 1)!;
    const box2 = boxPlayerId(state, 2)!;
    const personId = resolveControllerPersonId(state, 'Alice')!;
    state = addChipToBoxStake(state, box1, 50, personId);
    state = confirmBoxStake(state, box1);
    state = addChipToBoxStake(state, box2, 10, personId);
    state = confirmBoxStake(state, box2);
    state = shuffleToStartOnState(state);
    state = lockBetsAndStartRoundOnState(state);
    state = { ...state, deck: shuffleBlackjackShoe(createBlackjackShoe(6), 'ins-missing-card') };
    const k1 = blackjackHandKey(box1, 0);
    const k2 = blackjackHandKey(box2, 0);
    const aceId = findCardId(state.deck!, 'A');
    const round = syntheticRound(state, {
      dealerCardIds: [aceId, findCardId(state.deck!, '5')],
      playerHands: {
        [k1]: hand(box1, [findCardId(state.deck!, '6'), findCardId(state.deck!, '7')]),
        [k2]: hand(box2, [findCardId(state.deck!, '8')], 10),
      },
    });
    expect(isInitialDealRoundComplete(state.session, round)).toBe(false);
    expect(canOfferInsuranceAfterInitialDeal(state.session, round)).toBe(false);
    const activated = activateInsuranceOfferIfNeeded(
      round,
      state.deck!,
      state.blackjackSettings,
      state.session,
    );
    expect(activated.insuranceOfferPending).not.toBe(true);
  });

  it('no insurance after player actions have started', () => {
    const state = readyOneBox('ins-after-hit');
    const boxId = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(boxId, 0);
    const aceId = findCardId(state.deck!, 'A');
    const round = syntheticRound(state, {
      dealerCardIds: [aceId, findCardId(state.deck!, '5')],
      playerHands: {
        [handKey]: hand(boxId, [
          findCardId(state.deck!, '6'),
          findCardId(state.deck!, '7'),
          findCardId(state.deck!, '4'),
        ]),
      },
    });
    expect(hasPlayerActionsStarted(round)).toBe(true);
    expect(canOfferInsuranceAfterInitialDeal(state.session, round)).toBe(false);
    const activated = activateInsuranceOfferIfNeeded(
      round,
      state.deck!,
      state.blackjackSettings,
      state.session,
    );
    expect(activated.insuranceOfferPending).not.toBe(true);
  });

  it('insurance phase is before first player action when offered', () => {
    const state = readyOneBox('ins-before-play');
    const boxId = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(boxId, 0);
    const aceId = findCardId(state.deck!, 'A');
    const round = syntheticRound(state, {
      insuranceOfferPending: true,
      dealerCardIds: [aceId, findCardId(state.deck!, '5')],
      playerHands: {
        [handKey]: hand(boxId, [findCardId(state.deck!, '6'), findCardId(state.deck!, '7')]),
      },
    });
    expect(getBlackjackProtocolPhase({ ...state, blackjack: round })).toBe('insurance');
    expect(round.activeHandKey).toBeNull();
    expect(hasPlayerActionsStarted(round)).toBe(false);
  });
});
