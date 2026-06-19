import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameState } from '../types';
import { BlackjackPanel } from './BlackjackPanel';
import { CardViewDesktopHeroArea } from './CardViewDesktopHeroArea';
import {
  getCardViewHeroHandKey,
  getCardViewHeroBoxId,
} from './blackjackViewPhase';
import {
  splitBlackjackOnState,
  standBlackjackOnState,
  blackjackHandKey,
  listHandKeysForPlayer,
} from '../engine/blackjack';
import { claimBoxSlot } from '../engine/session';
import { setPersonPlayFlow } from '../engine/blackjack/playFlow';
import { getCallerPersonIdForBox } from '../engine/session/playerAssignment';
import { tableAfterStartPlaying, boxPlayerId, findCardId } from '../engine/blackjack/sanity/fixtures';
import { createBlackjackShoe, shuffleBlackjackShoe } from '../engine/blackjack/shoe';
import type { Deck, Rank } from '../types/deck';
import { actingRound } from '../engine/blackjack/sanity/fixtures';

const noop = () => undefined;

function deckWithNextDrawRanks(deck: Deck, ranks: Rank[]): Deck {
  const usedIds = new Set<string>();
  const indices = ranks.map((rank) => {
    const card = deck.cards.find((c) => c.rank === rank && !usedIds.has(c.id));
    if (!card) {
      throw new Error(`Card not found for draw order: ${rank}`);
    }
    usedIds.add(card.id);
    return deck.cards.findIndex((c) => c.id === card.id);
  });
  const used = new Set(indices);
  return {
    ...deck,
    drawOrder: [...deck.drawOrder.filter((i) => !used.has(i)), ...indices.slice().reverse()],
  };
}

function splitPlayingState(view: 'full' | 'card'): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const boxId = boxPlayerId(state, 1)!;
  let deck = shuffleBlackjackShoe(createBlackjackShoe(6), 'card-view-desktop-split');
  deck = deckWithNextDrawRanks(deck, ['2', '3']);
  state = { ...state, deck, tableViewMode: view };
  const sixA = findCardId(deck, '6', 'spades');
  const sixB = deck.cards.find((c) => c.rank === '6' && c.id !== sixA)!.id;
  const handKey = blackjackHandKey(boxId, 0);
  const round = actingRound(state, boxId, [sixA, sixB], 25);
  state = {
    ...state,
    blackjack: {
      ...round,
      status: 'player-turns',
      activeHandKey: handKey,
      activePlayerId: boxId,
    },
  };
  const ownerId = getCallerPersonIdForBox(state, boxId)!;
  state = setPersonPlayFlow(state, ownerId, 'manual');
  return splitBlackjackOnState(state, handKey);
}

describe('Desktop Card View split presentation', () => {
  it('engine split uses handIndex on same box — no physical temp box in tableMeta', () => {
    const state = splitPlayingState('card');
    const boxId = boxPlayerId(state, 1)!;
    const keys = listHandKeysForPlayer(state.blackjack!.playerHands, boxId);
    expect(keys).toHaveLength(2);
    expect(state.tableMeta.boxSlots.filter((s) => s.playerId === boxId)).toHaveLength(1);
    for (const key of keys) {
      expect(state.blackjack!.playerHands[key]!.currentBet).toBe(25);
    }
  });

  it('hero hand key follows activeHandKey through split advance', () => {
    let state = splitPlayingState('card');
    const boxId = boxPlayerId(state, 1)!;
    const keys = listHandKeysForPlayer(state.blackjack!.playerHands, boxId);
    const firstKey = keys[0]!;
    const secondKey = keys[1]!;
    expect(getCardViewHeroHandKey('player', state.blackjack, boxId)).toBe(firstKey);
    state = standBlackjackOnState(state, firstKey);
    expect(state.blackjack!.activeHandKey).toBe(secondKey);
    expect(getCardViewHeroHandKey('player', state.blackjack, boxId)).toBe(secondKey);
    expect(getCardViewHeroBoxId('player', boxId, null, null)).toBe(boxId);
  });

  it('CardViewDesktopHeroArea renders only active split hand cards', () => {
    let state = splitPlayingState('card');
    const boxId = boxPlayerId(state, 1)!;
    const keys = listHandKeysForPlayer(state.blackjack!.playerHands, boxId);
    const firstKey = keys[0]!;
    const secondKey = keys[1]!;
    const deck = state.deck!;

    const firstHtml = renderToStaticMarkup(
      createElement(CardViewDesktopHeroArea, {
        gameState: state,
        activeBoxId: boxId,
        protocolPhase: 'player',
        gameEnded: false,
      }),
    );
    const firstCards = state.blackjack!.playerHands[firstKey]!.cardIds.map(
      (id) => deck.cards.find((c) => c.id === id)!,
    );
    expect(firstHtml).toContain('data-layout-band="hero-cards"');
    expect(firstHtml).not.toContain('data-layout-band="hero-value"');
    expect(firstHtml).not.toContain('bj-card-view__hero-value');
    for (const card of firstCards) {
      expect(firstHtml).toContain(`aria-label="${card.rank} of`);
    }

    state = standBlackjackOnState(state, firstKey);
    const secondHtml = renderToStaticMarkup(
      createElement(CardViewDesktopHeroArea, {
        gameState: state,
        activeBoxId: boxId,
        protocolPhase: 'player',
        gameEnded: false,
      }),
    );
    const secondCards = state.blackjack!.playerHands[secondKey]!.cardIds.map(
      (id) => deck.cards.find((c) => c.id === id)!,
    );
    for (const card of secondCards) {
      expect(secondHtml).toContain(`aria-label="${card.rank} of`);
    }
    expect(secondHtml).not.toContain(`aria-label="${firstCards[0]!.rank} of ${firstCards[0]!.suit}`);
  });

  it('desktop Card View panel renders split companion inside cluster left of main box', () => {
    const state = splitPlayingState('card');
    const html = renderToStaticMarkup(
      createElement(BlackjackPanel, { gameState: state, onGameStateChange: noop }),
    );
    expect(html).toContain('bj-arc__slot--split-host');
    expect(html).toContain('bj-arc__slot-split-cluster');
    expect(html).toContain('bj-arc__split-companion-tile');
    expect(html).toContain('data-split-hand-key');
    const clusterIdx = html.indexOf('bj-arc__slot-split-cluster');
    const companionIdx = html.indexOf('bj-arc__split-companion-tile', clusterIdx);
    const mainIdx = html.indexOf('bj-arc__slot-split-main', clusterIdx);
    expect(clusterIdx).toBeGreaterThan(-1);
    expect(companionIdx).toBeGreaterThan(clusterIdx);
    expect(mainIdx).toBeGreaterThan(companionIdx);
  });

  it('desktop Full Table panel nests split companion without extra grid slots', () => {
    const state = splitPlayingState('full');
    const html = renderToStaticMarkup(
      createElement(BlackjackPanel, { gameState: state, onGameStateChange: noop }),
    );
    expect(html).toContain('bj-arc__slot--split-host');
    expect(html).toContain('bj-arc__slot--card-split');
    expect(html).toContain('bj-arc__split-hand--active');
    const clusterIdx = html.indexOf('bj-arc__slot-split-cluster');
    const companionIdx = html.indexOf('bj-arc__split-companion-tile', clusterIdx);
    const mainIdx = html.indexOf('bj-arc__slot-split-main', clusterIdx);
    expect(companionIdx).toBeGreaterThan(clusterIdx);
    expect(mainIdx).toBeGreaterThan(companionIdx);
    const playerBoxesIdx = html.indexOf('bj-arc--player-boxes');
    const beforePlayerBoxes = html.slice(0, playerBoxesIdx);
    expect(beforePlayerBoxes).not.toContain('bj-arc__split-companion-tile');
  });
});
