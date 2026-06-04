import type { GameState } from '../../types';
import { createEmptyLedger } from '../../types/ledger';
import { appendLedgerEntry } from '../ledger/ledger';
import { resetPlayerRoundFields } from '../blackjack/helpers';
import { clearTableUiEphemeral } from './inviteJoin';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import {
  allocateChipsToBankrollOwner,
  logDerivedBalances,
  logLedgerAfterAllocation,
} from './allocation';
import { getStartingChipsEachSeat, logTableMetaStartingChips } from './tokens';
import { listPersonBankrollOwnerIds } from './bankroll';
import {
  applyTableStakeSetup,
  type TableStakeSetupInput,
} from './tableSetup';

export const TABLE_RESET_LEDGER_MESSAGE = 'Table reset by owner';

/** Open stake setup UI for reset (client may set locally; optional engine helper). */
export function beginTableResetSetup(state: GameState): GameState {
  return {
    ...clearTableUiEphemeral(state),
    tableMeta: {
      ...state.tableMeta,
      showStakeSetup: true,
    },
  };
}

function clearGameStateForReset(state: GameState): GameState {
  const sessionId = state.session.id;
  const ledger = createEmptyLedger(sessionId);
  const session = {
    ...state.session,
    currentRound: 1,
    ledgerEntryIds: [],
    deckId: null,
    dealingStatus: 'no-deck' as const,
    status: 'active' as const,
  };

  return clearTableUiEphemeral({
    ...state,
    session,
    ledger,
    deck: null,
    blackjack: null,
    holdem: null,
    zilch: null,
    players: resetPlayerRoundFields(state.players),
    tableMeta: {
      ...state.tableMeta,
      outcome: null,
      status: 'open',
      boxStakes: {},
      bettingLocked: false,
      shoeStarted: false,
      awaitingNextRound: false,
      gameStatus: 'active',
      winnerId: null,
      endedAt: null,
      protocolLocked: false,
      showBankerSetup: false,
      tableNotice: null,
      joinHighlight: null,
    },
  });
}

function appendTableResetLedgerNote(
  state: GameState,
  resetByPersonId: string | null,
): GameState {
  const anchorId =
    resetByPersonId ??
    state.tableMeta.ownerPersonId ??
    state.session.bankPlayerId ??
    state.session.playerIds[0];
  if (!anchorId) {
    return state;
  }
  const appended = appendLedgerEntry(state.session, state.ledger, {
    playerId: anchorId,
    entryType: 'manual-adjustment',
    amount: 0,
    description: TABLE_RESET_LEDGER_MESSAGE,
    roundNumber: 0,
  });
  return {
    ...state,
    session: appended.session,
    ledger: appended.ledger,
  };
}

/** Seat bankrolls for seated players (bank/owner may already be allocated in stake setup). */
function allocateRemainingSeatBankrolls(state: GameState): GameState {
  let next = state;
  const seatChips = getStartingChipsEachSeat(next);
  if (seatChips <= 0) {
    return next;
  }
  for (const personId of listPersonBankrollOwnerIds(next)) {
    if (derivePlayerBalanceFromLedger(personId, next.ledger) !== 0) {
      continue;
    }
    next = allocateChipsToBankrollOwner(next, {
      bankrollOwnerId: personId,
      amount: seatChips,
      reason: 'initial-player',
      source: 'setup',
    });
  }
  logLedgerAfterAllocation(next, 'table-reset-seats');
  logDerivedBalances(next, 'table-reset-seats');
  logTableMetaStartingChips(next, 'table-reset-seats');
  return next;
}

/**
 * Reset play for a new game: same table id, players, seats, invites; fresh round/ledger.
 */
export function applyTableResetSetup(
  state: GameState,
  input: TableStakeSetupInput,
  resetByPersonId: string | null = null,
): GameState {
  let next = clearGameStateForReset(state);
  next = appendTableResetLedgerNote(next, resetByPersonId);
  next = applyTableStakeSetup(next, input);
  next = allocateRemainingSeatBankrolls(next);
  return {
    ...next,
    tableMeta: {
      ...next.tableMeta,
      showStakeSetup: false,
    },
  };
}
