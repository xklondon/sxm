# Full Work Summary — Phase B: proportional stake settlement

## Problem

Phase A debited actual stakers at deal via `stakerAmountsByPersonId`, but round settlement still routed win/push/loss through box-native ledger helpers — so cross-box bettors did not receive payouts and native owners could be credited without staking.

## Solution

### Settlement module (`src/engine/blackjack/stakeSettlement.ts`)

- `splitAmountByStakerShares` — integer proportional split (largest-remainder)
- `resolveHandStakerAmounts` — hand snapshot first; legacy native-owner fallback
- `applyProportionalHandBoxSettlement` — per-staker win/push/loss via `appendBoxLedgerEntryForStaker`; internal shared-pot rules per staker
- `applyProportionalHandBankSettlement` — bank side unchanged totals (bets already debited at deal)

### Hand snapshot (`src/types/blackjack.ts`, `round.ts`)

- `BlackjackPlayerHand.stakerAmountsByPersonId` copied at deal from box stake entry
- `resolveBlackjackRound` settlement loop uses proportional box + bank helpers

### Other settlement paths

- `bustSettlement.ts` — proportional box + bank on bust
- `naturalBlackjack.ts` — proportional box + bank on natural win

**Unchanged:** `canDealBlackjack`, box commander/caller (`resolveBoxRoundCommander`, `syncCallersForDeal`), free-box reset, `DealerBlock`, layouts, Zilch, IOU, routing.

## Tests

`src/engine/blackjack/stakeSettlement.test.ts` — 9 scenarios:

1. Guest k on host box → k receives win; host native owner does not  
2. Host xx on guest box → host receives win; guest native owner does not  
3. Co-stake loss → only stakers lose (debits at deal); native owner unchanged  
4. Co-stake win → payout split 1/3 and 2/3 (200/400 of 600 total)  
5. Assigned player commands when they staked  
6. First staker commands when assigned player did not stake  
7. Free box resets commander after round  
8. `syncCallersForDeal` locks commander separately from payer  
9. `splitAmountByStakerShares` unit test  

Also: `stakePayerAmounts.test.ts` (5), `sanity/sanity.test.ts` settlement checks (27 total in targeted run).

## Verification

- `npx vitest run src/engine/blackjack/stakeSettlement.test.ts src/engine/blackjack/stakePayerAmounts.test.ts src/engine/blackjack/sanity/sanity.test.ts` — 27 passed  
- `npm run build` — passed  

**Spec discipline:** checked/updated `docs/SXM_MASTER_SPEC.md` and `docs/CHANGE_LOG.md`.
