// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from 'vitest';
import type { GameState } from '../types';
import { actingRound, boxPlayerId, findCardId, tableAfterStartPlaying } from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session/boxOps';
import { addPlayer, mergeSessionUpdate } from '../engine/session';
import { allocateChipsToBankrollOwner } from '../engine/session/allocation';
import { addChipToBoxStake } from '../engine/blackjack/stakes';
import { clearTableUiEphemeral } from '../engine/session/inviteJoin';
import { shuffleToStartOnState } from '../engine/blackjack/gameState';
import {
  resolveViewerActionPermission,
} from './blackjackViewPhase';
import {
  applyOnlineTableBootstrap,
  resolveViewerPersonIdForTable,
  syncStoredViewerPersonId,
} from './viewerIdentity';
import {
  getStoredViewerPersonIdForTable,
  setStoredViewerPersonIdForTable,
} from '../storage/profileStorage';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const TABLE_ID = 'online-table-1';
const ROUTES_SRC = readFileSync(join(process.cwd(), 'server/src/tables/routes.ts'), 'utf8');
const CLIENT_SRC = readFileSync(join(process.cwd(), 'src/api/client.ts'), 'utf8');
const APP_SRC = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');
const JOIN_SRC = readFileSync(join(process.cwd(), 'src/components/JoinTableCurtain.tsx'), 'utf8');
const HOOK_SRC = readFileSync(join(process.cwd(), 'src/hooks/useOnlineMultiplayer.ts'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');

function twoPlayerOnlineTable(): { state: GameState; hostId: string; guestId: string; guestBoxId: string } {
  let state = tableAfterStartPlaying(500);
  const hostId = state.tableMeta.ownerPersonId!;
  state = claimBoxSlot(state, 1);
  const guestSpl = addPlayer(state.session, state.players, state.ledger, {
    displayName: 'Krv',
    controllerName: 'Krv',
    role: 'person',
    startingChips: 500,
  });
  state = mergeSessionUpdate(state, guestSpl);
  const guestId = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;
  state = allocateChipsToBankrollOwner(state, {
    bankrollOwnerId: guestId,
    amount: 500,
    reason: 'initial-player',
    source: 'setup',
  });
  state = {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      playerOrder: [hostId, guestId],
      assignedBoxByPersonId: { [hostId]: 1, [guestId]: 2 },
    },
  };
  state = claimBoxSlot(state, 2);
  const guestBoxId = boxPlayerId(state, 2)!;
  state = {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      boxSlots: state.tableMeta.boxSlots.map((s) =>
        s.slotNumber === 2
          ? { ...s, nativeAssignedPersonId: guestId, bankrollOwnerId: guestId }
          : s,
      ),
    },
  };
  return { state, hostId, guestId, guestBoxId };
}

function guestTurnState(base: ReturnType<typeof twoPlayerOnlineTable>): GameState {
  const { state, guestBoxId } = base;
  const round = actingRound(
    state,
    guestBoxId,
    [findCardId(state.deck!, '10'), findCardId(state.deck!, '9')],
    10,
  );
  return {
    ...state,
    blackjack: {
      ...round,
      status: 'player-turns' as const,
      activeHandKey: `${guestBoxId}:0`,
      activePlayerId: guestBoxId,
    },
  };
}

describe('online viewer identity API contract', () => {
  it('returns memberPersonId from join, fetch, and create routes', () => {
    expect(ROUTES_SRC).toMatch(/memberPersonId:\s*joined\.memberPersonId/);
    expect(ROUTES_SRC).toMatch(/getMemberPersonIdForSession[\s\S]*memberPersonId/);
    expect(CLIENT_SRC).toContain('memberPersonId: string');
    expect(APP_SRC).toContain('applyOnlineTableBootstrap');
    expect(JOIN_SRC).toContain('applyOnlineTableBootstrap');
    expect(HOOK_SRC).toContain('applyOnlineTableBootstrap');
    expect(PANEL_SRC).toContain('resolveViewerPersonIdForTable');
  });
});

describe('online viewer identity persistence and action visibility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('A: guest assigned box sees Hit/Stand when turn arrives (authoritative memberPersonId)', () => {
    const base = twoPlayerOnlineTable();
    const turn = guestTurnState(base);
    applyOnlineTableBootstrap({
      tableId: TABLE_ID,
      state: turn,
      memberPersonId: base.guestId,
    });
    expect(getStoredViewerPersonIdForTable(TABLE_ID)).toBe(base.guestId);
    const viewerId = resolveViewerPersonIdForTable(turn, TABLE_ID, {
      email: 'krv@example.com',
      displayName: 'Wrong',
    });
    expect(viewerId).toBe(base.guestId);
    const permission = resolveViewerActionPermission(turn, viewerId);
    expect(permission.canAct).toBe(true);
    expect(permission.blockReason).toBeNull();
  });

  it('B: refresh restores stored viewer id without joinHighlight', () => {
    const base = twoPlayerOnlineTable();
    setStoredViewerPersonIdForTable(TABLE_ID, base.guestId);
    const cleared = clearTableUiEphemeral(guestTurnState(base));
    expect(cleared.tableMeta.joinHighlight).toBeFalsy();
    const viewerId = resolveViewerPersonIdForTable(cleared, TABLE_ID, null);
    expect(viewerId).toBe(base.guestId);
    expect(resolveViewerActionPermission(cleared, viewerId).canAct).toBe(true);
  });

  it('C: shuffle and next-hand ephemeral clear do not drop stored viewer id', () => {
    const base = twoPlayerOnlineTable();
    applyOnlineTableBootstrap({
      tableId: TABLE_ID,
      state: base.state,
      memberPersonId: base.guestId,
    });
    let state = shuffleToStartOnState(guestTurnState(base));
    state = clearTableUiEphemeral(state);
    const viewerId = resolveViewerPersonIdForTable(state, TABLE_ID, null);
    expect(viewerId).toBe(base.guestId);
  });

  it('D: socket reconnect bootstrap re-persists memberPersonId', () => {
    const base = twoPlayerOnlineTable();
    localStorage.clear();
    const turn = guestTurnState(base);
    applyOnlineTableBootstrap({
      tableId: TABLE_ID,
      state: turn,
      memberPersonId: base.guestId,
    });
    expect(getStoredViewerPersonIdForTable(TABLE_ID)).toBe(base.guestId);
    syncStoredViewerPersonId(TABLE_ID, clearTableUiEphemeral(turn), null, base.guestId);
    expect(resolveViewerPersonIdForTable(turn, TABLE_ID, null)).toBe(base.guestId);
  });

  it('E: guest cannot control host box on host turn', () => {
    const base = twoPlayerOnlineTable();
    const hostBoxId = boxPlayerId(base.state, 1)!;
    const hostTurn = actingRound(
      base.state,
      hostBoxId,
      [findCardId(base.state.deck!, '8'), findCardId(base.state.deck!, '7')],
      10,
    );
    const state = {
      ...base.state,
      blackjack: {
        ...hostTurn,
        status: 'player-turns' as const,
        activeHandKey: `${hostBoxId}:0`,
        activePlayerId: hostBoxId,
      },
    };
    applyOnlineTableBootstrap({
      tableId: TABLE_ID,
      state,
      memberPersonId: base.guestId,
    });
    const permission = resolveViewerActionPermission(state, base.guestId);
    expect(permission.canAct).toBe(false);
    expect(permission.blockReason).toBe('not-decision-owner');
  });

  it('F: host cannot control guest box on guest turn', () => {
    const base = twoPlayerOnlineTable();
    const turn = guestTurnState(base);
    applyOnlineTableBootstrap({
      tableId: TABLE_ID,
      state: turn,
      memberPersonId: base.hostId,
    });
    const permission = resolveViewerActionPermission(turn, base.hostId);
    expect(permission.canAct).toBe(false);
    expect(permission.blockReason).toBe('not-decision-owner');
  });

  it('G: free box first bettor remains caller and can act on their turn', () => {
    let state = tableAfterStartPlaying(500);
    const hostId = state.tableMeta.ownerPersonId!;
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    const freeBoxId = boxPlayerId(state, 3)!;
    state = addChipToBoxStake(state, freeBoxId, 10, hostId);
    expect(state.tableMeta.boxStakes[freeBoxId]?.callerPersonId).toBe(hostId);
    const round = actingRound(
      state,
      freeBoxId,
      [findCardId(state.deck!, '9'), findCardId(state.deck!, '8')],
      10,
    );
    state = {
      ...state,
      blackjack: {
        ...round,
        status: 'player-turns' as const,
        activeHandKey: `${freeBoxId}:0`,
        activePlayerId: freeBoxId,
      },
    };
    applyOnlineTableBootstrap({
      tableId: TABLE_ID,
      state,
      memberPersonId: hostId,
    });
    const permission = resolveViewerActionPermission(state, hostId);
    expect(permission.canAct).toBe(true);
  });
});

describe('online viewer identity without stored id', () => {
  it('requires authoritative memberPersonId bootstrap before guest can act', () => {
    localStorage.clear();
    const base = twoPlayerOnlineTable();
    const turn = guestTurnState(base);
    expect(resolveViewerActionPermission(turn, null).blockReason).toBe('no-viewer');
    applyOnlineTableBootstrap({
      tableId: TABLE_ID,
      state: turn,
      memberPersonId: base.guestId,
    });
    const viewerId = resolveViewerPersonIdForTable(turn, TABLE_ID, null);
    expect(viewerId).toBe(base.guestId);
    expect(resolveViewerActionPermission(turn, viewerId).canAct).toBe(true);
  });
});
