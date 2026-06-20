import { describe, expect, it } from 'vitest';
import { createNewBlackjackTable } from '../engine/session';
import {
  collectTableStakeSetupSnapshot,
  createInitialTableStakeSetupSnapshot,
  isTableStakeSetupDirty,
} from './tableStakeSetupDirty';

describe('tableStakeSetupDirty', () => {
  it('is not dirty on initial open', () => {
    const gameState = createNewBlackjackTable();
    const baseline = createInitialTableStakeSetupSnapshot(gameState);
    const current = collectTableStakeSetupSnapshot({
      gameState,
      setupStage: 'category',
      setupTab: 'cards',
      tableMode: 'practice',
      stake: '',
      tableName: baseline.tableName,
      invitedEmails: [],
      invitedPlayers: [],
      inviteEmailInput: '',
      challengeBank: 'self',
      seatChips: baseline.seatChips,
      bankChips: baseline.bankChips,
      bankChipsCustom: false,
      bankerMode: 'bot',
      bankerName: '',
      protocolId: baseline.protocolId,
      zilchMode: 'target_points',
      targetPoints: '100',
      roundLimit: '10',
      diceAnimMode: 'fixed',
      diceAnimMs: '2500',
      diceAnimMin: '2000',
      diceAnimMax: '8000',
      advancedOpen: false,
      naturalDealing: baseline.naturalDealing,
      dealSpeedPreset: baseline.dealSpeedPreset,
      cardTimerPreset: baseline.cardTimerPreset,
      bankDrawAuto: baseline.bankDrawAuto,
      inviteNote: '',
    });
    expect(isTableStakeSetupDirty(baseline, current)).toBe(false);
  });

  it('is dirty after user advances stage or edits a field', () => {
    const gameState = createNewBlackjackTable();
    const baseline = createInitialTableStakeSetupSnapshot(gameState);
    const advanced = collectTableStakeSetupSnapshot({
      gameState,
      setupStage: 'mode',
      setupTab: 'cards',
      tableMode: 'practice',
      stake: '',
      tableName: baseline.tableName,
      invitedEmails: [],
      invitedPlayers: [],
      inviteEmailInput: '',
      challengeBank: 'self',
      seatChips: baseline.seatChips,
      bankChips: baseline.bankChips,
      bankChipsCustom: false,
      bankerMode: 'bot',
      bankerName: '',
      protocolId: baseline.protocolId,
      zilchMode: 'target_points',
      targetPoints: '100',
      roundLimit: '10',
      diceAnimMode: 'fixed',
      diceAnimMs: '2500',
      diceAnimMin: '2000',
      diceAnimMax: '8000',
      advancedOpen: false,
      naturalDealing: baseline.naturalDealing,
      dealSpeedPreset: baseline.dealSpeedPreset,
      cardTimerPreset: baseline.cardTimerPreset,
      bankDrawAuto: baseline.bankDrawAuto,
      inviteNote: '',
    });
    expect(isTableStakeSetupDirty(baseline, advanced)).toBe(true);
  });
});
