# Change Summary

## Files changed

### BUG 1 — Co-staked double not offered on hard 10
- `src/engine/blackjack/validation.ts` — `isDoubleOfferedForHand`, rule-vs-funding split in `resolveDoubleAvailabilityForHand`
- `src/engine/blackjack/index.ts` — export `isDoubleOfferedForHand`
- `src/components/blackjackActionContract.ts` — `showDouble` from rule eligibility; command lines show block reason
- `src/components/OptionalPlayDecisionOverlay.tsx` — show disabled 2×/Split when offered
- `src/engine/blackjack/doubleAction.test.ts` — co-staked 8+2 deal-path + funding-block tests
- `src/components/optionalPlayDealPacing.test.tsx` — updated overlay visibility contract

### BUG 2 — Mobile Full Table Hit/Stay overlaps boxes
- `src/styles/bj-table-shared.css` — `--bj-full-mobile-actions-clearance: 10px`
- `src/styles/bj-full-table-card-area.css` — lift actions zone (Full Table mobile only)
- `src/components/mobileLayoutFixes.test.ts`, `src/components/mobileTableViews.test.tsx` — clearance guards
- `src/components/frozenLayoutViewIntegrity.test.ts` — updated frozen hash for intentional mobile actions fix

### BUG 3 — IOU handoff rejected
- `src/lib/iouHandoffPayload.ts` — `payloadVersion`, personal zero-USD markers, `validateIouCreatePayloadContract`
- `server/src/lib/iouHandoffDiagnostics.ts` — expanded safe diagnostics
- `server/src/lib/iouHandoffCrypto.ts` — pre-send contract validation
- `src/lib/iouHandoffPayload.test.ts`, `server/tests/iouHandoff.test.ts` — contract + encrypt round-trip tests

### Docs
- `docs/CHANGE_LOG.md`, `docs/SXM_MASTER_SPEC.md`

## Tests added/updated

| Area | Tests |
|------|-------|
| Double co-stake | `doubleAction.test.ts` (+2), `optionalPlayDealPacing.test.tsx` (updated) |
| Mobile layout | `mobileLayoutFixes.test.ts`, `mobileTableViews.test.tsx` |
| IOU handoff | `iouHandoffPayload.test.ts`, `server/tests/iouHandoff.test.ts` |
| Frozen hash | `frozenLayoutViewIntegrity.test.ts` |

## Validation run

| Tier | Command | Result |
|------|---------|--------|
| Double / controls | `npx vitest run src/components/playerDecisionControls.test.ts src/engine/blackjack/doubleAction.test.ts` | **Run — pass** |
| Mobile layout | `npx vitest run src/components/mobileTableViews.test.tsx src/components/mobileLayoutFixes.test.ts` | **Run — pass** |
| IOU handoff | `npx vitest run src/lib/iouHandoffPayload.test.ts server/tests/iouHandoff.test.ts server/tests/iouHandoffConfig.test.ts` | **Run — pass** |
| Full suite | `npx vitest run --reporter=dot --pool=forks --testTimeout=10000` | **Run — 2487 passed, 5 skipped** |
| Build | `npm run build` | **Run — pass** |
| Ownership / layout audit | `npm run test:ownership`, `npm run test:layout:target` | **Skipped** — no routing/CSS ownership drift beyond scoped mobile actions token |

## Architecture impact

- Minimal engine/UI boundary fix: double **visibility** decoupled from **funding**; no new action paths.
- Mobile Full Table actions spacing only; Card View and desktop untouched.
- IOU handoff payload contract aligned with IOU Wallet personal-IOU schema; diagnostics only on server.

## Deploy readiness

Ready after verifying production `IOU_HANDOFF_SECRET` matches IOU Wallet Admin integration secret (mismatched secret still yields invalid/tampered).

**Spec discipline: checked/updated SXM_MASTER_SPEC.md and CHANGE_LOG.md.**
