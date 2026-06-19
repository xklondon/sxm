import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ZilchPanel } from '../../components/zilch/ZilchPanel';
import { TableScreen } from '../../screens/TableScreen';
import {
  applyZilchTableStakeSetup,
  beginZilchPlay,
  createNewBlackjackTable,
  DEFAULT_TABLE_CHIPS,
  isBlackjackTable,
  isZilchTable,
} from '../../engine/session';

const ROOT = join(process.cwd(), 'src');

function listTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'blackjack') {
        continue;
      }
      listTsFiles(full, acc);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      acc.push(full);
    }
  }
  return acc;
}

const ZILCH_ENGINE_FILES = listTsFiles(join(ROOT, 'engine', 'dice', 'zilch'));

describe('Zilch isolation guards', () => {
  it('registry paths: blackjack table vs zilch table', () => {
    let bj = createNewBlackjackTable();
    expect(isBlackjackTable(bj)).toBe(true);
    expect(isZilchTable(bj)).toBe(false);

    let zilch = applyZilchTableStakeSetup(bj, {
      stakeDescription: 'Dinner',
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
      targetPoints: 10_000,
      roundLimit: 10,
      diceAnimationMode: 'fixed',
      diceAnimationMs: 2500,
      diceAnimationRandomMinMs: 2000,
      diceAnimationRandomMaxMs: 8000,
    });
    expect(isZilchTable(zilch)).toBe(true);
    expect(isBlackjackTable(zilch)).toBe(false);
    expect(zilch.tableGame).toBe('zilch');
  });

  it('TableScreen routes zilch to ZilchPanel without blackjack shell', () => {
    let state = createNewBlackjackTable();
    state = applyZilchTableStakeSetup(state, {
      stakeDescription: 'Dinner',
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
      targetPoints: 10_000,
      roundLimit: 10,
      diceAnimationMode: 'fixed',
      diceAnimationMs: 2500,
      diceAnimationRandomMinMs: 2000,
      diceAnimationRandomMaxMs: 8000,
    });

    const html = renderToStaticMarkup(
      <TableScreen gameState={state} onGameStateChange={() => {}} onLeave={() => {}} />,
    );
    expect(html).toContain('data-game="zilch"');
    expect(html).not.toContain('bj-casino');
    expect(html).not.toContain('Deal Cards');
  });

  it('Zilch engine does not import Blackjack engine', () => {
    const blackjackImport = /from\s+['"][^'"]*engine\/blackjack/;
    for (const file of ZILCH_ENGINE_FILES) {
      const src = readFileSync(file, 'utf8');
      expect(src, file).not.toMatch(blackjackImport);
    }
  });

  it('ZilchPanel does not import BlackjackPanel or blackjack engine', () => {
    const panelSrc = readFileSync(join(ROOT, 'components', 'zilch', 'ZilchPanel.tsx'), 'utf8');
    expect(panelSrc).not.toContain('BlackjackPanel');
    expect(panelSrc).not.toMatch(/engine\/blackjack/);
    expect(panelSrc).not.toContain('bj-casino');
  });
});

describe('ZilchPanel UI smoke', () => {
  it('renders title, dice area, command, player row, and actions', () => {
    let state = createNewBlackjackTable();
    state = applyZilchTableStakeSetup(state, {
      stakeDescription: 'Test',
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
      targetPoints: 10_000,
      roundLimit: 10,
      diceAnimationMode: 'fixed',
      diceAnimationMs: 400,
      diceAnimationRandomMinMs: 400,
      diceAnimationRandomMaxMs: 400,
    });
    state = beginZilchPlay(state);

    const html = renderToStaticMarkup(
      <ZilchPanel gameState={state} onGameStateChange={() => {}} />,
    );
    expect(html).toContain('Zilch');
    expect(html).toContain('zilch-table');
    expect(html).toContain('zilch-panel__banner');
    expect(html).toContain('zilch-seat');
    expect(html).toContain('Randomise starter');
  });
});
