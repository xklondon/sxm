import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  applyHoldemTableStakeSetup,
  createNewHoldemTable,
} from '../../engine/session';
import { mapPokerTableViewModel } from './state/mapPokerTableViewModel';
import { PokerTableShell } from './components/PokerTableShell';
import { POKER_TEMPLATE_ACTION_BAR, POKER_TEMPLATE_SHELL } from './pokerTemplateContract';
import type { PokerSeatViewModel } from './state/pokerTypes';

const POKER_CSS = readFileSync(
  resolve(process.cwd(), 'src/games/poker/styles/poker-table.css'),
  'utf8',
);

function personSeat(id: string, name: string): PokerSeatViewModel {
  return {
    seatIndex: 0,
    playerId: id,
    displayName: name,
    chipCount: 500,
    streetBet: 0,
    isDealer: false,
    isSmallBlind: false,
    isBigBlind: false,
    isActive: false,
    isFolded: false,
    isAllIn: false,
    isWinner: false,
    isViewer: id === 'hero',
    actionStatus: 'active',
    holeCards: null,
  };
}

function shellWithSeats(seatCount: number) {
  const ids = Array.from({ length: seatCount }, (_, i) => (i === 0 ? 'hero' : `p${i}`));
  const state = applyHoldemTableStakeSetup(createNewHoldemTable(), {
    stakeDescription: 'Practice',
    seatChips: 500,
    bankChips: 500,
    bankerMode: 'self',
    bankerName: 'Alex',
    controllerName: 'Alex',
    controllerEmail: 'alex@example.com',
    protocolId: 'texas-holdem',
    naturalDealing: false,
    dealSpeedPreset: 'normal',
    cardTimerPreset: 0,
    bankDrawAuto: true,
    tableMode: 'practice',
    smallBlind: 5,
    bigBlind: 10,
    virtualPlayerCount: Math.max(0, seatCount - 1),
  });
  const vm = mapPokerTableViewModel(state, 'hero');
  vm.seats = ids.map((id, index) => ({
    ...personSeat(id, id === 'hero' ? 'Hero' : `Player ${index}`),
    seatIndex: index,
    isViewer: id === 'hero',
  }));
  return renderToStaticMarkup(
    <PokerTableShell gameState={state} viewModel={vm} handActive canActOnTurn />,
  );
}

describe('Poker responsive layout contract', () => {
  it('CSS uses clamp/aspect layout vars and sticky action bar', () => {
    expect(POKER_CSS).toContain('--poker-felt-height: clamp(');
    expect(POKER_CSS).toContain('--poker-seat-width: clamp(');
    expect(POKER_CSS).toContain('env(safe-area-inset-bottom');
    expect(POKER_CSS).toContain('.poker-hr-layout__actions');
    expect(POKER_CSS).toMatch(/overflow:\s*visible/);
    expect(POKER_CSS).not.toMatch(/poker-table-layout__controls/);
  });

  it('desktop render includes community cards, pot, action bar, seats', () => {
    const html = shellWithSeats(2);
    expect(html).toContain(POKER_TEMPLATE_SHELL);
    expect(html).toContain('poker-community');
    expect(html).toContain('poker-hr-pot');
    expect(html).toContain(POKER_TEMPLATE_ACTION_BAR);
    expect(html).toContain('poker-hr-seat-ring');
  });

  it('2-seat layout renders both seats', () => {
    const html = shellWithSeats(2);
    expect(html.match(/data-testid="poker-seat-/g)?.length).toBe(2);
  });

  it('6-seat layout renders all seats', () => {
    const html = shellWithSeats(6);
    expect(html.match(/data-testid="poker-seat-/g)?.length).toBe(6);
  });

  it('9-seat layout renders all seats', () => {
    const html = shellWithSeats(9);
    expect(html.match(/data-testid="poker-seat-/g)?.length).toBe(9);
  });

  it('action bar is sibling below stage, not inside felt overflow', () => {
    const html = shellWithSeats(2);
    const feltClose = html.indexOf('poker-hr-table');
    const actionsIndex = html.indexOf('poker-hr-layout__actions');
    const stageClose = html.indexOf('poker-hr-layout__actions', feltClose);
    expect(actionsIndex).toBeGreaterThan(feltClose);
    expect(html).toContain('poker-hr-layout__actions');
    expect(html).not.toContain('data-testid="poker-chat-dock"');
  });

  it('includes portrait and landscape media queries', () => {
    expect(POKER_CSS).toContain('@media (max-width: 720px)');
    expect(POKER_CSS).toContain('orientation: landscape');
  });
});
