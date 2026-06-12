import { describe, expect, it } from 'vitest';
import type { GameState } from '../../types';
import type { LedgerEntry } from '../../types/ledger';
import { tableAfterStartPlaying, tableWithClaimedBox } from '../blackjack/sanity/fixtures';
import { addPlayer, mergeSessionUpdate } from '../session/session';
import { getLedgerBalanceForBankrollOwner } from '../session/bankroll';
import {
  buildIouHandoffCreateRequest,
  canOfferGameEndIou,
  getGameEndIouDisabledReason,
  resolveEmailForPlayerId,
  resolveGameEndParties,
} from './gameEndIou';

function appendTestLedgerEntry(
  state: GameState,
  entry: Omit<LedgerEntry, 'id' | 'timestamp'>,
): GameState {
  return {
    ...state,
    ledger: {
      ...state.ledger,
      entries: [
        ...state.ledger.entries,
        {
          ...entry,
          id: `test-${entry.playerId}-${entry.balanceAfter}`,
          timestamp: new Date().toISOString(),
        },
      ],
    },
  };
}

function challengeInviteDefaults(base: GameState) {
  return {
    tableMode: 'challenge' as const,
    owner: {
      ownerName: 'Alice',
      ownerEmail: 'alice@example.com',
      createdAt: new Date().toISOString(),
    },
    setupInvitedEmails: ['bob@example.com'],
    invites: [
      {
        inviteId: 'inv-1',
        tableId: base.session.id,
        invitedEmail: 'bob@example.com',
        invitedName: 'Bob',
        invitedBy: 'alice@example.com',
        inviteStatus: 'accepted' as const,
        canInviteOthers: false,
        createdAt: new Date().toISOString(),
        token: 'token-1',
      },
    ],
  };
}

/** Owner selected "Me" as bank — bank participant id differs from ownerPersonId. */
function ownerAsBankChallengeBase() {
  const base = tableAfterStartPlaying(500);
  const bankId = base.session.bankPlayerId!;
  const ownerPersonId = base.tableMeta.ownerPersonId!;

  const guestSpl = addPlayer(base.session, base.players, base.ledger, {
    displayName: 'Bob',
    controllerName: 'Bob',
    role: 'person',
    startingChips: 0,
  });
  let state = mergeSessionUpdate(base, guestSpl);
  const guestId = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;

  state = {
    ...state,
    players: {
      ...state.players,
      [bankId]: {
        ...state.players[bankId]!,
        playerType: 'real' as const,
        role: 'bank',
        controllerName: 'Alice',
        displayName: 'Alice',
      },
      [ownerPersonId]: {
        ...state.players[ownerPersonId]!,
        playerType: 'real' as const,
        controllerName: 'Alice',
        displayName: 'Alice',
      },
      [guestId]: {
        ...state.players[guestId]!,
        playerType: 'real' as const,
        controllerName: 'Bob',
        displayName: 'Bob',
      },
    },
    tableMeta: {
      ...state.tableMeta,
      ...challengeInviteDefaults(state),
      controllerName: 'Alice',
      bankerSetup: {
        mode: 'person',
        displayName: 'Alice',
        playerId: bankId,
        startBalance: 500,
      },
      playerOrder: [guestId],
      assignedBoxByPersonId: { [guestId]: 1 },
      boxSlots: state.tableMeta.boxSlots.map((slot, index) =>
        index === 0
          ? {
              ...slot,
              bankrollOwnerId: guestId,
              nativeAssignedPersonId: guestId,
            }
          : slot,
      ),
    },
  };

  return { state, bankId, ownerPersonId, guestId };
}

function endedChallengeState() {
  const base = tableWithClaimedBox(1);
  const bankId = base.session.bankPlayerId!;
  const ownerPersonId = base.tableMeta.ownerPersonId!;
  return {
    ...base,
    players: {
      ...base.players,
      [bankId]: { ...base.players[bankId]!, playerType: 'real' as const, controllerName: 'Bob' },
    },
    tableMeta: {
      ...base.tableMeta,
      gameStatus: 'ended' as const,
      winnerId: ownerPersonId,
      ...challengeInviteDefaults(base),
      bankerSetup: {
        mode: 'person' as const,
        displayName: 'Bob',
        playerId: bankId,
        startBalance: 500,
      },
    },
  };
}

describe('buildIouHandoffCreateRequest', () => {
  it('builds debtor/creditor emails for ended challenge tables (invited player as bank)', () => {
    const state = endedChallengeState();
    expect(resolveGameEndParties(state)).toMatchObject({
      winnerEmail: 'alice@example.com',
      loserEmail: 'bob@example.com',
    });
    expect(canOfferGameEndIou(state, 'alice@example.com')).toBe(true);
    expect(buildIouHandoffCreateRequest(state)).toMatchObject({
      debtorEmail: 'bob@example.com',
      creditorEmail: 'alice@example.com',
    });
  });

  it('owner as bank loses: debtor is owner email, creditor is opponent email', () => {
    const { state, bankId, guestId } = ownerAsBankChallengeBase();
    const ended = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        gameStatus: 'ended' as const,
        winnerId: guestId,
      },
    };

    expect(resolveEmailForPlayerId(ended, bankId)).toBe('alice@example.com');
    expect(buildIouHandoffCreateRequest(ended)).toMatchObject({
      debtorEmail: 'alice@example.com',
      creditorEmail: 'bob@example.com',
    });
    expect(canOfferGameEndIou(ended, 'alice@example.com')).toBe(true);
  });

  it('owner as bank wins: creditor is owner email, debtor is opponent email', () => {
    const { state, bankId, ownerPersonId, guestId } = ownerAsBankChallengeBase();
    let ended: GameState = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        gameStatus: 'ended' as const,
        winnerId: bankId,
      },
    };
    ended = appendTestLedgerEntry(ended, {
      roundNumber: ended.session.currentRound,
      playerId: guestId,
      entryType: 'loss-collected',
      amount: -500,
      balanceBefore: 500,
      balanceAfter: 0,
      description: 'test: guest bust',
    });
    ended = appendTestLedgerEntry(ended, {
      roundNumber: ended.session.currentRound,
      playerId: bankId,
      entryType: 'win-paid',
      amount: 500,
      balanceBefore: 500,
      balanceAfter: 1000,
      description: 'test: bank wins all',
    });
    // Owner person bankroll still holds unused seat chips — must not be picked as loser.
    expect(getLedgerBalanceForBankrollOwner(ended, ownerPersonId)).toBeGreaterThan(0);
    expect(getLedgerBalanceForBankrollOwner(ended, guestId)).toBe(0);

    expect(buildIouHandoffCreateRequest(ended)).toMatchObject({
      debtorEmail: 'bob@example.com',
      creditorEmail: 'alice@example.com',
    });
    expect(buildIouHandoffCreateRequest(ended)?.debtorEmail).not.toBe(
      buildIouHandoffCreateRequest(ended)?.creditorEmail,
    );
  });

  it('owner as bank never resolves debtor === creditor', () => {
    const { state, bankId, guestId } = ownerAsBankChallengeBase();
    const endedWin = {
      ...state,
      tableMeta: { ...state.tableMeta, gameStatus: 'ended' as const, winnerId: bankId },
    };
    const endedLose = {
      ...state,
      tableMeta: { ...state.tableMeta, gameStatus: 'ended' as const, winnerId: guestId },
    };
    for (const ended of [endedWin, endedLose]) {
      const request = buildIouHandoffCreateRequest(ended);
      if (request) {
        expect(request.debtorEmail).not.toBe(request.creditorEmail);
      }
    }
  });

  it('practice / bot bank cannot create IOU', () => {
    const base = tableWithClaimedBox(1);
    const practiceEnded: GameState = {
      ...base,
      tableMeta: {
        ...base.tableMeta,
        gameStatus: 'ended',
        winnerId: base.tableMeta.ownerPersonId,
        tableMode: 'practice',
        owner: {
          ownerName: 'Alice',
          ownerEmail: 'alice@example.com',
          createdAt: new Date().toISOString(),
        },
      },
    };
    expect(buildIouHandoffCreateRequest(practiceEnded)).toBeNull();
    expect(canOfferGameEndIou(practiceEnded, 'alice@example.com')).toBe(false);
  });

  it('returns null when a party email is missing', () => {
    const { state, bankId, guestId } = ownerAsBankChallengeBase();
    const ended = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        gameStatus: 'ended' as const,
        winnerId: guestId,
        owner: {
          ownerName: 'Alice',
          ownerEmail: '',
          createdAt: new Date().toISOString(),
        },
      },
    };
    expect(resolveEmailForPlayerId(ended, bankId)).toBeNull();
    expect(buildIouHandoffCreateRequest(ended)).toBeNull();
    expect(getGameEndIouDisabledReason(ended)).toBe(
      'Cannot create IOU because one player is missing an email address.',
    );
  });
});
