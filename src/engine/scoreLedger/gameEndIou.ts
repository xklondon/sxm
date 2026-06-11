import type { GameState } from '../../types';
import {
  buildIouWalletNewUrl,
  detectIouTypeFromWager,
  IOU_GAME_MESSAGE,
  type GameEndIouHandoff,
} from '../../utils/iouWalletHandoff';
import { listPersonBankrollOwnerIds } from '../session/bankroll';

function bankShortName(state: GameState, bankId: string): string {
  const bank = state.players[bankId];
  if (!bank) {
    return 'Bank';
  }
  if (bank.playerType === 'virtual') {
    return bank.displayName.replace(/^Bank\s+/i, '').trim() || 'Dealer';
  }
  return bank.controllerName?.trim() || bank.displayName;
}

function personShortName(state: GameState, personId: string): string {
  const person = state.players[personId];
  return person?.controllerName?.trim() || person?.displayName || 'Player';
}

function isHumanPlayer(state: GameState, playerId: string): boolean {
  const player = state.players[playerId];
  return Boolean(player && player.playerType !== 'virtual');
}

/** Resolve email for a person/bank player id from owner + invite records. */
export function resolveEmailForPlayerId(state: GameState, playerId: string): string | null {
  const player = state.players[playerId];
  if (!player || player.playerType === 'virtual') {
    return null;
  }

  if (playerId === state.tableMeta.ownerPersonId) {
    const ownerEmail = state.tableMeta.owner?.ownerEmail?.trim().toLowerCase();
    if (ownerEmail) {
      return ownerEmail;
    }
  }

  const displayName = player.controllerName?.trim() || player.displayName?.trim() || '';
  for (const inv of state.tableMeta.invites ?? []) {
    const inviteEmail = inv.invitedEmail.trim().toLowerCase();
    const inviteLabel = inv.invitedName?.trim() || inviteEmail.split('@')[0] || '';
    if (
      displayName &&
      inviteLabel &&
      displayName.toLowerCase() === inviteLabel.toLowerCase()
    ) {
      return inviteEmail;
    }
  }

  for (const email of state.tableMeta.setupInvitedEmails ?? []) {
    const trimmed = email.trim().toLowerCase();
    const local = trimmed.split('@')[0] ?? '';
    if (displayName && local && displayName.toLowerCase() === local.toLowerCase()) {
      return trimmed;
    }
  }

  return null;
}

export interface GameEndParties {
  winnerId: string;
  loserId: string | null;
  winnerEmail: string | null;
  loserEmail: string | null;
}

export function resolveGameEndParties(state: GameState): GameEndParties | null {
  if (state.tableMeta.gameStatus !== 'ended') {
    return null;
  }

  const winnerId = state.tableMeta.winnerId;
  if (!winnerId) {
    return null;
  }

  const bankId = state.session.bankPlayerId;
  const winnerIsBank = Boolean(bankId && winnerId === bankId);

  let loserId: string | null = null;
  if (winnerIsBank) {
    const persons = listPersonBankrollOwnerIds(state);
    loserId = persons[0] ?? state.tableMeta.ownerPersonId;
  } else if (bankId) {
    loserId = bankId;
  }

  if (loserId && !isHumanPlayer(state, loserId)) {
    loserId = null;
  }
  if (!isHumanPlayer(state, winnerId)) {
    return null;
  }

  return {
    winnerId,
    loserId,
    winnerEmail: resolveEmailForPlayerId(state, winnerId),
    loserEmail: loserId ? resolveEmailForPlayerId(state, loserId) : null,
  };
}

/**
 * Build IOU handoff from loser (debtor) to winner (creditor).
 * counterpartyEmail is the other human party relative to the viewer.
 */
export function buildGameEndIouHandoff(
  state: GameState,
  viewerEmail: string,
): GameEndIouHandoff | null {
  const viewer = viewerEmail.trim().toLowerCase();
  if (!viewer) {
    return null;
  }

  const parties = resolveGameEndParties(state);
  if (!parties) {
    return null;
  }

  const { winnerEmail, loserEmail } = parties;
  if (!winnerEmail || !loserEmail) {
    return null;
  }

  let counterpartyEmail: string | null = null;
  if (viewer === loserEmail) {
    counterpartyEmail = winnerEmail;
  } else if (viewer === winnerEmail) {
    counterpartyEmail = loserEmail;
  } else {
    const participantEmails = [
      ...(state.tableMeta.setupInvitedEmails ?? []).map((e) => e.trim().toLowerCase()),
      state.tableMeta.owner?.ownerEmail?.trim().toLowerCase() ?? '',
    ].filter(Boolean);
    if (!participantEmails.includes(viewer)) {
      return null;
    }
    counterpartyEmail = winnerEmail;
  }

  if (!counterpartyEmail || counterpartyEmail === viewer) {
    return null;
  }

  const wager = state.tableMeta.agreement?.stakeDescription?.trim() || 'our wager';
  const url = buildIouWalletNewUrl({
    counterpartyEmail,
    title: wager,
    message: IOU_GAME_MESSAGE,
    type: detectIouTypeFromWager(wager),
    cryptoSettlement: false,
  });

  return { counterpartyEmail, url };
}

export function canOfferGameEndIou(state: GameState, viewerEmail: string): boolean {
  return buildGameEndIouHandoff(state, viewerEmail) !== null;
}

export function resolveWinnerDisplayName(state: GameState, winnerId: string): string {
  const bankId = state.session.bankPlayerId;
  const winnerIsBank = Boolean(bankId && winnerId === bankId);
  const name = winnerIsBank
    ? bankShortName(state, bankId!)
    : personShortName(state, winnerId);
  if (name && name !== 'Player' && name !== 'Dealer') {
    return name;
  }
  const email = resolveEmailForPlayerId(state, winnerId);
  if (email) {
    return email.split('@')[0] || email;
  }
  return name || 'Player';
}
