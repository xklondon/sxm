import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameState } from '../types';
import { createBlackjackPlayerHand, createEmptyBlackjackRound } from '../types/blackjack';
import { BlackjackCardView } from './BlackjackCardView';
import {
  getCardViewHandKeyForBox,
  getCardViewHeroHandKey,
  showHeroPlayerCards,
} from './blackjackViewPhase';
import { tableAfterStartPlaying, boxPlayerId, findCardId } from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { addChipToBoxStake, blackjackHandKey } from '../engine/blackjack';
import { applyCardVisibility, maxVisibilityForRound } from '../engine/blackjack/dealing/cardRevealDisplay';

const noop = () => {};

function renderCardView(
  state: GameState,
  opts: {
    protocolPhase: 'betting' | 'player' | 'bank';
    activeBoxId?: string | null;
    logicalGameState?: GameState;
  },
): string {
  return renderToStaticMarkup(
    <BlackjackCardView
      gameState={state}
      logicalGameState={opts.logicalGameState ?? state}
      activeBoxId={opts.activeBoxId ?? state.blackjack?.activePlayerId ?? null}
      showHoleHidden={false}
      protocolPhase={opts.protocolPhase}
      bettingOpen={opts.protocolPhase === 'betting'}
      gameEnded={false}
      onSelectBox={noop}
      onClaimSlot={noop}
      onReleaseSlot={noop}
      onAddChip={noop}
      onClearStake={noop}
      onRemoveLastChip={noop}
      onSlotChipDrop={noop}
      onStay={noop}
      onCard={noop}
      onDouble={noop}
      onSplit={noop}
      onBack={noop}
    />,
  );
}

function playerTurnState(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const deck = state.deck!;
  const boxId = boxPlayerId(state, 1)!;
  const handKey = blackjackHandKey(boxId, 0);
  return {
    ...state,
    selectedSeatId: boxId,
    blackjack: {
      ...createEmptyBlackjackRound(),
      status: 'player-turns',
      activeHandKey: handKey,
      activePlayerId: boxId,
      dealerCardIds: [findCardId(deck, '7'), findCardId(deck, 'K')],
      dealerHoleHidden: true,
      playerHands: {
        [handKey]: {
          ...createBlackjackPlayerHand(boxId, 0),
          cardIds: [findCardId(deck, '5'), findCardId(deck, '4')],
          currentBet: 50,
          actionStatus: 'acting',
        },
      },
      insuranceOfferPending: false,
      evenMoneyOfferHandKey: null,
    },
  };
}

describe('Card View hero hand', () => {
  it('uses activeHandKey for hero and mini strip on player turn', () => {
    const state = playerTurnState();
    const boxId = boxPlayerId(state, 1)!;
    const handKey = state.blackjack!.activeHandKey!;
    expect(getCardViewHeroHandKey('player', state.blackjack, boxId)).toBe(handKey);
    expect(getCardViewHandKeyForBox('player', state.blackjack, boxId)).toBe(handKey);
  });

  it('renders hero stitched cards matching authoritative hand', () => {
    const state = playerTurnState();
    const html = renderCardView(state, { protocolPhase: 'player', activeBoxId: boxPlayerId(state, 1) });
    expect(html).toContain('bj-phone-view__cards--stitched');
    expect(html).toContain('Total 9');
    expect(html).not.toContain('bj-phone-view__cards--bank');
  });

  it('shows hero cards when natural reveal masks display but logical hand has cards', () => {
    const state = playerTurnState();
    const target = maxVisibilityForRound(state.blackjack);
    const masked = applyCardVisibility(state, {
      ...target,
      hands: { [state.blackjack!.activeHandKey!]: 0 },
    });
    const html = renderCardView(masked, {
      protocolPhase: 'player',
      activeBoxId: boxPlayerId(state, 1),
      logicalGameState: state,
    });
    expect(html).toContain('bj-phone-view__cards--stitched');
    expect(html).toContain('Total 9');
  });

  it('does not show player cards in hero during bank turn', () => {
    const state = playerTurnState();
    state.blackjack!.status = 'bank-turn';
    state.blackjack!.activeHandKey = null;
    expect(showHeroPlayerCards('bank', false, 2)).toBe(false);
    const html = renderCardView(state, { protocolPhase: 'bank', activeBoxId: boxPlayerId(state, 1) });
    expect(html).not.toContain('bj-phone-view__cards--stitched');
    expect(html).toContain('bj-phone-view__cards-placeholder');
  });

  it('betting placeholder is invisible in markup', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const boxId = boxPlayerId(state, 1)!;
    state = addChipToBoxStake(state, boxId, 10);
    state = { ...state, selectedSeatId: boxId };
    const html = renderCardView(state, { protocolPhase: 'betting', activeBoxId: null });
    expect(html).toContain('bj-phone-view__cards-placeholder');
    expect(html).toContain('bj-phone-view__hand--waiting');
    expect(html).not.toContain('bj-phone-view__cards--stitched');
  });
});
