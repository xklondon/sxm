// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { DieFace } from './zilch/DieFace';
import {
  applyZilchTableStakeSetup,
  createNewZilchTable,
  addVirtualPlayer,
  mergeSessionUpdate,
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

  it('uses isolated zilch-table stylesheet with felt and gold rim', () => {
    expect(ZILCH_CSS).toContain('.zilch-table');
    expect(ZILCH_CSS).toMatch(/212 175 55/);
    expect(ZILCH_CSS).toContain('.zilch-die-face__cube');
    expect(ZILCH_CSS).toContain('overflow-x: hidden');
  });

  it('ledger sits outside felt play surface', () => {
    const html = renderToStaticMarkup(
      <ZilchPanel
        gameState={zilchPracticeState()}
        onGameStateChange={() => {}}
      />,
    );
    const ledgerIdx = html.indexOf('zilch-panel__ledger');
    const feltIdx = html.indexOf('zilch-table__felt');
    expect(ledgerIdx).toBeGreaterThan(-1);
    if (feltIdx >= 0) {
      expect(ledgerIdx).toBeGreaterThan(feltIdx);
    }
  });
});

function zilchPracticeState() {
  let state = createNewZilchTable();
  const spl = addVirtualPlayer(state.session, state.players, state.ledger, {
    displayName: 'Bot',
    virtualStyle: 'normal',
  });
  state = mergeSessionUpdate(state, spl);
  return applyZilchTableStakeSetup(state, {
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
