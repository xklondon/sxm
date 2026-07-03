# Change Summary — Insurance / double / split per-staker funding

## Problem

Insurance flow stalled after the first box when a stake owner could not fund their share. Double and split could show as available or debit the wrong person when co-staked or cross-box stakes were involved.

## Root causes

1. **`takeInsuranceBet` used a stripped synthetic state** (empty `boxStakes`) for funding checks, mis-attributing in-round exposure to box callers instead of actual stakers.
2. **Insurance tracked per-box, not per-staker** — unfunded stakers were not auto-skipped, leaving boxes pending with no actionable decision.
3. **`resolveHandStakerAmounts` fell back to native box owner** when hands lacked `stakerAmountsByPersonId`, ignoring open box stake maps in tests and edge cases.
4. **UI:** `insuranceDecisionPending` blocked decline on subsequent boxes after the first take.

## Implementation

### Engine

- **`resolveFundableActionParticipants(hand, actionType)`** in `handFunding.ts` — canonical fundable/skipped participants for `insurance | double | split`.
- **Per-staker insurance state:** `insuranceStakerDecisions`, `insuranceStakerSkipReasons`, `insuranceStakerBets` on `BlackjackRound`.
- **`applyAutoSkippedInsuranceStakers`** — marks unfunded stakers skipped; auto-completes zero-fundable boxes.
- **`takeInsuranceBet`** — now uses full `GameState` for funding resolution; debits one staker's proportional share.
- **`allStakersInsuranceResolved`** — box complete when all stakers accepted/declined/skipped; legacy `insuranceDeclined` honored when no per-staker map exists.
- **Double/split** — `validation.ts` + `round.ts` use funding helper; split uses proportional staker debits.
- **`resolveHandStakerAmounts`** — falls back to open box `stakerAmountsByPersonId` before native owner.

### UI

- **`InsuranceDecisionOverlay`** — queue hint `Insurance: Box X of Y — pays 2:1`; read-only block reason when viewer cannot fund.
- **`BlackjackPanel`** — per-staker take/decline with `personId`; `pendingTake` only blocks take button; resets on insurance state change.

## Tests

| Suite | Result |
|-------|--------|
| `npm test -- insurance` | 45/45 |
| `npm test -- multiBoxInsurance` | 4/4 |
| `npm test -- doublePayerFunding` | 2/2 |
| `npm test -- split` | 15/15 |
| `npm run build` | pass |

New/updated: `insuranceFunding.test.ts` (12 scenarios), `multiBoxInsurance.test.ts`, existing phase/targeting tests updated for per-staker model.

## Docs

- Updated `docs/SXM_MASTER_SPEC.md` — stake payer table, insurance UX, online authority row.
- Added `docs/CHANGE_LOG.md` entry (2026-06-22).

**Spec discipline: checked/updated SXM_MASTER_SPEC.md and CHANGE_LOG.md.**

## Not touched

Table host deal authority, commander hierarchy, modal shell, Zilch, Hold'em, IOU, routing, layout geometry.
