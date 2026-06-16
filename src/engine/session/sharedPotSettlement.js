import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import { appendBankLedgerEntry } from '../blackjack/bankLedger';
import { bankrollContextFromState, listBankrollParticipantIds, resolveBankrollOwnerId, } from './bankroll';
import { appendBoxLedgerEntry } from './boxLedger';
import { personsShareOneChipPot, resolveCanonicalBankrollOwnerId } from './sharedBankroll';
function settlementStateSlice(session, ctx) {
    return {
        session,
        players: ctx.players,
        tableMeta: {
            ownerPersonId: ctx.ownerPersonId ?? null,
            bankerSetup: ctx.bankerSetup ?? { mode: 'bot', playerId: null, displayName: '' },
        },
    };
}
/** True when box vs bank settlement is an internal move inside one shared chip pot. */
export function boxSettlesAsInternalBankPotTransfer(session, ctx, boxPlayerId) {
    const bankId = session.bankPlayerId;
    if (!bankId) {
        return false;
    }
    const ownerId = resolveBankrollOwnerId(ctx, boxPlayerId);
    return personsShareOneChipPot(settlementStateSlice(session, ctx), ownerId, bankId);
}
export function boxSettlesAsInternalBankPotTransferFromState(state, boxPlayerId) {
    return boxSettlesAsInternalBankPotTransfer(state.session, bankrollContextFromState(state), boxPlayerId);
}
export function appendBoxLedgerEntryUnlessInternalPot(session, ledger, ctx, boxPlayerId, entryType, amount, description, roundNumber, committedBet) {
    if (boxSettlesAsInternalBankPotTransfer(session, ctx, boxPlayerId)) {
        if (entryType === 'win-paid') {
            const bet = committedBet ?? 0;
            if (bet <= 0) {
                return { session, ledger };
            }
            return appendBoxLedgerEntry(session, ledger, ctx, boxPlayerId, entryType, bet, description, roundNumber);
        }
        if (entryType === 'loss-collected') {
            const bet = committedBet ?? 0;
            if (bet > 0) {
                return appendBoxLedgerEntry(session, ledger, ctx, boxPlayerId, 'push-refund', bet, description, roundNumber);
            }
            return { session, ledger };
        }
    }
    return appendBoxLedgerEntry(session, ledger, ctx, boxPlayerId, entryType, amount, description, roundNumber);
}
export function appendBankLedgerEntryUnlessInternalPot(session, ledger, ctx, boxPlayerId, bankPlayerId, amount, description, roundNumber) {
    if (amount === 0 || boxSettlesAsInternalBankPotTransfer(session, ctx, boxPlayerId)) {
        return { session, ledger };
    }
    return appendBankLedgerEntry(session, ledger, bankPlayerId, amount, description, roundNumber);
}
/** Sum canonical ledger pots once — invariant check for settlement tests. */
export function totalCanonicalChipsInPlay(state) {
    const seen = new Set();
    let total = 0;
    for (const id of listBankrollParticipantIds(state)) {
        const canonical = resolveCanonicalBankrollOwnerId(state, id);
        if (seen.has(canonical)) {
            continue;
        }
        seen.add(canonical);
        total += derivePlayerBalanceFromLedger(canonical, state.ledger);
    }
    return total;
}
