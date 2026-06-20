// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  applyZilchTableStakeSetup,
  createNewZilchTable,
  DEFAULT_TABLE_CHIPS,
} from '../../engine/session';
import { applyZilchActionToState } from '../../engine/zilch';
import { ZilchPanel } from './ZilchPanel';

const ZILCH_CSS = readFileSync(join(process.cwd(), 'src/styles/zilch-table.css'), 'utf8');

function practiceState() {
  return applyZilchTableStakeSetup(createNewZilchTable(), {
    stakeDescription: 'Practice',
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
    tableMode: 'practice',
    virtualPlayerCount: 2,
    zilchMode: 'target_points',
    targetPoints: 100,
    roundLimit: 10,
    diceAnimationMode: 'fixed',
    diceAnimationMs: 400,
    diceAnimationRandomMinMs: 400,
    diceAnimationRandomMaxMs: 400,
  });
}

describe('Zilch panel UI', () => {
  it('ledger is hidden until Table ledger is toggled', () => {
    const html = renderToStaticMarkup(
      <ZilchPanel gameState={practiceState()} onGameStateChange={() => {}} />,
    );
    expect(html).toContain('Table ledger');
    expect(html).not.toContain('ledger-panel__title');
    expect(html).not.toContain('zilch-panel__ledger--open');
  });

  it('highlights next player after bank', () => {
    let state = applyZilchActionToState(practiceState(), 'zilchRandomiseStarter', {});
    const firstName = state.players[state.zilch!.currentPlayerId!]?.displayName;
    state = applyZilchActionToState(
      {
        ...state,
        zilch: { ...state.zilch!, turnScore: 50, keptThisRoll: true, phase: 'player-turn' },
      },
      'zilchBankTurn',
      {},
    );
    const nextName = state.players[state.zilch!.currentPlayerId!]?.displayName;
    const html = renderToStaticMarkup(
      <ZilchPanel gameState={state} onGameStateChange={() => {}} />,
    );
    expect(html).toContain('zilch-seat--active');
    expect(html).toContain(nextName ?? '');
    expect(firstName).not.toEqual(nextName);
  });

  it('seat ring uses non-overlapping grid contract', () => {
    expect(ZILCH_CSS).toContain('.zilch-table__seat-ring');
    expect(ZILCH_CSS).toContain('grid-template-areas');
    expect(ZILCH_CSS).toContain('.zilch-seat--slot-top');
    expect(ZILCH_CSS).not.toContain('.zilch-seat--top');
  });
});
