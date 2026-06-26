// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  applyZilchTableStakeSetup,
  createNewZilchTable,
  DEFAULT_TABLE_CHIPS,
  isZilchTable,
  normalizeLoadedGameState,
} from '../../session';
import { finalizeInviteJoinAtTable } from '../../session/inviteJoin';
import { applyZilchActionToState } from '../../zilch';
import {
  canBeginZilchChallenge,
  countZilchChallengeOpponents,
  listPlayableZilchPlayerIds,
} from './zilchTurnAuthority';
import { getVisibleZilchPlayers } from './zilchVisiblePlayers';
import { reconcileZilchRoster } from './zilchRoster';
import { TableScreen } from '../../../screens/TableScreen';
import { ZilchPanel } from '../../../components/zilch/ZilchPanel';

function challengeSetup(controller = 'xk') {
  return {
    stakeDescription: 'Dinner',
    seatChips: DEFAULT_TABLE_CHIPS,
    bankChips: DEFAULT_TABLE_CHIPS,
    bankerMode: 'self' as const,
    bankerName: controller,
    controllerName: controller,
    controllerEmail: 'host@example.com',
    protocolId: 'zilch',
    naturalDealing: false,
    dealSpeedPreset: 'normal' as const,
    cardTimerPreset: 0 as const,
    bankDrawAuto: true,
    tableMode: 'challenge' as const,
    zilchMode: 'target_points' as const,
    targetPoints: 1000,
    roundLimit: 10,
    diceAnimationMode: 'fixed' as const,
    diceAnimationMs: 400,
    diceAnimationRandomMinMs: 400,
    diceAnimationRandomMaxMs: 400,
  };
}

describe('Zilch Challenge setup', () => {
  it('creation includes host as Player 1 visible and playable', () => {
    const state = applyZilchTableStakeSetup(createNewZilchTable(), challengeSetup());
    const hostId = state.tableMeta.ownerPersonId!;
    expect(listPlayableZilchPlayerIds(state)).toEqual([hostId]);
    const visible = getVisibleZilchPlayers(state);
    expect(visible[0]!.playerId).toBe(hostId);
    expect(visible[0]!.boxLabel).toBe('Player 1');
    expect(state.tableGame).toBe('zilch');
    expect(state.session.gameType).toBe('zilch');
    expect(state.tableMeta.tableMode).toBe('challenge');
  });

  it('host-only challenge cannot randomise starter yet', () => {
    const state = applyZilchTableStakeSetup(createNewZilchTable(), challengeSetup());
    expect(canBeginZilchChallenge(state)).toBe(false);
    expect(countZilchChallengeOpponents(state)).toBe(0);
    expect(() => applyZilchActionToState(state, 'zilchRandomiseStarter', {})).toThrow(
      /Invite at least one player/i,
    );
  });

  it('host-only challenge shows invite message in panel', () => {
    const state = applyZilchTableStakeSetup(createNewZilchTable(), challengeSetup());
    const html = renderToStaticMarkup(
      <ZilchPanel gameState={state} onGameStateChange={() => {}} />,
    );
    expect(html).toContain('Invite at least one player to start Challenge.');
    expect(html).toContain('data-game="zilch"');
    expect(html).toContain('Player 1');
    expect(html).not.toContain('Add at least one player to start Zilch.');
  });

  it('joined guest becomes playable and enables randomiser', () => {
    let state = applyZilchTableStakeSetup(createNewZilchTable(), challengeSetup());
    const guestId = 'guest-person';
    state = finalizeInviteJoinAtTable(state, guestId, 'Guest').state;
    const playable = listPlayableZilchPlayerIds(state);
    expect(playable).toHaveLength(2);
    expect(canBeginZilchChallenge(state)).toBe(true);
    expect(state.zilch?.players).toHaveLength(2);
    const next = applyZilchActionToState(state, 'zilchRandomiseStarter', {});
    expect(next.zilch?.starterPlayerId).toBeTruthy();
    expect(next.zilch?.phase).toBe('player-turn');
  });

  it('challenge excludes virtual players', () => {
    let state = applyZilchTableStakeSetup(createNewZilchTable(), {
      ...challengeSetup(),
      virtualPlayerCount: 2,
    } as never);
    expect(listPlayableZilchPlayerIds(state)).toHaveLength(1);
    expect(
      Object.values(state.players).some((player) => player.playerType === 'virtual'),
    ).toBe(false);
  });

  it('reloaded challenge table routes to ZilchPanel', () => {
    let state = applyZilchTableStakeSetup(createNewZilchTable(), challengeSetup());
    state = normalizeLoadedGameState(state);
    expect(isZilchTable(state)).toBe(true);
    const html = renderToStaticMarkup(
      <TableScreen gameState={state} onGameStateChange={() => {}} onLeave={() => {}} />,
    );
    expect(html).toContain('data-game="zilch"');
    expect(html).not.toContain('bj-casino');
  });

  it('reconcileZilchRoster adds joined guest during setup without duplicate ids', () => {
    let state = applyZilchTableStakeSetup(createNewZilchTable(), challengeSetup());
    state = finalizeInviteJoinAtTable(state, 'guest', 'Guest').state;
    const visible = getVisibleZilchPlayers(state);
    const ids = visible.map((player) => player.playerId);
    expect(new Set(ids).size).toBe(2);
    expect(visible.map((player) => player.boxLabel)).toEqual(['Player 1', 'Player 2']);
    state = reconcileZilchRoster(state);
    expect(state.zilch?.players.map((player) => player.playerId)).toEqual(ids);
  });
});
