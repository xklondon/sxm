import type { Deck } from '../../types/deck';
import {
  createStandardDeck,
  drawCard,
  drawCards,
  getRemainingCardCount,
  shuffleDeck,
} from './deck';

export interface DeckValidationIssue {
  code: string;
  message: string;
}

export function validateDeck(deck: Deck): { valid: boolean; issues: DeckValidationIssue[] } {
  const issues: DeckValidationIssue[] = [];

  if (deck.cards.length !== 52) {
    issues.push({
      code: 'card-count',
      message: `Expected 52 cards, found ${deck.cards.length}`,
    });
  }

  const ids = deck.cards.map((c) => c.id);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    issues.push({
      code: 'duplicate-ids',
      message: 'Deck contains duplicate card ids',
    });
  }

  for (const index of deck.drawOrder) {
    if (index < 0 || index >= deck.cards.length) {
      issues.push({
        code: 'invalid-draw-index',
        message: `Draw order contains invalid index: ${index}`,
      });
    }
  }

  const drawIndices = new Set(deck.drawOrder);
  if (drawIndices.size !== deck.drawOrder.length) {
    issues.push({
      code: 'duplicate-draw-index',
      message: 'Draw order contains duplicate indices',
    });
  }

  const dealtSet = new Set(deck.dealtCardIds);
  if (dealtSet.size !== deck.dealtCardIds.length) {
    issues.push({
      code: 'duplicate-dealt',
      message: 'Dealt card ids contain duplicates',
    });
  }

  for (const dealtId of deck.dealtCardIds) {
    const card = deck.cards.find((c) => c.id === dealtId);
    if (!card) {
      issues.push({
        code: 'unknown-dealt-id',
        message: `Dealt card id not in deck: ${dealtId}`,
      });
    }
  }

  const remainingIds = new Set(
    deck.drawOrder.map((i) => deck.cards[i]?.id).filter(Boolean),
  );
  for (const dealtId of deck.dealtCardIds) {
    if (remainingIds.has(dealtId)) {
      issues.push({
        code: 'dealt-in-remaining',
        message: `Dealt card still in draw order: ${dealtId}`,
      });
    }
  }

  const totalAccounted = deck.drawOrder.length + deck.dealtCardIds.length;
  if (deck.cards.length === 52 && totalAccounted !== 52) {
    issues.push({
      code: 'card-accounting',
      message: `Remaining + dealt (${totalAccounted}) does not equal 52`,
    });
  }

  return { valid: issues.length === 0, issues };
}

export interface DeckCheckResult {
  name: string;
  passed: boolean;
  detail?: string;
}

export function runDeckEngineChecks(): { passed: boolean; results: DeckCheckResult[] } {
  const results: DeckCheckResult[] = [];

  const fresh = createStandardDeck();
  const freshValid = validateDeck(fresh);
  results.push({
    name: 'standard deck has 52 cards',
    passed: fresh.cards.length === 52 && freshValid.valid,
    detail: freshValid.valid ? undefined : freshValid.issues[0]?.message,
  });

  const shuffled = shuffleDeck(fresh, 'test-seed');
  const shuffledValid = validateDeck(shuffled);
  const shuffledIds = new Set(shuffled.cards.map((c) => c.id));
  results.push({
    name: 'shuffled deck still has 52 unique cards',
    passed:
      shuffled.cards.length === 52 &&
      shuffledIds.size === 52 &&
      shuffledValid.valid,
  });

  const seededA = shuffleDeck(createStandardDeck(), 42);
  const seededB = shuffleDeck(createStandardDeck(), 42);
  const orderA = seededA.drawOrder.join(',');
  const orderB = seededB.drawOrder.join(',');
  results.push({
    name: 'seeded shuffle is deterministic',
    passed: orderA === orderB,
  });

  const beforeCount = getRemainingCardCount(shuffled);
  const drawOne = drawCard(shuffled);
  results.push({
    name: 'drawing 1 card reduces remaining count by 1',
    passed:
      drawOne.card !== null &&
      getRemainingCardCount(drawOne.deck) === beforeCount - 1,
  });

  let drained = createStandardDeck();
  drained = shuffleDeck(drained, 'drain-test');
  let drawCount = 0;
  while (getRemainingCardCount(drained) > 0) {
    const next = drawCard(drained);
    drained = next.deck;
    if (next.card) {
      drawCount += 1;
    }
  }
  const drainedValid = validateDeck(drained);
  results.push({
    name: 'drawing all cards leaves no duplicates',
    passed: drawCount === 52 && drainedValid.valid,
    detail: `drew ${drawCount} cards`,
  });

  const multi = drawCards(shuffleDeck(createStandardDeck(), 'multi'), 5);
  results.push({
    name: 'drawCards returns requested count when available',
    passed: multi.cards.length === 5 && getRemainingCardCount(multi.deck) === 47,
  });

  const passed = results.every((r) => r.passed);
  return { passed, results };
}
