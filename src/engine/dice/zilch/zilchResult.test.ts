import { describe, expect, it } from 'vitest';
import { buildZilchGameResult, buildZilchIouHandoffStub } from './zilchResult';
import { createZilchGame } from './zilchEngine';
import { DEFAULT_ZILCH_SETTINGS } from './settings';
import { createNewBlackjackTable } from '../../session/table';
import { startZilchGameOnState } from './applyZilchAction';

describe('zilchResult adapter', () => {
  it('builds generic GameResult envelope', () => {
    let state = createNewBlackjackTable();
    state = startZilchGameOnState(state, ['p1', 'p2'], DEFAULT_ZILCH_SETTINGS, {
      tableMode: 'challenge',
    });
    const zilch = {
      ...state.zilch!,
      phase: 'completed' as const,
      winnerPlayerId: 'p1',
      totalScoresByPlayerId: { p1: 10_500, p2: 8000 },
    };
    const result = buildZilchGameResult(state, zilch);
    expect(result.protocolId).toBe('zilch');
    expect(result.mode).toBe('challenge');
    expect(result.winnerId).toBe('p1');
    expect(result.finalScores.p1).toBe(10_500);
    expect(result.tableId).toBe(state.session.id);
  });

  it('IOU stub returns todo marker without blackjack assumptions', () => {
    const zilch = createZilchGame(['p1'], DEFAULT_ZILCH_SETTINGS);
    const state = createNewBlackjackTable();
    const stub = buildZilchIouHandoffStub(state, zilch);
    expect(stub.todo).toContain('IOU');
    expect(stub.result.protocolId).toBe('zilch');
  });
});
