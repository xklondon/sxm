import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
const RAISE_THRESHOLD_MULTIPLIER = 3;
/** Simple deterministic virtual player — no bluffing. */
export function getVirtualHoldemAction(round, playerId, ledger, style) {
    const ps = round.playerStates[playerId];
    if (!ps || ps.actionStatus === 'folded') {
        return { type: 'fold' };
    }
    const balance = derivePlayerBalanceFromLedger(playerId, ledger);
    const toCall = round.currentBet - ps.playerBetsThisStreet;
    const conservative = style === 'conservative' || style === undefined;
    const raiseThreshold = round.bigBlind * RAISE_THRESHOLD_MULTIPLIER;
    if (toCall === 0) {
        if (!conservative && round.currentBet === 0 && balance >= round.bigBlind) {
            return { type: 'bet', amount: round.bigBlind };
        }
        return { type: 'check' };
    }
    if (toCall > balance) {
        return { type: 'fold' };
    }
    if (conservative && round.currentBet > raiseThreshold) {
        return { type: 'fold' };
    }
    if (toCall <= round.bigBlind * 2) {
        return { type: 'call' };
    }
    return { type: 'fold' };
}
export function isVirtualHoldemPlayer(players, playerId) {
    return players[playerId]?.playerType === 'virtual';
}
