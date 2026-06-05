import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameState } from '../types';
import { BlackjackCardView } from './BlackjackCardView';
import { createBlackjackPlayerHand, createEmptyBlackjackRound } from '../types/blackjack';
import { tableAfterStartPlaying, boxPlayerId, findCardId } from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import { addChipToBoxStake, blackjackHandKey } from '../engine/blackjack';

const noop = () => {};

function renderCardView(state: GameState): string {
  return renderToStaticMarkup(
    <BlackjackCardView
      gameState={state}
      activeBoxId={state.blackjack?.activePlayerId ?? null}
      showHoleHidden={false}
      protocolPhase={
        state.blackjack?.status === 'bank-turn'
          ? 'bank'
          : state.blackjack?.status === 'player-turns'
            ? 'player'
            : 'betting'
      }
      bettingOpen={false}
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

describe('Card View dealer vs hero', () => {
  it('never renders dealer cards in hero during bank turn', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const deck = state.deck!;
    const boxId = boxPlayerId(state, 1)!;
    const handKey = blackjackHandKey(boxId, 0);
    state = {
      ...state,
      blackjack: {
        ...createEmptyBlackjackRound(),
        status: 'bank-turn',
        activeHandKey: null,
        activePlayerId: null,
        dealerCardIds: [findCardId(deck, 'A'), findCardId(deck, '7')],
        dealerHoleHidden: false,
        playerHands: {
          [handKey]: {
            ...createBlackjackPlayerHand(boxId, 0),
            cardIds: [findCardId(deck, '10'), findCardId(deck, '9')],
            currentBet: 50,
            actionStatus: 'stood',
          },
        },
        insuranceOfferPending: false,
        evenMoneyOfferHandKey: null,
      },
    };
    const html = renderCardView(state);
    expect(html).not.toContain('bj-phone-view__cards--bank');
    expect(html).not.toContain('bj-phone-view__bank-hero');
    expect(html).toContain('bj-phone-view__cards--stitched');
    expect(html).toContain('Total 19');
  });

  it('shows hero placeholder when betting with no active hand cards', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const boxId = boxPlayerId(state, 1)!;
    state = addChipToBoxStake(state, boxId, 10);
    state = { ...state, selectedSeatId: boxId };
    const html = renderToStaticMarkup(
      <BlackjackCardView
        gameState={state}
        activeBoxId={null}
        showHoleHidden={false}
        protocolPhase="betting"
        bettingOpen
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
    expect(html).toContain('bj-phone-view__hand--waiting');
    expect(html).toContain('bj-phone-view__cards-placeholder');
    expect(html).not.toContain('bj-phone-view__cards--bank');
  });
});
