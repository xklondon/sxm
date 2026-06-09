import { describe, expect, it } from 'vitest';
import { createNewBlackjackTable } from './table';
import { applyTableStakeSetup, resolveTableMode } from './tableSetup';

describe('table setup modes', () => {
  it('practice mode assigns dealer bank and skips wager requirement', () => {
    const state = createNewBlackjackTable();
    const next = applyTableStakeSetup(state, {
      stakeDescription: '',
      seatChips: 500,
      bankChips: 500,
      bankerMode: 'self',
      bankerName: '',
      controllerName: 'Host',
      controllerEmail: 'host@example.com',
      protocolId: 'las-vegas-house',
      naturalDealing: false,
      dealSpeedPreset: 'fast',
      cardTimerPreset: 0,
      bankDrawAuto: true,
      tableMode: 'practice',
    });
    expect(next.tableMeta.tableMode).toBe('practice');
    expect(next.tableMeta.bankerSetup.mode).toBe('bot');
    expect(next.tableMeta.showStakeSetup).toBe(false);
  });

  it('challenge mode keeps wager and invited emails on meta', () => {
    const state = createNewBlackjackTable();
    const next = applyTableStakeSetup(state, {
      stakeDescription: 'Dinner',
      seatChips: 400,
      bankChips: 400,
      bankerMode: 'self',
      bankerName: '',
      controllerName: 'Host',
      controllerEmail: 'host@example.com',
      protocolId: 'las-vegas-house',
      naturalDealing: false,
      dealSpeedPreset: 'fast',
      cardTimerPreset: 0,
      bankDrawAuto: true,
      tableMode: 'challenge',
      invitedEmails: ['friend@example.com'],
    });
    expect(next.tableMeta.tableMode).toBe('challenge');
    expect(next.tableMeta.agreement?.stakeDescription).toBe('Dinner');
    expect(next.tableMeta.setupInvitedEmails).toEqual(['friend@example.com']);
    expect(next.tableMeta.bankerSetup.mode).toBe('person');
  });

  it('resolveTableMode infers from banker when mode omitted', () => {
    expect(
      resolveTableMode({
        stakeDescription: 'x',
        seatChips: 500,
        bankChips: 500,
        bankerMode: 'bot',
        bankerName: '',
        controllerName: 'H',
        controllerEmail: '',
        protocolId: 'las-vegas-house',
        naturalDealing: false,
        dealSpeedPreset: 'fast',
        cardTimerPreset: 0,
        bankDrawAuto: true,
      }),
    ).toBe('practice');
  });
});
