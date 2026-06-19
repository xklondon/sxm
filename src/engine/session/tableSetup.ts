import type { InvitedTablePlayerSetup } from '../../features/messaging/tableMessagingTypes';
import type { GameState, TableMode, BankBustSettlementMode } from '../../types';
import type { CardTimerPreset, DealSpeedPreset } from '../blackjack/flowSettings';
import { DEFAULT_PRACTICE_TABLE_NAME } from '../../types/tableFeltSkin';
import { updateBlackjackFlowSettings } from '../blackjack';
import { setBlackjackProtocolOnState } from '../blackjack/protocolState';
import {
  assignBankBot,
  assignBankPerson,
} from './boxOps';
import { ensureTableOwnerPersonBankroll } from './ownerBankroll';
import { setTableOwner } from './invites';
import {
  confirmTableAgreement,
  DEFAULT_TABLE_CHIPS,
} from './table';
import {
  logDerivedBalances,
  logLedgerAfterAllocation,
  logTableMetaStartingChips,
} from './tokens';

export type TableBankerSetupMode = 'bot' | 'self' | 'other';

export interface TableStakeSetupInput {
  stakeDescription: string;
  tableName?: string;
  seatChips: number;
  bankChips: number;
  bankerMode: TableBankerSetupMode;
  bankerName: string;
  controllerName: string;
  controllerEmail: string;
  protocolId: string;
  naturalDealing: boolean;
  dealSpeedPreset: DealSpeedPreset;
  cardTimerPreset: CardTimerPreset;
  bankDrawAuto: boolean;
  tableMode?: TableMode;
  invitedEmails?: string[];
  invitedPlayers?: InvitedTablePlayerSetup[];
  bankBustSettlementMode?: BankBustSettlementMode;
}

function normalizeInvitedPlayers(
  invitedPlayers: InvitedTablePlayerSetup[] | undefined,
  invitedEmails: string[] | undefined,
): InvitedTablePlayerSetup[] {
  if (invitedPlayers?.length) {
    return invitedPlayers
      .map((player) => ({
        email: player.email.trim().toLowerCase(),
        inviteMessage: player.inviteMessage?.trim() || undefined,
      }))
      .filter((player) => player.email);
  }
  return (invitedEmails ?? [])
    .map((email) => ({ email: email.trim().toLowerCase() }))
    .filter((player) => player.email);
}

export function resolveInvitedEmails(input: TableStakeSetupInput): string[] {
  return normalizeInvitedPlayers(input.invitedPlayers, input.invitedEmails).map((player) => player.email);
}

export function resolveInviteMessageForEmail(
  input: TableStakeSetupInput,
  email: string,
): string | undefined {
  const normalized = email.trim().toLowerCase();
  const player = normalizeInvitedPlayers(input.invitedPlayers, input.invitedEmails).find(
    (entry) => entry.email === normalized,
  );
  return player?.inviteMessage;
}

function parseBankBustSettlementMode(raw: unknown): BankBustSettlementMode | undefined {
  if (raw === 'winner-takes-all' || raw === 'winner_takes_all') {
    return 'winner-takes-all';
  }
  if (raw === 'fractional') {
    return 'fractional';
  }
  return undefined;
}

export function parseTableStakeSetupPayload(
  payload: Record<string, unknown>,
  fallbackController: string,
): TableStakeSetupInput {
  const seatChips = Number(payload.seatChips);
  const bankChips = Number(payload.bankChips);
  const bankerMode = payload.bankerMode as TableBankerSetupMode;
  return {
    stakeDescription: String(payload.stakeDescription ?? 'Friendly game'),
    tableName: typeof payload.tableName === 'string' ? payload.tableName : undefined,
    seatChips: Number.isFinite(seatChips) && seatChips > 0 ? seatChips : DEFAULT_TABLE_CHIPS,
    bankChips: Number.isFinite(bankChips) && bankChips > 0 ? bankChips : DEFAULT_TABLE_CHIPS,
    bankerMode: bankerMode === 'self' || bankerMode === 'other' ? bankerMode : 'bot',
    bankerName: String(payload.bankerName ?? ''),
    controllerName: String(payload.controllerName ?? fallbackController).trim() || fallbackController,
    controllerEmail: String(payload.controllerEmail ?? ''),
    protocolId: String(payload.protocolId ?? 'las-vegas-house'),
    naturalDealing: payload.naturalDealing === true,
    dealSpeedPreset: (payload.dealSpeedPreset as DealSpeedPreset) ?? 'fast',
    cardTimerPreset: (Number(payload.cardTimerPreset) || 0) as CardTimerPreset,
    bankDrawAuto: payload.bankDrawAuto !== false,
    tableMode:
      payload.tableMode === 'practice' || payload.tableMode === 'challenge'
        ? payload.tableMode
        : undefined,
    invitedEmails: Array.isArray(payload.invitedEmails)
      ? payload.invitedEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean)
      : undefined,
    invitedPlayers: Array.isArray(payload.invitedPlayers)
      ? payload.invitedPlayers
          .map((entry) => {
            const record = entry as Record<string, unknown>;
            return {
              email: String(record.email ?? '').trim().toLowerCase(),
              inviteMessage:
                typeof record.inviteMessage === 'string' ? record.inviteMessage.trim() : undefined,
            };
          })
          .filter((player) => player.email)
      : undefined,
    bankBustSettlementMode: parseBankBustSettlementMode(payload.bankBustSettlementMode),
  };
}

export function resolveTableMode(input: TableStakeSetupInput): TableMode {
  if (input.tableMode) {
    return input.tableMode;
  }
  return input.bankerMode === 'bot' ? 'practice' : 'challenge';
}

/** First-time table setup (new table or post–stake-panel confirm). */
export function applyTableStakeSetup(state: GameState, input: TableStakeSetupInput): GameState {
  const seatAmount = input.seatChips;
  const bankAmount = input.bankChips;
  const tableMode = resolveTableMode(input);
  const isPractice = tableMode === 'practice';
  const stakeDescription = isPractice
    ? input.stakeDescription.trim() || 'Practice'
    : input.stakeDescription.trim() || 'Friendly wager';
  const tableClothName = isPractice
    ? input.tableName?.trim() || DEFAULT_PRACTICE_TABLE_NAME
    : input.tableName?.trim() || stakeDescription;

  let next = confirmTableAgreement(state, stakeDescription, seatAmount, bankAmount);

  next = setTableOwner(next, input.controllerName, input.controllerEmail);

  const invitedEmails = resolveInvitedEmails(input);

  next = {
    ...next,
    tableMeta: {
      ...next.tableMeta,
      controllerName: input.controllerName,
      showBankerSetup: false,
      showStakeSetup: false,
      tableMode,
      setupInvitedEmails: invitedEmails.length > 0 ? invitedEmails : undefined,
      bankBustSettlementMode:
        tableMode === 'challenge' ? input.bankBustSettlementMode ?? 'fractional' : undefined,
      tableClothName,
      tableClothWager: isPractice ? 'Practice' : stakeDescription,
    },
  };

  if (isPractice || input.bankerMode === 'bot') {
    if (tableMode === 'challenge') {
      next = assignBankPerson(next, input.controllerName, bankAmount);
    } else {
      next = assignBankBot(next, bankAmount);
    }
  } else if (input.bankerMode === 'self') {
    next = assignBankPerson(next, input.controllerName, bankAmount);
  } else {
    next = assignBankPerson(next, input.bankerName.trim(), bankAmount);
  }

  next = ensureTableOwnerPersonBankroll(next);

  logLedgerAfterAllocation(next, 'start-playing');
  logDerivedBalances(next, 'start-playing');
  logTableMetaStartingChips(next, 'start-playing');
  next = setBlackjackProtocolOnState(next, input.protocolId, input.controllerName);
  next = updateBlackjackFlowSettings(next, {
    initialDealMode: input.naturalDealing ? 'natural' : 'staged',
    dealSpeedPreset: input.dealSpeedPreset,
    cardTimerPreset: input.cardTimerPreset,
    countdownSeconds: input.cardTimerPreset,
    bankDrawMode: input.bankDrawAuto ? 'auto' : 'manual',
  });

  return next;
}
