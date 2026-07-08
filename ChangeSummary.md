# Change Summary

## Files changed

### BUG 1 — End of game not triggered
- `src/engine/session/playerCommittedExposure.ts` — `getInRoundBetExposureForPerson` returns 0 when round is settled/resolved
- `src/engine/blackjack/gameOverEvaluation.test.ts` — settled round with stale `currentBet` still triggers game-over
- `src/engine/session/playerCommittedExposure.test.ts` — post-settlement exposure guard

### BUG 2 — Card deal timing inconsistent
- `src/components/useBlackjackTableFlow.ts` — banking settlement gated on `cardRevealComplete` (removed early complete while reveals pending; manual bank same)
- `src/hooks/useSequentialCardReveal.ts` — watchdog timeout requires stuck steps; ordered initial-deal wait uses `scheduleNextCardReveal` instead of break-without-delay
- `src/engine/blackjack/dealTimingConsistency.test.ts` — banking gate + watchdog guards

### Docs
- `docs/CHANGE_LOG.md`, `docs/SXM_MASTER_SPEC.md`

## Tests added/updated

| Area | Tests |
|------|-------|
| Game end | `gameOverEvaluation.test.ts` (+1), `playerCommittedExposure.test.ts` (+1) |
| Game-over UI | `gameEndFlowRegression.test.ts`, `blackjackGameOverContract.test.ts` (pass) |
| Card timing | `dealTimingConsistency.test.ts` (+2), `cardRevealOrder.test.ts`, `cardRevealGameplay.test.ts`, `bankTurnPacing.test.ts`, `bankDrawLoop.test.ts` (pass) |

## Validation run

| Tier | Command | Result |
|------|---------|--------|
| Game end UI | `npx vitest run src/components/gameEndFlowRegression.test.ts src/components/blackjackGameOverContract.test.ts` | **Run — 15 passed** |
| Game end engine | `npx vitest run src/engine/blackjack/gameOverEvaluation.test.ts src/engine/session/playerCommittedExposure.test.ts` | **Run — pass** |
| Card timing | `npx vitest run src/engine/blackjack/dealTimingConsistency.test.ts src/engine/blackjack/dealing/cardRevealOrder.test.ts src/engine/blackjack/dealing/cardRevealGameplay.test.ts src/engine/blackjack/bankTurnPacing.test.ts src/engine/blackjack/bankDrawLoop.test.ts` | **Run — pass** |
| Full suite | `npx vitest run --reporter=dot --pool=forks --testTimeout=10000` | **Run — 2490 passed, 5 skipped** |
| Build | `npm run build` | **Run — pass** |
| Ownership / layout | `npm run test:ownership`, `npm run test:layout:target` | **Skipped** — no routing/CSS ownership changes |

## Architecture impact

- Game-end eligibility: settled rounds treat hand `currentBet` as display-only for exposure; ledger remains source of truth.
- Bank automation: engine may enter `banking` before reveal catches up, but settlement waits for reveal queue (`cardRevealComplete`).
- Card timing: single delay path unchanged (`getNextCardDelay` → `scheduleNextCardReveal`); removed fast-path settlement and premature watchdog snap during normal paced sequences.

## Deploy readiness

Ready — full suite green, build green.

**Spec discipline: checked/updated SXM_MASTER_SPEC.md and CHANGE_LOG.md.**
