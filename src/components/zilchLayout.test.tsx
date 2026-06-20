// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { DieFace } from './zilch/DieFace';
import {
  applyZilchTableStakeSetup,
  createNewZilchTable,
  DEFAULT_TABLE_CHIPS,
} from '../engine/session';
import { ZilchPanel } from './zilch/ZilchPanel';

const ZILCH_CSS = readFileSync(join(process.cwd(), 'src/styles/zilch-table.css'), 'utf8');

describe('Zilch visual layout', () => {
  it('renders pip dice faces instead of plain numbers', () => {
    const html = renderToStaticMarkup(<DieFace value={5} />);
    expect(html).toContain('zilch-die-face__pip');
    expect(html).not.toMatch(/>5</);
    expect(html).toContain('Die 5');
  });

  it('uses grid-based seat ring and compact above-fold desktop shell', () => {
    expect(ZILCH_CSS).toContain('.zilch-table--play');
    expect(ZILCH_CSS).toContain('grid-template-areas');
    expect(ZILCH_CSS).toContain('.zilch-panel--compact');
    expect(ZILCH_CSS).toContain('@media (min-width: 921px)');
    expect(ZILCH_CSS).toContain('max-height: min(64vh');
    expect(ZILCH_CSS).toContain('overflow-x: hidden');
  });

  it('ZilchPanel renders compact shell with reset and invite controls', () => {
    const html = renderToStaticMarkup(
      <ZilchPanel
        gameState={zilchPracticeState()}
        onGameStateChange={() => {}}
        onInviteTable={() => {}}
        onBeginTableReset={() => {}}
      />,
    );
    expect(html).toContain('zilch-panel--compact');
    expect(html).toContain('Reset table');
    expect(html).toContain('Invite to table');
  });

  it('dice throw animation uses short visual duration and reduced-motion fallback', () => {
    expect(ZILCH_CSS).toContain('--zilch-roll-visual-ms');
    expect(ZILCH_CSS).toContain('@keyframes zilch-die-throw');
    expect(ZILCH_CSS).toContain('@media (prefers-reduced-motion: reduce)');
    expect(ZILCH_CSS).toContain('zilch-die-throw-reduced');
  });

  it('ledger toggle is present but panel is collapsed by default', () => {
    const html = renderToStaticMarkup(
      <ZilchPanel
        gameState={zilchPracticeState()}
        onGameStateChange={() => {}}
      />,
    );
    expect(html).toContain('Table ledger');
    expect(html).not.toContain('ledger-panel__title');
  });
});

function zilchPracticeState() {
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
    virtualPlayerCount: 1,
    zilchMode: 'target_points',
    targetPoints: 100,
    roundLimit: 10,
    diceAnimationMode: 'fixed',
    diceAnimationMs: 400,
    diceAnimationRandomMinMs: 400,
    diceAnimationRandomMaxMs: 400,
  });
}
