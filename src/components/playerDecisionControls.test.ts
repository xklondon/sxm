import { describe, expect, it } from 'vitest';
import {
  buildTableCommandDisplay,
  formatCallerLegalLine,
  formatCallerTurnMessage,
  isTableInstructionMessage,
} from './tableCommandDisplay';
import {
  canShowPlayerDecisionControls,
  showPlayerActionControls,
} from './blackjackViewPhase';
import {
  actingRound,
  boxPlayerId,
  findCardId,
  tableWithClaimedBox,
} from '../engine/blackjack/sanity/fixtures';
import { blackjackHandKey } from '../engine/blackjack';
import { beginInitialDealOnState, shuffleToStartOnState } from '../engine/blackjack/gameState';
import { addChipToBoxStake } from '../engine/blackjack/stakes';
import { claimBoxSlot } from '../engine/session/boxOps';
import { getBlackjackProtocolPhase } from '../engine/blackjack/protocol';

describe('table command display', () => {
  it('shows only the legal-action hint when split/double are available (no duplicate turn line)', () => {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(boxId, 0);
    state = {
      ...state,
      blackjack: {
        ...actingRound(state, boxId, [findCardId(state.deck!, '6'), findCardId(state.deck!, '5')], 50),
        activeHandKey: handKey,
        activePlayerId: boxId,
      },
      blackjackSettings: { ...state.blackjackSettings, allowDoubleDown: true, allowSplit: false },
    };
    const result = buildTableCommandDisplay({
      gameState: state,
      gameEnded: false,
      gameOverMessage: '',
      centerStatus: '',
      protocolPhase: 'player',
      roundSummaryLines: [],
      controllerName: 'Alice',
      viewerPersonId: state.tableMeta.ownerPersonId,
    });
    const hint = formatCallerLegalLine(1, 'Alice', false, true);
    expect(result.commandMessage).toBe(hint);
    expect(result.commandLines).toEqual([]);
    expect(result.commandMessage).not.toBe(formatCallerTurnMessage(1, 'Alice'));
    expect(isTableInstructionMessage(result.commandMessage)).toBe(true);
  });
});

describe('player decision controls visibility', () => {
  function readyToDeal() {
    let state = tableWithClaimedBox(1);
    state = claimBoxSlot(state, 1);
    const boxId = boxPlayerId(state, 1)!;
    state = addChipToBoxStake(state, boxId, 50);
    state = shuffleToStartOnState(state);
    return { ...state, tableMeta: { ...state.tableMeta, bettingLocked: true } };
  }

  it('hides controls during staged initial-deal status', () => {
    let state = readyToDeal();
    state = {
      ...state,
      blackjackFlowSettings: { ...state.blackjackFlowSettings, initialDealMode: 'staged' },
    };
    state = beginInitialDealOnState(state);
    expect(state.blackjack?.status).toBe('initial-deal');
    expect(
      canShowPlayerDecisionControls(state, 'dealing', { cardRevealComplete: true }),
    ).toBe(false);
    expect(showPlayerActionControls('dealing', state.blackjack)).toBe(false);
  });

  it('hides controls while display phase is dealing before reveal completes', () => {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(boxId, 0);
    state = {
      ...state,
      blackjack: {
        ...actingRound(state, boxId, [findCardId(state.deck!, '6'), findCardId(state.deck!, '5')], 50),
        status: 'player-turns',
        activeHandKey: handKey,
        activePlayerId: boxId,
      },
    };
    expect(getBlackjackProtocolPhase(state)).toBe('player');
    expect(
      canShowPlayerDecisionControls(state, 'dealing', { cardRevealComplete: false }),
    ).toBe(false);
  });

  it('shows controls after initial deal when reveal is complete and hand is acting', () => {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(boxId, 0);
    const deck = state.deck!;
    state = {
      ...state,
      blackjack: {
        ...actingRound(state, boxId, [findCardId(deck, '6'), findCardId(deck, '5')], 50),
        status: 'player-turns',
        activeHandKey: handKey,
        activePlayerId: boxId,
        dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '7')],
      },
    };
    expect(
      canShowPlayerDecisionControls(state, 'player', { cardRevealComplete: true }),
    ).toBe(true);
  });
});
