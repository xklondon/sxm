// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  applyZilchTableStakeSetup,
  beginZilchPlay,
  createNewZilchTable,
  DEFAULT_TABLE_CHIPS,
} from '../../engine/session';
import { finalizeInviteJoinAtTable } from '../../engine/session/inviteJoin';
import { setTableOwner } from '../../engine/session/invites';
import { applyZilchActionToState } from '../../engine/dice/zilch';
import { canInitialRollAllDice } from '../../engine/dice/zilch/zilchSelectors';
import { canControlZilchTurn, listPlayableZilchPlayerIds } from '../../engine/dice/zilch/zilchTurnAuthority';
import { ZilchPanel } from './ZilchPanel';
import { ZilchPlayArea } from './ZilchPlayArea';

function challengeWithGuest(guestStarts = false) {
  let state = setTableOwner(createNewZilchTable(), 'Host', 'host@example.com');
  state = applyZilchTableStakeSetup(state, {
    stakeDescription: 'Dinner',
    seatChips: DEFAULT_TABLE_CHIPS,
    bankChips: DEFAULT_TABLE_CHIPS,
    bankerMode: 'self',
    bankerName: 'Host',
    controllerName: 'Host',
    controllerEmail: 'host@example.com',
    protocolId: 'zilch',
    naturalDealing: false,
    dealSpeedPreset: 'normal',
    cardTimerPreset: 0,
    bankDrawAuto: true,
    tableMode: 'challenge',
    zilchMode: 'target_points',
    targetPoints: 1000,
    roundLimit: 10,
    diceAnimationMode: 'fixed',
    diceAnimationMs: 400,
    diceAnimationRandomMinMs: 400,
    diceAnimationRandomMaxMs: 400,
  });
  state = beginZilchPlay(state);
  state = finalizeInviteJoinAtTable(state, 'guest-person', 'Guest').state;
  const hostId = state.tableMeta.ownerPersonId!;
  const guestId = listPlayableZilchPlayerIds(state).find((id) => id !== hostId)!;
  state = applyZilchActionToState(state, 'zilchRandomiseStarter', {});
  if (guestStarts && state.zilch!.currentPlayerId !== guestId) {
    state = {
      ...state,
      zilch: { ...state.zilch!, currentPlayerId: guestId },
    };
  }
  return { state, hostId, guestId };
}

describe('Zilch host control', () => {
  it('host can control turn when guest is current player', () => {
    const { state, hostId, guestId } = challengeWithGuest(true);
    expect(state.zilch!.currentPlayerId).toBe(guestId);
    expect(canControlZilchTurn(state, hostId)).toBe(true);
    expect(canControlZilchTurn(state, guestId)).toBe(true);
  });

  it('Roll Dice is enabled for host after randomiser when guest starts', () => {
    const { state, hostId, guestId } = challengeWithGuest(true);
    expect(state.zilch!.currentPlayerId).toBe(guestId);
    expect(state.zilch!.currentPlayerId).not.toBe(hostId);
    expect(canControlZilchTurn(state, hostId)).toBe(true);
    expect(canInitialRollAllDice(state.zilch!)).toBe(true);

    render(
      <ZilchPlayArea
        zilch={state.zilch!}
        rolling={false}
        showValues
        animSeed={1}
        controlsDisabled={false}
        onKeepSelected={vi.fn()}
        onRollDice={vi.fn()}
        onBank={vi.fn()}
      />,
    );
    const rollBtn = screen.getByRole('button', { name: 'Roll Dice' }) as HTMLButtonElement;
    expect(rollBtn.disabled).toBe(false);
  });

  it('non-host cannot control when it is host turn in challenge', () => {
    const { state, hostId, guestId } = challengeWithGuest(false);
    if (state.zilch!.currentPlayerId === hostId) {
      expect(canControlZilchTurn(state, guestId)).toBe(false);
      expect(canControlZilchTurn(state, hostId)).toBe(true);
    }
  });

  it('ZilchPanel has no full-width command banner during play', () => {
    const { state } = challengeWithGuest(true);
    const html = renderToStaticMarkup(
      <ZilchPanel
        gameState={state}
        onGameStateChange={() => {}}
        viewerAuth={{ email: 'host@example.com', displayName: 'Host' }}
      />,
    );
    expect(html).not.toContain('zilch-panel__banner');
    expect(html).not.toContain('Not your turn');
    expect(html).not.toContain('Waiting for another player');
    expect(html).toContain('Roll Dice');
    expect(html).toContain('zilch-table__control-row');
  });

  it('shows compact inline error class not full banner', () => {
    const { state } = challengeWithGuest(true);
    render(
      <ZilchPlayArea
        zilch={state.zilch!}
        rolling={false}
        showValues
        animSeed={1}
        controlsDisabled={false}
        actionError="Not your turn"
        onDismissError={vi.fn()}
        onKeepSelected={vi.fn()}
        onRollDice={vi.fn()}
        onBank={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert').className).toContain('zilch-table__inline-error');
    expect(document.querySelector('.zilch-panel__banner')).toBeNull();
  });
});
