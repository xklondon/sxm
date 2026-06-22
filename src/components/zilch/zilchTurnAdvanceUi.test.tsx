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
import { listPlayableZilchPlayerIds } from '../../engine/dice/zilch/zilchTurnAuthority';
import { getVisibleZilchPlayers } from '../../engine/dice/zilch/zilchVisiblePlayers';
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

function activeSeatPlayerId(html: string): string | null {
  const match =
    html.match(/data-player-id="([^"]+)"[^>]*data-active="true"/) ??
    html.match(/data-active="true"[^>]*data-player-id="([^"]+)"/);
  return match?.[1] ?? null;
}

function seatMarkup(html: string, playerId: string): string | null {
  const match = html.match(
    new RegExp(`<div[^>]*data-testid="zilch-seat-${playerId}"[^>]*>[\\s\\S]*?</div>\\s*(?=<div[^>]*data-testid="zilch-seat-|<div class="zilch-table__seats|$)`),
  );
  return match?.[0] ?? null;
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
    const playableOrder = listPlayableZilchPlayerIds(state);
    const currentBefore = state.zilch!.currentPlayerId!;
    const beforeIndex = playableOrder.indexOf(currentBefore);
    expect(beforeIndex).toBeGreaterThanOrEqual(0);

    state = applyZilchActionToState(
      {
        ...state,
        zilch: { ...state.zilch!, turnScore: 50, keptThisRoll: true, phase: 'player-turn' },
      },
      'zilchBankTurn',
      {},
    );

    const currentAfter = state.zilch!.currentPlayerId!;
    const expectedNextId = playableOrder[(beforeIndex + 1) % playableOrder.length]!;
    expect(currentAfter).toBe(expectedNextId);
    expect(currentAfter).not.toBe(currentBefore);

    const visible = getVisibleZilchPlayers(state);
    const nextVisible = visible.find((player) => player.playerId === currentAfter);
    expect(nextVisible).toBeTruthy();

    const html = renderToStaticMarkup(
      <ZilchPanel gameState={state} onGameStateChange={() => {}} />,
    );

    expect(activeSeatPlayerId(html)).toBe(currentAfter);
    expect(html).toContain('zilch-seat--active');
    expect(html).toContain(`data-testid="zilch-seat-${currentAfter}"`);

    const activeSeat = seatMarkup(html, currentAfter);
    expect(activeSeat).toBeTruthy();
    expect(activeSeat).toContain('zilch-seat--active');
    expect(activeSeat).toContain(nextVisible!.name);
    if (nextVisible!.boxLabel) {
      expect(activeSeat).toContain(nextVisible!.boxLabel);
    }

    const previousSeat = seatMarkup(html, currentBefore);
    expect(previousSeat).toBeTruthy();
    expect(previousSeat).not.toContain('zilch-seat--active');
    expect(previousSeat).toContain('data-active="false"');
  });

  it('seat ring uses non-overlapping grid contract', () => {
    expect(ZILCH_CSS).toContain('.zilch-table__seat-ring');
    expect(ZILCH_CSS).toContain('grid-template-areas');
    expect(ZILCH_CSS).toContain('.zilch-seat--slot-top');
    expect(ZILCH_CSS).not.toContain('.zilch-seat--top');
  });
});
