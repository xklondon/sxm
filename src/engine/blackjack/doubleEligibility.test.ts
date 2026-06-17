import { describe, expect, it } from 'vitest';
import type { GameState } from '../../types';
import type { Rank } from '../../types/deck';
import { blackjackHandKey } from './handKeys';
import { cardsFromIds, getBlackjackHandValue } from './hand';
import {
  actingRound,
  boxPlayerId,
  findCardId,
  tableWithClaimedBox,
} from './sanity/fixtures';
import {
  canDoubleBlackjackForState,
  canSplitBlackjackForState,
} from './validation';
import {
  getAllowedActionsForHand,
  buildActiveRulesHandContext,
} from './protocols/activeRules';
import { getBlackjackProtocolForState } from './protocolState';
import { resolveBankrollOwnerIdForBox } from '../session/bankroll';
import { getAvailableChipsForBankrollOwner } from '../session/bankroll';
import {
  getPlayFlowForPerson,
  setPersonPlayFlow,
  shouldAutoStopPlayerHandForState,
} from './playFlow';
import { getCallerPersonIdForBox } from '../session/playerAssignment';
import { hitBlackjackOnState, processPlayFlowAutoStands } from './gameState';
import { formatPlayerTurnOptions } from '../../components/tableCommandDisplay';

function playerTurn(
  state: GameState,
  ranks: [Rank, Rank],
  bet = 25,
): { state: GameState; handKey: string } {
  const boxId = boxPlayerId(state, 1)!;
  const deck = state.deck!;
  const handKey = blackjackHandKey(boxId, 0);
  const round = actingRound(state, boxId, [findCardId(deck, ranks[0]), findCardId(deck, ranks[1])], bet);
  return {
    handKey,
    state: {
      ...state,
      tableMeta: { ...state.tableMeta, bettingLocked: true },
      blackjack: {
        ...round,
        status: 'player-turns',
        activeHandKey: handKey,
        activePlayerId: boxId,
      },
    },
  };
}

describe('double eligibility — protocol', () => {
  it('two-card hard 10 offers Double', () => {
    let state = tableWithClaimedBox(1);
    const { state: playing, handKey } = playerTurn(state, ['6', '4']);
    const cards = cardsFromIds(playing.deck!, playing.blackjack!.playerHands[handKey]!.cardIds);
    expect(getBlackjackHandValue(cards).value).toBe(10);
    expect(getBlackjackHandValue(cards).isSoft).toBe(false);
    expect(canDoubleBlackjackForState(playing, handKey)).toBe(true);
  });

  it('two-card hard 9 offers Double when protocol allows 9/10/11', () => {
    const { state, handKey } = playerTurn(tableWithClaimedBox(1), ['5', '4']);
    expect(canDoubleBlackjackForState(state, handKey)).toBe(true);
  });

  it('two-card hard 11 offers Double', () => {
    const { state, handKey } = playerTurn(tableWithClaimedBox(1), ['5', '6']);
    expect(canDoubleBlackjackForState(state, handKey)).toBe(true);
  });

  it('three-card hard 10 does NOT offer Double', () => {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    const deck = state.deck!;
    const handKey = blackjackHandKey(boxId, 0);
    state = {
      ...state,
      tableMeta: { ...state.tableMeta, bettingLocked: true },
      blackjack: {
        ...actingRound(state, boxId, [findCardId(deck, '3'), findCardId(deck, '2'), findCardId(deck, '5')], 25),
        status: 'player-turns',
        activeHandKey: handKey,
        activePlayerId: boxId,
      },
    };
    const cards = cardsFromIds(state.deck!, state.blackjack!.playerHands[handKey]!.cardIds);
    expect(getBlackjackHandValue(cards).value).toBe(10);
    expect(canDoubleBlackjackForState(state, handKey)).toBe(false);
  });

  it('three-card hard 11 does NOT offer Double', () => {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    const deck = state.deck!;
    const handKey = blackjackHandKey(boxId, 0);
    state = {
      ...state,
      tableMeta: { ...state.tableMeta, bettingLocked: true },
      blackjack: {
        ...actingRound(state, boxId, [findCardId(deck, '4'), findCardId(deck, '3'), findCardId(deck, '4')], 25),
        status: 'player-turns',
        activeHandKey: handKey,
        activePlayerId: boxId,
      },
    };
    const cards = cardsFromIds(state.deck!, state.blackjack!.playerHands[handKey]!.cardIds);
    expect(getBlackjackHandValue(cards).value).toBe(11);
    expect(canDoubleBlackjackForState(state, handKey)).toBe(false);
  });

  it('command text lists Double for hard 11 when allowDoubleDown is true', () => {
    const { state, handKey } = playerTurn(tableWithClaimedBox(1), ['5', '6']);
    const optionsLine = formatPlayerTurnOptions(
      true,
      true,
      state.blackjackSettings.allowDoubleDown &&
        canDoubleBlackjackForState(state, handKey),
      state.blackjackSettings.allowSplit && canSplitBlackjackForState(state, handKey),
    );
    expect(optionsLine).toMatch(/Double/i);
  });

  it('after hit, Double is not offered', () => {
    const { state, handKey } = playerTurn(tableWithClaimedBox(1), ['6', '4']);
    const afterHit = hitBlackjackOnState(state, handKey);
    expect(canDoubleBlackjackForState(afterHit, handKey)).toBe(false);
  });

  it('pair where split and double are both legal offers both actions', () => {
    const { state, handKey } = playerTurn(tableWithClaimedBox(1), ['5', '5']);
    expect(canSplitBlackjackForState(state, handKey)).toBe(true);
    expect(canDoubleBlackjackForState(state, handKey)).toBe(true);
    const protocol = getBlackjackProtocolForState(state);
    const ownerId = resolveBankrollOwnerIdForBox(state, boxPlayerId(state, 1)!);
    const ctx = buildActiveRulesHandContext(
      protocol,
      state.ledger,
      state.blackjack!,
      handKey,
      state.deck!,
      ownerId!,
      getAvailableChipsForBankrollOwner(state, ownerId!),
    );
    expect(ctx).not.toBeNull();
    const actions = getAllowedActionsForHand(protocol, { ...ctx!, deck: state.deck! });
    expect(actions).toContain('double');
    expect(actions).toContain('split');
  });

  it('soft two-card 19 does not offer Double on hard-total protocols', () => {
    const { state, handKey } = playerTurn(tableWithClaimedBox(1), ['A', '8']);
    const cards = cardsFromIds(state.deck!, state.blackjack!.playerHands[handKey]!.cardIds);
    expect(getBlackjackHandValue(cards).isSoft).toBe(true);
    expect(canDoubleBlackjackForState(state, handKey)).toBe(false);
  });

  it('auto-stand does not suppress double on hard 10', () => {
    let state = tableWithClaimedBox(1);
    const box1 = boxPlayerId(state, 1)!;
    const callerId = getCallerPersonIdForBox(state, box1)!;
    state = setPersonPlayFlow(state, callerId, 'auto-18');
    const { state: playing, handKey } = playerTurn(state, ['6', '4']);
    expect(canDoubleBlackjackForState(playing, handKey)).toBe(true);
    const cards = cardsFromIds(playing.deck!, playing.blackjack!.playerHands[handKey]!.cardIds);
    expect(
      shouldAutoStopPlayerHandForState(
        playing,
        handKey,
        getPlayFlowForPerson(playing, callerId),
        cards,
      ),
    ).toBe(false);
    const next = processPlayFlowAutoStands(playing);
    expect(next.blackjack!.playerHands[handKey]!.actionStatus).toBe('acting');
  });

  it('command text lists Double for hard 10 when allowDoubleDown is true', () => {
    const { state, handKey } = playerTurn(tableWithClaimedBox(1), ['6', '4']);
    const hand = state.blackjack!.playerHands[handKey]!;
    const cards = cardsFromIds(state.deck!, hand.cardIds);
    const { value, isSoft } = getBlackjackHandValue(cards);
    const optionsLine = formatPlayerTurnOptions(
      true,
      true,
      state.blackjackSettings.allowDoubleDown &&
        canDoubleBlackjackForState(state, handKey),
      state.blackjackSettings.allowSplit && canSplitBlackjackForState(state, handKey),
    );
    expect(optionsLine).toMatch(/Double/i);
    expect(value).toBe(10);
    expect(isSoft).toBe(false);
  });

  it('does not offer Double when available chips are below current bet', () => {
    const base = tableWithClaimedBox(1);
    const boxId = boxPlayerId(base, 1)!;
    const ownerId = resolveBankrollOwnerIdForBox(base, boxId)!;
    const { state: playing, handKey } = playerTurn(base, ['6', '4'], 400);
    expect(getAvailableChipsForBankrollOwner(playing, ownerId)).toBeLessThan(400);
    expect(canDoubleBlackjackForState(playing, handKey)).toBe(false);
  });
});
