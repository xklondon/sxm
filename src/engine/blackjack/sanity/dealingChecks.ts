import { buildInitialDealPlanFromHandKeys } from '../initialDeal';
import { buildNaturalDealSequence } from '../dealing/naturalDealSequence';
import { getBettingPlayerIds } from '../helpers';
import { createEmptySession } from '../../../types/session';
import { createEmptyBlackjackRound } from '../../../types/blackjack';
import { check, type SanitySuiteResult } from './types';

export function runDealingSanityChecks(): SanitySuiteResult {
  const results = [];

  results.push(
    check(
      'RTL turn order: slot 1 before slot 2',
      getBettingPlayerIds({
        ...createEmptySession('bj'),
        playerIds: ['a', 'b', 'c'],
        bankPlayerId: 'b',
        boxSlotNumbers: { a: 2, c: 1 },
      }).join(',') === 'c,a',
    ),
  );

  const handKeys = ['boxSlot2:0', 'boxSlot1:0'];
  const plan = buildInitialDealPlanFromHandKeys(handKeys);
  const labels = plan.map((step) =>
    step.type === 'dealer'
      ? `dealer:${step.cardIndex}`
      : `${step.handKey}:${step.cardIndex}`,
  );

  results.push(
    check(
      'initial deal: all box first cards before dealer up-card',
      labels[0] === 'boxSlot2:0:0' &&
        labels[1] === 'boxSlot1:0:0' &&
        labels[2] === 'dealer:0',
      labels.join(' → '),
    ),
  );

  results.push(
    check(
      'initial deal: second pass box then dealer hole',
      labels[3] === 'boxSlot2:0:1' &&
        labels[4] === 'boxSlot1:0:1' &&
        labels[5] === 'dealer:1',
      labels.join(' → '),
    ),
  );

  results.push(check('initial deal plan has six steps for two boxes', plan.length === 6));

  const session = {
    ...createEmptySession('deal'),
    playerIds: ['boxSlot2', 'boxSlot1', 'bank'],
    bankPlayerId: 'bank',
    boxSlotNumbers: { 'boxSlot2': 2, 'boxSlot1': 1 },
  };
  const round = {
    ...createEmptyBlackjackRound(),
    initialDealHandKeys: handKeys,
    playerHands: {
      'boxSlot2:0': {
        playerId: 'boxSlot2',
        handIndex: 0,
        cardIds: [],
        currentBet: 10,
        actionStatus: 'betting' as const,
        doubled: false,
        fromSplit: false,
      },
      'boxSlot1:0': {
        playerId: 'boxSlot1',
        handIndex: 0,
        cardIds: [],
        currentBet: 10,
        actionStatus: 'betting' as const,
        doubled: false,
        fromSplit: false,
      },
    },
  };

  const natural = buildNaturalDealSequence(session, round);
  results.push(
    check(
      'natural deal sequence matches initial deal plan length',
      natural.length === plan.length,
    ),
  );
  results.push(
    check(
      'natural deal sequence is one card per step',
      natural.every((s) => s.stepIndex >= 0 && s.label.length > 0),
    ),
  );

  return { passed: results.every((r) => r.passed), results };
}
