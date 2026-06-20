import { describe, expect, it } from 'vitest';
import { createNewBlackjackTable, createNewZilchTable } from '../engine/session';
import {
  createFreshSetupDraft,
  goBackFromMode,
  isBlackjackSetupDraft,
  isZilchSetupDraft,
  prepareTableStateForSetupConfirm,
  selectCategoryCards,
  selectCategoryDice,
  selectMode,
} from './tableSetupFlow';

describe('tableSetupFlow', () => {
  it('starts fresh with no category or game selected', () => {
    const draft = createFreshSetupDraft('root');
    expect(draft.step).toBe('category');
    expect(draft.category).toBeNull();
    expect(draft.cardGame).toBeNull();
    expect(draft.diceGame).toBeNull();
  });

  it('selecting Cards sets blackjack and advances to mode', () => {
    const draft = selectCategoryCards(createFreshSetupDraft('menu-new-table'));
    expect(draft.category).toBe('cards');
    expect(draft.cardGame).toBe('blackjack');
    expect(draft.diceGame).toBeNull();
    expect(draft.step).toBe('mode');
  });

  it('selecting Dice sets zilch and advances to mode', () => {
    const draft = selectCategoryDice(createFreshSetupDraft('root'));
    expect(draft.category).toBe('dice');
    expect(draft.diceGame).toBe('zilch');
    expect(draft.cardGame).toBeNull();
    expect(draft.step).toBe('mode');
  });

  it('mode click advances to settings without extra game step', () => {
    let draft = selectCategoryDice(createFreshSetupDraft('root'));
    draft = selectMode(draft, 'practice');
    expect(draft.mode).toBe('practice');
    expect(draft.step).toBe('settings');
  });

  it('switching category clears opposing game markers', () => {
    let draft = selectCategoryDice(createFreshSetupDraft('reset-table'));
    draft = goBackFromMode(draft);
    draft = selectCategoryCards(draft);
    expect(isBlackjackSetupDraft(draft)).toBe(true);
    expect(isZilchSetupDraft(draft)).toBe(false);
    expect(draft.diceGame).toBeNull();
  });

  it('prepareTableStateForSetupConfirm clears stale zilch when switching to blackjack', () => {
    let state = createNewZilchTable();
    state = {
      ...state,
      zilch: state.zilch ?? null,
      tableMeta: { ...state.tableMeta, gameCategory: 'dice', diceGame: 'zilch' },
    };
    const draft = selectMode(selectCategoryCards(createFreshSetupDraft('reset-table')), 'practice');
    const next = prepareTableStateForSetupConfirm(state, draft);
    expect(next.tableGame).toBe('blackjack');
    expect(next.session.gameType).toBe('blackjack');
    expect(next.zilch).toBeNull();
    expect(next.tableMeta.diceGame).toBeUndefined();
    expect(next.tableMeta.cardGame).toBe('blackjack');
  });

  it('prepareTableStateForSetupConfirm clears stale blackjack when switching to zilch', () => {
    const state = createNewBlackjackTable();
    const draft = selectMode(selectCategoryDice(createFreshSetupDraft('reset-table')), 'practice');
    const next = prepareTableStateForSetupConfirm(state, draft);
    expect(next.tableGame).toBe('zilch');
    expect(next.session.gameType).toBe('zilch');
    expect(next.blackjack).toBeNull();
    expect(next.tableMeta.diceGame).toBe('zilch');
    expect(next.tableMeta.cardGame).toBeUndefined();
  });
});
