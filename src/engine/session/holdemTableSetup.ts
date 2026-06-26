import type { GameState } from '../../types';
import { mergeHoldemSettings } from '../holdem/settings';
import { addVirtualPlayer, mergeSessionUpdate } from './session';
import { ensureTableOwnerPersonBankroll } from './ownerBankroll';
import { setTableOwner } from './invites';
import {
  confirmTableAgreement,
  DEFAULT_TABLE_CHIPS,
  switchGameType,
} from './table';
import type { TableStakeSetupInput } from './tableSetup';
import { resolveInvitedEmails, resolveTableMode } from './tableSetup';
import {
  logDerivedBalances,
  logLedgerAfterAllocation,
  logTableMetaStartingChips,
} from './tokens';
import { ensureHoldemTableIdentity } from './zilchTableKind';
import { createDefaultPokerTableConfig, validatePokerBlinds } from '../../types/poker';
import { allocateChipsToBankrollOwner } from './allocation';
import { listHoldemPlayableSeatIds, pruneHoldemSessionForPlay } from '../holdem/holdemPlayableSeats';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';

export interface HoldemTableStakeSetupInput extends TableStakeSetupInput {
  smallBlind: number;
  bigBlind: number;
  totalChallengeValue?: number;
  currency?: string;
  /** Practice mode only — virtual opponents controlled by the host. */
  virtualPlayerCount?: number;
}

export function parseHoldemTableStakePayload(
  payload: Record<string, unknown>,
  fallbackController: string,
): HoldemTableStakeSetupInput {
  const tableMode =
    payload.tableMode === 'practice' || payload.tableMode === 'challenge'
      ? payload.tableMode
      : undefined;
  return {
    stakeDescription: String(payload.stakeDescription ?? 'Friendly game'),
    tableName: payload.tableName ? String(payload.tableName) : undefined,
    seatChips: Number(payload.seatChips) || DEFAULT_TABLE_CHIPS,
    bankChips: Number(payload.bankChips) || DEFAULT_TABLE_CHIPS,
    bankerMode: (payload.bankerMode as HoldemTableStakeSetupInput['bankerMode']) ?? 'self',
    bankerName: String(payload.bankerName ?? fallbackController).trim() || fallbackController,
    controllerName: String(payload.controllerName ?? fallbackController).trim() || fallbackController,
    controllerEmail: String(payload.controllerEmail ?? ''),
    protocolId: 'texas-holdem',
    naturalDealing: false,
    dealSpeedPreset: 'normal',
    cardTimerPreset: 0,
    bankDrawAuto: true,
    tableMode,
    invitedEmails: Array.isArray(payload.invitedEmails)
      ? payload.invitedEmails.map((e) => String(e))
      : undefined,
    invitedPlayers: Array.isArray(payload.invitedPlayers)
      ? (payload.invitedPlayers as HoldemTableStakeSetupInput['invitedPlayers'])
      : undefined,
    smallBlind: Number(payload.smallBlind) || 5,
    bigBlind: Number(payload.bigBlind) || 10,
    totalChallengeValue:
      payload.totalChallengeValue !== undefined
        ? Number(payload.totalChallengeValue)
        : undefined,
    currency: payload.currency ? String(payload.currency) : undefined,
    virtualPlayerCount:
      tableMode === 'practice' ? Number(payload.virtualPlayerCount) || 1 : undefined,
  };
}

function allocateStartingStacks(state: GameState, startingStack: number): GameState {
  let next = state;
  for (const playerId of listHoldemPlayableSeatIds(next)) {
    const player = next.players[playerId];
    if (!player) {
      continue;
    }
    const bankrollOwnerId = player.bankrollOwnerId ?? playerId;
    if (derivePlayerBalanceFromLedger(playerId, next.ledger) > 0) {
      continue;
    }
    next = allocateChipsToBankrollOwner(next, {
      bankrollOwnerId,
      amount: startingStack,
      reason: 'initial-player',
      source: 'setup',
    });
  }
  return next;
}

export function applyHoldemTableStakeSetup(
  state: GameState,
  input: HoldemTableStakeSetupInput,
): GameState {
  const startingStack = input.seatChips;
  const tableMode = resolveTableMode(input);
  const isPractice = tableMode === 'practice';
  const blindError = validatePokerBlinds(input.smallBlind, input.bigBlind);
  if (blindError) {
    throw new Error(blindError);
  }
  const stakeDescription = isPractice
    ? input.stakeDescription.trim() || 'Practice'
    : input.stakeDescription.trim() || 'Friendly wager';

  let next = confirmTableAgreement(state, stakeDescription, startingStack, startingStack);
  next = setTableOwner(next, input.controllerName, input.controllerEmail);
  next = {
    ...next,
    tableMeta: {
      ...next.tableMeta,
      controllerName: input.controllerName,
      showBankerSetup: false,
      showStakeSetup: false,
      gameCategory: 'cards',
      cardGame: 'holdem',
      tableMode,
      tableClothName: input.tableName?.trim() || next.tableMeta.tableClothName,
      tableClothWager: stakeDescription,
      setupInvitedEmails: isPractice ? [] : resolveInvitedEmails(input),
      startingChipsEachSeat: startingStack,
      pokerConfig: createDefaultPokerTableConfig({
        mode: tableMode,
        wagerLabel: stakeDescription,
        totalChallengeValue: isPractice ? undefined : input.totalChallengeValue,
        currency: input.currency ?? '$',
        startingStack,
        smallBlind: input.smallBlind,
        bigBlind: input.bigBlind,
        handNumber: 0,
      }),
    },
    holdemSettings: mergeHoldemSettings({
      smallBlind: input.smallBlind,
      bigBlind: input.bigBlind,
    }),
  };

  next = ensureTableOwnerPersonBankroll(next);

  if (isPractice) {
    const count = Math.max(1, input.virtualPlayerCount ?? 1);
    for (let i = 0; i < count; i++) {
      const spl = addVirtualPlayer(next.session, next.players, next.ledger, {
        virtualStyle: 'normal',
        displayName: `Virtual Player ${i + 2}`,
        startingChips: startingStack,
      });
      next = mergeSessionUpdate(next, spl);
    }
  }

  next = pruneHoldemSessionForPlay(next);
  next = allocateStartingStacks(next, startingStack);
  logLedgerAfterAllocation(next, 'holdem-start');
  logDerivedBalances(next, 'holdem-start');
  logTableMetaStartingChips(next, 'holdem-start');

  next = switchGameType(next, 'texas-holdem');
  next = ensureHoldemTableIdentity(next);

  const firstPlayerId = next.session.playerIds[0] ?? null;
  if (firstPlayerId && next.tableMeta.pokerConfig) {
    next = {
      ...next,
      tableMeta: {
        ...next.tableMeta,
        pokerConfig: {
          ...next.tableMeta.pokerConfig,
          dealerSeatId: firstPlayerId,
        },
      },
    };
  }

  return next;
}

export function applyHoldemTableResetSetup(
  state: GameState,
  input: HoldemTableStakeSetupInput,
  _personId: string,
): GameState {
  return applyHoldemTableStakeSetup(state, input);
}

export function updatePokerBlindsOnState(
  state: GameState,
  smallBlind: number,
  bigBlind: number,
): GameState {
  if (!state.tableMeta.pokerConfig) {
    return state;
  }
  const handStarted =
    state.holdem !== null &&
    state.holdem.status !== 'setup' &&
    state.holdem.status !== 'resolved';
  if (handStarted) {
    throw new Error('Blinds can only be changed before a hand starts.');
  }
  const validationError = validatePokerBlinds(smallBlind, bigBlind);
  if (validationError) {
    throw new Error(validationError);
  }
  return {
    ...state,
    holdemSettings: mergeHoldemSettings({ smallBlind, bigBlind }),
    tableMeta: {
      ...state.tableMeta,
      pokerConfig: {
        ...state.tableMeta.pokerConfig,
        smallBlind,
        bigBlind,
      },
    },
  };
}

export function rotatePokerDealerOnState(state: GameState): GameState {
  const config = state.tableMeta.pokerConfig;
  if (!config) {
    return state;
  }
  const order = state.session.playerIds;
  if (order.length === 0) {
    return state;
  }
  const currentIndex = config.dealerSeatId
    ? order.indexOf(config.dealerSeatId)
    : -1;
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % order.length : 0;
  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      pokerConfig: {
        ...config,
        dealerSeatId: order[nextIndex],
        handNumber: config.handNumber + 1,
      },
    },
  };
}
