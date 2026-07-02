# Change Summary — blackjackRoundOwnershipReset batch flake fix

## Problem

`blackjackRoundOwnershipReset.test.ts` passed in isolation but failed intermittently when batched with stake/insurance/deal-authority suites (e.g. `expected 'player-turns' to be 'resolved'` in `settleRound`). Different tests failed on different runs (`stakePayerAmounts`, `doublePayerFunding`, various ownership-reset cases).

## Root cause

1. **Global `Math.random` pollution:** `shuffleToStartOnState` → `shuffleGameDeck()` reshuffles the shoe with unseeded `Math.random`. Vitest batch runs consume the process-global PRNG across files, so the same `qa-seed` table fixture produced different dealer up-cards and hand shapes depending on which tests ran first.

2. **Brittle `settleRound` helper:** When the random reshuffle dealt a dealer Ace, insurance stayed pending. Phase 2 insurance no longer auto-skips unfunded boxes, but the helper only stood on `acting` hands and called `resolveBankTurnAuto` — it never declined insurance or handled even-money, so the loop exited at 80 iterations still in `player-turns`.

3. **`doublePayerFunding` coupling:** One test relied on a real deal + manual card override; random deals could land in insurance or non-double-eligible hands.

## Fix (test isolation only — no gameplay / ownership / layout changes)

### `src/engine/blackjack/sanity/fixtures.ts`

- **`shuffleTableForDeal(state, seed)`** — shuffle then re-pin a seeded shoe (`test-deal-seed` default) + `withInstantInitialDeal`, immune to global PRNG drift.
- **`blackjackTestActorContext(state)`** — shared actor for test reducers.
- **`settleBlackjackRoundForTest(state, seed)`** — robust round walk: initial-deal completion, decline all pending insurance, `waitFor3to2` for even-money, stand acting hands, `resolveBankTurnAuto`.

### Test files updated to use deterministic helpers

- `blackjackRoundOwnershipReset.test.ts` — `settleRound` delegates to `settleBlackjackRoundForTest`.
- `stakePayerAmounts.test.ts`, `stakeSettlement.test.ts`, `dealStartAuthority.test.ts` — `readyToDeal` → `shuffleTableForDeal`.
- `doublePayerFunding.test.ts` — guest double test uses synthetic `playerTurnHard9` + `stakerAmountsByPersonId` instead of random deal.

## Validation

```text
npm test -- blackjackRoundOwnershipReset          → 7/7 passed
npm test -- stakePayerAmounts stakeSettlement doublePayerFunding multiBoxInsurance insurancePhase blackjackRoundOwnershipReset dealStartAuthority → 46/46 passed (8 consecutive batch runs)
npm run build                                     → success
```

## Spec discipline

Test-only change; no product behaviour, protocol, or layout updates — `SXM_MASTER_SPEC.md` and `CHANGE_LOG.md` unchanged.
