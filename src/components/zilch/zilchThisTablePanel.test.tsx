// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  applyZilchTableStakeSetup,
  beginZilchPlay,
  createNewZilchTable,
  DEFAULT_TABLE_CHIPS,
} from '../../engine/session';
import { ZilchPanel } from './ZilchPanel';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/zilch/ZilchPanel.tsx'), 'utf8');

afterEach(() => cleanup());

function practiceState() {
  let state = applyZilchTableStakeSetup(createNewZilchTable(), {
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
    targetPoints: 1000,
    roundLimit: 10,
    diceAnimationMode: 'fixed',
    diceAnimationMs: 400,
    diceAnimationRandomMinMs: 400,
    diceAnimationRandomMaxMs: 400,
  });
  state = beginZilchPlay(state);
  return state;
}

describe('Zilch This Table panel', () => {
  it('renders This Table toggle instead of top utility buttons', () => {
    const html = renderToStaticMarkup(
      <ZilchPanel gameState={practiceState()} onGameStateChange={() => {}} />,
    );
    expect(html).toContain('This Table');
    expect(html).toContain('data-testid="zilch-this-table-toggle"');
    expect(html).not.toContain('Reset table');
    expect(html).not.toContain('Invite to table');
    expect(html).not.toContain('Add virtual player');
    expect(html).not.toContain('ZilchLedgerDrawer');
  });

  it('opens side panel with table actions when toggled', () => {
    render(
      <ZilchPanel
        gameState={practiceState()}
        onGameStateChange={() => {}}
        onInviteTable={() => {}}
        onBeginTableReset={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('zilch-this-table-toggle'));
    expect(screen.getByTestId('zilch-this-table-panel')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset table' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Invite player' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add virtual player' })).toBeTruthy();
  });

  it('does not import legacy ZilchActions or ZilchCommand', () => {
    expect(PANEL_SRC).not.toContain('ZilchActions');
    expect(PANEL_SRC).not.toContain('ZilchCommand');
    expect(PANEL_SRC).not.toContain('ZilchLedgerDrawer');
  });
});
