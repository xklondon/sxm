import type { GameState } from '../../types';
import type { IouHandoffCreateRequestBody } from '../../lib/iouHandoffPayload';
import {
  buildIouWalletNewUrl,
  detectIouTypeFromWager,
  IOU_GAME_MESSAGE,
  type GameEndIouHandoff,
} from '../../utils/iouWalletHandoff';
import {
  getLedgerBalanceForBankrollOwner,
  listPersonBankrollOwnerIds,
} from '../session/bankroll';
import {
  resolveWinnerDisplayName as resolveWinnerDisplayNameCore,
} from './challengeBankDisplay';
import {
  buildChallengeEndRankings,
  isFractionalChallengeEnd,
} from './challengeEndAccounting';

function isHumanPlayer(state: GameState, playerId: string): boolean {
  const player = state.players[playerId];
  return Boolean(player && player.playerType !== 'virtual');
}

function normalizeLabel(value: string | undefined | null): string {
  return value?.trim().toLowerCase() ?? '';
}

function ownerEmailFromMeta(state: GameState): string | null {
  const ownerEmail = state.tableMeta.owner?.ownerEmail?.trim().toLowerCase();
  return ownerEmail || null;
}

/** True when the bank seat is the table owner (e.g. challenge setup "Me" as bank). */
export function bankRepresentsTableOwner(state: GameState, bankId: string): boolean {
  if (!bankId || bankId !== state.session.bankPlayerId) {
    return false;
  }

  const ownerName = normalizeLabel(state.tableMeta.owner?.ownerName);
  if (!ownerName) {
    return false;
  }

  const setup = state.tableMeta.bankerSetup;
  if (setup.mode === 'person' && setup.playerId === bankId) {
    const setupName = normalizeLabel(setup.displayName);
    if (setupName && setupName === ownerName) {
      return true;
    }
  }

  const bank = state.players[bankId];
  const bankName = normalizeLabel(bank?.controllerName || bank?.displayName);
  if (bankName && bankName === ownerName) {
    return true;
  }

  const controllerName = normalizeLabel(state.tableMeta.controllerName);
  return controllerName === ownerName && bankName === ownerName;
}

/** Resolve email for a person/bank player id from owner + invite records. */
export function resolveEmailForPlayerId(state: GameState, playerId: string): string | null {
  const player = state.players[playerId];
  if (!player || player.playerType === 'virtual') {
    return null;
  }

  if (playerId === state.tableMeta.ownerPersonId) {
    const ownerEmail = ownerEmailFromMeta(state);
    if (ownerEmail) {
      return ownerEmail;
    }
  }

  const bankId = state.session.bankPlayerId;
  if (bankId && playerId === bankId && bankRepresentsTableOwner(state, bankId)) {
    const ownerEmail = ownerEmailFromMeta(state);
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

/** Non-bank opponent when the bank wins — prefer broke players, else sole non-bank human. */
function resolveBankWinLoserId(state: GameState, bankId: string): string | null {
  const candidates = listPersonBankrollOwnerIds(state).filter(
    (id) => id !== bankId && isHumanPlayer(state, id),
  );

  const broke = candidates.filter(
    (id) => getLedgerBalanceForBankrollOwner(state, id) <= 0,
  );
  if (broke.length === 1) {
    return broke[0]!;
  }

  if (candidates.length === 1) {
    return candidates[0]!;
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
  const fractional = isFractionalChallengeEnd(state, state.tableMeta.gameEndReason);

  if (fractional) {
    const nonBankWithChips = buildChallengeEndRankings(state).filter(
      (r) => !r.isBank && r.endingChips > 0,
    );
    if (nonBankWithChips.length !== 1 || !bankId) {
      return null;
    }
    const soleWinner = nonBankWithChips[0]!;
    if (!isHumanPlayer(state, soleWinner.playerId) || !isHumanPlayer(state, bankId)) {
      return null;
    }
    return {
      winnerId: soleWinner.playerId,
      loserId: bankId,
      winnerEmail: resolveEmailForPlayerId(state, soleWinner.playerId),
      loserEmail: resolveEmailForPlayerId(state, bankId),
    };
  }

  const winnerIsBank = Boolean(bankId && winnerId === bankId);

  let loserId: string | null = null;
  if (winnerIsBank) {
    if (!bankId) {
      return null;
    }
    loserId = resolveBankWinLoserId(state, bankId);
  } else if (bankId) {
    loserId = bankId;
  }

  if (loserId && !isHumanPlayer(state, loserId)) {
    loserId = null;
  }
  if (loserId && loserId === winnerId) {
    loserId = null;
  }
  if (winnerIsBank && loserId === bankId) {
    loserId = null;
  }
  if (!isHumanPlayer(state, winnerId)) {
    return null;
  }
  if (winnerIsBank && !loserId) {
    return null;
  }

  const winnerEmail = resolveEmailForPlayerId(state, winnerId);
  const loserEmail = loserId ? resolveEmailForPlayerId(state, loserId) : null;
  if (!winnerEmail || !loserEmail || winnerEmail === loserEmail) {
    return null;
  }

  return {
    winnerId,
    loserId,
    winnerEmail,
    loserEmail,
  };
}

export function buildIouHandoffCreateRequest(
  state: GameState,
  options?: { message?: string },
): IouHandoffCreateRequestBody | null {
  const parties = resolveGameEndParties(state);
  if (!parties?.winnerEmail || !parties.loserEmail) {
    return null;
  }

  const wager =
    state.tableMeta.agreement?.stakeDescription?.trim() || 'Blackjack wager';
  const customMessage = options?.message?.trim();

  return {
    tableId: state.session.id,
    sessionId: state.session.id,
    wagerDescription: wager,
    debtorEmail: parties.loserEmail,
    creditorEmail: parties.winnerEmail,
    creditorName: resolveWinnerDisplayName(state, parties.winnerId),
    gameType: state.tableGame ?? 'blackjack',
    title: wager,
    message: customMessage || undefined,
  };
}

/** True when both human parties have emails and the viewer is debtor or creditor. */
export function canCreateGameEndIou(state: GameState, viewerEmail: string): boolean {
  const request = buildIouHandoffCreateRequest(state);
  if (!request) {
    return false;
  }
  const viewer = viewerEmail.trim().toLowerCase();
  return viewer === request.debtorEmail || viewer === request.creditorEmail;
}

/**
 * @deprecated URL handoff — prefer server-side create via /api/iou-handoff/create.
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
  return canCreateGameEndIou(state, viewerEmail);
}

const IOU_MISSING_EMAIL_MESSAGE =
  'Cannot create IOU because one player is missing an email address.';

/** Hint when Create IOU is disabled on the game-over overlay. */
export function getGameEndIouDisabledReason(state: GameState): string {
  if (state.tableMeta.gameStatus !== 'ended') {
    return 'Add a counterparty email to create an IOU handoff.';
  }

  const parties = resolveGameEndParties(state);
  if (parties?.winnerId && parties.loserId && (!parties.winnerEmail || !parties.loserEmail)) {
    return IOU_MISSING_EMAIL_MESSAGE;
  }

  const winnerId = state.tableMeta.winnerId;
  const bankId = state.session.bankPlayerId;
  if (winnerId && isHumanPlayer(state, winnerId)) {
    const loserId =
      winnerId === bankId && bankId
        ? resolveBankWinLoserId(state, bankId)
        : bankId && winnerId !== bankId
          ? bankId
          : null;
    if (loserId) {
      const winnerEmail = resolveEmailForPlayerId(state, winnerId);
      const loserEmail = resolveEmailForPlayerId(state, loserId);
      if (!winnerEmail || !loserEmail) {
        return IOU_MISSING_EMAIL_MESSAGE;
      }
    }
  }

  return 'Add a counterparty email to create an IOU handoff.';
}

export function resolveWinnerDisplayName(state: GameState, winnerId: string): string {
  const name = resolveWinnerDisplayNameCore(state, winnerId);
  if (name && name !== 'Player' && name !== 'Dealer') {
    return name;
  }
  const email = resolveEmailForPlayerId(state, winnerId);
  if (email) {
    return email.split('@')[0] || email;
  }
  return name || 'Player';
}
