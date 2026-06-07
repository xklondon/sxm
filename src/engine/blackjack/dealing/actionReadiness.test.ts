import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  getCardDealDelayMs,
  getBankTurnDelayMs,
  normalizeFlowSettings,
} from '../flowSettings';
import {
  isActionRevealReady,
  isActiveHandRevealComplete,
  maxVisibilityForRound,
  applyCardVisibility,
} from './cardRevealDisplay';
import { isNaturalInitialDeal } from './dealingModes';
import { canShowPlayerDecisionControls } from '../../../components/blackjackViewPhase';
import {
  actingRound,
  boxPlayerId,
  findCardId,
  tableWithClaimedBox,
} from '../sanity/fixtures';
import { blackjackHandKey } from '../handKeys';

describe('action readiness — natural dealing OFF', () => {
  it('does not wait for sequential reveal flags', () => {
    expect(
      isActionRevealReady(false, {
        cardRevealComplete: false,
        activeHandRevealComplete: false,
      }),
    ).toBe(true);
  });

  it('enables decision controls immediately after authoritative deal', () => {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(boxId, 0);
    const deck = state.deck!;
    state = {
      ...state,
      blackjackFlowSettings: {
        ...state.blackjackFlowSettings,
        initialDealMode: 'instant',
      },
      blackjack: {
        ...actingRound(state, boxId, [findCardId(deck, '6'), findCardId(deck, '5')], 50),
        status: 'player-turns',
        activeHandKey: handKey,
        activePlayerId: boxId,
        dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '7')],
      },
    };
    expect(isNaturalInitialDeal(state.blackjackFlowSettings.initialDealMode)).toBe(false);
    expect(
      canShowPlayerDecisionControls(state, 'player', {
        cardRevealComplete: false,
        activeHandRevealComplete: false,
      }),
    ).toBe(true);
  });

  it('hydrates full visibility instantly (no masking)', () => {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(boxId, 0);
    const deck = state.deck!;
    state = {
      ...state,
      blackjack: {
        ...actingRound(state, boxId, [findCardId(deck, '6'), findCardId(deck, '5')], 50),
        status: 'player-turns',
        activeHandKey: handKey,
        activePlayerId: boxId,
        dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '7')],
      },
    };
    const target = maxVisibilityForRound(state.blackjack);
    const instant = applyCardVisibility(state, target);
    expect(instant.blackjack!.playerHands[handKey]!.cardIds).toHaveLength(2);
    expect(instant.blackjack!.dealerCardIds).toHaveLength(2);
  });
});

describe('action readiness — natural dealing ON', () => {
  it('waits for active-hand reveal before enabling controls', () => {
    expect(
      isActionRevealReady(true, {
        cardRevealComplete: false,
        activeHandRevealComplete: false,
      }),
    ).toBe(false);
    expect(
      isActionRevealReady(true, {
        cardRevealComplete: false,
        activeHandRevealComplete: true,
      }),
    ).toBe(true);
  });

  it('detects active hand reveal complete when two cards visible', () => {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(boxId, 0);
    const deck = state.deck!;
    state = {
      ...state,
      blackjack: {
        ...actingRound(state, boxId, [findCardId(deck, '6'), findCardId(deck, '5')], 50),
        status: 'player-turns',
        activeHandKey: handKey,
        activePlayerId: boxId,
        dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '7')],
      },
    };
    const visible = { dealer: 1, hands: { [handKey]: 2 } };
    expect(isActiveHandRevealComplete(state.blackjack, visible, handKey)).toBe(true);
    expect(
      canShowPlayerDecisionControls(state, 'player', {
        cardRevealComplete: false,
        activeHandRevealComplete: true,
      }),
    ).toBe(true);
  });

  it('uses configured deal speed per card reveal (not bank timer)', () => {
    const settings = normalizeFlowSettings({
      dealSpeedPreset: 'slow',
      cardTimerPreset: 15,
    });
    expect(getCardDealDelayMs({ blackjackFlowSettings: settings }, 'initial-deal')).toBe(5000);
    expect(getCardDealDelayMs({ blackjackFlowSettings: settings }, 'dealer')).toBe(5000);
    expect(getCardDealDelayMs({ blackjackFlowSettings: settings }, 'bank-turn-start')).toBe(
      15000,
    );
    expect(getCardDealDelayMs({ blackjackFlowSettings: settings }, 'bank-card-draw')).toBe(
      15000,
    );
  });
});

describe('bank timer — independent of natural dealing', () => {
  it('uses cardTimerPreset for pre-bank delay', () => {
    const settings = normalizeFlowSettings({ cardTimerPreset: 10, dealSpeedPreset: 'fast' });
    expect(getBankTurnDelayMs(settings)).toBe(10000);
    expect(getCardDealDelayMs({ blackjackFlowSettings: settings }, 'bank-turn-start')).toBe(
      10000,
    );
  });

  it('bank timer 0 starts bank immediately (no pre-bank wait)', () => {
    const settings = normalizeFlowSettings({ cardTimerPreset: 0, dealSpeedPreset: 'slow' });
    expect(getBankTurnDelayMs(settings)).toBe(0);
    expect(getCardDealDelayMs({ blackjackFlowSettings: settings }, 'bank-turn-start')).toBe(0);
  });

  it('does not gate player decision controls', () => {
    let state = tableWithClaimedBox(1);
    const boxId = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(boxId, 0);
    const deck = state.deck!;
    state = {
      ...state,
      blackjackFlowSettings: {
        ...state.blackjackFlowSettings,
        cardTimerPreset: 30,
        initialDealMode: 'natural',
      },
      blackjack: {
        ...actingRound(state, boxId, [findCardId(deck, '6'), findCardId(deck, '5')], 50),
        status: 'player-turns',
        activeHandKey: handKey,
        activePlayerId: boxId,
        dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '7')],
      },
    };
    expect(
      canShowPlayerDecisionControls(state, 'player', {
        cardRevealComplete: false,
        activeHandRevealComplete: true,
      }),
    ).toBe(true);
  });
});

describe('action-in-progress UX guard', () => {
  it('online dispatch returns null instead of throwing when action is in flight', () => {
    const src = readFileSync(join(process.cwd(), 'src/hooks/useOnlineMultiplayer.ts'), 'utf8');
    expect(src).toMatch(/if \(actionInFlight\) \{\s*return null;/);
    expect(src).not.toContain("throw new Error('Action already in progress')");
  });

  it('BlackjackPanel suppresses action-in-progress from central error display', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(src).toContain("if (msg === 'Action already in progress')");
    expect(src).toMatch(/onlineActionInFlight[\s\S]*return;/);
  });
});
