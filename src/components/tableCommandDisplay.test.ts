import { describe, expect, it } from 'vitest';
import { createNewBlackjackTable } from '../engine/session';
import { buildTableCommandDisplay, formatLegalActionHint } from './tableCommandDisplay';

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

  it('uses expanded double wording in legal action hints', () => {
    expect(formatLegalActionHint(false, true)).toBe('You can double — one card only.');
    expect(formatLegalActionHint(true, true)).toBe(
      'You can split or double — double gets one card only.',
    );
    expect(formatLegalActionHint(true, false)).toBe('You can split.');
    expect(formatLegalActionHint(false, false)).toBeNull();
  });
});
