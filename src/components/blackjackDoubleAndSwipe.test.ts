import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { BlackjackPanel } from './BlackjackPanel';
import { BlackjackActionPanel } from './BlackjackActionPanel';
import { TABLE_UX } from './tableUxContract';
import {
  actingRound,
  boxPlayerId,
  findCardId,
  tableWithClaimedBox,
} from '../engine/blackjack/sanity/fixtures';
import { blackjackHandKey, doubleDownBlackjackOnState, hitBlackjackOnState } from '../engine/blackjack';
import { canDoubleBlackjackForState } from '../engine/blackjack/validation';
import { cardsFromIds, getBlackjackHandValue } from '../engine/blackjack/hand';
import {
  getAvailableChipsForBankrollOwner,
  resolveBankrollOwnerIdForBox,
} from '../engine/session/bankroll';
import {
  resolveMobileCardViewPlaySwipe,
  MOBILE_CARD_VIEW_SWIPE_MIN_PX,
} from '../hooks/useMobileCardViewPlaySwipe';

const noop = () => undefined;
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const ACTION_PANEL_SRC = readFileSync(
  join(process.cwd(), 'src/components/BlackjackActionPanel.tsx'),
  'utf8',
);

let simulatedWidth = 390;
const globalRef = globalThis as unknown as { window?: unknown };
const hadWindow = 'window' in globalRef;

function installMobileViewport() {
  globalRef.window = {
    matchMedia: (query: string) => {
      const m = /max-width:\s*(\d+)/.exec(query);
      const max = m ? Number(m[1]) : Number.POSITIVE_INFINITY;
      return {
        matches: simulatedWidth <= max,
        media: query,
        addEventListener: noop,
        removeEventListener: noop,
        addListener: noop,
        removeListener: noop,
        onchange: null,
        dispatchEvent: () => false,
      };
    },
  };
}

if (!hadWindow) {
  installMobileViewport();
}

vi.mock('./storage/profileStorage', () => ({
  loadProfile: () => ({ name: 'Alice', email: 'alice@test.com' }),
  needsLocalProfileSetup: () => false,
  syncAuthEmailToProfile: () => {},
  getPlayerInitials: () => 'AL',
}));

function doubleEligibleState(bet = 50): { state: GameState; handKey: string } {
  let state = tableWithClaimedBox(1);
  const boxId = boxPlayerId(state, 1)!;
  const handKey = blackjackHandKey(boxId, 0);
  const deck = state.deck!;
  state = {
    ...state,
    tableViewMode: 'full',
    blackjackSettings: { ...state.blackjackSettings, allowDoubleDown: true, allowSplit: false },
    tableMeta: { ...state.tableMeta, bettingLocked: true },
    blackjack: {
      ...actingRound(state, boxId, [findCardId(deck, '5'), findCardId(deck, '4')], bet),
      status: 'player-turns',
      activeHandKey: handKey,
      activePlayerId: boxId,
      dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '7')],
      dealerHoleHidden: true,
    },
  };
  return { state, handKey };
}

describe('double-down engine wiring', () => {
  it('2x doubles the current box bet', () => {
    const { state, handKey } = doubleEligibleState(50);
    const betBefore = state.blackjack!.playerHands[handKey]!.currentBet;
    const after = doubleDownBlackjackOnState(state, handKey);
    expect(after.blackjack!.playerHands[handKey]!.currentBet).toBe(betBefore * 2);
  });

  it('2x deals exactly one additional card', () => {
    const { state, handKey } = doubleEligibleState(50);
    const beforeCount = state.blackjack!.playerHands[handKey]!.cardIds.filter(Boolean).length;
    const after = doubleDownBlackjackOnState(state, handKey);
    const afterCount = after.blackjack!.playerHands[handKey]!.cardIds.filter(Boolean).length;
    expect(beforeCount).toBe(2);
    expect(afterCount).toBe(3);
  });

  it('2x then auto-stands and advances turn', () => {
    const { state, handKey } = doubleEligibleState(50);
    const after = doubleDownBlackjackOnState(state, handKey);
    const hand = after.blackjack!.playerHands[handKey]!;
    expect(hand.actionStatus).toBe('stood');
    expect(hand.doubled).toBe(true);
    expect(after.blackjack!.activeHandKey).not.toBe(handKey);
  });

  it('2x unavailable after hit', () => {
    const { state, handKey } = doubleEligibleState(50);
    const afterHit = hitBlackjackOnState(state, handKey);
    expect(canDoubleBlackjackForState(afterHit, handKey)).toBe(false);
  });

  it('2x unavailable when player cannot cover extra bet', () => {
    const base = tableWithClaimedBox(1);
    const boxId = boxPlayerId(base, 1)!;
    const ownerId = resolveBankrollOwnerIdForBox(base, boxId)!;
    const deck = base.deck!;
    const handKey = blackjackHandKey(boxId, 0);
    const state: GameState = {
      ...base,
      blackjack: {
        ...actingRound(base, boxId, [findCardId(deck, '6'), findCardId(deck, '4')], 400),
        status: 'player-turns',
        activeHandKey: handKey,
        activePlayerId: boxId,
      },
    };
    expect(getAvailableChipsForBankrollOwner(state, ownerId)).toBeLessThan(400);
    expect(canDoubleBlackjackForState(state, handKey)).toBe(false);
  });
});

describe('action row 2x placement and wiring', () => {
  it('renders 2x immediately right of Hit on the primary row', () => {
    const html = renderToStaticMarkup(
      createElement(BlackjackActionPanel, {
        actionsEnabled: true,
        canHit: true,
        canStand: true,
        canDouble: true,
        canSplit: false,
        showDouble: true,
        showSplit: false,
        showAid: false,
        onHit: noop,
        onStand: noop,
        onDouble: noop,
        onSplit: noop,
        onAid: noop,
      }),
    );
    const hitIdx = html.indexOf('>Hit<');
    const doubleIdx = html.indexOf('>2×<');
    expect(hitIdx).toBeGreaterThan(-1);
    expect(doubleIdx).toBeGreaterThan(hitIdx);
    const primaryChunk = html.split('bj-table-actions__row')[1] ?? html;
    expect(primaryChunk.indexOf('>Hit<')).toBeLessThan(primaryChunk.indexOf('>2×<'));
    expect(ACTION_PANEL_SRC).not.toContain('tableDoubleVisible');
  });

  it('disables 2x when not eligible', () => {
    const html = renderToStaticMarkup(
      createElement(BlackjackActionPanel, {
        actionsEnabled: true,
        canHit: true,
        canStand: true,
        canDouble: false,
        canSplit: false,
        showDouble: true,
        showSplit: false,
        showAid: false,
        onHit: noop,
        onStand: noop,
        onDouble: noop,
        onSplit: noop,
        onAid: noop,
      }),
    );
    expect(html).toMatch(/2×<\/button>/);
    expect(html).toContain('disabled=""');
  });

  it('marks the canonical action row busy during an online action', () => {
    const html = renderToStaticMarkup(
      createElement(BlackjackActionPanel, {
        actionsEnabled: false,
        busy: true,
        canHit: true,
        canStand: true,
        canDouble: false,
        canSplit: false,
        showDouble: false,
        showSplit: false,
        showAid: false,
        onHit: noop,
        onStand: noop,
        onDouble: noop,
        onSplit: noop,
        onAid: noop,
      }),
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('data-action-busy="true"');
    expect(PANEL_SRC).toContain('busy={Boolean(onlineActionInFlight)}');
  });

  it('panel dispatches double through run() with type double', () => {
    expect(PANEL_SRC).toContain("type: 'double'");
    expect(PANEL_SRC).toContain('doubleDownBlackjackOnState');
    expect(PANEL_SRC).toContain('onDouble={() =>');
  });

  it('full-table panel action zone shows wired 2x for eligible hand', () => {
    const { state } = doubleEligibleState(50);
    const html = renderToStaticMarkup(
      createElement(BlackjackPanel, { gameState: state, onGameStateChange: noop }),
    );
    const actionsZone =
      html.split(TABLE_UX.tableZoneActions)[1]?.split(TABLE_UX.tableZoneBoxes)[0] ?? '';
    expect(actionsZone).toContain('>2×<');
    const hitIdx = actionsZone.indexOf('>Hit<');
    const doubleIdx = actionsZone.indexOf('>2×<');
    expect(doubleIdx).toBeGreaterThan(hitIdx);
  });
});

describe('mobile Card View play swipe', () => {
  it('maps swipe left to stand and swipe right to hit only', () => {
    expect(resolveMobileCardViewPlaySwipe(-MOBILE_CARD_VIEW_SWIPE_MIN_PX - 1, 2)).toBe('stand');
    expect(resolveMobileCardViewPlaySwipe(MOBILE_CARD_VIEW_SWIPE_MIN_PX + 1, 2)).toBe('hit');
    expect(resolveMobileCardViewPlaySwipe(80, 80)).toBeNull();
  });

  it('swipe resolver never returns double', () => {
    const samples = [-120, -60, 60, 120, 200];
    for (const deltaX of samples) {
      const action = resolveMobileCardViewPlaySwipe(deltaX, 0);
      expect(action === 'stand' || action === 'hit' || action === null).toBe(true);
    }
  });

  it('panel wires card-view play swipe on felt during actionable turn', () => {
    expect(PANEL_SRC).toContain('useMobileCardViewPlaySwipe');
    expect(PANEL_SRC).toContain('cardViewPlaySwipeEnabled');
    expect(PANEL_SRC).toContain('mobileFeltTouchHandlers');
    expect(PANEL_SRC).toContain("run((s) => standBlackjackOnState(s, actionable.handKey), { type: 'stand'");
    expect(PANEL_SRC).toContain("run((s) => hitBlackjackOnState(s, actionable.handKey), { type: 'hit'");
    expect(PANEL_SRC).not.toMatch(
      /useMobileCardViewPlaySwipe[\s\S]{0,500}doubleDownBlackjackOnState/,
    );
  });

  it('disables play swipe when game-over modal gate is active', () => {
    expect(PANEL_SRC).toContain('!showGameOverModal');
    expect(PANEL_SRC).toContain("protocolPhase !== 'insurance'");
    expect(PANEL_SRC).toContain('!round?.evenMoneyOfferHandKey');
    expect(PANEL_SRC).toContain('!round?.insuranceOfferPending');
  });

  it('mobile card view uses card action-row variant (not forced table)', () => {
    expect(PANEL_SRC).not.toMatch(/BlackjackActionRow[\s\S]{0,120}variant="table"/);
  });

  it('mobile card view shows 2x in actions zone not command overlay', () => {
    const { state } = doubleEligibleState(25);
    simulatedWidth = 390;
    const html = renderToStaticMarkup(
      createElement(BlackjackPanel, {
        gameState: { ...state, tableViewMode: 'card' },
        onGameStateChange: noop,
      }),
    );
    const actionsZone =
      html.split(TABLE_UX.tableZoneActions)[1]?.split(TABLE_UX.tableZoneBoxes)[0] ?? '';
    expect(actionsZone).toContain('>2×<');
    const commandZone =
      html.split('bj-table-zone--summary')[1]?.split('bj-table-zone--cards')[0] ?? '';
    expect(commandZone).not.toContain('>Double<');
  });
});

describe('double hand value sanity', () => {
  it('eligible hard 9 can double before action', () => {
    const { state, handKey } = doubleEligibleState(50);
    const cards = cardsFromIds(state.deck!, state.blackjack!.playerHands[handKey]!.cardIds);
    expect(getBlackjackHandValue(cards).value).toBe(9);
    expect(canDoubleBlackjackForState(state, handKey)).toBe(true);
  });
});
