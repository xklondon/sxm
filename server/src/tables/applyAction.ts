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
  dealCardsButtonOnState,
  shuffleToStartOnState,
  hitBlackjackOnState,
  standBlackjackOnState,
  doubleDownBlackjackOnState,
  splitBlackjackOnState,
  takeInsuranceOnState,
  declineInsuranceOnState,
  takeEvenMoneyOnState,
  waitForBlackjackPayoutOnState,
} from '../../../src/engine/blackjack/gameState.js';
import { addGameToPersonalLedger } from '../../../src/engine/scoreLedger/scoreLedger.js';
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
    case 'shuffleToStart':
      return shuffleToStartOnState(state);
    case 'dealCards':
      return dealCardsButtonOnState(state);
    case 'hit':
      return hitBlackjackOnState(state, payload.handKey as string);
    case 'stand':
      return standBlackjackOnState(state, payload.handKey as string);
    case 'double':
      return doubleDownBlackjackOnState(state, payload.handKey as string);
    case 'split':
      return splitBlackjackOnState(state, payload.handKey as string);
    case 'takeInsurance':
      return takeInsuranceOnState(state, payload.playerId as string);
    case 'declineInsurance':
      return declineInsuranceOnState(state, payload.playerId as string);
    case 'takeEvenMoney':
      return takeEvenMoneyOnState(state, payload.handKey as string);
    case 'waitFor3to2':
      return waitForBlackjackPayoutOnState(state, payload.handKey as string);
    case 'addGameToPersonalLedger':
      addGameToPersonalLedger(state);
      return state;
    default:
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
