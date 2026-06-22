# Change Summary — Blackjack 2× wiring + mobile Card View swipe restore

## Root cause (why 2× looked shown but not wired)

1. **Engine and `run()` were already correct** — `doubleDownBlackjackOnState` doubles bet, deals one card, auto-stands; `BlackjackPanel` already dispatched `{ type: 'double' }` on `onDouble`.
2. **UX made 2× feel dead:**
   - **2× sat on the secondary action row** below Stay/Hit in `BlackjackActionPanel`, not beside Hit — easy to miss or confuse with a label-only affordance.
   - **Mobile Card View forced `variant="table"`** on `BlackjackActionRow`, so card-view action styling/layout did not apply; the primary row did not match Card View expectations.
3. **Stale test expectations** still looked for `>Double<` in the command zone (`OptionalPlayDecisionOverlay` path removed earlier); optional lines now live in the canonical action row as **2×**.

## What changed

### 1. Wire 2× / Double (action row)
- **`BlackjackActionPanel.tsx`** — 2× moved to the **primary row** immediately right of Hit: **Stay / Hit / 2×** (Split stays secondary).
- **`BlackjackPanel.tsx`** — removed hardcoded `variant="table"` so Card View resolves `variant="card"` via `BlackjackActionRow` scale.
- Double still routes through existing `run((s) => doubleDownBlackjackOnState(...), { type: 'double' })`; bankroll/eligibility unchanged (`canDoubleBlackjackForState`).

### 2. Mobile Card View play swipe restore
- **`useMobileCardViewPlaySwipe.ts`** (new) — swipe **left = Stay**, swipe **right = Hit**; never double/split.
- **`BlackjackPanel.tsx`** — during actionable Card View player turns, felt uses play-swipe handlers; box-navigation swipe (`useMobileBoxSwipeNavigation`) is disabled for that window.
- Gated off when: game over modal, insurance, even-money, non-player phase, actions blocked (hold/deal/online in-flight), or viewer cannot act.

## Files changed

| File | Change |
|------|--------|
| `src/components/BlackjackActionPanel.tsx` | 2× on primary row after Hit |
| `src/components/BlackjackPanel.tsx` | Card variant fix; play-swipe wiring; felt handler merge |
| `src/hooks/useMobileCardViewPlaySwipe.ts` | **New** — Stay/Hit swipe hook |
| `src/hooks/useMobileCardViewPlaySwipe.test.ts` | **New** — gesture resolver tests |
| `src/components/blackjackDoubleAndSwipe.test.ts` | **New** — engine + UI + swipe contract tests |
| `src/components/optionalPlayDealPacing.test.tsx` | Expect 2×/Split in actions zone |
| `src/components/cardViewSwipeAffordances.test.tsx` | Expect play-swipe wiring |
| `package.json` | Include new tests in `test:blackjack:layout` |

## Frozen / untouched (per scope)

**Not modified:** `tableLayoutEngine.ts`, `blackjackCardPlacementContract.ts`, `blackjackUiRenderContract.ts`, Game Over modal, command box styling, card layout CSS, reveal/dealing timing, table setup, IOU, ledger, auth, Zilch.

## Test results

| Command | Result |
|---------|--------|
| `npm run test:ownership` | 27 passed |
| `npm run test:layout:target` | 53 passed |
| `npm run test:blackjack:layout` | 252 passed |
| `npm run build` | Success |

## Browser checklist

1. **Click 2×** — bet doubles, exactly one card dealt, turn ends (auto-stand).
2. **2× button** sits immediately right of HIT (Stay / Hit / 2×).
3. **Mobile Card View swipe left** = Stay.
4. **Mobile Card View swipe right** = Hit.
5. **Swipe never triggers 2×** — double only from the action button.

Spec discipline: checked/updated `docs/CHANGE_LOG.md` (entry below); `SXM_MASTER_SPEC.md` already describes canonical action row — no structural spec change required.
