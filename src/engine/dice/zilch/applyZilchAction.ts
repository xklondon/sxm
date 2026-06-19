import type { GameState } from '../../../types';
import type { ZilchGameSettings, ZilchTableMode } from './zilchTypes';
import {
  bankTurn,
  completeDiceRoll,
  confirmStarter,
  createInitialZilchState,
  keepCombination,
  randomiseStarter,
  rollDice,
} from './zilchEngine';
import { normalizeZilchState } from './normalizeZilchState';

export const ZILCH_GAMEPLAY_ACTIONS = [
  'zilchRandomiseStarter',
  'zilchConfirmStarter',
  'zilchRollDice',
  'zilchCompleteRoll',
  'zilchKeepCombination',
  'zilchBankTurn',
  'zilchQuitTurn',
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
  if (!state.zilch) {
    throw new Error('No Zilch game in progress');
  }
  const settings = state.zilchSettings;
  let zilch = state.zilch;

  switch (action) {
    case 'zilchRandomiseStarter':
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
      const combinationId = String(payload.combinationId ?? '');
      if (!combinationId) {
        throw new Error('combinationId required');
      }
      zilch = keepCombination(zilch, combinationId);
      break;
    }
    case 'zilchBankTurn':
      zilch = bankTurn(zilch);
      break;
    case 'zilchQuitTurn':
      zilch = bankTurn(zilch);
      break;
    default:
      throw new Error(`Unknown Zilch action: ${action}`);
  }

  return { ...state, zilch: normalizeZilchState(zilch) };
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
