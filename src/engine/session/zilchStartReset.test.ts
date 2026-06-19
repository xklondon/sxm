import { describe, expect, it } from 'vitest';
import {
  applyZilchTableResetSetup,
  applyZilchTableStakeSetup,
  createNewBlackjackTable,
  createNewZilchTable,
  addVirtualPlayer,
  mergeSessionUpdate,
  DEFAULT_TABLE_CHIPS,
  isZilchTable,
  recordZilchGameEnd,
} from '../session';
import { applyZilchActionToState, ensureZilchGameOnState } from '../zilch';
import { addGameToPersonalLedger, buildGameOverSummary } from '../scoreLedger/scoreLedger';
import { applyTableResetSetup } from '../session/tableReset';
import type { ZilchTableStakeSetupInput } from '../session/zilchTableSetup';

const zilchSetup: ZilchTableStakeSetupInput = {
  stakeDescription: 'Test wager',
  seatChips: DEFAULT_TABLE_CHIPS,
  bankChips: DEFAULT_TABLE_CHIPS,
  bankerMode: 'bot',
  bankerName: '',
  controllerName: 'Host',
  controllerEmail: '',
  protocolId: 'zilch',
  naturalDealing: false,
  dealSpeedPreset: 'normal',
  cardTimerPreset: 0,
  bankDrawAuto: true,
  zilchMode: 'target_points',
  targetPoints: 100,
  roundLimit: 10,
  diceAnimationMode: 'fixed',
  diceAnimationMs: 400,
  diceAnimationRandomMinMs: 400,
  diceAnimationRandomMaxMs: 400,
};

function zilchTableWithPlayer() {
  let state = createNewZilchTable();
  const spl = addVirtualPlayer(state.session, state.players, state.ledger, {
    displayName: 'Bot Seat',
    virtualStyle: 'normal',
  });
  state = mergeSessionUpdate(state, spl);
  state = applyZilchTableStakeSetup(state, zilchSetup);
  return state;
}

describe('Zilch start and reset flow', () => {
  it('applyZilchTableStakeSetup initializes gameState.zilch in setup phase', () => {
    const state = zilchTableWithPlayer();
    expect(isZilchTable(state)).toBe(true);
    expect(state.zilch).toBeTruthy();
    expect(state.zilch?.phase).toBe('setup');
    expect(state.tableGame).toBe('zilch');
    expect(state.session.gameType).toBe('zilch');
  });

  it('zilchRandomiseStarter repairs missing zilch state instead of throwing', () => {
    let state = zilchTableWithPlayer();
    state = { ...state, zilch: null };
    const next = applyZilchActionToState(state, 'zilchRandomiseStarter', {});
    expect(next.zilch?.phase).toBe('player-turn');
    expect(next.zilch?.starterPlayerId).toBeTruthy();
    expect(next.zilch?.currentPlayerId).toBe(next.zilch?.starterPlayerId);
  });

  it('ensureZilchGameOnState creates setup zilch when table identity is zilch', () => {
    const state = { ...zilchTableWithPlayer(), zilch: null };
    const ready = ensureZilchGameOnState(state);
    expect(ready.zilch?.phase).toBe('setup');
  });

  it('applyZilchTableResetSetup keeps zilch identity and fresh setup state', () => {
    let state = zilchTableWithPlayer();
    state = applyZilchActionToState(state, 'zilchRandomiseStarter', {});
    expect(state.zilch?.phase).toBe('player-turn');

    const reset = applyZilchTableResetSetup(state, zilchSetup, state.tableMeta.ownerPersonId);
    expect(reset.session.id).toBe(state.session.id);
    expect(isZilchTable(reset)).toBe(true);
    expect(reset.blackjack).toBeNull();
    expect(reset.zilch?.phase).toBe('setup');
    expect(reset.tableGame).toBe('zilch');
  });

  it('blackjack reset path does not apply when zilch reset is used', () => {
    let state = zilchTableWithPlayer();
    const sessionId = state.session.id;
    const reset = applyZilchTableResetSetup(state, zilchSetup, null);
    expect(reset.session.id).toBe(sessionId);
    expect(isZilchTable(reset)).toBe(true);
    expect(reset.zilch).toBeTruthy();
  });

  it('blackjack table reset still uses blackjack setup', () => {
    let state = createNewBlackjackTable();
    const reset = applyTableResetSetup(state, {
      stakeDescription: 'BJ rematch',
      seatChips: 500,
      bankChips: 500,
      bankerMode: 'bot',
      bankerName: '',
      controllerName: 'Host',
      controllerEmail: '',
      protocolId: 'las-vegas-house',
      naturalDealing: false,
      dealSpeedPreset: 'normal',
      cardTimerPreset: 0,
      bankDrawAuto: true,
    }, null);
    expect(isZilchTable(reset)).toBe(false);
    expect(reset.blackjack).toBeNull();
  });

  it('recordZilchGameEnd sets ended status once with zilch ledger metadata', () => {
    let state = zilchTableWithPlayer();
    state = applyZilchActionToState(state, 'zilchRandomiseStarter', {});
    state = {
      ...state,
      zilch: {
        ...state.zilch!,
        phase: 'completed',
        winnerPlayerId: state.zilch!.starterPlayerId,
        totalScoresByPlayerId: {
          [state.zilch!.starterPlayerId!]: 120,
        },
      },
    };
    const ended = recordZilchGameEnd(state);
    expect(ended.tableMeta.gameStatus).toBe('ended');
    expect(ended.tableMeta.winnerId).toBe(state.zilch!.starterPlayerId);

    const { entry } = buildGameOverSummary(ended);
    expect(entry?.gameType).toBe('zilch');
    expect(entry?.gameLabel).toBe('Zilch');
    expect(entry?.protocolId).toBe('zilch');
    expect(entry?.finalScores?.[state.zilch!.starterPlayerId!]).toBe(120);

    const saved = addGameToPersonalLedger(ended);
    expect(saved?.gameLabel).toBe('Zilch');
    expect(saved?.gameType).toBe('zilch');
  });
});
