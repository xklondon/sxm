import { appendLedgerEntry } from '../ledger/ledger';
import { log } from '../../utils/logger';
import { resolveBankrollOwnerId } from './bankroll';
export function boxLedgerMeta(ctx, boxPlayerId) {
    const bankrollOwnerId = resolveBankrollOwnerId(ctx, boxPlayerId);
    return {
        boxPlayerId,
        boxSlotNumber: ctx.boxSlotNumbers[boxPlayerId] ?? null,
        bankrollOwnerId,
    };
}
export function appendBoxLedgerEntry(session, ledger, ctx, boxPlayerId, entryType, amount, description, roundNumber) {
    const meta = boxLedgerMeta(ctx, boxPlayerId);
    const slotLabel = meta.boxSlotNumber ? `Box ${meta.boxSlotNumber}` : 'Box';
    const desc = description.includes(slotLabel) ? description : `${slotLabel}: ${description}`;
    const result = appendLedgerEntry(session, ledger, {
        playerId: meta.bankrollOwnerId,
        entryType,
        amount,
        description: desc,
        roundNumber,
        boxPlayerId: meta.boxPlayerId,
        boxSlotNumber: meta.boxSlotNumber ?? undefined,
    });
    if (entryType === 'bet-placed' || entryType === 'bet-increased') {
        log.info('betLedgerEntry', {
            bankrollOwnerId: meta.bankrollOwnerId,
            boxPlayerId: meta.boxPlayerId,
            boxSlotNumber: meta.boxSlotNumber,
            amount,
            entryType,
        });
    }
    else if (entryType === 'win-paid' ||
        entryType === 'push-refund' ||
        entryType === 'loss-collected') {
        log.info('payoutLedgerEntry', {
            bankrollOwnerId: meta.bankrollOwnerId,
            boxPlayerId: meta.boxPlayerId,
            boxSlotNumber: meta.boxSlotNumber,
            amount,
            entryType,
        });
    }
    return { session: result.session, ledger: result.ledger };
}
