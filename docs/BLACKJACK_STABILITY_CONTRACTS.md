# Blackjack stability contracts

Protected boundaries between **protocol**, **layout**, **dealing**, and **accounting**. Views and panels must not bypass these modules — contract tests in `src/components/blackjackStabilityContracts.test.ts` and `src/engine/blackjack/dealing/dealingRoundRegression.test.ts` enforce them.

## Protocol ownership

**Module:** `src/components/blackjackActionContract.ts`

| Responsibility | Canonical API |
|----------------|---------------|
| Who may act on the active hand | `resolveViewerActionPermission` |
| Whether decision chrome may show | `canShowPlayerDecisionControls` |
| Hit / stay / double / split legality | `resolvePlayerHandActionOptions` |
| Insurance prompts (person-scoped) | `getInsuranceActionsForController`, `getPrimaryInsuranceActionForController` |
| Betting open | `allowsBettingActions` |
| Round phase for views | `getBlackjackRoundPhase` |

**Engine source of truth:** `src/engine/session/boxDecisionOwnership.ts`, `src/engine/blackjack/protocol.ts`, engine `canHitBlackjack` / `canStandBlackjack` / etc.

**Views must not:**

- Import `canHitBlackjack`, `canStandBlackjack`, `canDoubleBlackjackForState`, or `canSplitBlackjackForState` directly.
- Enable controls from `activeHandKey` alone without `resolveViewerActionPermission`.
- Compute insurance eligibility per box in the panel.

**Allowed consumers:** `BlackjackPanel.tsx`, `BlackjackCardView.tsx` (via `blackjackActionContract` only).

---

## Layout ownership

**Modules:** `src/components/tableViewContract.ts`, `src/components/tableUxContract.ts`, `src/components/blackjackLayoutContract.ts`

**Canonical layout doc:** [BLACKJACK_LAYOUT_CONTRACTS.md](./BLACKJACK_LAYOUT_CONTRACTS.md) — per-view freeze flags (A, B1, B2, C1–C3), media boundaries, audit guards in `blackjackLayoutContractGuards.test.ts`.

| Responsibility | Canonical API / rule |
|----------------|----------------------|
| View roots (CSS scope) | `getViewRootClass` → `bj-view-{full\|card}-{desktop\|mobile}` |
| Client-local view mode | `preserveClientViewMode`, `resolveInitialViewMode` |
| Visible box slot order | `sortBoxSlotsForTableVisualOrder`, `displaySlots` in `BlackjackPanel` |
| Arc card + box alignment | Both rows map `displaySlots` → `renderArcCardColumn` / `renderArcSlot` |
| Active turn highlight | `cardColumnHandValueClassName` / hero `bj-phone-view__box-value--active-turn` only |

**Views must not:**

- Add bare `.bj-casino__felt …` selectors that leak across view roots.
- Reintroduce `bj-box--turn` or `bj-arc__slot--turn` for player-turn highlight.
- Derive box order independently of `displaySlots`.

---

## DEALING CONTRACT

**Modules:** `src/hooks/useSequentialCardReveal.ts`, `src/components/blackjackDealingContract.ts`, `src/engine/blackjack/dealing/cardRevealDisplay.ts`

**Only `blackjackDealingContract` (and its engine helpers) may expose:**

- Reveal order (`buildInitialRevealSteps`, `applyRevealStep`, ordered initial reveal)
- Visible cards (`applyCardVisibility`, `getVisibleHandCardIds`, `getVisibleDealerCardIds`)
- Visible values (`getDisplayedHandValue`, `resolveDealerDisplayValue`, `resolveHandDisplayValue`)
- Reveal completion (`isActiveHandRevealComplete`, `shouldSnapCardRevealOnMount`, `resolveRevealScopeTransition`)

| Responsibility | Canonical API |
|----------------|---------------|
| Reveal queue (natural + staged) | `useSequentialCardReveal` only |
| Visible card subsets | `applyCardVisibility`, `getVisibleHandCardIds`, `getVisibleDealerCardIds` |
| Hand values in UI | `getDisplayedHandValue` (null until revealed) |
| Dealer value in UI | `resolveDealerDisplayValue` / masked `displayState` |
| Action timing | `canShowPlayerDecisionControls` + `isActionRevealReady` |
| Round scope / round 2 reset | `resolveRevealScopeTransition` → `'reset'` on first mount; `'hydrate'` only on cross-table join |
| Mid-round join snap | `shouldSnapCardRevealOnMount` |

**Views must not:**

- Maintain a second reveal timer or parallel visibility state.
- Import `cardRevealDisplay` or `protocolState` directly for display.
- Call `hydrateInstant` on first mount for fresh natural deals (P→D→P→D must step from empty).
- Show hand totals or dealer totals from authoritative card ids while visibility counts are zero.
- Show “Round finished” command text before `cardRevealComplete`.
- Enable Hit/Stay before `activeHandRevealComplete` during natural deal.

**Initial deal order (round 1 and round 2):** player card → dealer up → player card → dealer hole (P→D→P→D per box).

---

## ACCOUNTING CONTRACT

**Modules:** `src/engine/session/playerCommittedExposure.ts`, `src/components/blackjackAccountingDisplay.ts`, `src/engine/session/bankroll.ts`

**Only `blackjackAccountingDisplay` may expose:**

- Available (`resolvePersonDisplayBalances`, `resolveViewerTrayAvailable`)
- Betting / committed exposure (`resolvePersonDisplayBalances` → `betting`)
- End-game bankroll checks (`resolvePersonEndGameBalances` → `evaluateTableGameEnd`)

| Responsibility | Canonical API |
|----------------|---------------|
| Committed exposure | `getTotalCommittedExposureForPerson` |
| Tray available | `resolveViewerTrayAvailable` → `buildTableInfoDisplay` |
| This Table rows | `resolvePersonDisplayBalances` → `buildTablePeopleRows` |
| End-game eligibility | `resolvePersonEndGameBalances` → `evaluateTableGameEnd` |
| Display clamp | `clampAvailableForDisplay` (never show negative available) |

**Formula (display):**

- `betting` = committed active stakes/bets for that person (all attributed boxes).
- `available` = `max(0, allocated bankroll − betting)`.

**Views must not:**

- Subtract stakes manually in the panel or This Table.
- Read `getAvailableChipsForBankrollOwner` or ledger helpers directly in UI or end-game code.
- Double-count optimistic/pending box ids.
- Use native `bankrollOwnerId` alone for multi-box staker exposure.

**Note:** Felt/header bank chip totals (`bankChips`) are the **bank’s** balance, not the viewer’s tray available.

---

## BOX PLACEMENT CONTRACT

**Modules:** `src/components/blackjackBoxPlacementContract.ts`, `src/components/localChipTargetSelection.ts`, `src/components/tableBoxLayout.ts`

| Responsibility | Canonical API / rule |
|----------------|----------------------|
| Stable UI anchor | `slotNumber` only in local chip target (`LocalChipSlotTarget`) |
| React keys for arc slots | `slotArcReactKey(slotNumber)` → `slot-${slotNumber}` — never `boxId` |
| Payload at send time | `resolvePlaceBetPayloadTarget(state, slotNumber, online, inFlight)` |
| Visible row expansion | User **+** button only — `resolveEffectiveVisibleBoxCount` ignores occupied max |
| Online empty-slot first chip | Pending preview keyed by `slotNumber` — no client `claimBoxSlot` / visual `boxId` |
| Arc slot DOM | Single `renderArcSlot(slotNumber)` shape for empty/occupied/staked |
| Stake pile layout | Fixed `bj-phone-view__mini-stake-slot`; chips absolutely positioned + clipped |

**Views must not:**

- Key arc player boxes by `boxId` or branch empty vs occupied into separate render functions.
- Store betting selection as `boxId` in local React state (derive occupant at payload time only).
- Call `claimBoxSlot` in the online optimistic placement path for empty slots.
- Auto-expand visible box count when a high slot is first occupied.
- Use `resolveChipTrayBetTarget` or `selectedSeatId` for chip-tray betting (legacy only).

**Allowed consumers:** `BlackjackPanel.tsx` chip tray, drag/drop, arc row.

---

## Contract tests

| File | Guards |
|------|--------|
| `blackjackBoxPlacementStability.test.ts` | Slot-only keys, payload derivation, pending online preview, visible-count decouple |
| `blackjackStabilityContracts.test.ts` | Protocol, layout, dealing, accounting boundaries + render smoke |
| `dealingRoundRegression.test.ts` | P→D→P→D round 1/2, dealer value gating, reveal mount snap, round-finished command, end-game |
| `playerCommittedExposure.test.ts` | Multi-box same-player tray + This Table parity |

Run: `npm test` (includes all contract tests).

---

## Related spec

Authoritative product behaviour: **`docs/SXM_MASTER_SPEC.md`** § Blackjack view contract and stability contracts.
