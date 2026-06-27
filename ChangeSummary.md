# Full Work Summary — Blackjack deal authority canonicalization

## Problem

Deal Cards could appear clickable but do nothing (silent no-op). Example: host `xk` native on Box1 betting Box2; guest `k` on Box1 and Box3 — stakes placed, no cards dealt.

Root cause: **split permission paths** — `canCurrentUserDealTable` (host only), `canDeal` / `canStartBlackjackDeal`, `getDealBlockReason`, `canStartCards`, and server `assertHostDealAction` each re-implemented overlapping rules. Box commander logic was correctly separated from deal eligibility, but eligible-box detection could drop staked boxes not present in `getBettingPlayerIds` ordering, and first-start deal skipped canonical authority checks.

## PART 1 — Audit table

| Layer | File | Current decision (before) | Inputs | Result |
|-------|------|---------------------------|--------|--------|
| UI visibility | `DealerBlock.tsx` | Host gate + `hasStakes` (pre-shoe) or `canDeal` (post-shoe) | `canUserDealTable`, `canDeal`, `bettingOpen`, `bankerReady` | Button shown/disabled (unchanged per request) |
| UI `canDeal` | `useBlackjackTableFlow.ts` | `canStartBlackjackDeal` | phase, shoe, betting, host, engine | Enabled state for post-shoe Deal |
| Host gate | `canCurrentUserDealTable` | `viewer === ownerPersonId` | owner, viewer | Host-only UI controls |
| Deal block | `getBlackjackDealBlockReason` | host → `getCardsBlockReason` | owner, viewer, engine | String or null |
| Engine eligibility | `getEligibleDealBoxes` | stake ≥ min, confirmed, not bank | box stakes, min bet, **betting player order** | Box ids for deal |
| Protocol | `canStartCards` | Duplicate engine checks | phase, deck, stakes | boolean |
| Client click | `handleDealCards` / `handlePrimaryDealAction` | Re-check block reason; first-start only `hasAnyStakes` | viewer, state | Dispatch or error |
| Server | `assertHostDealAction` | host + `getBlackjackDealBlockReason` | personId, phase, shoe | throw or allow |
| Engine apply | `applyBlackjackAction` dealCards | `getBlackjackDealBlockReason` | personId | throw or deal |

**Duplicated:** host check in 4 places; engine readiness in `canStartCards`, `getDealBlockReason`, `assertHostDealAction`.  
**Contradictory:** pre-shoe button used `hasStakes`; post-shoe `canDeal` required full engine path.  
**Stale:** `getEligibleDealBoxes` filtered through `getBettingPlayerIds`, dropping eligible boxes missing from session order.

## PART 2 — Canonical box ownership

**New:** `src/engine/session/playableBoxes.ts` → `resolvePlayableBoxes(state)`

Returns per box: `{ boxId, designatedOwner, activePlayer, passivePlayers }` using `resolveBoxRoundCommander` only.

Rules:
- Designated box: owner commands if staked; else first staker; others passive
- Free box (no native owner): first staker commands; others passive
- Round reset clears temp command via existing `resetBlackjackRoundOwnership`

## PART 3 — Canonical deal authority

**New:** `src/engine/session/canDealBlackjack.ts` → `canDealBlackjack(state, viewerPersonId, options?)`

Returns `{ allowed, reason, message }`.

Rules ONLY:
1. `viewer === table owner`
2. Betting phase + engine ready (`evaluateBlackjackDealEngine` in `dealEligibility.ts`)
3. At least one eligible staked box (from `resolvePlayableBoxes` + confirmed stake ≥ min)
4. Optional `allowPreShuffle` for first shoe start (no deck yet)

Wired through: `useBlackjackTableFlow`, `applyBlackjackAction`, `authority.ts`. Deprecated thin aliases: `canStartBlackjackDeal`, `getBlackjackDealBlockReason`.

## PART 4 — Simplified deal flow

```
click Deal → logDealAudit / canDealBlackjack → dispatch dealCards → applyBlackjackAction → cards
```

- No second hidden permission path on click (first-start now uses `canDealBlackjack` with `allowPreShuffle`)
- Box ownership never gates deal
- Blocked deals always surface `reportFlowError` with message (no silent return on `actionPending`)

## PART 5 — Audit logging

`logDealAudit` emits:

```
[DEAL AUDIT] viewer=… owner=… phase=betting playable=[box1,box2,box3] allowed=true
```

or `allowed=false reason=no_playable_boxes`

## PART 6 — Tests

**New:** `src/engine/session/canDealBlackjack.test.ts` — host/non-host, reassigned boxes, no playable boxes, free boxes, designated restore after reset, first-start pre-shuffle, enabled ⇒ deal succeeds.

**Updated:** `blackjackFiveIssueFixes.test.tsx` wiring expectations.

**Fix:** `getEligibleDealBoxes` now includes all eligible boxes even if missing from `getBettingPlayerIds` (append after ordered pass).

## Files changed

| File | Change |
|------|--------|
| `src/engine/session/playableBoxes.ts` | **NEW** — `resolvePlayableBoxes` |
| `src/engine/session/canDealBlackjack.ts` | **NEW** — `canDealBlackjack`, `logDealAudit` |
| `src/engine/session/canDealBlackjack.test.ts` | **NEW** — authority + ownership tests |
| `src/engine/blackjack/dealEligibility.ts` | `evaluateBlackjackDealEngine`; eligibility uses `resolvePlayableBoxes`; eligible-box ordering fix |
| `src/engine/session/tableDealPermission.ts` | Host gate only + deprecated aliases |
| `src/engine/blackjack/protocol.ts` | `canStartCards` delegates to engine evaluator |
| `src/components/useBlackjackTableFlow.ts` | Single `canDealBlackjack` + `[DEAL AUDIT]` on every click |
| `src/engine/blackjack/applyBlackjackAction.ts` | `canDealBlackjack` on dealCards |
| `server/src/tables/authority.ts` | `canDealBlackjack` on host deal |
| `src/components/blackjackFiveIssueFixes.test.tsx` | Updated string guards |

**Not modified:** `DealerBlock.tsx`, Zilch, setup, ledger, IOU, routing, layouts.

## Verification

- `npx vitest run src/engine/session/canDealBlackjack.test.ts` — 12 passed
- `npx vitest run src/engine/blackjack/dealStartAuthority.test.ts` — passed
- `npx vitest run src/engine/blackjack/blackjackRoundOwnershipReset.test.ts` — passed (isolated)
- `npm run test:ownership` — 28 passed
- `npm run build` — passed

**Spec discipline:** checked/updated `docs/SXM_MASTER_SPEC.md` and `docs/CHANGE_LOG.md`.
