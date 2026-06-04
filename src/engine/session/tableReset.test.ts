import { describe, expect, it } from 'vitest';
import { tableWithClaimedBox, boxPlayerId } from '../blackjack/sanity/fixtures';
import { claimBoxSlot } from './boxOps';
import { addChipToBoxStake } from '../blackjack/stakes';
import {
  startBlackjackRound,
  shuffleToStartOnState,
  dealCardsButtonOnState,
  completeStepwiseInitialDealIfNeeded,
} from '../blackjack/gameState';
import { hasPersonalLedgerEntryForTable } from '../scoreLedger/scoreLedger';
import { loadScoreLedgerEntries } from '../../storage/scoreLedgerStorage';
import { applyTableResetSetup, TABLE_RESET_LEDGER_MESSAGE } from './tableReset';
import { canUserResetTable } from '../table/adminControls';
import { parseTableStakeSetupPayload, type TableStakeSetupInput } from './tableSetup';

const setupInput: TableStakeSetupInput = {
  stakeDescription: 'New dinner wager',
  seatChips: 400,
  bankChips: 400,
  bankerMode: 'bot',
  bankerName: '',
  controllerName: 'Alice',
  controllerEmail: '',
  protocolId: 'las-vegas-house',
  naturalDealing: false,
  dealSpeedPreset: 'normal',
  cardTimerPreset: 0,
  bankDrawAuto: true,
};

function midGameTable() {
  let state = tableWithClaimedBox(1);
  const boxId = boxPlayerId(state, 1)!;
  state = startBlackjackRound(state);
  state = addChipToBoxStake(state, boxId, 10);
  state = addChipToBoxStake(state, boxId, 10);
  state = addChipToBoxStake(state, boxId, 5);
  state = shuffleToStartOnState(state);
  state = completeStepwiseInitialDealIfNeeded(dealCardsButtonOnState(state));
  expect(state.blackjack?.status).not.toBe('betting');
  return { state, boxId };
}

describe('applyTableResetSetup', () => {
  it('keeps the same table session id and box assignments', () => {
    let state = tableWithClaimedBox(1);
    state = claimBoxSlot(state, 3);
    const sessionId = state.session.id;
    const box1 = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.playerId;
    const box3 = state.tableMeta.boxSlots.find((s) => s.slotNumber === 3)?.playerId;

    const reset = applyTableResetSetup(state, setupInput, state.tableMeta.ownerPersonId);

    expect(reset.session.id).toBe(sessionId);
    expect(reset.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.playerId).toBe(box1);
    expect(reset.tableMeta.boxSlots.find((s) => s.slotNumber === 3)?.playerId).toBe(box3);
    expect(reset.tableMeta.invites).toEqual(state.tableMeta.invites);
  });

  it('clears active round and returns to betting-ready state', () => {
    const { state } = midGameTable();
    const reset = applyTableResetSetup(state, setupInput, state.tableMeta.ownerPersonId);

    expect(reset.blackjack).toBeNull();
    expect(reset.deck).toBeNull();
    expect(reset.tableMeta.boxStakes).toEqual({});
    expect(reset.tableMeta.bettingLocked).toBe(false);
    expect(reset.tableMeta.shoeStarted).toBe(false);
    expect(reset.tableMeta.awaitingNextRound).toBe(false);
    expect(reset.tableMeta.protocolLocked).toBe(false);
    expect(reset.tableMeta.agreement?.stakeDescription).toBe('New dinner wager');
    expect(reset.tableMeta.startingChipsEachSeat).toBe(400);
  });

  it('starts play ledger with a table reset note only', () => {
    const { state } = midGameTable();
    const beforeEntries = state.ledger.entries.length;
    expect(beforeEntries).toBeGreaterThan(0);

    const reset = applyTableResetSetup(state, setupInput, state.tableMeta.ownerPersonId);
    const resetEntries = reset.ledger.entries.filter((e) =>
      e.description.includes(TABLE_RESET_LEDGER_MESSAGE),
    );
    expect(resetEntries).toHaveLength(1);
    expect(resetEntries[0]!.entryType).toBe('manual-adjustment');
    expect(resetEntries[0]!.amount).toBe(0);
  });

  it('does not add a score ledger completion when resetting mid-game', () => {
    const { state } = midGameTable();
    const scoreBefore = loadScoreLedgerEntries().length;
    applyTableResetSetup(state, setupInput, state.tableMeta.ownerPersonId);
    expect(loadScoreLedgerEntries()).toHaveLength(scoreBefore);
    expect(hasPersonalLedgerEntryForTable(state.session.id)).toBe(false);
  });
});

describe('canUserResetTable', () => {
  it('allows table owner only', () => {
    const state = tableWithClaimedBox(1);
    expect(canUserResetTable(state, 'Alice')).toBe(true);
    expect(canUserResetTable(state, 'Bob')).toBe(false);
  });
});

describe('parseTableStakeSetupPayload', () => {
  it('parses resetTable action payload', () => {
    const input = parseTableStakeSetupPayload(
      {
        stakeDescription: 'Coffee',
        seatChips: 300,
        bankChips: 600,
        bankerMode: 'self',
        protocolId: 'european-shoe',
        naturalDealing: true,
        dealSpeedPreset: 'fast',
        cardTimerPreset: 10,
        bankDrawAuto: false,
      },
      'Alice',
    );
    expect(input.stakeDescription).toBe('Coffee');
    expect(input.seatChips).toBe(300);
    expect(input.bankChips).toBe(600);
    expect(input.bankerMode).toBe('self');
    expect(input.naturalDealing).toBe(true);
    expect(input.bankDrawAuto).toBe(false);
  });
});
