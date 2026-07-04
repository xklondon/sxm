import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { tableWithClaimedBox } from '../engine/blackjack/sanity/fixtures';
import { applyTableResetSetup } from '../engine/session/tableReset';
import type { TableStakeSetupInput } from '../engine/session/tableSetup';
import { canViewerResetTable } from '../engine/table/adminControls';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { blackjackHandKey } from '../engine/blackjack/handKeys';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const TABLE_SRC = readFileSync(join(process.cwd(), 'src/screens/TableScreen.tsx'), 'utf8');
const LEAVE_CSS = readFileSync(join(process.cwd(), 'src/components/LeaveTableConfirmDialog.css'), 'utf8');

const setupInput: TableStakeSetupInput = {
  stakeDescription: 'Rematch',
  seatChips: 300,
  bankChips: 300,
  bankerMode: 'bot',
  bankerName: '',
  controllerName: 'Alice',
  controllerEmail: '',
  protocolId: 'las-vegas-house',
  naturalDealing: false,
  dealSpeedPreset: 'normal',
  cardTimerPreset: 0,
  bankDrawAuto: true,
};

function endedBlackjackWithRoundResidue() {
  const base = tableWithClaimedBox(1);
  const box1 = base.tableMeta.boxSlots.find((s) => s.slotNumber === 1)!.playerId!;
  const splitKey = blackjackHandKey(box1, 1);
  return {
    ...base,
    tableMeta: {
      ...base.tableMeta,
      gameStatus: 'ended' as const,
      winnerId: base.tableMeta.ownerPersonId,
      endedAt: new Date().toISOString(),
      awaitingNextRound: true,
      bettingLocked: true,
      boxStakes: {
        [box1]: {
          amount: 100,
          chips: [50, 50],
          callerPersonId: base.tableMeta.ownerPersonId,
          stakerPersonIds: [base.tableMeta.ownerPersonId!],
          stakerAmountsByPersonId: { [base.tableMeta.ownerPersonId!]: 100 },
        },
      },
      invites: base.tableMeta.invites ?? [],
    },
    blackjack: {
      ...base.blackjack!,
      status: 'resolved' as const,
      activeHandKey: splitKey,
      splitCounts: { [box1]: 1 },
      insuranceOfferPending: false,
      insuranceBets: { [box1]: 25 },
      evenMoneyOfferHandKey: null,
      dealerCardIds: ['c1', 'c2'],
      playerHands: {
        [blackjackHandKey(box1, 0)]: createBlackjackPlayerHand(box1, 0, true),
        [splitKey]: createBlackjackPlayerHand(box1, 1, true),
      },
    },
  };
}

describe('game over table actions', () => {
  it('New Game and Reset Table share openSetupFlow reset path', () => {
    expect(PANEL_SRC).toContain("onBeginTableReset?.('newGame')");
    expect(PANEL_SRC).toContain("onBeginTableReset('resetTable')");
    expect(TABLE_SRC).toMatch(/onBeginTableReset=\{\(variant = 'resetTable'\) => \{[\s\S]*openSetupFlow\(\{ reset: true, variant \}\)/);
  });

  it('game over New Game dismisses overlay before opening setup', () => {
    expect(PANEL_SRC).toMatch(/dismissGameOverOverlayForAction[\s\S]*setGameOverOverlayConfirmed\(true\)/);
    expect(PANEL_SRC).toMatch(/beginNewGame[\s\S]*dismissGameOverOverlayForAction\('new-game'\)/);
    expect(PANEL_SRC).toMatch(/handleGameOverNewGameSetup[\s\S]*onBeginTableReset\?\.\('newGame'\)/);
    expect(PANEL_SRC).not.toMatch(
      /onNewGame:[\s\S]*gameOverOverlayConfirmed[\s\S]*onBeginTableReset\?\.\('newGame'\)/,
    );
  });

  it('game over Exit Table dismisses overlay before onLeave', () => {
    expect(PANEL_SRC).toMatch(/exitTable[\s\S]*dismissGameOverOverlayForAction\('exit-table'\)/);
    expect(PANEL_SRC).toMatch(/dismissGameOverOverlayForAction[\s\S]*setGameOverOverlayDismissed\(true\)/);
    expect(TABLE_SRC).toContain('onExitTable={onLeave}');
  });

  it('leave-table confirm renders above game-over overlay', () => {
    expect(LEAVE_CSS).toMatch(/z-index:\s*140/);
  });

  it('canViewerResetTable uses ownerPersonId even when profile name differs', () => {
    const state = tableWithClaimedBox(1);
    const ownerId = state.tableMeta.ownerPersonId!;
    expect(canViewerResetTable(state, ownerId, 'Different Name')).toBe(true);
    expect(canViewerResetTable(state, 'guest-person-id', 'Alice')).toBe(false);
  });

  it('reset setup preserves table id, invites, and clears blackjack residue', () => {
    const state = endedBlackjackWithRoundResidue();
    const sessionId = state.session.id;
    const invites = state.tableMeta.invites;
    const reset = applyTableResetSetup(state, setupInput, state.tableMeta.ownerPersonId);
    expect(reset.session.id).toBe(sessionId);
    expect(reset.tableMeta.invites).toEqual(invites);
    expect(reset.tableMeta.gameStatus).toBe('active');
    expect(reset.blackjack).toBeNull();
    expect(reset.deck).toBeNull();
    expect(reset.tableMeta.boxStakes).toEqual({});
    expect(reset.tableMeta.awaitingNextRound).toBe(false);
    expect(reset.tableMeta.bettingLocked).toBe(false);
    for (const slot of reset.tableMeta.boxSlots) {
      expect(slot.callerPersonId).toBeNull();
    }
  });
});
