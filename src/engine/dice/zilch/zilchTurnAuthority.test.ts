import { describe, expect, it } from 'vitest';
import {
  createNewZilchTable,
  applyZilchTableStakeSetup,
  DEFAULT_TABLE_CHIPS,
} from '../../session';
import { setTableOwner } from '../../session/invites';
import { applyZilchActionToState } from '../../zilch';
import {
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
      bankerMode: 'bot',
      virtualPlayerCount: 0,
    });
    const bankId = state.session.bankPlayerId;
    expect(bankId).toBeTruthy();
    const playable = listPlayableZilchPlayerIds(state);
    expect(playable).not.toContain(bankId);
    for (const id of playable) {
      expect(state.players[id]?.role).not.toBe('bank');
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

  it('non-host cannot act on virtual player turn', () => {
    const { state: base, hostId } = practiceTable();
    let state = applyZilchActionToState(base, 'zilchRandomiseStarter', {});
    expect(canPersonActOnZilchTurn(state, 'guest-person')).toBe(false);
    expect(canPersonActOnZilchTurn(state, hostId)).toBe(true);
  });

  it('randomiser picks only playable virtual players', () => {
    const { state: base } = practiceTable();
    let state = applyZilchActionToState(base, 'zilchRandomiseStarter', {});
    const starterId = state.zilch!.starterPlayerId!;
    expect(listPlayableZilchPlayerIds(state)).toContain(starterId);
    expect(state.players[starterId]?.role).not.toBe('bank');
  });

  it('reload preserves valid current player identity for host control', () => {
    const { state: base, hostId } = practiceTable();
    let state = applyZilchActionToState(base, 'zilchRandomiseStarter', {});
    const reloaded = { ...state, zilch: state.zilch ? { ...state.zilch } : null };
    expect(canPersonActOnZilchTurn(reloaded, hostId)).toBe(true);
    expect(reloaded.zilch?.currentPlayerId).toBeTruthy();
  });
});
