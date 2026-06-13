import { describe, expect, it } from 'vitest';

import {
  resolvePersonDisplayBalances,
  resolveViewerTrayAvailable,
} from '../../components/blackjackAccountingDisplay';
import { buildTableInfoDisplay } from '../../components/tableInfoDisplay';
import { addChipToBoxStake } from '../blackjack/stakes';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import { addPlayer, mergeSessionUpdate } from './session';
import { allocateChipsToBankrollOwner } from './allocation';
import {
  getAvailableChipsForBankrollOwner,
  getLedgerBalanceForBankrollOwner,
} from './bankroll';
import { assignBankPerson, claimBoxSlot, ensureTableOwnerPersonBankroll } from './index';
import { confirmTableAgreement, createNewBlackjackTable } from './table';
import { setTableOwner } from './invites';
import { setControllerName } from './boxOps';
import {
  getSharedPotAvailableChips,
  personsShareOneChipPot,
  resolveCanonicalBankrollOwnerId,
  usesSharedBankPlayerPot,
} from './sharedBankroll';

function ownerAsBankPlayingTable(seatChips = 500) {
  let state = createNewBlackjackTable();
  state = confirmTableAgreement(state, 'Challenge', seatChips, seatChips);
  state = setTableOwner(state, 'Alice', '');
  state = setControllerName(state, 'Alice');
  state = assignBankPerson(state, 'Alice', seatChips);
  state = ensureTableOwnerPersonBankroll(state);
  const bankId = state.session.bankPlayerId!;
  const ownerId = state.tableMeta.ownerPersonId!;
  return { state, bankId, ownerId };
}

describe('shared bank-player pot', () => {
  it('detects owner and bank as one chip pot', () => {
    const { state, bankId, ownerId } = ownerAsBankPlayingTable();
    expect(personsShareOneChipPot(state, bankId, ownerId)).toBe(true);
    expect(usesSharedBankPlayerPot(state, ownerId)).toBe(true);
    expect(resolveCanonicalBankrollOwnerId(state, ownerId)).toBe(bankId);
  });

  it('does not create a duplicate player allocation when owner is bank', () => {
    const { state, bankId, ownerId } = ownerAsBankPlayingTable();
    expect(derivePlayerBalanceFromLedger(bankId, state.ledger)).toBe(500);
    expect(derivePlayerBalanceFromLedger(ownerId, state.ledger)).toBe(0);
  });

  it('tray and This Table show shared pot available for bank-player', () => {
    const { state, bankId, ownerId } = ownerAsBankPlayingTable();
    const ownerBalances = resolvePersonDisplayBalances(state, ownerId);
    const bankBalances = resolvePersonDisplayBalances(state, bankId);
    const tray = buildTableInfoDisplay(state, ownerId).playerAvailable;

    expect(ownerBalances.available).toBe(500);
    expect(bankBalances.available).toBe(500);
    expect(tray).toBe(500);
    expect(resolveViewerTrayAvailable(state, ownerId)).toBe(500);
    expect(getSharedPotAvailableChips(state, ownerId)).toBe(500);
  });

  it('cannot overbet beyond shared pot when bank-player plays a box', () => {
    let { state, ownerId } = ownerAsBankPlayingTable();
    state = claimBoxSlot(state, 1);
    const box1 = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.playerId!;
    for (let i = 0; i < 10; i += 1) {
      state = addChipToBoxStake(state, box1, 50, ownerId);
    }
    expect(getAvailableChipsForBankrollOwner(state, ownerId)).toBe(0);
    expect(resolvePersonDisplayBalances(state, ownerId).available).toBe(0);
    expect(() => addChipToBoxStake(state, box1, 50, ownerId)).toThrow(/insufficient|not enough|available/i);
  });

  it('leaves non-bank players on their own pot', () => {
    let { state, bankId, ownerId } = ownerAsBankPlayingTable();
    const guestSpl = addPlayer(state.session, state.players, state.ledger, {
      displayName: 'Bob',
      controllerName: 'Bob',
      role: 'person',
      startingChips: 0,
    });
    state = mergeSessionUpdate(state, guestSpl);
    const guestId = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;
    state = allocateChipsToBankrollOwner(state, {
      bankrollOwnerId: guestId,
      amount: 500,
      reason: 'initial-player',
      source: 'setup',
    });

    expect(personsShareOneChipPot(state, guestId, bankId)).toBe(false);
    expect(usesSharedBankPlayerPot(state, guestId)).toBe(false);
    expect(getLedgerBalanceForBankrollOwner(state, guestId)).toBe(500);
    expect(getLedgerBalanceForBankrollOwner(state, ownerId)).toBe(500);
    expect(getLedgerBalanceForBankrollOwner(state, bankId)).toBe(500);
    expect(resolvePersonDisplayBalances(state, guestId).available).toBe(500);
  });
});
