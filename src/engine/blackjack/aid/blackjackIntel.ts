/**
 * Structured blackjack knowledge pool for local AID reasoning.
 * Concise extracted facts — not raw source text.
 */

export interface StrategyFact {
  id: string;
  topic: string;
  summary: string;
}

export const HARD_HAND_STRATEGY: StrategyFact[] = [
  { id: 'hard-8-below', topic: 'Hard 8 or less', summary: 'Always hit — cannot bust on one card.' },
  { id: 'hard-9', topic: 'Hard 9', summary: 'Double vs dealer 3–6 if allowed; otherwise hit. Vs strong dealer (7–A), hit.' },
  { id: 'hard-10-11', topic: 'Hard 10–11', summary: 'Strong doubling totals — double vs dealer 2–9/10 when allowed; hit if double unavailable.' },
  { id: 'hard-12', topic: 'Hard 12', summary: 'Stand vs dealer 4–6 (dealer likely busts); hit vs 2–3 and 7–A.' },
  { id: 'hard-13-16', topic: 'Hard 13–16', summary: 'Stand vs dealer 2–6; hit vs 7–A — stiff hands lose often to strong up-cards.' },
  { id: 'hard-17-plus', topic: 'Hard 17+', summary: 'Always stand — high bust risk if hitting.' },
];

export const SOFT_HAND_STRATEGY: StrategyFact[] = [
  { id: 'soft-13-17', topic: 'Soft 13–17 (A-2 through A-6)', summary: 'Hit or double vs weak dealer (3–6); hit vs strong dealer.' },
  { id: 'soft-18', topic: 'Soft 18 (A-7)', summary: 'Stand vs 2, 7, 8; double vs 3–6; hit vs 9, 10, Ace.' },
  { id: 'soft-19-plus', topic: 'Soft 19+', summary: 'Stand — strong totals with low bust risk.' },
];

export const PAIR_STRATEGY: StrategyFact[] = [
  { id: 'pair-aces', topic: 'Pair of Aces', summary: 'Always split — one card each; aim for two strong hands.' },
  { id: 'pair-8s', topic: 'Pair of 8s', summary: 'Always split — 16 is a weak total; two chances at 18+.' },
  { id: 'pair-10s', topic: 'Pair of 10s / face cards', summary: 'Never split — 20 is premium; splitting throws away a winning total.' },
  { id: 'pair-9s', topic: 'Pair of 9s', summary: 'Split vs 2–9 except 7; stand vs 7, 10, Ace.' },
  { id: 'pair-7s', topic: 'Pair of 7s', summary: 'Split vs 2–7; hit vs 8–A.' },
  { id: 'pair-6s', topic: 'Pair of 6s', summary: 'Split vs 2–6; hit vs 7–A.' },
  { id: 'pair-4s', topic: 'Pair of 4s', summary: 'Split only vs 5–6; otherwise hit.' },
  { id: 'pair-2-3', topic: 'Pair of 2s or 3s', summary: 'Split vs 2–7; hit vs 8–A.' },
];

export const DOUBLE_STRATEGY: StrategyFact[] = [
  { id: 'double-when', topic: 'When to double', summary: 'Maximize expected value on 9, 10, 11 and soft hands vs weak dealer cards (3–6).' },
  { id: 'double-vs-ace', topic: 'Double vs Ace', summary: 'Usually poor — dealer likely makes 17–21; prefer hit on 9 vs Ace even if double is legal.' },
  { id: 'double-one-card', topic: 'After double', summary: 'Exactly one card is drawn — no further hits on that hand.' },
];

export const INSURANCE_LOGIC: StrategyFact[] = [
  { id: 'ins-what', topic: 'What insurance is', summary: 'Side bet when dealer shows Ace — not part of main hand outcome.' },
  { id: 'ins-max', topic: 'Insurance limit', summary: 'Maximum half of main bet (rounded down).' },
  { id: 'ins-pay', topic: 'Insurance payout', summary: 'Pays 2:1 if dealer has natural blackjack (Ace + ten-value).' },
  { id: 'ins-basic', topic: 'Basic strategy', summary: 'Decline insurance without counting — house edge is high on average.' },
  { id: 'ins-rich-tens', topic: 'Counting context', summary: 'Consider insurance only when shoe is rich in ten-value cards (high true count).' },
  { id: 'ins-even-money', topic: 'Even money', summary: 'Taking insurance on player blackjack equals even money — same math as 1:1 payout.' },
];

export const DEALER_UPCARD_STRENGTH: StrategyFact[] = [
  { id: 'dealer-2-6', topic: 'Dealer 2–6', summary: 'Weak up-cards — dealer busts more often; stand on stiff totals, split aggressively.' },
  { id: 'dealer-7-9', topic: 'Dealer 7–9', summary: 'Medium strength — dealer likely makes 17–19.' },
  { id: 'dealer-10-a', topic: 'Dealer 10 or Ace', summary: 'Strong up-cards — dealer likely makes 17–21; hit stiff hands, decline insurance without count.' },
];

export const HILO_COUNT_BASICS: StrategyFact[] = [
  { id: 'hilo-tags', topic: 'Hi-Lo tags', summary: 'Low cards 2–6: +1; neutral 7–9: 0; high 10–A: −1.' },
  { id: 'hilo-running', topic: 'Running count', summary: 'Sum tags as cards are exposed from the shoe.' },
  { id: 'hilo-true', topic: 'True count', summary: 'Running count divided by decks remaining — scales advantage estimate.' },
  { id: 'hilo-use', topic: 'Practical use', summary: 'Higher true count favors player — larger bets and occasional insurance deviation.' },
];

export const PROBABILITY_NOTES: StrategyFact[] = [
  { id: 'prob-bust-dealer', topic: 'Dealer bust', summary: 'Dealer busts most often with up-cards 5 and 6 in multi-deck games.' },
  { id: 'prob-bj-natural', topic: 'Natural frequency', summary: 'Natural blackjack occurs roughly 4–5% of hands in a full shoe.' },
  { id: 'prob-ten', topic: 'Ten density', summary: 'About 30% of cards are ten-value in a standard deck — drives dealer strength on 10/A up-cards.' },
];

export const COMMON_WARNINGS: StrategyFact[] = [
  { id: 'warn-never-hit-21', topic: 'Natural 21', summary: 'Never hit on blackjack or any 21 — hand is complete.' },
  { id: 'warn-split-tens', topic: 'Splitting tens', summary: 'Splitting 10-value pairs is a classic mistake — 20 wins often.' },
  { id: 'warn-insurance-habit', topic: 'Insurance habit', summary: 'Insurance is profitable for the house under basic strategy — not a safety net.' },
  { id: 'warn-chase-losses', topic: 'Bet sizing', summary: 'Increase bets only with discipline and agreed table limits — not emotion.' },
  { id: 'warn-soft-double', topic: 'Soft doubles', summary: 'Doubling soft hands targets weak dealer cards — avoid doubling into strong up-cards.' },
];

export const BLACKJACK_INTEL = {
  hardHand: HARD_HAND_STRATEGY,
  softHand: SOFT_HAND_STRATEGY,
  pairs: PAIR_STRATEGY,
  doubles: DOUBLE_STRATEGY,
  insurance: INSURANCE_LOGIC,
  dealerUpcard: DEALER_UPCARD_STRENGTH,
  hiLo: HILO_COUNT_BASICS,
  probability: PROBABILITY_NOTES,
  warnings: COMMON_WARNINGS,
} as const;

export function findIntelByTopic(topicIncludes: string): StrategyFact | undefined {
  const all = [
    ...HARD_HAND_STRATEGY,
    ...SOFT_HAND_STRATEGY,
    ...PAIR_STRATEGY,
    ...DOUBLE_STRATEGY,
    ...INSURANCE_LOGIC,
    ...DEALER_UPCARD_STRENGTH,
    ...COMMON_WARNINGS,
  ];
  const needle = topicIncludes.toLowerCase();
  return all.find((f) => f.topic.toLowerCase().includes(needle) || f.id.includes(needle));
}
