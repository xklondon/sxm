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
import { getVisibleZilchPlayers } from '../../engine/dice/zilch/zilchVisiblePlayers';

const ZILCH_CSS = readFileSync(join(process.cwd(), 'src/styles/zilch-table.css'), 'utf8');

describe('Zilch play layout and seats', () => {
  it('felt canvas contains center dice zone inside play area', () => {
    expect(ZILCH_CSS).toContain('.zilch-table__felt--canvas');
    expect(ZILCH_CSS).toContain('.zilch-felt-center');
    expect(ZILCH_CSS).toContain('grid-template-areas');
  });

  it('mobile stacks compact actions without side options panel', () => {
    expect(ZILCH_CSS).not.toContain('.zilch-options-zone');
    expect(ZILCH_CSS).toContain('.zilch-table__actions--compact');
  });

  it('left/right seat columns stack one card per player without shared grid cell', () => {
    const ring = distributeZilchSeats(5);
    expect(ring.left.length + ring.right.length).toBe(3);
    expect(new Set([...ring.left, ...ring.right, ...ring.top, ...ring.bottom]).size).toBe(5);

    expect(ZILCH_CSS).toContain('.zilch-table__seats--left');
    expect(ZILCH_CSS).toContain('flex-direction: column');
  });

  it('player seats render one card with canonical fields', () => {
    let state = applyZilchTableStakeSetup(createNewZilchTable(), practiceSetup());
    state = beginZilchPlay(state);
    const visiblePlayers = getVisibleZilchPlayers(state);

    const html = renderToStaticMarkup(
      <ZilchPlayerRail zilch={state.zilch} visiblePlayers={visiblePlayers} />,
    );

    const seatCount = (html.match(/class="zilch-seat(?![\w-])/g) ?? []).length;
    expect(seatCount).toBe(visiblePlayers.length);
    expect(html).toContain('zilch-seat__name');
    expect(html).toContain('zilch-seat__score');
    expect(html).toContain('zilch-seat__status');
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
    targetPoints: 1000,
    roundLimit: 10,
    diceAnimationMode: 'fixed' as const,
    diceAnimationMs: 400,
    diceAnimationRandomMinMs: 400,
    diceAnimationRandomMaxMs: 400,
  };
}
