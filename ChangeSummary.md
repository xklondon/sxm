# Change Summary — Blackjack canonical-risk fixes (V1/V2/V3)

## Root causes fixed

| ID | Root cause | Fix |
|----|------------|-----|
| **V1** | `applyBlackjackActionToState` passed `ctx.payload.handKey` into even-money actions; a crafted key could settle a non-offer hand at 1:1 | Reducer calls `takeEvenMoneyOnState` / `waitForBlackjackPayoutOnState` with no client key; engine resolves only on `evenMoneyOfferHandKey` and validates natural-blackjack offer hand |
| **V2** | `handleDealNextCard`, `handleDrawBank`, `handleShuffleFresh` mutated local protocol state without `onlineDispatch` guard; DealerBlock showed Card/Draw online | Early-return when `onlineDispatch` is set; panel gates `initialDealManual` / `bankDrawManual` off when online |
| **V3** | Reveal queue could stall indefinitely with pending cards, blocking offline bank draw and controls | Display-only watchdog in `useSequentialCardReveal`: snap to target after bounded stuck steps or timeout; logs safe warning; no engine mutation |

## Files changed

- `src/engine/blackjack/applyBlackjackAction.ts`
- `src/engine/blackjack/naturalBlackjack.ts`
- `src/components/useBlackjackTableFlow.ts`
- `src/components/BlackjackPanel.tsx`
- `src/hooks/useSequentialCardReveal.ts`
- `src/engine/blackjack/naturalBlackjack.test.ts`
- `src/components/useBlackjackTableFlow.test.ts`
- `src/engine/blackjack/dealTimingConsistency.test.ts`

## Tests added/updated

- `naturalBlackjack.test.ts` — crafted mismatched `handKey` in `takeEvenMoney` settles offer hand only
- `useBlackjackTableFlow.test.ts` — online guards + manual control hiding
- `dealTimingConsistency.test.ts` — watchdog presence in reveal hook

## Validation run

| Tier | Command | Result |
|------|---------|--------|
| Targeted | `npx vitest run src/engine/blackjack/naturalBlackjack.test.ts src/engine/blackjack/insurancePhase.test.ts` | **Run** — 16 passed |
| Targeted | `npx vitest run src/components/useBlackjackTableFlow.test.ts src/components/bankAutomationGate.test.ts` | **Run** — 9 passed |
| Targeted | `npx vitest run src/engine/blackjack/dealing/cardRevealGameplay.test.ts src/engine/blackjack/dealTimingConsistency.test.ts` | **Run** — 12 passed |
| Targeted | `npx vitest run src/components/blackjackStabilityContracts.test.tsx` | **Run** — 17 passed |
| Full suite | `npx vitest run --reporter=dot --pool=forks --testTimeout=10000` | **Run** — 347 files, 2473 passed, 5 skipped |
| Build | `npm run build` | **Run** — success |

## Architecture impact

Minimal, localized to canonical-risk boundaries. No new routes, no poker/zilch/lobby/styling changes.

## Deploy readiness

Build green; full test suite green. Safe to deploy after review.

**Spec discipline:** checked SXM_MASTER_SPEC.md and CHANGE_LOG.md — no spec update required (security/guard fixes only, behavior now matches documented even-money authority).
