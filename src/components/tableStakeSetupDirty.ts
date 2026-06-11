import type { GameState, TableMode } from '../types';
import type { DealSpeedPreset } from '../engine/blackjack/flowSettings';
import { listBlackjackProtocolPresets } from '../engine/blackjack/protocols';
import { isNaturalInitialDeal } from '../engine/blackjack/dealing/dealingModes';
import type { TableBankerSetupMode } from '../engine/session';
import { DEFAULT_PRACTICE_TABLE_NAME } from '../types/tableFeltSkin';

export type NewSetupStage = 'game' | 'blackjack-mode' | 'configure';
export type SetupCategoryTab = 'cards' | 'dice';

export interface TableStakeSetupSnapshot {
  setupStage: NewSetupStage;
  setupTab: SetupCategoryTab;
  tableMode: TableMode;
  stake: string;
  tableName: string;
  invitedEmails: string[];
  inviteEmailInput: string;
  challengeBank: string;
  seatChips: string;
  bankChips: string;
  bankChipsCustom: boolean;
  bankerMode: TableBankerSetupMode;
  bankerName: string;
  protocolId: string;
  zilchMode: 'target_points' | 'fixed_rounds';
  targetPoints: string;
  roundLimit: string;
  diceAnimMode: 'fixed' | 'random';
  diceAnimMs: string;
  diceAnimMin: string;
  diceAnimMax: string;
  advancedOpen: boolean;
  naturalDealing: boolean;
  dealSpeedPreset: DealSpeedPreset;
  cardTimerPreset: number;
  bankDrawAuto: boolean;
  inviteNote: string;
}

export interface TableStakeSetupSnapshotInput {
  gameState: GameState;
  setupStage: NewSetupStage;
  setupTab: SetupCategoryTab;
  tableMode: TableMode;
  stake: string;
  tableName: string;
  invitedEmails: string[];
  inviteEmailInput: string;
  challengeBank: string;
  seatChips: string;
  bankChips: string;
  bankChipsCustom: boolean;
  bankerMode: TableBankerSetupMode;
  bankerName: string;
  protocolId: string;
  zilchMode: 'target_points' | 'fixed_rounds';
  targetPoints: string;
  roundLimit: string;
  diceAnimMode: 'fixed' | 'random';
  diceAnimMs: string;
  diceAnimMin: string;
  diceAnimMax: string;
  advancedOpen: boolean;
  naturalDealing: boolean;
  dealSpeedPreset: DealSpeedPreset;
  cardTimerPreset: number;
  bankDrawAuto: boolean;
  inviteNote: string;
}

/** Baseline snapshot when the staged New Table panel first opens. */
export function createInitialTableStakeSetupSnapshot(
  gameState: GameState,
): TableStakeSetupSnapshot {
  const flow = gameState.blackjackFlowSettings;
  const agreement = gameState.tableMeta.agreement;
  return {
    setupStage: 'game',
    setupTab:
      gameState.tableMeta.gameCategory === 'dice' || gameState.tableGame === 'zilch'
        ? 'dice'
        : 'cards',
    tableMode: 'practice',
    stake: agreement?.stakeDescription ?? '',
    tableName: gameState.tableMeta.tableClothName?.trim() || DEFAULT_PRACTICE_TABLE_NAME,
    invitedEmails: [],
    inviteEmailInput: '',
    challengeBank: 'self',
    seatChips: String(gameState.tableMeta.startingChipsEachSeat ?? 500),
    bankChips: String(
      gameState.tableMeta.startingChipsBank ??
        gameState.tableMeta.startingChipsEachSeat ??
        500,
    ),
    bankChipsCustom: false,
    bankerMode: 'bot',
    bankerName: gameState.tableMeta.bankerSetup.displayName ?? '',
    protocolId:
      gameState.blackjackProtocolId ??
      listBlackjackProtocolPresets()[0]?.protocolId ??
      'las-vegas-house',
    zilchMode: gameState.zilchSettings.mode ?? 'target_points',
    targetPoints: String(gameState.zilchSettings.targetPoints ?? 100),
    roundLimit: String(gameState.zilchSettings.roundLimit ?? 10),
    diceAnimMode: gameState.zilchSettings.diceAnimation.diceAnimationMode,
    diceAnimMs: String(gameState.zilchSettings.diceAnimation.diceAnimationMs),
    diceAnimMin: String(gameState.zilchSettings.diceAnimation.diceAnimationRandomMinMs),
    diceAnimMax: String(gameState.zilchSettings.diceAnimation.diceAnimationRandomMaxMs),
    advancedOpen: false,
    naturalDealing: isNaturalInitialDeal(flow.initialDealMode),
    dealSpeedPreset: flow.dealSpeedPreset,
    cardTimerPreset: flow.cardTimerPreset,
    bankDrawAuto: flow.bankDrawMode === 'auto',
    inviteNote: '',
  };
}

export function collectTableStakeSetupSnapshot(
  input: TableStakeSetupSnapshotInput,
): TableStakeSetupSnapshot {
  return {
    setupStage: input.setupStage,
    setupTab: input.setupTab,
    tableMode: input.tableMode,
    stake: input.stake,
    tableName: input.tableName,
    invitedEmails: [...input.invitedEmails],
    inviteEmailInput: input.inviteEmailInput,
    challengeBank: input.challengeBank,
    seatChips: input.seatChips,
    bankChips: input.bankChips,
    bankChipsCustom: input.bankChipsCustom,
    bankerMode: input.bankerMode,
    bankerName: input.bankerName,
    protocolId: input.protocolId,
    zilchMode: input.zilchMode,
    targetPoints: input.targetPoints,
    roundLimit: input.roundLimit,
    diceAnimMode: input.diceAnimMode,
    diceAnimMs: input.diceAnimMs,
    diceAnimMin: input.diceAnimMin,
    diceAnimMax: input.diceAnimMax,
    advancedOpen: input.advancedOpen,
    naturalDealing: input.naturalDealing,
    dealSpeedPreset: input.dealSpeedPreset,
    cardTimerPreset: input.cardTimerPreset,
    bankDrawAuto: input.bankDrawAuto,
    inviteNote: input.inviteNote,
  };
}

function snapshotsEqual(a: TableStakeSetupSnapshot, b: TableStakeSetupSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** True when the user has changed anything from the initial New Table baseline. */
export function isTableStakeSetupDirty(
  baseline: TableStakeSetupSnapshot,
  current: TableStakeSetupSnapshot,
): boolean {
  return !snapshotsEqual(baseline, current);
}
