import { buildIouWalletNewUrl, detectIouTypeFromWager, IOU_GAME_MESSAGE, } from '../../utils/iouWalletHandoff';
import { listPersonBankrollOwnerIds } from '../session/bankroll';
import { resolveWinnerDisplayName as resolveWinnerDisplayNameCore, } from './challengeBankDisplay';
import { buildChallengeEndRankings, isFractionalChallengeEnd, } from './challengeEndAccounting';
function isHumanPlayer(state, playerId) {
    const player = state.players[playerId];
    return Boolean(player && player.playerType !== 'virtual');
}
/** Resolve email for a person/bank player id from owner + invite records. */
export function resolveEmailForPlayerId(state, playerId) {
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
        if (displayName &&
            inviteLabel &&
            displayName.toLowerCase() === inviteLabel.toLowerCase()) {
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
export function resolveGameEndParties(state) {
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
        const nonBankWithChips = buildChallengeEndRankings(state).filter((r) => !r.isBank && r.endingChips > 0);
        if (nonBankWithChips.length !== 1 || !bankId) {
            return null;
        }
        const soleWinner = nonBankWithChips[0];
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
    let loserId = null;
    if (winnerIsBank) {
        const persons = listPersonBankrollOwnerIds(state);
        loserId = persons[0] ?? state.tableMeta.ownerPersonId;
    }
    else if (bankId) {
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
export function buildIouHandoffCreateRequest(state) {
    const parties = resolveGameEndParties(state);
    if (!parties?.winnerEmail || !parties.loserEmail) {
        return null;
    }
    const wager = state.tableMeta.agreement?.stakeDescription?.trim() || 'Blackjack wager';
    return {
        tableId: state.session.id,
        sessionId: state.session.id,
        wagerDescription: wager,
        debtorEmail: parties.loserEmail,
        creditorEmail: parties.winnerEmail,
        creditorName: resolveWinnerDisplayName(state, parties.winnerId),
        gameType: state.tableGame ?? 'blackjack',
        title: wager,
    };
}
export function canCreateGameEndIou(state, viewerEmail) {
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
export function buildGameEndIouHandoff(state, viewerEmail) {
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
    let counterpartyEmail = null;
    if (viewer === loserEmail) {
        counterpartyEmail = winnerEmail;
    }
    else if (viewer === winnerEmail) {
        counterpartyEmail = loserEmail;
    }
    else {
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
export function canOfferGameEndIou(state, viewerEmail) {
    return canCreateGameEndIou(state, viewerEmail);
}
export function resolveWinnerDisplayName(state, winnerId) {
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
