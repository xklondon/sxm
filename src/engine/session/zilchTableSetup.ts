import type { GameState } from '../../types';
import type { ZilchMode } from '../zilch/zilchTypes';
import { listPlayableZilchPlayerIds } from '../dice/zilch/zilchTurnAuthority';
import { DEFAULT_ZILCH_DICE_ANIMATION } from '../zilch/settings';
import { addVirtualPlayer, mergeSessionUpdate } from './session';
import {
  ensureZilchGameOnState,
  startZilchGameOnState,
} from '../zilch/applyZilchAction';
import { getZilchWinnerId } from '../dice/zilch/zilchSelectors';
import {
  assignBankBot,
  assignBankPerson,
} from './boxOps';
import { ensureTableOwnerPersonBankroll } from './ownerBankroll';
import { setTableOwner } from './invites';
import {
  confirmTableAgreement,
  DEFAULT_TABLE_CHIPS,
  recordTableOutcome,
  switchGameType,
} from './table';
import {
  logDerivedBalances,
  logLedgerAfterAllocation,
  logTableMetaStartingChips,
} from './tokens';
import type { TableBankerSetupMode, TableStakeSetupInput } from './tableSetup';
import { resolveTableMode } from './tableSetup';
import { ensureZilchTableIdentity } from './zilchTableKind';
import {
  allocateRemainingSeatBankrolls,
  appendTableResetLedgerNote,
  clearGameStateForReset,
} from './tableReset';

export interface ZilchTableStakeSetupInput extends TableStakeSetupInput {
  zilchMode: ZilchMode;
  targetPoints: number;
  roundLimit: number;
  diceAnimationMode: 'fixed' | 'random';
  diceAnimationMs: number;
  diceAnimationRandomMinMs: number;
  diceAnimationRandomMaxMs: number;
  /** Practice mode only — virtual opponents controlled by the host. */
  virtualPlayerCount?: number;
}

export function parseZilchTableStakePayload(
  payload: Record<string, unknown>,
  fallbackController: string,
): ZilchTableStakeSetupInput {
  const base = {
    stakeDescription: String(payload.stakeDescription ?? 'Friendly game'),
    seatChips: Number(payload.seatChips) || DEFAULT_TABLE_CHIPS,
    bankChips: Number(payload.bankChips) || DEFAULT_TABLE_CHIPS,
    bankerMode: (payload.bankerMode as TableBankerSetupMode) ?? 'bot',
    bankerName: String(payload.bankerName ?? ''),
    controllerName: String(payload.controllerName ?? fallbackController).trim() || fallbackController,
    controllerEmail: String(payload.controllerEmail ?? ''),
    protocolId: 'zilch',
    naturalDealing: false,
    dealSpeedPreset: 'normal' as const,
    cardTimerPreset: 0 as const,
    bankDrawAuto: true,
  };
  const mode = payload.zilchMode === 'fixed_rounds' ? 'fixed_rounds' : 'target_points';
  const tableMode =
    payload.tableMode === 'practice' || payload.tableMode === 'challenge'
      ? payload.tableMode
      : undefined;
  return {
    ...base,
    tableMode,
    virtualPlayerCount:
      tableMode === 'practice' ? Number(payload.virtualPlayerCount) || 2 : undefined,
    zilchMode: mode,
    targetPoints: Number(payload.targetPoints) || 100,
    roundLimit: Number(payload.roundLimit) || 10,
    diceAnimationMode: payload.diceAnimationMode === 'random' ? 'random' : 'fixed',
    diceAnimationMs: Number(payload.diceAnimationMs) || DEFAULT_ZILCH_DICE_ANIMATION.diceAnimationMs,
    diceAnimationRandomMinMs:
      Number(payload.diceAnimationRandomMinMs) || DEFAULT_ZILCH_DICE_ANIMATION.diceAnimationRandomMinMs,
    diceAnimationRandomMaxMs:
      Number(payload.diceAnimationRandomMaxMs) || DEFAULT_ZILCH_DICE_ANIMATION.diceAnimationRandomMaxMs,
  };
}

export function applyZilchTableStakeSetup(
  state: GameState,
  input: ZilchTableStakeSetupInput,
): GameState {
  const seatAmount = input.seatChips;
  const bankAmount = input.bankChips;
  const tableMode = resolveTableMode(input);
  const isPractice = tableMode === 'practice';
  const stakeDescription = isPractice
    ? input.stakeDescription.trim() || 'Practice'
    : input.stakeDescription.trim() || 'Friendly wager';

  let next = confirmTableAgreement(state, stakeDescription, seatAmount, bankAmount);
  next = setTableOwner(next, input.controllerName, input.controllerEmail);
  next = {
    ...next,
    tableMeta: {
      ...next.tableMeta,
      controllerName: input.controllerName,
      showBankerSetup: false,
      showStakeSetup: false,
      gameCategory: 'dice',
      diceGame: 'zilch',
      tableMode,
      tableClothName: input.tableName?.trim() || next.tableMeta.tableClothName,
      tableClothWager: isPractice ? stakeDescription : stakeDescription,
    },
    zilchSettings: {
      mode: input.zilchMode,
      targetPoints: input.targetPoints,
      roundLimit: input.roundLimit,
      diceAnimation: {
        diceAnimationMode: input.diceAnimationMode,
        diceAnimationMs: input.diceAnimationMs,
        diceAnimationRandomMinMs: input.diceAnimationRandomMinMs,
        diceAnimationRandomMaxMs: input.diceAnimationRandomMaxMs,
      },
    },
  };

  if (!isPractice) {
    if (input.bankerMode === 'bot') {
      next = assignBankBot(next, bankAmount);
    } else if (input.bankerMode === 'self') {
      next = assignBankPerson(next, input.controllerName, bankAmount);
    } else {
      next = assignBankPerson(next, input.bankerName.trim(), bankAmount);
    }
  }

  if (isPractice) {
    const count = Math.max(1, input.virtualPlayerCount ?? 2);
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const spl = addVirtualPlayer(next.session, next.players, next.ledger, {
          virtualStyle: 'normal',
        });
        next = mergeSessionUpdate(next, spl);
      }
    }
  }

  next = ensureTableOwnerPersonBankroll(next);
  logLedgerAfterAllocation(next, 'zilch-start');
  logDerivedBalances(next, 'zilch-start');
  logTableMetaStartingChips(next, 'zilch-start');

  next = switchGameType(next, 'zilch');
  next = ensureZilchTableIdentity(next);
  return initializeZilchPlayState(next);
}

function resolveZilchPlayerIds(state: GameState): string[] {
  return listPlayableZilchPlayerIds(state);
}

/** Create fresh zilch engine state in setup phase (ready for random starter). */
export function initializeZilchPlayState(state: GameState): GameState {
  const playerIds = resolveZilchPlayerIds(state);
  if (playerIds.length === 0) {
    return state;
  }
  return startZilchGameOnState(state, playerIds, state.zilchSettings);
}

export function beginZilchPlay(state: GameState): GameState {
  if (state.session.gameType !== 'zilch' && state.tableGame !== 'zilch') {
    throw new Error('Not a Zilch table');
  }
  if (state.zilch && state.zilch.phase !== 'setup') {
    return state;
  }
  return ensureZilchGameOnState(state);
}

/**
 * Reset a Zilch table for a new game: same table id, players, invites; fresh zilch state.
 */
export function applyZilchTableResetSetup(
  state: GameState,
  input: ZilchTableStakeSetupInput,
  resetByPersonId: string | null = null,
): GameState {
  let next = clearGameStateForReset(state);
  next = appendTableResetLedgerNote(next, resetByPersonId);
  next = applyZilchTableStakeSetup(next, input);
  next = allocateRemainingSeatBankrolls(next);
  return {
    ...next,
    tableGame: 'zilch',
    session: { ...next.session, gameType: 'zilch' },
    tableMeta: {
      ...next.tableMeta,
      showStakeSetup: false,
      gameCategory: 'dice',
      diceGame: 'zilch',
    },
  };
}

/** Record Zilch game completion for table outcome + personal ledger eligibility. */
export function recordZilchGameEnd(state: GameState): GameState {
  const zilch = state.zilch;
  if (!zilch || zilch.phase !== 'completed') {
    return state;
  }
  if (state.tableMeta.gameStatus === 'ended') {
    return state;
  }
  const winnerId = zilch.winnerPlayerId ?? getZilchWinnerId(zilch);
  const loserId =
    zilch.players.map((p) => p.playerId).find((id) => id !== winnerId) ??
    state.session.bankPlayerId ??
    null;
  const modeLabel =
    zilch.mode === 'fixed_rounds'
      ? `${zilch.roundLimit ?? '?'} rounds`
      : `target ${zilch.targetPoints ?? '?'} points`;
  const scoreLine = Object.entries(zilch.totalScoresByPlayerId)
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => `${state.players[id]?.displayName ?? id}: ${score}`)
    .join(' · ');

  let next = recordTableOutcome(state, winnerId, loserId);
  return {
    ...next,
    tableMeta: {
      ...next.tableMeta,
      gameStatus: 'ended',
      winnerId,
      gameEndReason: 'zilch-completed',
      endedAt: new Date().toISOString(),
      status: 'complete',
      outcome: next.tableMeta.outcome
        ? {
            ...next.tableMeta.outcome,
            note: `Zilch (${modeLabel}) · ${scoreLine}`,
          }
        : next.tableMeta.outcome,
    },
  };
}
