import { appendLedgerEntry } from '../ledger/ledger';
export function appendHoldemLedgerEntry(session, ledger, playerId, entryType, amount, description) {
    const result = appendLedgerEntry(session, ledger, {
        playerId,
        entryType,
        amount,
        description,
        roundNumber: session.currentRound,
    });
    return { session: result.session, ledger: result.ledger };
}
export function payPotToWinner(session, ledger, playerId, amount, description) {
    return appendHoldemLedgerEntry(session, ledger, playerId, 'pot-paid', amount, description);
}
