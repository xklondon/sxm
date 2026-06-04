import { describe, expect, it } from 'vitest';
import {
  isNaturalInitialDeal,
  isStagedInitialDeal,
  isStepwiseInitialDeal,
} from './dealingModes';
import { dealCardsFromState, shuffleToStartOnState } from '../gameState';
import { tableAfterStartPlaying, boxPlayerId } from '../sanity/fixtures';
import { claimBoxSlot } from '../../session/boxOps';
import { addChipToBoxStake } from '../stakes';
import { clearTableUiEphemeral } from '../../session/inviteJoin';

describe('initial deal modes', () => {
  it('natural and instant are not staged engine deals', () => {
    expect(isStagedInitialDeal('natural')).toBe(false);
    expect(isStagedInitialDeal('instant')).toBe(false);
    expect(isStagedInitialDeal('staged')).toBe(true);
    expect(isStepwiseInitialDeal('natural')).toBe(false);
  });

  it('natural mode completes deal without initial-deal status', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = addChipToBoxStake(state, boxPlayerId(state, 1)!, 50);
    state = shuffleToStartOnState(state);
    state = clearTableUiEphemeral({
      ...state,
      tableMeta: { ...state.tableMeta, bettingLocked: true },
      blackjackFlowSettings: { ...state.blackjackFlowSettings, initialDealMode: 'natural' },
    });
    const dealt = dealCardsFromState(state);
    expect(dealt.blackjack?.status).not.toBe('initial-deal');
    expect(isNaturalInitialDeal(dealt.blackjackFlowSettings.initialDealMode)).toBe(true);
  });

  it('staged mode leaves round in initial-deal until completed', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = addChipToBoxStake(state, boxPlayerId(state, 1)!, 50);
    state = shuffleToStartOnState(state);
    state = clearTableUiEphemeral({
      ...state,
      tableMeta: { ...state.tableMeta, bettingLocked: true },
      blackjackFlowSettings: { ...state.blackjackFlowSettings, initialDealMode: 'staged' },
    });
    const begun = dealCardsFromState(state);
    expect(begun.blackjack?.status).toBe('initial-deal');
  });
});
