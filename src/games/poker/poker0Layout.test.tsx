import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  applyHoldemTableStakeSetup,
  createNewHoldemTable,
} from '../../engine/session';
import { mapPokerTableViewModel } from './state/mapPokerTableViewModel';
import { PokerTableShell } from './components/PokerTableShell';
import {
  POKER0_CLOTH_TITLE,
  POKER0_COMMUNITY,
  POKER0_HEADER_BLINDS,
  POKER0_HEADER_DEAL,
  POKER0_HEADER_POT,
  POKER0_REFERENCE_IMAGE,
  POKER0_SHELL,
} from './poker0LayoutContract';
import { POKER_TEMPLATE_SHELL } from './pokerTemplateContract';
import type { PokerSeatViewModel } from './state/pokerTypes';

const POKER_CSS = readFileSync(
  resolve(process.cwd(), 'src/games/poker/styles/poker-table.css'),
  'utf8',
);

function personSeat(id: string, name: string, index: number): PokerSeatViewModel {
  return {
    seatIndex: index,
    playerId: id,
    displayName: name,
    chipCount: 500,
    streetBet: 0,
    isDealer: index === 0,
    isSmallBlind: index === 0,
    isBigBlind: index === 1,
    isActive: false,
    isFolded: false,
    isAllIn: false,
    isWinner: false,
    isViewer: id === 'hero',
    actionStatus: 'waiting',
    holeCards: null,
  };
}

function shellMarkup(
  seatCount: number,
  opts?: { tableName?: string; wager?: string; handActive?: boolean },
) {
  const ids = Array.from({ length: seatCount }, (_, i) => (i === 0 ? 'hero' : `p${i}`));
  let state = applyHoldemTableStakeSetup(createNewHoldemTable(), {
    stakeDescription: opts?.wager ?? 'Dinner',
    tableName: opts?.tableName ?? 'Practice Table',
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
  if (opts?.tableName) {
    state = {
      ...state,
      tableMeta: { ...state.tableMeta, tableClothName: opts.tableName },
    };
  }
  const vm = mapPokerTableViewModel(state, 'hero');
  vm.activePlayerId = 'hero';
  const seats = ids.map((id, index) => ({
    ...personSeat(id, id === 'hero' ? 'Hero' : `Player ${index}`, index),
    isViewer: id === 'hero',
    isActive: id === 'hero',
  }));
  vm.seats = seats;
  vm.pot = 30;
  const handActive = opts?.handActive ?? false;
  return renderToStaticMarkup(
    <PokerTableShell
      gameState={state}
      viewModel={vm}
      canStartHand
      handActive={handActive}
      canActOnTurn={handActive}
      actionAvailability={
        handActive
          ? {
              canCheck: true,
              canCall: true,
              canBet: false,
              canRaise: false,
              canFold: true,
              canAllIn: true,
              callAmount: 10,
              allInAmount: 500,
              minBet: 10,
              minRaise: 20,
            }
          : undefined
      }
      onStartHand={() => {}}
      onAction={() => {}}
    />,
  );
}

describe('Poker 0 canonical layout', () => {
  it('references Poker0Cannonical_Layout.png as sole spec', () => {
    expect(POKER0_REFERENCE_IMAGE).toContain('Poker0Cannonical_Layout.png');
  });

  it('renders exactly one poker shell', () => {
    const html = shellMarkup(2);
    expect(html).toContain(POKER_TEMPLATE_SHELL);
    expect(html).toContain(POKER0_SHELL);
    expect(html.match(/poker0-shell/g)?.length).toBe(1);
    expect(html).toContain('data-template="poker0"');
  });

  it('header contains pot, blinds, deal, and This Table', () => {
    const html = shellMarkup(2);
    expect(html).toContain(POKER0_HEADER_POT);
    expect(html).toContain(POKER0_HEADER_BLINDS);
    expect(html).toContain(POKER0_HEADER_DEAL);
    expect(html).toContain('data-testid="poker-header-this-table"');
    expect(html).toContain('Playing for Dinner');
  });

  it('pot and deal are not in felt center', () => {
    const html = shellMarkup(2);
    const centerStart = html.indexOf('data-testid="poker-felt-center"');
    const centerSlice = html.slice(centerStart, centerStart + 800);
    expect(centerSlice).not.toContain(POKER0_HEADER_POT);
    expect(centerSlice).not.toContain(POKER0_HEADER_DEAL);
    expect(centerSlice).toContain(POKER0_COMMUNITY);
  });

  it('table name embossed on cloth center', () => {
    const html = shellMarkup(2, { tableName: 'Friday Night Game' });
    expect(html).toContain(POKER0_CLOTH_TITLE);
    expect(html).toContain('FRIDAY NIGHT GAME');
    expect(html).not.toContain('SXM Poker');
  });

  it.each([2, 4, 6, 9])('%i-player layout renders all seats', (count) => {
    const html = shellMarkup(count);
    expect(html.match(/data-testid="poker-seat-/g)?.length).toBe(count);
    expect(html).toContain(`data-seat-count="${count}"`);
  });

  it('community board uses FLOP TURN RIVER rows', () => {
    const html = shellMarkup(2);
    expect(html).toContain('data-testid="poker-community-flop"');
    expect(html).toContain('data-testid="poker-community-turn"');
    expect(html).toContain('data-testid="poker-community-river"');
  });

  it('action bar outside felt with poker0 buttons', () => {
    const html = shellMarkup(2, { handActive: true });
    const feltIdx = html.indexOf('data-testid="poker0-felt"');
    const actionsIdx = html.indexOf('poker0-layout__actions');
    expect(actionsIdx).toBeGreaterThan(feltIdx);
    expect(html).toContain('poker0-layout__actions');
    expect(html).toContain('poker0-action-bar');
    expect(html).toContain('Fold');
    expect(html).toContain('All In');
  });

  it('no permanent chat rail', () => {
    const html = shellMarkup(2);
    expect(html).not.toContain('data-testid="poker-chat-dock"');
  });

  it('CSS defines desktop, portrait, and landscape contracts', () => {
    expect(POKER_CSS).toContain('orientation: portrait');
    expect(POKER_CSS).toContain('orientation: landscape');
    expect(POKER_CSS).toContain('min-width: 721px');
    expect(POKER_CSS).toContain('poker0-felt');
    expect(POKER_CSS).toContain('grid-template-columns: repeat(7');
  });

  it('writes HTML snapshot artifact for visual comparison', () => {
    const html = shellMarkup(6, { tableName: 'Slinki P Table' });
    const outDir = resolve(process.cwd(), 'dist/poker0-captures');
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, 'poker0-layout-desktop.html');
    writeFileSync(
      outPath,
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${POKER_CSS}</style></head><body>${html}</body></html>`,
      'utf8',
    );
    expect(outPath).toContain('poker0-layout-desktop.html');
  });
});
