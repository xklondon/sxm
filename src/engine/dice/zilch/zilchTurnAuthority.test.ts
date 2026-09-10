import { describe, expect, it } from 'vitest';
import {
  createNewZilchTable,
  applyZilchTableStakeSetup,
  DEFAULT_TABLE_CHIPS,
} from '../../session';
import { setTableOwner } from '../../session/invites';
import { applyZilchActionToState } from '../../zilch';
import { setTableOwner } from '../../session/invites';
import { finalizeInviteJoinAtTable } from '../../session/inviteJoin';
import { beginZilchPlay } from '../../session/zilchTableSetup';
import {
  canControlZilchTurn,
  canPersonActOnZilchTurn,
  canPersonControlZilchPlayer,
  listPlayableZilchPlayerIds,
} from './zilchTurnAuthority';
import type { ZilchTableStakeSetupInput } from '../../session/zilchTableSetup';

const practiceSetup: ZilchTableStakeSetupInput = {
  stakeDescription: 'Practice',
  seatChips: DEFAULT_TABLE_CHIPS,
  bankChips: DEFAULT_TABLE_CHIPS,
  bankerMode: 'bot',
  bankerName: '',
  controllerName: 'Host',
  controllerEmail: 'host@example.com',
  protocolId: 'zilch',
  naturalDealing: false,
  dealSpeedPreset: 'normal',
  cardTimerPreset: 0,
  bankDrawAuto: true,
  tableMode: 'practice',
  virtualPlayerCount: 2,
  zilchMode: 'target_points',
  targetPoints: 100,
  roundLimit: 10,
  diceAnimationMode: 'fixed',
  diceAnimationMs: 400,
  diceAnimationRandomMinMs: 400,
  diceAnimationRandomMaxMs: 400,
};

function practiceTable() {
  let state = setTableOwner(createNewZilchTable(), 'Host', 'host@example.com');
  state = applyZilchTableStakeSetup(state, practiceSetup);
  const hostId = state.tableMeta.ownerPersonId;
  if (!hostId) {
    throw new Error('expected ownerPersonId after zilch setup');
  }
  return { state, hostId };
}

describe('zilchTurnAuthority', () => {
  it('listPlayableZilchPlayerIds excludes bank bot and empty seats', () => {
    let state = createNewZilchTable();
    state = applyZilchTableStakeSetup(state, {
      ...practiceSetup,
      tableMode: 'challenge',
      bankerMode: 'self',
      bankerName: 'Host',
      virtualPlayerCount: 0,
    });
    const bankId = state.session.bankPlayerId;
    expect(bankId).toBeTruthy();
    const playable = listPlayableZilchPlayerIds(state);
    expect(playable).not.toContain(bankId);
    expect(playable).toHaveLength(1);
    expect(playable[0]).toBe(state.tableMeta.ownerPersonId);
    for (const id of playable) {
      expect(state.players[id]?.role).toBe('person');
    }
  });

  it('host can act when virtual player is current after randomiser', () => {
    const { state: base, hostId } = practiceTable();
    let state = applyZilchActionToState(base, 'zilchRandomiseStarter', {});
    const currentId = state.zilch!.currentPlayerId!;
    expect(listPlayableZilchPlayerIds(state)).toContain(currentId);
    expect(canPersonActOnZilchTurn(state, hostId)).toBe(true);
    expect(canPersonControlZilchPlayer(state, hostId, currentId)).toBe(true);
  });

  it('host can act when guest is current after randomiser in challenge', () => {
    let state = setTableOwner(createNewZilchTable(), 'Host', 'host@example.com');
    state = applyZilchTableStakeSetup(state, {
      ...practiceSetup,
      tableMode: 'challenge',
      bankerMode: 'self',
      bankerName: 'Host',
      virtualPlayerCount: 0,
    } as never);
    state = beginZilchPlay(state);
    state = finalizeInviteJoinAtTable(state, 'guest-person', 'Guest').state;
    state = applyZilchActionToState(state, 'zilchRandomiseStarter', {});
    const hostId = state.tableMeta.ownerPersonId!;
    const currentId = state.zilch!.currentPlayerId!;
    expect(currentId).toBeTruthy();
    expect(canControlZilchTurn(state, hostId)).toBe(true);
  });

  it('matching display name does not grant control of another player turn', () => {
    let state = setTableOwner(createNewZilchTable(), 'Host', 'host@example.com');
    state = applyZilchTableStakeSetup(state, {
      ...practiceSetup,
      tableMode: 'challenge',
      bankerMode: 'self',
      bankerName: 'Host',
      virtualPlayerCount: 0,
    } as never);
    state = beginZilchPlay(state);
    state = finalizeInviteJoinAtTable(state, 'guest-a', 'Guest').state;
    // Second guest picked the SAME display name — names are spoofable and
    // must never grant turn control (server authority path).
    state = finalizeInviteJoinAtTable(state, 'guest-b', 'Guest').state;
    state = {
      ...state,
      zilch: { ...state.zilch!, currentPlayerId: 'guest-a' },
    };
    expect(canPersonControlZilchPlayer(state, 'guest-b', 'guest-a')).toBe(false);
    expect(canControlZilchTurn(state, 'guest-b')).toBe(false);
    expect(canControlZilchTurn(state, 'guest-a')).toBe(true);
  });

  it('non-host cannot act on another player turn in challenge', () => {
    const { state: base, hostId } = practiceTable();
    let state = applyZilchActionToState(base, 'zilchRandomiseStarter', {});
    expect(canPersonActOnZilchTurn(state, 'guest-person')).toBe(false);
    expect(canPersonActOnZilchTurn(state, hostId)).toBe(true);
  });

  it('randomiser picks playable practice players including host box', () => {
    const { state: base } = practiceTable();
    let state = applyZilchActionToState(base, 'zilchRandomiseStarter', {});
    const starterId = state.zilch!.starterPlayerId!;
    const playable = listPlayableZilchPlayerIds(state);
    expect(playable).toHaveLength(3);
    expect(playable).toContain(starterId);
    expect(state.players[starterId]?.role).not.toBe('bank');
  });

  it('practice playable list includes host box and virtual players only', () => {
    const { state, hostId } = practiceTable();
    const playable = listPlayableZilchPlayerIds(state);
    expect(playable).toHaveLength(3);
    expect(playable).not.toContain(hostId);
    const hostBox = playable.find((id) => state.players[id]?.role === 'box');
    expect(hostBox).toBeTruthy();
    expect(playable.filter((id) => state.players[id]?.playerType === 'virtual')).toHaveLength(2);
  });

  it('reload preserves valid current player identity for host control', () => {
    const { state: base, hostId } = practiceTable();
    let state = applyZilchActionToState(base, 'zilchRandomiseStarter', {});
    const reloaded = { ...state, zilch: state.zilch ? { ...state.zilch } : null };
    expect(canPersonActOnZilchTurn(reloaded, hostId)).toBe(true);
    expect(reloaded.zilch?.currentPlayerId).toBeTruthy();
  });
});
