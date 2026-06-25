import { describe, expect, it } from 'vitest';
import { createNewBlackjackTable, createNewZilchTable } from '../engine/session';
import {
  createFreshSetupDraft,
  goBackFromCardGame,
  goBackFromMode,
  isBlackjackSetupDraft,
  isHoldemSetupDraft,
  isZilchSetupDraft,
  prepareTableStateForSetupConfirm,
  selectCardGame,
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

  it('selecting Cards advances to card game step', () => {
    const draft = selectCategoryCards(createFreshSetupDraft('menu-new-table'));
    expect(draft.category).toBe('cards');
    expect(draft.cardGame).toBeNull();
    expect(draft.diceGame).toBeNull();
    expect(draft.step).toBe('cardGame');
  });

  it('selecting Blackjack under Cards advances to mode', () => {
    const draft = selectCardGame(selectCategoryCards(createFreshSetupDraft('root')), 'blackjack');
    expect(draft.cardGame).toBe('blackjack');
    expect(isBlackjackSetupDraft(draft)).toBe(true);
    expect(draft.step).toBe('mode');
  });

  it('selecting Holdem under Cards advances to mode', () => {
    const draft = selectCardGame(selectCategoryCards(createFreshSetupDraft('root')), 'holdem');
    expect(draft.cardGame).toBe('holdem');
    expect(isHoldemSetupDraft(draft)).toBe(true);
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
    draft = selectCardGame(draft, 'blackjack');
    expect(isBlackjackSetupDraft(draft)).toBe(true);
    expect(isZilchSetupDraft(draft)).toBe(false);
    expect(draft.diceGame).toBeNull();
  });

  it('goBackFromCardGame returns to category', () => {
    const draft = goBackFromCardGame(selectCategoryCards(createFreshSetupDraft('root')));
    expect(draft.step).toBe('category');
    expect(draft.category).toBeNull();
  });

  it('prepareTableStateForSetupConfirm clears stale zilch when switching to blackjack', () => {
    let state = createNewZilchTable();
    state = {
      ...state,
      zilch: state.zilch ?? null,
      tableMeta: { ...state.tableMeta, gameCategory: 'dice', diceGame: 'zilch' },
    };
    const draft = selectMode(
      selectCardGame(selectCategoryCards(createFreshSetupDraft('reset-table')), 'blackjack'),
      'practice',
    );
    const next = prepareTableStateForSetupConfirm(state, draft);
    expect(next.tableGame).toBe('blackjack');
    expect(next.session.gameType).toBe('blackjack');
    expect(next.zilch).toBeNull();
    expect(next.tableMeta.diceGame).toBeUndefined();
    expect(next.tableMeta.cardGame).toBe('blackjack');
  });

  it('prepareTableStateForSetupConfirm clears stale blackjack when switching to holdem', () => {
    const state = createNewBlackjackTable();
    const draft = selectMode(
      selectCardGame(selectCategoryCards(createFreshSetupDraft('reset-table')), 'holdem'),
      'practice',
    );
    const next = prepareTableStateForSetupConfirm(state, draft);
    expect(next.tableGame).toBe('texas-holdem');
    expect(next.session.gameType).toBe('texas-holdem');
    expect(next.blackjack).toBeNull();
    expect(next.tableMeta.cardGame).toBe('holdem');
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
