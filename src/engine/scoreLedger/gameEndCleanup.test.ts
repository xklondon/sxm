import { describe, expect, it, beforeEach } from 'vitest';
import type { GameState } from '../../types';
import { tableWithClaimedBox } from '../blackjack/sanity/fixtures';
import {
  addGameToPersonalLedger,
  buildGameOverSummary,
  hasPersonalLedgerEntryForTable,
} from './scoreLedger';
import { buildGameEndIouHandoff, canOfferGameEndIou } from './gameEndIou';
import {
  filterPersonalLedgerEntries,
  filterScoreLedgerByPerson,
  filterScoreLedgerByTable,
  loadScoreLedgerEntries,
  saveScoreLedgerEntries,
} from '../../storage/scoreLedgerStorage';

function endedChallengeState(): GameState {
  const base = tableWithClaimedBox(1);
  const bankId = base.session.bankPlayerId!;
  const ownerPersonId = base.tableMeta.ownerPersonId!;
  return {
    ...base,
    players: {
      ...base.players,
      [bankId]: { ...base.players[bankId]!, playerType: 'real', controllerName: 'Bob' },
    },
    tableMeta: {
      ...base.tableMeta,
      gameStatus: 'ended',
      winnerId: ownerPersonId,
      tableMode: 'challenge',
      tableClothName: 'Friday Night',
      agreement: {
        stakeDescription: '€20',
        defaultChips: 500,
        agreedAt: new Date().toISOString(),
      },
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
          inviteStatus: 'accepted',
          canInviteOthers: false,
          createdAt: new Date().toISOString(),
          token: 'token-1',
        },
      ],
    },
    session: { ...base.session, currentRound: 4 },
  };
}

function installLocalStorageMock(): void {
  if (typeof globalThis.localStorage !== 'undefined') {
    return;
  }
  const bag: Record<string, string> = {};
  (globalThis as { localStorage: Storage }).localStorage = {
    getItem: (key: string) => bag[key] ?? null,
    setItem: (key: string, value: string) => {
      bag[key] = value;
    },
    removeItem: (key: string) => {
      delete bag[key];
    },
    clear: () => {
      for (const key of Object.keys(bag)) {
        delete bag[key];
      }
    },
    key: (index: number) => Object.keys(bag)[index] ?? null,
    length: 0,
  } as Storage;
}

describe('game end cleanup', () => {
  beforeEach(() => {
    installLocalStorageMock();
    saveScoreLedgerEntries([]);
  });

  it('renders game-over command with winner and round count', () => {
    const state = endedChallengeState();
    const { message } = buildGameOverSummary(state);
    expect(message).toBe('Game Over, congrats Alice, you won in 4 rounds.');
  });

  it('add to ledger is idempotent per table', () => {
    const state = endedChallengeState();
    const first = addGameToPersonalLedger(state, { savedByEmail: 'alice@example.com' });
    const second = addGameToPersonalLedger(state, { savedByEmail: 'alice@example.com' });
    expect(first?.id).toBe(second?.id);
    expect(loadScoreLedgerEntries()).toHaveLength(1);
    expect(hasPersonalLedgerEntryForTable(state.session.id)).toBe(true);
  });

  it('personal ledger includes saved practice games for logged-in user', () => {
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
      session: { ...base.session, currentRound: 2 },
    };
    addGameToPersonalLedger(practiceEnded, { savedByEmail: 'alice@example.com' });
    const personal = filterPersonalLedgerEntries(loadScoreLedgerEntries(), 'alice@example.com');
    expect(personal).toHaveLength(1);
    expect(personal[0]?.mode).toBe('practice');
  });

  it('score ledger filters by person and table', () => {
    const state = endedChallengeState();
    addGameToPersonalLedger(state, { savedByEmail: 'alice@example.com' });
    const entries = loadScoreLedgerEntries();
    expect(filterScoreLedgerByPerson(entries, 'Bob')).toHaveLength(1);
    expect(filterScoreLedgerByTable(entries, 'Friday')).toHaveLength(1);
    expect(filterScoreLedgerByPerson(entries, 'Nobody')).toHaveLength(0);
  });

  it('offers IOU handoff with cash type and counterparty email', () => {
    const state = endedChallengeState();
    const handoff = buildGameEndIouHandoff(state, 'alice@example.com');
    expect(handoff).not.toBeNull();
    const url = new URL(handoff!.url);
    expect(url.searchParams.get('type')).toBe('cash');
    expect(url.searchParams.get('counterpartyEmail')).toBe('bob@example.com');
    expect(url.searchParams.get('title')).toBe('€20');
    expect(url.searchParams.get('message')).toContain('sxm challenge');
    expect(url.searchParams.get('cryptoSettlement')).toBe('false');
  });

  it('hides IOU when no valid counterparty email (bot bank practice)', () => {
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
    expect(canOfferGameEndIou(practiceEnded, 'alice@example.com')).toBe(false);
    expect(buildGameEndIouHandoff(practiceEnded, 'alice@example.com')).toBeNull();
  });
});
