import type { GameState } from '../../../types';
import { listPlayableZilchPlayerIds, canBeginZilchChallenge } from './zilchTurnAuthority';
import type { ZilchGameSettings, ZilchTableMode } from './zilchTypes';
import { isZilchTable } from '../../session/zilchTableKind';
import {
  bankTurn,
  completeDiceRoll,
  confirmStarter,
  createInitialZilchState,
  advanceAfterZilchReveal,
  keepCombination,
  holdSelectedDice,
  randomiseStarter,
  rollDice,
} from './zilchEngine';
import { normalizeZilchState } from './normalizeZilchState';

function resolveZilchPlayerIds(state: GameState): string[] {
  return listPlayableZilchPlayerIds(state);
}

/** Ensure zilch engine state exists before gameplay actions (repair on load/dispatch). */
export function ensureZilchGameOnState(state: GameState): GameState {
  if (state.zilch) {
    return state;
  }
  if (!isZilchTable(state)) {
    throw new Error('No Zilch game in progress');
  }
  const playerIds = resolveZilchPlayerIds(state);
  if (playerIds.length === 0) {
    throw new Error('Add at least one player before starting Zilch');
  }
  return startZilchGameOnState(state, playerIds, state.zilchSettings);
}

export const ZILCH_GAMEPLAY_ACTIONS = [
  'zilchRandomiseStarter',
  'zilchConfirmStarter',
  'zilchRollDice',
  'zilchCompleteRoll',
  'zilchKeepCombination',
  'zilchBankTurn',
  'zilchQuitTurn',
  'zilchAdvanceAfterReveal',
] as const;

export type ZilchGameplayAction = (typeof ZILCH_GAMEPLAY_ACTIONS)[number];

export function isZilchGameplayAction(action: string): action is ZilchGameplayAction {
  return (ZILCH_GAMEPLAY_ACTIONS as readonly string[]).includes(action);
}

export function applyZilchActionToState(
  state: GameState,
  action: ZilchGameplayAction,
  payload: Record<string, unknown> = {},
): GameState {
  const ready = ensureZilchGameOnState(state);
  const settings = ready.zilchSettings;
  let zilch = ready.zilch!;

  switch (action) {
    case 'zilchRandomiseStarter':
      if (!canBeginZilchChallenge(ready)) {
        throw new Error('Invite at least one player to start Challenge.');
      }
      zilch = randomiseStarter(zilch);
      break;
    case 'zilchConfirmStarter':
      zilch = confirmStarter(zilch);
      break;
    case 'zilchRollDice':
      zilch = rollDice(zilch, settings);
      break;
    case 'zilchCompleteRoll':
      zilch = completeDiceRoll(zilch);
      break;
    case 'zilchKeepCombination': {
      const diceIds = payload.diceIds;
      const combinationId = String(payload.combinationId ?? '');
      if (Array.isArray(diceIds) && diceIds.length > 0) {
        zilch = holdSelectedDice(zilch, diceIds.map(String));
      } else if (combinationId) {
        zilch = keepCombination(zilch, combinationId);
      } else {
        throw new Error('combinationId or diceIds required');
      }
      break;
    }
    case 'zilchBankTurn':
      zilch = bankTurn(zilch);
      break;
    case 'zilchQuitTurn':
      zilch = bankTurn(zilch);
      break;
    case 'zilchAdvanceAfterReveal':
      zilch = advanceAfterZilchReveal(zilch);
      break;
    default:
      throw new Error(`Unknown Zilch action: ${action}`);
  }

  return { ...ready, zilch: normalizeZilchState(zilch) };
}

/** @alias applyZilchActionToState */
export const applyZilchAction = applyZilchActionToState;

export function startZilchGameOnState(
  state: GameState,
  playerIds: string[],
  settings: ZilchGameSettings,
  options: { tableMode?: ZilchTableMode } = {},
): GameState {
  const tableMode =
    options.tableMode ??
    (state.tableMeta.tableMode === 'challenge' ? 'challenge' : 'practice');
  return {
    ...state,
    zilch: normalizeZilchState(
      createInitialZilchState(playerIds, settings, {
        tableMode,
        wagerMetadata: state.tableMeta.agreement?.stakeDescription
          ? { stakeDescription: state.tableMeta.agreement.stakeDescription }
          : undefined,
      }),
    ),
    zilchSettings: settings,
    tableMeta: {
      ...state.tableMeta,
      gameCategory: 'dice',
      diceGame: 'zilch',
      protocolLocked: true,
    },
  };
}
