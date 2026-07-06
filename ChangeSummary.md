# Change Summary — Blackjack production smoke-test regressions (A/B/C)

## Root causes fixed

| Bug | Root cause | Fix |
|-----|------------|-----|
| **A — Deal/reveal order** | When authoritative state jumped ahead (online auto bank-resolve), `shouldUseOrderedInitialReveal` keyed off full target counts (`dealer > 2`), so gameplay catch-up revealed dealer cards before unfinished player initial-deal steps. V3 watchdog also snapped to full target instantly, reordering cards. | `hasPendingInitialDealReveal` / `shouldUseOrderedInitialReveal` now key off the canonical initial-deal plan from the round. Gameplay hits/doubles no longer re-enter ordered reveal. Watchdog snap advances one canonical step (or bounded progressive catch-up on timeout) and skips stuck-step snap during initial-deal catch-up. |
| **B — Card View hero blank** | `BlackjackCardView` passed `null` for `selectedSeatId`; `getCardViewHeroHandKey` defaulted to `:0` when `activeHandKey` cleared at round-complete; masked display state hid cards with no logical fallback. | Hero box/hand selectors prefer `selectedSeatId` / settled hand on box during round-complete/bank phases; Card View passes `gameState.selectedSeatId`; logical cards used as fallback when reveal mask is empty after play settles. |
| **C — Bank bankruptcy / game-over** | Settlement (`completeBankingOnState`) was gated on `cardRevealComplete`, delaying ledger updates and `applyTableGameEndIfNeeded` until reveal finished; stale bank balance and round-complete UI could show instead of game-over. | Banking settlement runs immediately when engine enters `banking` (reveal still paces display only). Added safety re-evaluation of `applyTableGameEndIfNeeded` when a settled `resolved` round arrives without `gameStatus: ended`. |

## Files changed

- `src/engine/blackjack/dealing/cardRevealDisplay.ts`
- `src/hooks/useSequentialCardReveal.ts`
- `src/components/blackjackViewPhase.ts`
- `src/components/BlackjackCardView.tsx`
- `src/components/useBlackjackTableFlow.ts`
- `src/engine/blackjack/sanity/cardViewPhaseChecks.ts`
- `src/components/blackjackFourRegression.test.ts`
- `src/engine/blackjack/dealing/cardRevealOrder.test.ts`
- `src/engine/blackjack/dealing/cardRevealRoundReset.test.ts`
- `src/components/cardViewDisplayRegressions.test.ts`

## Tests added/updated

- `cardRevealOrder.test.ts` — online bank-resolve jump keeps player cards before dealer
- `cardViewDisplayRegressions.test.ts` — hero across phases, split hand, bankruptcy + bank display 0
- `cardRevealRoundReset.test.ts`, `blackjackFourRegression.test.ts`, `cardViewPhaseChecks.ts` — `shouldUseOrderedInitialReveal(round, …)` API

## Validation run

| Tier | Command | Result |
|------|---------|--------|
| Reveal | `npx vitest run src/engine/blackjack/dealing/cardRevealOrder.test.ts src/engine/blackjack/dealing/cardRevealGameplay.test.ts` | **Run — 11 passed** |
| Card View | `npx vitest run src/components/cardViewDisplayRegressions.test.ts src/components/cardViewLayoutGuard.test.tsx` | **Run — passed** |
| Game end | `npx vitest run src/components/gameEndFlowRegression.test.ts src/components/blackjackGameOverContract.test.ts src/components/challengeGameEndPresentation.test.tsx` | **Run — passed** |
| Full suite | `npx vitest run --reporter=dot --pool=forks --testTimeout=10000` | **Run — 347 files, 2479 passed, 5 skipped** |
| Build | `npm run build` | **Run — success** |
| Ownership / layout | `npm run test:ownership`, `npm run test:layout:target` | **Skipped** — no routing/CSS ownership change |

## Architecture impact

Display-only reveal pacing unchanged in authority model: engine settlement no longer waits on reveal completion. Card View hero selection aligned with Full Table selectors; no protocol/state mutation in UI.

## Deploy readiness

Targeted + full suite green; build green. Ready for smoke re-test on LAN.

**Spec discipline: checked/updated SXM_MASTER_SPEC.md and CHANGE_LOG.md.**
