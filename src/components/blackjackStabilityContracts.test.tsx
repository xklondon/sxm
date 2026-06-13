import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { BlackjackPanel } from './BlackjackPanel';
import {
  ACTION_CONTRACT_VIEW_FILES,
  FORBIDDEN_DIRECT_ENGINE_ACTION_IMPORTS,
  resolvePlayerHandActionOptions,
  resolveViewerActionPermission,
  canShowPlayerDecisionControls,
} from './blackjackActionContract';
import {
  ACCOUNTING_DISPLAY_VIEW_FILES,
  ACCOUNTING_END_GAME_FILES,
  resolvePersonDisplayBalances,
  resolveViewerTrayAvailable,
} from './blackjackAccountingDisplay';
import {
  ACTIVE_HAND_VALUE_CLASS,
  DEPRECATED_BOX_TURN_CLASS,
  LAYOUT_SLOT_OWNER_FILES,
  VIEW_ROOT_CLASSES,
} from './blackjackLayoutContract';
import {
  DEALING_REVEAL_HOOK,
  DEALING_REVEAL_OWNER_FILES,
  applyCardVisibility,
  emptyCardVisibility,
  getDisplayedHandValue,
  maxVisibilityForRound,
  resolveRevealScopeTransition,
} from './blackjackDealingContract';
import { cardColumnHandValueClassName } from './boxHandValueDisplay';
import { buildTableInfoDisplay } from './tableInfoDisplay';
import { getBoxBorderVisualClasses, resolveBoxBorderVisualState } from './cardViewBox';
import {
  actingRound,
  boxPlayerId,
  findCardId,
  tableAfterStartPlaying,
  withInstantInitialDeal,
} from '../engine/blackjack/sanity/fixtures';
import { addChipToBoxStake } from '../engine/blackjack/stakes';
import { claimBoxSlot } from '../engine/session';
import { addPlayer, mergeSessionUpdate } from '../engine/session/session';
import { allocateChipsToBankrollOwner } from '../engine/session/allocation';
import { syncPlayerOrderAndAssignments } from '../engine/session/playerAssignment';
import { createBlackjackPlayerHand } from '../types/blackjack';
import { blackjackHandKey } from '../engine/blackjack';
import { createMobileLayoutMatchMedia } from '../test/mobileLayoutMatchMedia';

const noop = () => {};

function readSrc(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

function twoPlayerTable() {
  let state = tableAfterStartPlaying(500);
  const p1 = state.tableMeta.ownerPersonId!;
  const guestSpl = addPlayer(state.session, state.players, state.ledger, {
    displayName: 'K',
    controllerName: 'K',
    role: 'person',
    startingChips: 0,
  });
  state = mergeSessionUpdate(state, guestSpl);
  const p2 = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;
  state = allocateChipsToBankrollOwner(state, {
    bankrollOwnerId: p2,
    amount: 500,
    reason: 'initial-player',
    source: 'setup',
  });
  state = {
    ...state,
    tableMeta: { ...state.tableMeta, playerOrder: [p1, p2] },
  };
  state = syncPlayerOrderAndAssignments(state);
  return { state, p1, p2 };
}

describe('stability contracts — protocol boundary', () => {
  it('view files route engine legality through blackjackActionContract', () => {
    for (const file of ACTION_CONTRACT_VIEW_FILES) {
      const src = readSrc(file);
      for (const symbol of FORBIDDEN_DIRECT_ENGINE_ACTION_IMPORTS) {
        expect(src).not.toMatch(new RegExp(`\\b${symbol}\\b`));
      }
      expect(src).toContain('blackjackActionContract');
    }
  });

  it('resolvePlayerHandActionOptions mirrors engine rules for hit/stand/double/split', () => {
    let { state } = twoPlayerTable();
    const box2 = boxPlayerId(state, 2)!;
    const handKey = `${box2}:0`;
    state = {
      ...state,
      blackjack: actingRound(
        state,
        box2,
        [findCardId(state.deck!, '9'), findCardId(state.deck!, '2')],
        250,
      ),
    };
    state.blackjack!.activeHandKey = handKey;

    const opts = resolvePlayerHandActionOptions(state, handKey, state.blackjackSettings, true);
    expect(opts.canHit).toBe(true);
    expect(opts.canStand).toBe(true);
  });

  it('resolveViewerActionPermission is the sole ownership gate for active hand', () => {
    let { state, p1, p2 } = twoPlayerTable();
    const box2 = boxPlayerId(state, 2)!;
    state = {
      ...state,
      blackjack: actingRound(
        state,
        box2,
        [findCardId(state.deck!, '3'), findCardId(state.deck!, '2')],
        250,
      ),
    };
    state.blackjack!.activeHandKey = `${box2}:0`;

    expect(resolveViewerActionPermission(state, p2).canAct).toBe(true);
    expect(resolveViewerActionPermission(state, p1).canAct).toBe(false);
    expect(resolveViewerActionPermission(state, p1).waitMessage).toMatch(/waiting for K/i);
  });

  it('insurance decisions aggregate through action contract selectors', () => {
    const panelSrc = readSrc('src/components/BlackjackPanel.tsx');
    expect(panelSrc).toContain('getPrimaryInsuranceActionForController');
    expect(panelSrc).toContain('blackjackActionContract');
  });
});

describe('stability contracts — layout boundary', () => {
  it('view roots are documented and used on panel root', () => {
    const panelSrc = readSrc('src/components/BlackjackPanel.tsx');
    expect(panelSrc).toContain('getViewRootClass');
    for (const root of VIEW_ROOT_CLASSES) {
      expect(root.startsWith('bj-view-')).toBe(true);
    }
  });

  it('shared CSS scopes major table rules under view roots', () => {
    const css = readSrc('src/styles/bj-table-shared.css');
    expect(css).toContain('.bj-view-full-desktop');
    expect(css).toContain('.bj-view-card-mobile');
  });

  it('card columns and boxes iterate displaySlots in slot order', () => {
    for (const file of LAYOUT_SLOT_OWNER_FILES) {
      const src = readSrc(file);
      expect(src).toMatch(
        /displaySlots\.map\(\(slot\)[\s\S]*renderArcCardColumn\(slot\.playerId, slot\.slotNumber\)/,
      );
      expect(src).toMatch(
        /displaySlots\.map\(\(slot\)[\s\S]*renderArcSlot\(slot\.slotNumber\)/,
      );
    }
  });

  it('active value highlight is circular number only — no box turn border', () => {
    const active = cardColumnHandValueClassName(true, false, true);
    expect(active).toContain(ACTIVE_HAND_VALUE_CLASS);
    expect(active).not.toContain('bj-player-hand-value--emphasis');

    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const box1 = boxPlayerId(state, 1)!;
    const resolved = resolveBoxBorderVisualState({
      state,
      boxPlayerId: box1,
      viewerPersonId: state.tableMeta.ownerPersonId,
      activeBoxId: box1,
      playerPhase: true,
    });
    expect(resolved.isTurn).toBe(true);
    expect(getBoxBorderVisualClasses(resolved)).not.toContain(DEPRECATED_BOX_TURN_CLASS);

    const panelSrc = readSrc('src/components/BlackjackPanel.tsx');
    expect(panelSrc).not.toContain("'bj-arc__slot--turn'");
  });
});

describe('stability contracts — dealing boundary', () => {
  it('useSequentialCardReveal is the sole reveal hook owner', () => {
    const panelSrc = readSrc('src/components/BlackjackPanel.tsx');
    expect(panelSrc).toContain(DEALING_REVEAL_HOOK);
    for (const file of DEALING_REVEAL_OWNER_FILES) {
      if (file.endsWith('BlackjackPanel.tsx')) {
        continue;
      }
      const src = readSrc(file);
      if (file.includes('useSequentialCardReveal')) {
        expect(src).toContain('export function useSequentialCardReveal');
      }
    }
  });

  it('hand values are null until cards are revealed in visibility layer', () => {
    let { state } = twoPlayerTable();
    const box2 = boxPlayerId(state, 2)!;
    state = {
      ...state,
      blackjack: actingRound(
        state,
        box2,
        [findCardId(state.deck!, '6'), findCardId(state.deck!, '7')],
        250,
      ),
    };
    const round = state.blackjack!;
    const hidden = applyCardVisibility(state, emptyCardVisibility());
    expect(getDisplayedHandValue(hidden.deck, hidden.blackjack, `${box2}:0`)).toBeNull();
    const visible = applyCardVisibility(state, maxVisibilityForRound(round));
    expect(getDisplayedHandValue(visible.deck, visible.blackjack, `${box2}:0`)).toBe(13);
  });

  it('player controls stay disabled until reveal/hold complete', () => {
    let { state } = twoPlayerTable();
    const box2 = boxPlayerId(state, 2)!;
    state = {
      ...state,
      blackjackFlowSettings: { ...state.blackjackFlowSettings, initialDealMode: 'natural' },
      blackjack: {
        ...actingRound(
          state,
          box2,
          [findCardId(state.deck!, '9'), findCardId(state.deck!, '2')],
          250,
        ),
        dealerCardIds: [findCardId(state.deck!, '10'), findCardId(state.deck!, '7')],
      },
    };
    state.blackjack!.activeHandKey = `${box2}:0`;

    expect(
      canShowPlayerDecisionControls(state, 'dealing', {
        cardRevealComplete: false,
        activeHandRevealComplete: false,
      }),
    ).toBe(false);
    expect(
      canShowPlayerDecisionControls(state, 'dealing', {
        cardRevealComplete: false,
        activeHandRevealComplete: true,
      }),
    ).toBe(true);
  });

  it('round scope change resets reveal queue (round 2 regression guard)', () => {
    expect(resolveRevealScopeTransition(null, 'table-a:1')).toBe('reset');
    expect(resolveRevealScopeTransition('table-a:1', 'table-a:2')).toBe('reset');
    expect(resolveRevealScopeTransition('table-a:2', 'table-a:2')).toBe('continue');
  });

  it('view files route card visibility through blackjackDealingContract', () => {
    const dealingViewFiles = [
      'src/components/BlackjackPanel.tsx',
      'src/components/BlackjackCardView.tsx',
      'src/components/boxHandValueDisplay.ts',
      'src/components/tableInfoDisplay.ts',
      'src/components/tableCommandDisplay.ts',
    ];
    for (const file of dealingViewFiles) {
      const src = readSrc(file);
      expect(src).toContain('blackjackDealingContract');
      expect(src).not.toMatch(/from ['"].*\/dealing\/cardRevealDisplay['"]/);
      expect(src).not.toMatch(/from ['"].*\/protocolState['"]/);
    }
  });
});

describe('stability contracts — accounting boundary', () => {
  it('display view files use blackjackAccountingDisplay helpers', () => {
    for (const file of ACCOUNTING_DISPLAY_VIEW_FILES) {
      const src = readSrc(file);
      expect(src).toContain('blackjackAccountingDisplay');
    }
  });

  it('tray and This Table agree for multi-box same-player betting', () => {
    let { state, p2 } = twoPlayerTable();
    const box1 = boxPlayerId(state, 1)!;
    const box2 = boxPlayerId(state, 2)!;
    for (let i = 0; i < 5; i += 1) {
      state = addChipToBoxStake(state, box1, 50, p2);
      state = addChipToBoxStake(state, box2, 50, p2);
    }

    const balances = resolvePersonDisplayBalances(state, p2);
    const trayAvailable = buildTableInfoDisplay(state, p2).playerAvailable;
    const contractAvailable = resolveViewerTrayAvailable(state, p2);
    expect(balances.available).toBe(0);
    expect(balances.betting).toBe(500);
    expect(trayAvailable).toBe(0);
    expect(contractAvailable).toBe(0);
    expect(trayAvailable).toBe(balances.available);
  });

  it('end-game evaluation routes through blackjackAccountingDisplay', () => {
    for (const file of ACCOUNTING_END_GAME_FILES) {
      const src = readSrc(file);
      expect(src).toContain('blackjackAccountingDisplay');
      expect(src).not.toMatch(/\bgetAvailableChipsForBankrollOwner\b/);
    }
  });
});

describe('stability contracts — layout render guard', () => {
  let simulatedViewport = { width: 390, height: 844 };
  const globalRef = globalThis as unknown as { window?: unknown };
  const hadWindow = 'window' in globalRef;

  beforeAll(() => {
    globalRef.window = {
      matchMedia: createMobileLayoutMatchMedia(() => simulatedViewport),
    };
  });

  afterAll(() => {
    if (!hadWindow) {
      delete globalRef.window;
    }
  });

  function playingState(): GameState {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 2);
    const deck = state.deck!;
    const box1 = boxPlayerId(state, 1)!;
    const box2 = boxPlayerId(state, 2)!;
    const k1 = blackjackHandKey(box1, 0);
    const k2 = blackjackHandKey(box2, 0);
    return withInstantInitialDeal({
      ...state,
      selectedSeatId: box2,
      blackjack: {
        ...state.blackjack!,
        status: 'player-turns',
        activeHandKey: k2,
        activePlayerId: box2,
        dealerCardIds: [findCardId(deck, '7'), findCardId(deck, 'K')],
        dealerHoleHidden: true,
        playerHands: {
          [k1]: {
            ...createBlackjackPlayerHand(box1, 0),
            cardIds: [findCardId(deck, '10'), findCardId(deck, '9'), findCardId(deck, '5')],
            currentBet: 10,
            actionStatus: 'busted',
            bustSettled: true,
          },
          [k2]: {
            ...createBlackjackPlayerHand(box2, 0),
            cardIds: [findCardId(deck, '6'), findCardId(deck, '7')],
            currentBet: 10,
            actionStatus: 'acting',
          },
        },
      },
    });
  }

  it('Full Table render shows active-turn on card column only', () => {
    simulatedViewport = { width: 390, height: 844 };
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={{ ...playingState(), tableViewMode: 'full' }} onGameStateChange={noop} />,
    );
    expect(html).toContain(ACTIVE_HAND_VALUE_CLASS);
    expect(html).not.toContain(DEPRECATED_BOX_TURN_CLASS);
    const cardsArea = html.split('bj-arc--cards')[1]?.split('bj-arc--player-boxes')[0] ?? '';
    expect(cardsArea).toContain('data-box-slot="2"');
  });
});
