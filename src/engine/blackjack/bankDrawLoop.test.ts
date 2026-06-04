import { describe, expect, it } from 'vitest';

import type { BlackjackRound } from '../../types/blackjack';
import { createEmptyBlackjackRound } from '../../types/blackjack';
import { cardsFromIds, getBlackjackHandValue } from './hand';
import { evaluateDealerDraw } from './dealerDraw';
import {
  drawSingleBankCard,
  enterBankingIfComplete,
} from './bankTurn';
import {
  LAS_VEGAS_PROTOCOL,
  protocolToBlackjackSettings,
} from './protocols';
import { baseTestTable, findCardId } from './sanity/fixtures';

function dealerRound(dealerCardIds: string[]): BlackjackRound {
  return {
    ...createEmptyBlackjackRound(),
    status: 'bank-turn',
    dealerCardIds,
    dealerHoleHidden: false,
  };
}

describe('dealer bank draw loop', () => {
  const table = baseTestTable();
  const deck = table.deck!;
  const session = table.session;
  const players = table.players;
  const settings = protocolToBlackjackSettings(LAS_VEGAS_PROTOCOL);

  it('draws sequentially until 17+ on hard totals', () => {
    const ids13 = [findCardId(deck, '8'), findCardId(deck, '5')];
    let round = dealerRound(ids13);
    let currentDeck = deck;
    let draws = 0;
    let guard = 0;

    while (round.status === 'bank-turn' && guard < 8) {
      guard += 1;
      const result = drawSingleBankCard(
        session,
        players,
        currentDeck,
        round,
        settings,
        LAS_VEGAS_PROTOCOL,
      );
      currentDeck = result.deck;
      round = result.round;
      if (result.cardId) {
        draws += 1;
      }
      if (result.complete) {
        break;
      }
    }

    const cards = cardsFromIds(currentDeck, round.dealerCardIds.filter(Boolean));
    const { value } = getBlackjackHandValue(cards);
    expect(value).toBeGreaterThanOrEqual(17);
    expect(draws).toBeGreaterThanOrEqual(1);
    expect(round.status).toBe('banking');
  });

  it('stands on soft 17 (S17)', () => {
    const ace = findCardId(deck, 'A');
    const six = findCardId(deck, '6');
    const cards = cardsFromIds(deck, [ace, six]);
    const decision = evaluateDealerDraw(cards, settings, LAS_VEGAS_PROTOCOL);
    expect(decision.shouldDraw).toBe(false);
    expect(decision.reason).toContain('S17');
  });

  it('drawSingleBankCard does not draw after dealer already stands', () => {
    const ace = findCardId(deck, 'A');
    const six = findCardId(deck, '6');
    const round = dealerRound([ace, six]);
    const result = drawSingleBankCard(
      session,
      players,
      deck,
      round,
      settings,
      LAS_VEGAS_PROTOCOL,
    );
    expect(result.cardId).toBeNull();
    expect(result.complete).toBe(true);
    expect(result.round.status).toBe('banking');
    expect(result.round.dealerCardIds.filter(Boolean).length).toBe(2);
  });

  it('enterBankingIfComplete is idempotent on settled dealer hand', () => {
    const ace = findCardId(deck, 'A');
    const six = findCardId(deck, '6');
    let round = dealerRound([ace, six]);
    round = enterBankingIfComplete(round, deck, settings, LAS_VEGAS_PROTOCOL, session);
    expect(round.status).toBe('banking');
    const again = enterBankingIfComplete(round, deck, settings, LAS_VEGAS_PROTOCOL, session);
    expect(again.status).toBe('banking');
    expect(again.dealerCardIds).toEqual(round.dealerCardIds);
  });
});
