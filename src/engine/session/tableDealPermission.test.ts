import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameState } from '../../types';
import { tableAfterStartPlaying, tableWithClaimedBox } from '../blackjack/sanity/fixtures';
import { canCurrentUserDealTable, canStartBlackjackDeal } from './tableDealPermission';

function withOwner(
  state: GameState,
  ownerPersonId: string | null,
): GameState {
  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      ownerPersonId,
      tableMode: state.tableMeta.tableMode ?? 'practice',
    },
  };
}

describe('canCurrentUserDealTable', () => {
  it('allows the table owner to deal', () => {
    const state = tableAfterStartPlaying(500);
    const ownerId = state.tableMeta.ownerPersonId!;
    expect(canCurrentUserDealTable(state, ownerId)).toBe(true);
  });

  it('denies non-owner seated players', () => {
    const state = tableAfterStartPlaying(500);
    const ownerId = state.tableMeta.ownerPersonId!;
    const guestId = Object.keys(state.players).find((id) => id !== ownerId)!;
    expect(canCurrentUserDealTable(state, guestId)).toBe(false);
  });

  it('allows challenge table owner regardless of bank assignment', () => {
    let state = tableWithClaimedBox(1);
    const ownerId = state.tableMeta.ownerPersonId!;
    const bankId = state.session.bankPlayerId!;
    state = {
      ...state,
      tableMeta: { ...state.tableMeta, tableMode: 'challenge', ownerPersonId: ownerId },
    };
    expect(ownerId).not.toBe(bankId);
    expect(canCurrentUserDealTable(state, ownerId)).toBe(true);
    expect(canCurrentUserDealTable(state, bankId)).toBe(false);
  });

  it('allows practice table owner', () => {
    const state = tableAfterStartPlaying(500);
    const ownerId = state.tableMeta.ownerPersonId!;
    expect(canCurrentUserDealTable(
      { ...state, tableMeta: { ...state.tableMeta, tableMode: 'practice' } },
      ownerId,
    )).toBe(true);
  });

  it('denies bank player who is not table owner', () => {
    let state = tableAfterStartPlaying(500);
    const bankId = state.session.bankPlayerId!;
    const guestOwner = Object.keys(state.players).find((id) => id !== bankId)!;
    state = withOwner(state, guestOwner);
    expect(canCurrentUserDealTable(state, bankId)).toBe(false);
  });

  it('stays disabled until ownerPersonId hydrates, then enables owner', () => {
    const state = tableAfterStartPlaying(500);
    const ownerId = state.tableMeta.ownerPersonId!;
    const loading = withOwner(state, null);
    expect(canCurrentUserDealTable(loading, ownerId)).toBe(false);
    expect(canCurrentUserDealTable(withOwner(state, ownerId), ownerId)).toBe(true);
  });

  it('denies spectators with no viewer person id', () => {
    const state = tableAfterStartPlaying(500);
    expect(canCurrentUserDealTable(state, null)).toBe(false);
  });

  it('canStartBlackjackDeal requires host and eligible stakes', () => {
    const state = tableAfterStartPlaying(500);
    const ownerId = state.tableMeta.ownerPersonId!;
    expect(canStartBlackjackDeal(state, ownerId)).toBe(false);
    expect(canStartBlackjackDeal(state, null)).toBe(false);
  });
});

describe('DealerBlock deal permission wiring', () => {
  it('gates New Cards on canUserDealTable only (not engine canDeal)', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/DealerBlock.tsx'), 'utf8');
    const newCardsBlock = src.match(
      /protocolPhase === 'round-complete'[\s\S]*?onClick: onNextRound,\s*\};/,
    )?.[0];
    expect(newCardsBlock).toBeTruthy();
    expect(newCardsBlock).toContain('canUserDealTable');
    expect(newCardsBlock).not.toContain('canDeal');
  });
});
