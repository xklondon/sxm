import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  buildBlackjackCommandText,
  formatPlayerTurnOptions,
  isTableInstructionMessage,
} from './tableCommandDisplay';
import {
  canShowPlayerDecisionControls,
  showPlayerActionControls,
} from './blackjackViewPhase';
import { resolvePlayerHandActionOptions } from './blackjackActionContract';
import { BlackjackPanel } from './BlackjackPanel';
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

const noop = () => undefined;

describe('table command display', () => {
  it('includes double in options line for hard 10 from 8+2', () => {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(boxId, 0);
    state = {
      ...state,
      blackjack: {
        ...actingRound(state, boxId, [findCardId(state.deck!, '8'), findCardId(state.deck!, '2')], 50),
        status: 'player-turns',
        activeHandKey: handKey,
        activePlayerId: boxId,
      },
      blackjackSettings: { ...state.blackjackSettings, allowDoubleDown: true, allowSplit: false },
    };
    const result = buildBlackjackCommandText({
      gameState: state,
      gameEnded: false,
      gameOverMessage: '',
      centerStatus: '',
      protocolPhase: 'player',
      roundSummaryLines: [],
      controllerName: 'Alice',
      viewerPersonId: state.tableMeta.ownerPersonId,
    });
    expect(result.commandLines).toContain('Double available.');
    expect(result.commandLines.some((line) => line.startsWith('Options:'))).toBe(false);
  });

  it('includes double in options line when split/double are available', () => {
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
    const result = buildBlackjackCommandText({
      gameState: state,
      gameEnded: false,
      gameOverMessage: '',
      centerStatus: '',
      protocolPhase: 'player',
      roundSummaryLines: [],
      controllerName: 'Alice',
      viewerPersonId: state.tableMeta.ownerPersonId,
    });
    expect(result.commandMessage).toBe('Box 1 — Alice — your turn.');
    expect(result.commandLines).toContain('Double available.');
    expect(result.commandLines.some((line) => line.startsWith('Options:'))).toBe(false);
    expect(isTableInstructionMessage('Double available.')).toBe(true);
  });
});

describe('command and action parity', () => {
  function splittableFullTableState() {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(boxId, 0);
    const deck = state.deck!;
    return {
      state: {
        ...state,
        tableViewMode: 'full' as const,
        blackjackSettings: { ...state.blackjackSettings, allowDoubleDown: true, allowSplit: true },
        tableMeta: { ...state.tableMeta, bettingLocked: true },
        blackjack: {
          ...actingRound(state, boxId, [findCardId(deck, '8'), findCardId(deck, '8')], 50),
          status: 'player-turns' as const,
          activeHandKey: handKey,
          activePlayerId: boxId,
          dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '7')],
          dealerHoleHidden: true,
        },
      },
      handKey,
    };
  }

  it('split-eligible hand: command and action row both offer Split', () => {
    const { state, handKey } = splittableFullTableState();
    const command = buildBlackjackCommandText({
      gameState: state,
      gameEnded: false,
      gameOverMessage: '',
      centerStatus: '',
      protocolPhase: 'player',
      roundSummaryLines: [],
      controllerName: 'Alice',
      viewerPersonId: state.tableMeta.ownerPersonId,
    });
    expect(command.commandLines).toContain('Split available.');

    const options = resolvePlayerHandActionOptions(
      state,
      handKey,
      state.blackjackSettings,
      true,
    );
    expect(options.showSplit && options.canSplit).toBe(true);

    const html = renderToStaticMarkup(
      createElement(BlackjackPanel, { gameState: state, onGameStateChange: noop }),
    );
    const actionsZone =
      html.split('bj-table-zone--actions')[1]?.split('bj-table-zone--boxes')[0] ?? '';
    expect(actionsZone).toContain('>Split<');
  });

  it('double-eligible hard 11: command and action row both offer Double', () => {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(boxId, 0);
    const deck = state.deck!;
    state = {
      ...state,
      tableViewMode: 'full',
      blackjackSettings: { ...state.blackjackSettings, allowDoubleDown: true, allowSplit: false },
      tableMeta: { ...state.tableMeta, bettingLocked: true },
      blackjack: {
        ...actingRound(state, boxId, [findCardId(deck, '5'), findCardId(deck, '6')], 50),
        status: 'player-turns',
        activeHandKey: handKey,
        activePlayerId: boxId,
        dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '7')],
        dealerHoleHidden: true,
      },
    };
    const command = buildBlackjackCommandText({
      gameState: state,
      gameEnded: false,
      gameOverMessage: '',
      centerStatus: '',
      protocolPhase: 'player',
      roundSummaryLines: [],
      controllerName: 'Alice',
      viewerPersonId: state.tableMeta.ownerPersonId,
    });
    expect(command.commandLines).toContain('Double available.');

    const html = renderToStaticMarkup(
      createElement(BlackjackPanel, { gameState: state, onGameStateChange: noop }),
    );
    const actionsZone =
      html.split('bj-table-zone--actions')[1]?.split('bj-table-zone--boxes')[0] ?? '';
    expect(actionsZone).toContain('>2×<');
  });

  it('non-split hand: no Split command line or button', () => {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(boxId, 0);
    const deck = state.deck!;
    state = {
      ...state,
      tableViewMode: 'full',
      blackjackSettings: { ...state.blackjackSettings, allowDoubleDown: true, allowSplit: true },
      tableMeta: { ...state.tableMeta, bettingLocked: true },
      blackjack: {
        ...actingRound(state, boxId, [findCardId(deck, '8'), findCardId(deck, '3')], 50),
        status: 'player-turns',
        activeHandKey: handKey,
        activePlayerId: boxId,
        dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '7')],
        dealerHoleHidden: true,
      },
    };
    const command = buildBlackjackCommandText({
      gameState: state,
      gameEnded: false,
      gameOverMessage: '',
      centerStatus: '',
      protocolPhase: 'player',
      roundSummaryLines: [],
      controllerName: 'Alice',
      viewerPersonId: state.tableMeta.ownerPersonId,
    });
    expect(command.commandLines).not.toContain('Split available.');
    const html = renderToStaticMarkup(
      createElement(BlackjackPanel, { gameState: state, onGameStateChange: noop }),
    );
    const actionsZone =
      html.split('bj-table-zone--actions')[1]?.split('bj-table-zone--boxes')[0] ?? '';
    expect(actionsZone).not.toContain('>Split<');
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

  it('shows controls during natural dealing once active hand reveal completes', () => {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(boxId, 0);
    const deck = state.deck!;
    state = {
      ...state,
      blackjackFlowSettings: {
        ...state.blackjackFlowSettings,
        initialDealMode: 'natural',
      },
      blackjack: {
        ...actingRound(state, boxId, [findCardId(deck, '6'), findCardId(deck, '5')], 50),
        status: 'player-turns',
        activeHandKey: handKey,
        activePlayerId: boxId,
        dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '7')],
      },
    };
    expect(
      canShowPlayerDecisionControls(state, 'player', {
        cardRevealComplete: false,
        activeHandRevealComplete: false,
      }),
    ).toBe(false);
    expect(
      canShowPlayerDecisionControls(state, 'player', {
        cardRevealComplete: false,
        activeHandRevealComplete: true,
      }),
    ).toBe(true);
  });
});
