import { describe, expect, it } from 'vitest';
import { tableAfterStartPlaying, boxPlayerId } from './sanity/fixtures';
import { claimBoxSlot } from '../session/boxOps';
import { resolveControllerPersonId } from '../session';
import { addChipToBoxStake } from './stakes';
import { createBlackjackShoe, shuffleBlackjackShoe } from './shoe';
import { shuffleToStartOnState, completeStepwiseInitialDealIfNeeded, dealCardsButtonOnState, standBlackjackOnState, hitBlackjackOnState, processPlayFlowAutoStands, syncBankPhaseOnState, resolveBankTurnAuto, } from './gameState';
import { applyBlackjackActionToState } from './applyBlackjackAction';
const ctx = (resolveBankAuto) => ({
    personId: 'host',
    payload: {},
    resolveBankAuto,
});
/**
 * Gameplay-relevant projection used for parity comparison. Per spec it ignores
 * generated ids and timestamps (ledger entry ids, session ledgerEntryIds order)
 * but compares phase, active hand, hands/cards/totals/status, stakes, balances,
 * and gameplay ledger entry content.
 */
function projectParity(state) {
    const round = state.blackjack;
    const ledger = state.ledger.entries.map((e) => ({
        roundNumber: e.roundNumber,
        playerId: e.playerId,
        entryType: e.entryType,
        amount: e.amount,
        balanceBefore: e.balanceBefore,
        balanceAfter: e.balanceAfter,
        boxPlayerId: e.boxPlayerId ?? null,
        boxSlotNumber: e.boxSlotNumber ?? null,
    }));
    return {
        status: round?.status ?? null,
        activeHandKey: round?.activeHandKey ?? null,
        dealerCardIds: round?.dealerCardIds ?? [],
        playerHands: round
            ? Object.fromEntries(Object.entries(round.playerHands).map(([key, hand]) => [
                key,
                {
                    cardIds: hand.cardIds,
                    actionStatus: hand.actionStatus,
                    currentBet: hand.currentBet,
                    doubled: hand.doubled,
                },
            ]))
            : {},
        outcomes: round?.outcomes ?? null,
        resultMessages: round?.resultMessages ?? null,
        awaitingNextRound: state.tableMeta.awaitingNextRound ?? false,
        bettingLocked: state.tableMeta.bettingLocked ?? false,
        boxStakes: state.tableMeta.boxStakes ?? {},
        ledger,
    };
}
/** Boxes 1/3/4 staked and shoe shuffled ONCE so both paths share one deck. */
function readyToDeal() {
    let s = tableAfterStartPlaying(500);
    s = claimBoxSlot(s, 1);
    s = claimBoxSlot(s, 3);
    s = claimBoxSlot(s, 4);
    const personId = resolveControllerPersonId(s, 'Alice') ?? undefined;
    for (const slot of [1, 3, 4]) {
        const box = boxPlayerId(s, slot);
        s = addChipToBoxStake(s, box, 50, personId);
    }
    // shuffleToStartOnState reshuffles with unseeded Math.random; pin a seeded
    // shoe afterwards so the full-round walk is deterministic (no flaky natural /
    // even-money hand that the stand loop cannot resolve).
    const started = shuffleToStartOnState(s);
    return { ...started, deck: shuffleBlackjackShoe(createBlackjackShoe(6), 'parity-deal-seed') };
}
describe('online/offline blackjack action parity', () => {
    it('deal: server reducer result equals the offline engine pipeline', () => {
        const base = readyToDeal();
        const online = applyBlackjackActionToState(base, 'dealCards', ctx(true));
        // Offline = deal + post-deal auto-stand effect + bank animation final frame.
        const offline = resolveBankTurnAuto(syncBankPhaseOnState(processPlayFlowAutoStands(completeStepwiseInitialDealIfNeeded(dealCardsButtonOnState(base)))));
        expect(projectParity(online)).toEqual(projectParity(offline));
    });
    it('stand (server, no handKey) equals offline stand on the active hand', () => {
        const dealt = applyBlackjackActionToState(readyToDeal(), 'dealCards', ctx(false));
        if (dealt.blackjack?.status !== 'player-turns' || !dealt.blackjack.activeHandKey) {
            return; // round auto-resolved (all naturals/auto-stand) — nothing to compare
        }
        const activeKey = dealt.blackjack.activeHandKey;
        const online = applyBlackjackActionToState(dealt, 'stand', ctx(false));
        const offline = standBlackjackOnState(dealt, activeKey);
        expect(projectParity(online)).toEqual(projectParity(offline));
    });
    it('hit (server, no handKey) equals offline hit on the active hand', () => {
        const dealt = applyBlackjackActionToState(readyToDeal(), 'dealCards', ctx(false));
        if (dealt.blackjack?.status !== 'player-turns' || !dealt.blackjack.activeHandKey) {
            return;
        }
        const activeKey = dealt.blackjack.activeHandKey;
        const online = applyBlackjackActionToState(dealt, 'hit', ctx(false));
        const offline = hitBlackjackOnState(dealt, activeKey);
        expect(projectParity(online)).toEqual(projectParity(offline));
    });
    it('full round settles server-side and nextRound resets stakes/bets', () => {
        let s = applyBlackjackActionToState(readyToDeal(), 'dealCards', ctx(true));
        let guard = 0;
        while (s.blackjack?.status === 'player-turns' && guard < 30) {
            guard += 1;
            s = applyBlackjackActionToState(s, 'stand', ctx(true));
        }
        // Auto bank + settlement resolved within the action chain.
        expect(s.blackjack?.status).toBe('resolved');
        expect(s.tableMeta.awaitingNextRound).toBe(true);
        const reset = applyBlackjackActionToState(s, 'nextRound', ctx(true));
        expect(reset.tableMeta.awaitingNextRound).toBe(false);
        expect(reset.tableMeta.bettingLocked).toBe(false);
        expect(reset.tableMeta.boxStakes).toEqual({});
    });
    it('settlement parity: server full chain equals offline full chain', () => {
        const base = readyToDeal();
        const runChain = (resolveBankAuto) => {
            let s = applyBlackjackActionToState(base, 'dealCards', ctx(resolveBankAuto));
            let guard = 0;
            while (s.blackjack?.status === 'player-turns' && guard < 30) {
                guard += 1;
                s = applyBlackjackActionToState(s, 'stand', ctx(resolveBankAuto));
            }
            // Offline animates the bank; fast-forward to the same final frame.
            return resolveBankAuto ? s : resolveBankTurnAuto(s);
        };
        expect(projectParity(runChain(true))).toEqual(projectParity(runChain(false)));
    });
});
