// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  applyZilchTableStakeSetup,
  beginZilchPlay,
  createNewZilchTable,
  DEFAULT_TABLE_CHIPS,
} from '../../engine/session';
import { ZilchPlayerRail } from './ZilchPlayerRail';
import { distributeZilchSeats } from '../zilchPlayerDisplay';

const ZILCH_CSS = readFileSync(join(process.cwd(), 'src/styles/zilch-table.css'), 'utf8');

describe('Zilch play layout and seats', () => {
  it('desktop play grid separates dice zone and options zone', () => {
    expect(ZILCH_CSS).toContain('.zilch-play-grid');
    expect(ZILCH_CSS).toContain('.zilch-dice-zone');
    expect(ZILCH_CSS).toContain('.zilch-options-zone');
    expect(ZILCH_CSS).toContain('grid-template-columns: minmax(18rem, 1fr) minmax(14rem, 18rem)');
  });

  it('mobile stacks options below dice without overlap guards', () => {
    expect(ZILCH_CSS).toContain('.zilch-play-grid');
    expect(ZILCH_CSS).toContain('grid-template-columns: 1fr');
    expect(ZILCH_CSS).toContain('.zilch-table__actions--stacked');
  });

  it('left/right seat columns stack one card per player without shared grid cell', () => {
    const ring = distributeZilchSeats(5);
    expect(ring.left.length + ring.right.length).toBe(3);
    expect(new Set([...ring.left, ...ring.right, ...ring.top, ...ring.bottom]).size).toBe(5);

    expect(ZILCH_CSS).toContain('.zilch-table__seats--left');
    expect(ZILCH_CSS).toContain('flex-direction: column');
    expect(ZILCH_CSS).toContain('.zilch-seat__box');
  });

  it('player seats render one card with canonical fields and no duplicate box label', () => {
    let state = applyZilchTableStakeSetup(createNewZilchTable(), practiceSetup());
    state = beginZilchPlay(state);

    const playerOrder = state.session.playerIds;
    const html = renderToStaticMarkup(
      <ZilchPlayerRail gameState={state} zilch={state.zilch} playerOrder={playerOrder} />,
    );

    const seatCount = (html.match(/class="zilch-seat(?![\w-])/g) ?? []).length;
    expect(seatCount).toBe(playerOrder.length);

    for (const id of playerOrder) {
      const player = state.players[id]!;
      expect(html).toContain(`>${player.displayName}<`);
    }

    expect(html).toContain('zilch-seat__name');
    expect(html).toContain('zilch-seat__score');
    expect(html).toContain('zilch-seat__status');
    expect(html).toContain('zilch-seat__badge');
  });
});

function practiceSetup() {
  return {
    stakeDescription: 'Practice',
    seatChips: DEFAULT_TABLE_CHIPS,
    bankChips: DEFAULT_TABLE_CHIPS,
    bankerMode: 'bot' as const,
    bankerName: '',
    controllerName: 'Host',
    controllerEmail: '',
    protocolId: 'zilch',
    naturalDealing: false,
    dealSpeedPreset: 'normal' as const,
    cardTimerPreset: 0 as const,
    bankDrawAuto: true,
    tableMode: 'practice' as const,
    virtualPlayerCount: 2,
    zilchMode: 'target_points' as const,
    targetPoints: 100,
    roundLimit: 10,
    diceAnimationMode: 'fixed' as const,
    diceAnimationMs: 400,
    diceAnimationRandomMinMs: 400,
    diceAnimationRandomMaxMs: 400,
  };
}
