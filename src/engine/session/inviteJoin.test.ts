import { describe, expect, it } from 'vitest';

import { addChipToBoxStake } from '../blackjack/stakes';
import { getAvailableChipsForBankrollOwner } from './bankroll';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import { tableAfterStartPlaying } from '../blackjack/sanity/fixtures';
import {
  finalizeInviteJoinAtTable,
  formatPlayerJoinedMessage,
  clearTableUiEphemeral,
} from './inviteJoin';
import { addPlayer, mergeSessionUpdate } from './session';
import { buildTableCommandDisplay } from '../../components/tableCommandDisplay';

describe('invite join allocation', () => {
  it('allocates starting chips and assigns next free box', () => {
    let state = tableAfterStartPlaying(500);
    const ownerId = state.tableMeta.ownerPersonId!;

    const guestSpl = addPlayer(state.session, state.players, state.ledger, {
      displayName: 'Guest',
      controllerName: 'Guest',
      role: 'person',
      startingChips: 0,
    });
    state = mergeSessionUpdate(state, guestSpl);
    const guestId = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;

    const joined = finalizeInviteJoinAtTable(state, guestId, 'Guest');
    expect(joined.boxAssigned).toBe(true);
    expect(joined.spectator).toBe(false);

    const slot = joined.state.tableMeta.boxSlots.find(
      (s) => s.nativeAssignedPersonId === guestId,
    );
    expect(slot).toBeTruthy();
    expect(derivePlayerBalanceFromLedger(guestId, joined.state.ledger)).toBe(500);
    expect(getAvailableChipsForBankrollOwner(joined.state, guestId)).toBe(500);
    expect(joined.state.tableMeta.tableNotice?.message).toBe(
      formatPlayerJoinedMessage('Guest', joined.state.tableMeta.joinHighlight!.slotNumber),
    );
    expect(joined.state.tableMeta.joinHighlight?.personId).toBe(guestId);
    expect(joined.state.tableMeta.playerOrder).toContain(guestId);
    expect(joined.state.tableMeta.playerOrder[0]).toBe(ownerId);
  });

  it('joined player can place minimum bet immediately', () => {
    let state = tableAfterStartPlaying(500);
    const guestSpl = addPlayer(state.session, state.players, state.ledger, {
      displayName: 'Bob',
      controllerName: 'Bob',
      role: 'person',
      startingChips: 0,
    });
    state = mergeSessionUpdate(state, guestSpl);
    const guestId = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;
    const joined = finalizeInviteJoinAtTable(state, guestId, 'Bob');
    const boxId = joined.state.tableMeta.boxSlots.find(
      (s) => s.nativeAssignedPersonId === guestId,
    )!.playerId!;
    const afterBet = addChipToBoxStake(joined.state, boxId, 5, guestId);
    expect(afterBet.tableMeta.boxStakes[boxId]?.amount).toBe(5);
    expect(getAvailableChipsForBankrollOwner(afterBet, guestId)).toBe(495);
  });

  it('shows join notice in command display during betting', () => {
    let state = tableAfterStartPlaying(500);
    const guestSpl = addPlayer(state.session, state.players, state.ledger, {
      displayName: 'Kay',
      controllerName: 'Kay',
      role: 'person',
      startingChips: 0,
    });
    state = mergeSessionUpdate(state, guestSpl);
    const guestId = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;
    const joined = finalizeInviteJoinAtTable(state, guestId, 'Kay');
    const cmd = buildTableCommandDisplay({
      gameState: joined.state,
      gameEnded: false,
      gameOverMessage: '',
      centerStatus: 'Place your bets',
      protocolPhase: 'betting',
      roundSummaryLines: [],
      controllerName: 'Host',
    });
    expect(cmd.commandMessage).toContain('Kay joined the table on Box');
  });

  it('clears join notice on shuffle', () => {
    let state = tableAfterStartPlaying(500);
    const guestSpl = addPlayer(state.session, state.players, state.ledger, {
      displayName: 'Zed',
      controllerName: 'Zed',
      role: 'person',
      startingChips: 0,
    });
    state = mergeSessionUpdate(state, guestSpl);
    const guestId = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;
    const joined = finalizeInviteJoinAtTable(state, guestId, 'Zed');
    const cleared = clearTableUiEphemeral(joined.state);
    expect(cleared.tableMeta.tableNotice).toBeNull();
    expect(cleared.tableMeta.joinHighlight).toBeNull();
  });
});
