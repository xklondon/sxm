import { describe, expect, it } from 'vitest';
import { createNewBlackjackTable } from '../engine/session';
import {
  buildTableCommandDisplay,
  formatCallerTurnMessage,
  formatLegalActionHint,
} from './tableCommandDisplay';
import { tableWithClaimedBox, actingRound, boxPlayerId, findCardId } from '../engine/blackjack/sanity/fixtures';
import { blackjackHandKey } from '../engine/blackjack';

describe('buildTableCommandDisplay', () => {
  it('returns betting instruction during open betting', () => {
    const state = createNewBlackjackTable();
    const result = buildTableCommandDisplay({
      gameState: state,
      gameEnded: false,
      gameOverMessage: '',
      centerStatus: 'Place your bets, then Shuffle to start.',
      protocolPhase: 'betting',
      roundSummaryLines: [],
      controllerName: 'Host',
    });
    expect(result.commandMessage).toContain('Place your bets');
  });

  it('returns round summary lines when awaiting next round', () => {
    const state = createNewBlackjackTable();
    const result = buildTableCommandDisplay({
      gameState: state,
      gameEnded: false,
      gameOverMessage: '',
      centerStatus: 'ignored',
      protocolPhase: 'round-complete',
      roundSummaryLines: ['Box 1 wins +10', 'Box 2 loses -10'],
      controllerName: 'Host',
    });
    expect(result.commandMessage).toBeNull();
    expect(result.commandLines).toEqual(['Box 1 wins +10', 'Box 2 loses -10']);
  });

  it('formats caller turn in command area during player phase', () => {
    let state = tableWithClaimedBox(2);
    const box2 = boxPlayerId(state, 2)!;
    const k2 = blackjackHandKey(box2, 0);
    state = {
      ...state,
      blackjack: actingRound(state, box2, [findCardId(state.deck!, '6'), findCardId(state.deck!, '7')], 10),
    };
    state.blackjack!.activeHandKey = k2;
    state.blackjack!.activePlayerId = box2;
    const result = buildTableCommandDisplay({
      gameState: state,
      gameEnded: false,
      gameOverMessage: '',
      centerStatus: 'ignored',
      protocolPhase: 'player',
      roundSummaryLines: [],
      controllerName: 'Alice',
    });
    expect(result.commandMessage).toBe(formatCallerTurnMessage(2, 'Alice'));
  });

  it('shows join notice during betting when tableNotice is set', () => {
    const state = createNewBlackjackTable();
    const withNotice = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        tableNotice: {
          message: 'Kay joined the table on Box 3.',
          personId: 'p1',
          slotNumber: 3,
          at: new Date().toISOString(),
        },
      },
    };
    const result = buildTableCommandDisplay({
      gameState: withNotice,
      gameEnded: false,
      gameOverMessage: '',
      centerStatus: 'Place your bets',
      protocolPhase: 'betting',
      roundSummaryLines: [],
      controllerName: 'Host',
    });
    expect(result.commandMessage).toBe('Kay joined the table on Box 3.');
  });

  it('uses caller-prefixed legal action hints', () => {
    expect(formatLegalActionHint(false, true)).toBe('can double — one card only.');
    expect(formatLegalActionHint(true, true)).toBe(
      'can split or double — double gets one card only.',
    );
    expect(formatLegalActionHint(true, false)).toBe('can split.');
    expect(formatLegalActionHint(false, false)).toBeNull();
  });
});
