import { describe, expect, it } from 'vitest';
import {
  GAME_OVER_ROUND_COMMENT_TIERS,
  buildGameOverPresentationModel,
  resolveGameOverRoundComment,
  resolveGameOverSummaryMessage,
} from './gameOverPresentation';
import { tableWithClaimedBox } from '../engine/blackjack/sanity/fixtures';

describe('gameOverPresentation round comments', () => {
  it('uses quick comment for 1–3 rounds', () => {
    expect(resolveGameOverRoundComment(1)).toBe('Ouch, that was a quick one.');
    expect(resolveGameOverRoundComment(3)).toBe('Ouch, that was a quick one.');
  });

  it('uses medium comment for mid-length games', () => {
    expect(resolveGameOverRoundComment(4)).toBe('Nice table fight.');
    expect(resolveGameOverRoundComment(8)).toBe('Nice table fight.');
  });

  it('uses long comment for extended games', () => {
    expect(resolveGameOverRoundComment(9)).toBe('That was a proper battle.');
    expect(resolveGameOverRoundComment(20)).toBe('That was a proper battle.');
  });

  it('includes round comment in presentation model', () => {
    const state = {
      ...tableWithClaimedBox(1),
      session: { ...tableWithClaimedBox(1).session, currentRound: 2 },
      tableMeta: { ...tableWithClaimedBox(1).tableMeta, gameStatus: 'ended' as const },
    };
    const model = buildGameOverPresentationModel(state, 'Game over', null, null);
    expect(model.roundCommentLine).toBe('Ouch, that was a quick one.');
    expect(GAME_OVER_ROUND_COMMENT_TIERS.length).toBeGreaterThanOrEqual(3);
  });

  it('falls back to chip totals when summary message is generic', () => {
    const state = {
      ...tableWithClaimedBox(1),
      tableMeta: {
        ...tableWithClaimedBox(1).tableMeta,
        gameStatus: 'ended' as const,
        winnerId: null,
      },
    };
    const resolved = resolveGameOverSummaryMessage(state, 'Game over.');
    expect(resolved).toContain('Final chips:');
    const model = buildGameOverPresentationModel(state, 'Game over.', null, null);
    expect(model.winnerLine).toMatch(/leads with \d+ chips/);
    expect(model.rawSummary).toContain('Final chips:');
  });
});
