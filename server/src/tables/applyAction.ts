import type { GameState } from '../../../src/types/index.js';
import { createNewBlackjackTable } from '../../../src/engine/session/table.js';
import { claimBoxSlot } from '../../../src/engine/session/boxOps.js';
import { ensureBoxPositionForPerson } from '../../../src/engine/session/playerAssignment.js';
import {
  addChipToBoxStake,
  clearBoxStake,
  removeLastChipFromBoxStake,
} from '../../../src/engine/blackjack/stakes.js';
import {
  applyBlackjackActionToState,
  isBlackjackGameplayAction,
} from '../../../src/engine/blackjack/applyBlackjackAction.js';
import { addGameToPersonalLedger } from '../../../src/engine/scoreLedger/scoreLedger.js';
import { assignChips, type ChipAssignReason } from '../../../src/engine/session/tokens.js';
import { canUserAssignChips } from '../../../src/engine/table/adminControls.js';
import { applyTableResetSetup } from '../../../src/engine/session/tableReset.js';
import {
  applyTableStakeSetup,
  parseTableStakeSetupPayload,
} from '../../../src/engine/session/tableSetup.js';
import {
  applyZilchTableStakeSetup,
  parseZilchTableStakePayload,
} from '../../../src/engine/session/zilchTableSetup.js';
import {
  applyZilchActionToState,
  isZilchGameplayAction,
} from '../../../src/engine/zilch/applyZilchAction.js';
import { beginZilchPlay } from '../../../src/engine/session/zilchTableSetup.js';
import type { TableActionType } from './actions.js';

export function applyTableAction(
  state: GameState,
  action: TableActionType,
  payload: Record<string, unknown>,
  personId: string,
): GameState {
  switch (action) {
    case 'assignBox': {
      const slotNumber = Number(payload.slotNumber);
      if (!Number.isFinite(slotNumber)) {
        throw new Error('slotNumber required');
      }
      return claimBoxSlot(
        {
          ...state,
          tableMeta: {
            ...state.tableMeta,
            controllerName: state.players[personId]?.displayName ?? state.tableMeta.controllerName,
          },
        },
        slotNumber,
      );
    }
    case 'placeBet': {
      const amount = Number(payload.amount);
      if (!Number.isFinite(amount)) {
        throw new Error('amount required');
      }
      let next = state;
      let boxId = payload.boxId as string | undefined;
      const slotNumberRaw = payload.slotNumber;
      const slotNumber = slotNumberRaw !== undefined ? Number(slotNumberRaw) : undefined;

      if (slotNumber !== undefined && Number.isFinite(slotNumber)) {
        const slot = next.tableMeta.boxSlots.find((s) => s.slotNumber === slotNumber);
        if (!slot) {
          throw new Error('Invalid slot');
        }
        if (!slot.playerId) {
          next = ensureBoxPositionForPerson(next, slotNumber, personId);
          boxId = next.tableMeta.boxSlots.find((s) => s.slotNumber === slotNumber)?.playerId ?? undefined;
        } else {
          boxId = slot.playerId;
        }
      }

      if (!boxId) {
        throw new Error('boxId or slotNumber required');
      }
      return addChipToBoxStake(next, boxId, amount, personId);
    }
    case 'retractChip': {
      const boxId = payload.boxId as string;
      if (!boxId) throw new Error('boxId required');
      return removeLastChipFromBoxStake(state, boxId);
    }
    case 'clearBet': {
      const boxId = payload.boxId as string;
      if (!boxId) throw new Error('boxId required');
      return clearBoxStake(state, boxId);
    }
    case 'addGameToPersonalLedger':
      addGameToPersonalLedger(state);
      return state;
    case 'configureTable': {
      const caller = state.players[personId];
      const controllerName =
        caller?.controllerName?.trim() || caller?.displayName || state.tableMeta.controllerName;
      const input = parseTableStakeSetupPayload(payload, controllerName);
      return applyTableStakeSetup(state, input);
    }
    case 'resetTable': {
      const caller = state.players[personId];
      const controllerName =
        caller?.controllerName?.trim() || caller?.displayName || state.tableMeta.controllerName;
      if (payload.zilchMode !== undefined || state.tableGame === 'zilch') {
        const zilchInput = parseZilchTableStakePayload(payload, controllerName);
        return applyZilchTableStakeSetup(
          applyTableResetSetup(state, zilchInput, personId),
          zilchInput,
        );
      }
      const input = parseTableStakeSetupPayload(payload, controllerName);
      return applyTableResetSetup(state, input, personId);
    }
    case 'zilchStartGame':
      return beginZilchPlay(state);
    case 'assignChips': {
      const recipientId = payload.recipientId as string;
      const amount = Number(payload.amount);
      const reason = (payload.reason as ChipAssignReason) ?? 'top-up';
      if (!recipientId) {
        throw new Error('recipientId required');
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('amount must be a positive number');
      }
      const caller = state.players[personId];
      const callerLabel = caller?.controllerName?.trim() || caller?.displayName || '';
      if (!canUserAssignChips(state, callerLabel)) {
        throw new Error('Not authorized to assign chips');
      }
      return assignChips(state, recipientId, amount, reason);
    }
    default:
      // All blackjack gameplay actions (shuffle/deal/hit/stand/double/split/
      // insurance/even-money/nextRound) go through the single canonical engine
      // reducer shared with offline play. Player-turn actions ignore any
      // client-sent handKey and resolve on the authoritative active hand;
      // `resolveBankAuto` plays out the auto bank turn + settlement server-side
      // so online never mutates bank/settlement locally.
      if (isBlackjackGameplayAction(action)) {
        return applyBlackjackActionToState(state, action, {
          personId,
          payload,
          resolveBankAuto: true,
        });
      }
      if (isZilchGameplayAction(action)) {
        return applyZilchActionToState(state, action, payload);
      }
      throw new Error(`Action not applied on state: ${action}`);
  }
}

export function createHostedTableState(hostDisplayName: string): GameState {
  const state = createNewBlackjackTable();
  const now = new Date().toISOString();
  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      controllerName: hostDisplayName,
      showStakeSetup: false,
      agreement: {
        stakeDescription: 'Online table',
        defaultChips: 500,
        agreedAt: now,
      },
      startingChipsEachSeat: 500,
      startingChipsBank: 500,
    },
  };
}
