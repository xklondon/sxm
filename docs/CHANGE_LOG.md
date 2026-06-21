# SXM Change Log

Significant product and architecture changes. For the authoritative current-state description, see **[SXM_MASTER_SPEC.md](./SXM_MASTER_SPEC.md)**.

## Process rule

Every significant feature change must update **both**:

1. `docs/SXM_MASTER_SPEC.md` — reflect new behavior
2. `docs/CHANGE_LOG.md` — record what changed and when

before the work is considered complete. This rule is also stated in `.cursorrules`.

---

---

## 2026-06-13 — Full Table 3+/4-card stack containment + bank-owner game-over liveness

- **Desktop Full Table play:** Tighter 3/4-card overlap tokens under `[data-bj-phase='playing']`; fixed playing stack-zone height so columns stay anchored when hand count changes or bank draws.
- **Game end:** `evaluateTableGameEnd` excludes bank-linked participants (bank seat + shared-pot owner/person) from non-bank player liveness; bank ledger ≤ 0 ends even when ledger totals net to zero.
- **Tests:** `gameOverEvaluation.test.ts` bank-owner scenarios; capture `scripts/capture-desktop-full-playing-layout.mts` adds 2/3/4-card + before/after bank-draw stability assertions.

---

## 2026-06-13 — Full Table desktop play clipping + mobile visual regressions

- **Desktop Full Table play:** Card stack tokens scaled by `[data-bj-phase='playing']` and card count; actions band trimmed to keep stacks inside `cardsArea`.
- **Mobile Card View:** Hero fan scales and anchors layered cards (3+) via `data-bj-hero-card-count` so tops stay inside `cardsArea`.
- **Mobile swipe:** Shared `useMobileBoxSwipeNavigation` on felt — swipe left/right cycles occupied box slots (Card View + Full Table); respects local chip target for hero focus.
- **Mobile Full Table values:** Card-column hand totals suppressed in play; values remain in player boxes only.
- **Captures:** `capture-desktop-full-playing-layout.mts`; extended mobile card/full captures.

---

## 2026-06-13 — Desktop Full Table insurance clipping + per-box insurance decisions

- **Visual (Full Table desktop):** Insurance command row rebalanced (dealer/command/actions bands); compact overlay in command zone; insurance-phase card stack tokens so two-card hands stay inside `cardsArea` without clipping.
- **Insurance flow:** Each eligible box/hand gets its own decision in slot order; UI dispatches `takeInsurance` / `declineInsurance` with `{ playerId: boxId }` (no batched person-level decision).
- **Tests:** `multiBoxInsurance.test.ts`, `insurancePhase.test.ts`; capture `scripts/capture-desktop-full-insurance-layout.mts`.

---

## 2026-06-20 — Table invite flow stability + diagnostics

- **Diagnostics:** `[SXM][invite-flow]` logs on invite create/accept/join/preview/fail with masked emails/ids (no raw tokens).
- **Resolution:** canonical email/person/user linking on join; stale `Person.userId` repaired; session/invite email mismatch returns explicit error.
- **Guards:** duplicate Person/User emails block invite creation until admin repair; disabled persons blocked from join.
- **Errors:** `INVITE_EMAIL_MISMATCH`, `INVITE_PERSON_DISABLED`, `INVITE_DUPLICATE_ACCOUNTS`, `INVITE_INVALID` / `INVITE_EXPIRED`.
- **Tests:** `server/tests/inviteFlow.test.ts`.

## 2026-06-20 — People admin duplicate detection and safe cleanup

- **Audit:** `GET /api/people` returns `audit` warnings for duplicate Person/User emails, stale `Person.userId`, and email/user mismatches.
- **Remove:** `DELETE /api/people/:id` (soft disable default; `?hard=true` removes Person and revokes pending invites — not table history).
- **Repair:** `POST /api/people/repair-email` merges duplicate Person rows and links canonical Person to User.
- **Runtime fix:** `getPersonForUser` prefers email-canonical Person and repairs `userId` link on read.
- **UI:** `PeopleScreen` shows warnings, Repair, Disable, and Remove actions (root protected).
- **Tests:** `server/tests/peopleCleanup.test.ts`.

## 2026-06-19 — Blackjack targeted UX fixes (6 items)

- **Full Table scroll:** play/dealing/resolved phases hide internal felt/box-row scrollbars (CSS containment only; desktop Full Table).
- **Mobile Card View portrait:** hero cards ~2.5× scale; BUST/BlackJack stack badges on hero cards area.
- **Mobile landscape:** isolated `@media (max-width: 900px) and (orientation: landscape)` layout for Full Table + Card View (`bj-mobile-landscape-layout.css`).
- **Bank draw skip:** when every active bet is terminal (bust, natural/blackjack, done) before bank draw, skip bank draw and resolve immediately; stood hands still require normal bank comparison.
- **Desktop game over:** large dismissible table-centre overlay on felt (`bj-game-over-table-overlay`); mobile overlay + right-rail inline summary unchanged.
- **Tests:** `blackjackTargetedFixes.test.ts`, `roundFlow.terminal.test.ts`.

## 2026-06-19 — Table chat unread badge (client-side)

- **Unread:** `lastSeenAt` per table/user in localStorage; closed dock shows `Chat • N` and brief pulse on new messages from others.

## 2026-06-19 — Shared table chat via server API

- **Server:** in-memory `tableChatStore` + `GET/POST /api/tables/:tableId/messages` (member-only, max 200 msgs/table).
- **Client:** `tableChatService` prefers server API when `preferServer`; localStorage fallback only on API failure.
- **UI:** `TableChatDock` polls every 2s open / 5s closed; dedupes by message id.

## 2026-06-19 — Table messaging (invite notes + table chat dock)

- **Types:** `src/features/messaging/tableMessagingTypes.ts` — `TableInviteMessage`, `TableChatMessage`, `InvitedTablePlayerSetup`.
- **Invite setup:** Challenge flow stores per-player `inviteMessage`; online invite emails include optional “Message from host” section.
- **Chat:** `tableChatService` (localStorage) + `TableChatDock` mounted on `TableScreen` (not inside game panels).
- **Blackjack:** engine, rules, phases, and layout unchanged.

---

## 2026-06-13 — Zilch isolated Dice engine + canonical scoring

- **Engine home:** `src/engine/dice/zilch/` (`zilchRules`, `zilchState`, `zilchEngine`, `zilchSelectors`, `zilchResult`); `src/engine/zilch/` re-exports for server/client compatibility.
- **Scoring:** migrated to canonical points scale (e.g. single 1 = 100, default target 10,000); added two triplets combo.
- **UI:** split into `src/components/zilch/*` + `src/styles/zilch-table.css`; `ZilchPanel` re-export unchanged for `TableScreen`.
- **Adapters:** `ZilchGameResult` envelope + IOU handoff stub; ledger outcome on game complete via existing `recordTableOutcome`.
- **Guards:** `zilchIsolationGuards.test.tsx` — no Blackjack imports, routing unchanged.
- **Blackjack:** untouched (freeze guards pass).

---

## 2026-06-13 — Blackjack engine/layout freeze baseline

- **Freeze doc:** `docs/BLACKJACK_ENGINE_FREEZE.md` — engine rules, dealing, phases, desktop + mobile portrait/landscape Full Table baseline, split display, shared shell; new-game gate.
- **BJ badge:** Full Table stack outcome badge text `BJ` → **BlackJack** with subtle gold festive styling (badge-only; zones unchanged).
- **Guards:** `blackjackEngineFreezeGuards.test.ts` — shell zone order, desktop `data-bj-view`/`data-bj-phase`, shared `renderActionsContent`, Card View desktop/mobile routes, routine scripts exclude `blackjackRenderedLayout`.
- **New games:** must use separate game protocol modules and table panels — not by modifying frozen Blackjack engine/shared shell without explicit unfreeze.

---

- **Mobile Card View portrait:** play phase no longer applies Full Table's tall command band (`6.375rem`) — hero cards zone recovers height; portrait owner restores hero card min size (~50×70px at 390×844). Hero hand total stays hidden in Card View.
- **Mobile Full Table landscape:** grid targets `.bj-dealer-area` (not missing `.bj-table-zone--dealer`); felt bank row hidden; play phase uses compact landscape command height; flex chain fits shell in viewport below toolbar.
- **Captures:** `capture-mobile-card-layout.mts` asserts hero `.playing-card` rects; new `capture-mobile-full-landscape-layout.mts`.

---

- **Split display (engine unchanged):** split hands remain `boxId:handIndex` on one slot. Desktop Full Table + Card View render a nested `.bj-arc__slot--split-host` cluster: smaller `.bj-arc__split-companion-tile` left of normal `.bj-arc__slot-split-main` (wager, card ranks, active highlight per `activeHandKey`). Full Table card columns use compact `.bj-arc__slot--card-split` stacks side-by-side.
- **Card View hero:** still follows `activeHandKey` only (one split hand at a time).
- **Full Table dealer:** `.bj-view-full-desktop` centers dealer cards + deal button on felt in betting and playing (≤5px at 1280×800); Card View unchanged.
- **Tests:** `cardViewDesktopSplit.test.tsx` (cluster DOM + Full Table split cards); runtime audit extended for Full Table felt-center checks.

---

- **Desktop Card View:** command/dealer tokens aligned with Full Table; optional Double/Split in command zone (not unstyled cards anchor).
- **Mobile Card View:** reuse Full Table shell zones; hero value inside cards area (`segment="all"`); stripped portrait layout owner to hero card sizing only.
- **New Game modal:** wider `NewTableOverlay` panel, no horizontal scroll, mobile single-column embedded grid.

---

## 2026-06-13 — Mobile portrait Card View, landscape Full Table, double-on-10

- **Frozen (unchanged CSS):** Desktop Full Table, Desktop Card View, Mobile Portrait Full Table — guard tests in `frozenLayoutViewIntegrity.test.ts`.
- **Mobile Card View portrait:** `bj-card-mobile-portrait-layout.css` — desktop-like zone order, bounded hero band, visible value/actions/boxes/tray.
- **Mobile Full Table landscape:** `bj-full-mobile-landscape-layout.css` — grid bands for dealer/command/cards/actions/boxes/tray under `.bj-view-full-mobile`.
- **Gameplay:** `hardTotalAllowedForDouble` rejects soft hands on hard-total protocols; `canDoubleUnderProtocol` uses available chips only.
- **Tests:** `doubleEligibility.test.ts`, mobile layout owner tests, `test:mobile-card-layout:browser`, `test:mobile-landscape-full-layout:browser`.

---

## 2026-06-17 — Layout contract reconciliation (structural)

- **Source of truth:** `docs/BLACKJACK_LAYOUT_CONTRACTS.md` — authority order (reference images → browser captures → doc → ownership tests); test categories A–D; per-view layout owners; shell placement exception.
- **Desktop Card View:** action-to-box gap tuned to ~5px (`margin-bottom: -0.3125rem` on actions zone); browser capture asserts 3–8px.
- **Desktop Full Table:** play-phase card-column value suppressed (total in box); cards row 1fr grid aligned to boxes; ownership tests enforce owners + shell-only exception (no “29 violations” baseline).
- **Tests:** `test:layout:desktop-full`, `test:layout:desktop-card`, `test:layout:ownership`, `test:layout:all-fast`; frozen/guard tests updated to match browser-validated tokens.
- **Docs:** `SXM_MASTER_SPEC.md`, `BLACKJACK_STABILITY_CONTRACTS.md`, `.cursorrules` defer detailed layout rules to `BLACKJACK_LAYOUT_CONTRACTS.md`.

---

## 2026-06-13 — Desktop Full Table betting alignment + mobile layout polish

- **Desktop Full Table betting:** `[data-bj-phase='betting']` centers dealer block on felt to match Card View betting (dealer cards, Deal button, command pill within 5px); playing dealer alignment unchanged.
- **Mobile command slot:** Shared `--bj-zone-command-height` via `data-phase` (player/dealer/resolved) on `.bj-casino`; Full Table + Card View command zones match in betting and playing.
- **Mobile boxes:** Player box row uses `1fr` grid spread across felt width; player-box hand value ~2× via `--bj-mobile-box-value-scale`.
- **Mobile Card View hero:** Portrait container-fit hero cards inside cards area; hero hand total hidden under cards (player box values unchanged).

---

- **Card View dealer centering:** `.bj-dealer-area` centers `.dealer-block` on felt (Card View only); dealer cards/deal button within 5px of felt center at 1280×800.
- **Hero cards:** Larger shell tokens + `@container bj-hero-cards` fit in `bj-card-desktop-hero-area.css` (≥90×125px target).
- **Command gap:** Shared `--bj-desktop-dealer-command-gap: 0.4125rem` (~15px closer to deal vs 1.35rem); Card View actions share Full Table Hit/Stay styles via `bj-full-table-card-area.css`.
- **Command copy:** Turn line includes box + player name (`Box N — name — your turn.`); removed Hit/Stay option lines; only `Double available.` / `Split available.` / insurance copy when applicable.

---

## 2026-06-18 — Runtime visual branch fixes (dealer/boxes/actions/hero)

- **Dealer parity:** Card View desktop now shares Full Table `dealer-block` max-width + centered grid (`bj-table-shared.css`, `DealerBlock.css`); shell dealer rules target `.bj-dealer-area` (was `.bj-table-zone--dealer`); fixed 3.35rem cards-slot + 1.55rem bank-hand band + hidden dealer hint stabilize deal button across betting/playing.
- **Boxes parity:** Card View desktop included in full-arc box height lock (`bj-player-row-layout.css`).
- **Hit/Stay:** Desktop table variant no longer renders empty secondary row with `bj-phone-view__action-bar-*` placeholders (`BlackjackActionPanel.tsx`).
- **Hero cards:** Shell token sizing + min size + z-index 2 (`bj-card-desktop-hero-area.css`).
- **Audit script:** `scripts/runtime-visual-branch-audit.mts` (1280×800 DOM/rect/CSS proof).

---

## 2026-06-18 — Desktop betting cloth alignment + Card View hero card visibility

- **Betting cloth:** Shared `align-items: center` for Full Table + Card View in `bj-full-table-card-area.css`; removed Full Table–only `bj-cards-area--table` cloth flex-end override. Cloth/title now centered inside cardsArea (0px title delta between views).
- **Card View playing cards:** Replaced `max-height: 3.2rem` clip in `bj-card-desktop-hero-area.css` with shell `--bj-card-hero-card-*` tokens + `@container bj-hero-cards` fit; hero z-index 1 above cloth.

---

## 2026-06-18 — Desktop shell slot unification (betting = playing geometry)

- **Single shell grid:** All desktop phases share play-phase row tokens; bank-info row reserved at `1.5rem`; cards zone stretch identical for `--table` and `--hero`.
- **Actions slot:** Betting renders `bj-action-row--slot-reserved` (same band as Hit/Stay) instead of legacy placeholders.
- **Hero CSS:** Removed all `[data-bj-phase]` rules from `bj-card-desktop-hero-area.css` — internals only.
- **Verification:** `measure-desktop-polish.mts` enforces ≤1px parity across all four desktop states.

---

## 2026-06-18 — Betting/play phase shell parity (desktop Full Table + Card View)

- **Shell geometry:** Removed betting/resolved-specific zone token overrides in `bj-blackjack-table-shell.css`. All `data-bj-phase` bands now share play-phase slot heights (command `5.85rem`, actions `2.5rem`, dealer→command gap `2.55rem`). Only cards-area cloth/content differs by phase.
- **Command pill:** Same flex/min-height rules for betting and playing (no phase-only command CSS).
- **Tests/measure:** `blackjackPhaseLayoutParity.test.ts`; `measure-desktop-polish.mts` enforces betting↔playing band parity.

---

## 2026-06-18 — Desktop Card View route cleanup + split presentation

- **Card View dead routes removed:** `BlackjackCardView.css` desktop `.bj-phone-view__*` hero rules; card-only dealer grid/commentary CSS in `bj-blackjack-table-shell.css`; duplicate cloth/hero-value rules in `bj-card-desktop-hero-area.css`.
- **Desktop Card View hero:** cards only (no value badge); outcome marker floats on cards band; shared `BlackjackActionRow` (`full-table` scale) unchanged.
- **Command (playing/dealing):** both desktop views — command zone height `5.85rem`, dealer→command gap `2.55rem` (pill closer to dealer; more cards-row headroom). Card View betting command gap aligned with Full Table (`3.875rem`).
- **Split:** engine unchanged (`splitBlackjackOnState` — `boxId:handIndex` hands, equal wager). Desktop Card View adds split-companion box tiles left of parent slot (`bj-arc__slot--split-companion`); hero follows `activeHandKey` only. Tests: `cardViewDesktopSplit.test.tsx`.

---


- **Desktop layout:** Token-based vertical zone model for `.bj-view-full-desktop` and `.bj-view-card-desktop` — player row spread (`--bj-desktop-player-row-spread`), in-box value 2× scale, Card View hero value −30%, action row offset, hero card area bottom gap.
- **Card View desktop:** Player boxes now full-width `space-evenly` (was compact centered cluster); hero cards stretch lower without clipping; hero value in dedicated shell zone.
- **Freeze:** `CARD_VIEW_DESKTOP_FROZEN = true`; reference mockup [`reference-ui/views/Mobil.png`](../reference-ui/views/Mobil.png) documented in `BLACKJACK_LAYOUT_CONTRACTS.md`.
- **Tests:** Extended `blackjackRenderedLayout.test.tsx` with desktop token guards and hero stack position checks.

---

## 2026-06-16 — Split gameplay tests + shared layout rows + rendered-position tests

- **Split engine:** No logic change — canonical `splitBlackjackOnState` / `handKey` routing already correct. Added `splitGameplay.test.ts` (7 cases: pair split, wager parity, active-hand advance, resplit, double-after-split, settlement, handKey routing).
- **Shared rows:** `BlackjackActionRow`, `BlackjackPlayerBoxRow`, `BlackjackTrayRow` — single presentational path for Full Table and Card View; Panel no longer imports `BlackjackActionPanel` or `ValueAndChipsBar` directly.
- **Card View structure:** Shell `heroValue` zone between cards and actions; `BlackjackCardView` `segment="cards" | "value"` — explicit row order without hero value/action overlay.
- **Rendered-position tests:** `blackjackRenderedLayout.test.tsx` + `layoutMeasure.ts` — bounding-box stack/overlap checks for all five view scenarios (desktop/mobile full + card, mobile landscape full).
- **Docs:** `BLACKJACK_LAYOUT_CONTRACTS.md` updated with shared-row table and rendered-position test references.

---

## 2026-06-16 — Online table membership stability

- **Canonical membership:** `server/src/tables/membership.ts` resolves session user id, repairs missing host/invitee rows, and syncs `member.personId` when `ownerPersonId` drifts after setup/reset.
- **Authority:** All table actions use `ensureTableMember` (no direct `getMember` + non-null assertion).
- **Client:** `TableMembershipError` (403) distinct from table-not-found; stale local table id cleared with lobby prompt; `onlineDispatch` re-throws membership errors without wrapping.

---

- **Hero layout:** Reserved `--bj-cardview-hero-value-band-height` between hero cards and actions; removed conflicting `overflow: visible` reset on cards-slot; shell hero stage `min-height: 0` so value is not overlapped (desktop + mobile Card View).
- **Actions/boxes/tray:** Canonical order hero cards → hero value → `BlackjackActionPanel` → shared player boxes → shared `ValueAndChipsBar` tray; removed Card View–only action padding overrides; player box in-play totals + stake-slot collapse apply to all views.
- **Desktop tray:** Card View desktop uses same `ValueAndChipsBar` grid as Full Table (`label` row below chip plaques).
- **Tests:** `cardViewDisplayRegressions.test.ts` freezes shell vertical order and shared-path guards.

---

## 2026-06-16 — Final blackjack layout polish (actions, hero value, chips, layered cards)

- **Desktop Full Table:** Hit/Stay lowered (`--bj-full-desktop-actions-boxes-gap: 0.125rem`); stack/value gap preserved (`--bj-full-desktop-stack-value-gap: 0.3125rem`).
- **Desktop Card View:** Hero hand value visible below cards (overflow fix); shell `BlackjackActionPanel` shares Full Table desktop action-zone tokens; third+ hero cards use `bj-phone-view__card-wrap--layered`.
- **All views:** Player boxes show in-play hand total inside box; chip stacks hidden during play; betting phase unchanged.
- **Tests:** `blackjackFinalLayoutFixes.test.ts`; frozen layout tests updated.

---

## 2026-06-19 — Game-over IOU handoff + Exit Table

- **IOU on New Game:** `runGameOverCompleteAction` submits `/api/iou-handoff/create` before new-game reset; removed client localStorage gate that skipped the API; IOU failure blocks proceed; duplicate/alreadySubmitted is non-fatal.
- **Exit Table:** Game-over overlay adds Exit Table beside Start New Game; IOU + save-table prompt (`LeaveTableConfirmDialog`) before returning to lobby/start.

---


- **Challenge same-person bank+box:** Round/bust/natural settlement skips internal bank↔box ledger transfers when `personsShareOneChipPot` — wins restore committed bet only; losses refund committed bet without crediting bank; total chips invariant.
- **Desktop Full Table:** Hit/Stay pinned to bottom of actions row (`justify-content: flex-end`); `--bj-full-desktop-actions-boxes-gap: 0.25rem`.

---

## 2026-06-12 — Blackjack layout regressions (actions, box totals, reset)

- **Desktop Full Table:** Hit/Stay row lowered (`--bj-full-desktop-actions-boxes-gap: 1.25rem`).
- **All views:** Canonical `BlackjackActionPanel` for Hit/Stay; removed Card View side-action/swipe path.
- **Card View hero:** Hand value below cards at dealer-value size; active-turn frame on value only.
- **Player boxes:** In-play hand total inside box under ranks; chips hidden during play; bet amount stays above box.
- **Reset crash:** TableStakePanel catches online reset errors; host member self-heal on server when record missing.

---

## 2026-06-12 — Card View reuse + mobile box stability

- **Player boxes:** Desktop Card View reuses Full Table box width tokens and `renderArcSlot` / `BlackjackPlayerBoxHead` / `ValueAndChipsBar` tray path; active-turn `bj-box--turn` applies in all views.
- **Actions:** Desktop Card View — shell `BlackjackActionPanel` (Hit/Stay) + cards-zone `OptionalPlayDecisionOverlay` (Double/Split). Mobile Card View — single path: hero side Stay/Hit OR command-zone optional overlay; shell panel suppressed on mobile Card View.
- **Mobile boxes:** Portrait tiles use fixed height + `overflow: hidden`; Mobile Card View shows in-box hand value under ranks (`bj-phone-view__mini-hand-value`).
- **Hero value:** Mobile Card View hero total matches bank emphasis token (`calc(var(--bj-seat-total-size) * 1.35)`).
- **Tests:** `cardViewReuseFixes.test.tsx`; updated layout guard / parity tests.

---

## 2026-06-12 — Layout contract system cleanup (audit → enforceable docs)

- **Docs:** `BLACKJACK_LAYOUT_CONTRACTS.md` restructured — A (desktop FT), B1 (mobile portrait FT), B2 (mobile landscape pending), C1–C3 (Card View pending), recommended freeze order.
- **Constants:** `blackjackLayoutContract.ts` — per-view freeze flags, portrait/landscape media constants, Card View markers, dual-action-path documentation flag.
- **Guards:** `blackjackLayoutContractGuards.test.ts` — pending-freeze audit tests (no visual changes).
- **Spec:** `SXM_MASTER_SPEC.md` — Card View hero value below cards; layout test references.

---

## 2026-06-12 — Full Table layout freeze (desktop + mobile)

- **Docs:** `docs/BLACKJACK_LAYOUT_CONTRACTS.md` — frozen desktop/mobile Full Table zone order, action region, card stack/value contract, ownership guards, change checklist.
- **Constants:** `blackjackLayoutContract.ts` — `FULL_TABLE_DESKTOP_FROZEN`, `FULL_TABLE_MOBILE_FROZEN`, zone classes, action/overlay button contracts, forbidden CSS patterns.
- **Tests:** `blackjackFullTableLayoutFrozen.test.ts` — scrollbar, zone order, overlay vs action row, AID hidden on desktop, source guards.
- **AID:** Hidden on desktop Full Table per freeze (`FULL_TABLE_DESKTOP_AID_VISIBLE = false`).

---

## 2026-06-12 — Desktop Full Table split overlay + action layout

- **Split overlay:** Optional Double/Split offer moves from command zone to cards zone on desktop Full Table — centered above stacks (`bj-optional-play-overlay-anchor`, z-index 25); mobile unchanged in command zone.
- **Play Hand:** Decline split without engine action — dismisses overlay for current hand; Hit/Stay remain available.
- **Hit/Stay ↔ boxes:** ~10px gap (`0.625rem`); card stacks nudged to `translateY(18px)`.
- **AID:** Inline to the right of Hit on desktop Full Table (`aidInlineWithHit`); mobile / Card View unchanged.
- **Tests:** `blackjackFullTableDesktopPolish.test.ts`, `optionalPlayDealPacing.test.tsx`, `blackjackPolishRegression.test.ts`.

---

## 2026-06-12 — Desktop Full Table layout polish (spacing + bust badge)

- **Hit/Stay ↔ boxes:** Desktop Full Table actions row height tightened; ~5px (`0.3125rem`) padding below Hit/Stay.
- **Stack ↔ value:** ~5px gap via `--bj-full-desktop-stack-value-gap`; columns nudged down (`translateY(14px)`).
- **Command clearance:** ~3px (`0.1875rem`) between dealer Deal/New Cards and command box on desktop Full Table.
- **BUST badge:** Desktop Full Table bust renders as compact overlay on card stack (`bj-card-outcome-marker--stack-badge`), not floating outcome row.
- **Tests:** `blackjackFullTableDesktopPolish.test.ts`.

---

- **Desktop scrollbar:** Removed `overflow-x: hidden` + `overflow-y: visible` pair on Full Table card zone (CSS computes to `overflow-y: auto`); scoped hero-only `overflow: hidden`; card zone uses `overflow: visible`.
- **Desktop card values:** Value band uses flex centering + `overflow: visible`; removed forced `height: 100%` on desktop card zone.
- **Natural blackjack reveal:** `shouldUseOrderedInitialReveal` no longer skips `bank-turn`/`banking`/`resolved` while target counts are still initial-deal; exported `nextSequentialRevealStep`.
- **Game Over panel:** Desktop dock opens via `desktopSideRailPanel` even when user closed This Table before end.
- **Tests:** `blackjackFourRegression.test.ts`.

---

## 2026-06-12 — Full Table polish + game-end/insurance regressions

- **Active box highlight:** Restored `bj-box--turn` on the active player box during player turn (`cardViewBox.ts`); betting selection pulse unchanged.
- **Mobile end-state values:** Full Table card columns always show numeric hand values; outcome markers no longer hide values on mobile.
- **Desktop card nudge:** `translateY(10px)` on desktop Full Table card arc only (`bj-full-table-card-area.css`).
- **Active value frame:** Tight inset padding on `bj-phone-view__box-value--active-turn` without band height change.
- **Insurance:** Duplicate-submit guard via `insuranceDecisionPending` + overlay `pending` prop; viewer `personId` unchanged.
- **Start New Game:** Game-over shell uses compact `bj-game-over` styling (removed wide `invite-modal--table-panel`); still routes to `onBeginTableReset('newGame')` → `NewTableOverlay` + `TableStakePanel`.
- **Tests:** `blackjackPolishRegression.test.ts`.

---

## 2026-06-12 — Full Table play-zone layout rebuild

- **Root cause:** Competing card/command/action CSS across `bj-card-layout.css` (imported after card-area), `bj-table-shared.css`, `bj-player-row-layout.css`, and `BlackjackPanel.css` — `overflow: hidden`, fixed stack bands, and arc `height: 100%` clipped cards; import order defeated the card-area contract. **DOM/CSS mismatch:** `renderArcCardStack` wraps stacks in `bj-arc__play-zone`, but column grid targeted direct `> .bj-arc__cards--stack-vertical`; without an outcome marker the play-zone auto-placed into row 1 (0.72rem) and clipped cards while values stayed in row 3.
- **Single contract:** `bj-full-table-card-area.css` now owns command (B), card (C), and action (D) zones for Full Table desktop + mobile. Stack host `bj-arc__play-zone` is explicit grid row 2 with 2-card minimum band.
- **Import order:** `bj-full-table-card-area.css` loads after `bj-card-layout.css`.
- **Shared shell:** Full Table table-mode cards zone no longer inherits hero `padding-top` / desktop `overflow: hidden`.
- **Actions:** One render path — `renderActionsContent()` → `BlackjackActionPanel` in `bj-table-zone--actions`; CSS hides controls inside card area; desktop uses same pill styling as mobile.
- **Tests:** `blackjackFullTablePlayZoneLayout.test.ts` guards zone order, single action path, play-zone row 2, render-time visible `playing-card` desktop + mobile, Hit/Stay only in actions zone.

---

## 2026-06-12 — Full Table card area bottom-pin fix

- **Root cause:** Card zone was locked to `--bj-full-table-card-column-height` and desktop grid `[cards]` was overridden to that same fixed height, so stacks sat in a short strip under the command box instead of filling command→actions space with columns pinned to the bottom.
- **`bj-full-table-card-area.css`:** Zone uses `flex: 1 1 auto` + `justify-content: flex-end`; arc row `height: auto`; value band `align-self: end`; removed hero top inset (`padding-top: 0`); desktop grid row stays `1fr` in shared shell.
- **Tests:** Updated layout contract guards for flexible zone + bottom alignment.

---

## 2026-06-12 — Canonical Full Table card area contract

- **Single CSS module:** `src/styles/bj-full-table-card-area.css` — bottom-anchored columns (outcome / stack / value), desktop + mobile Full Table only.
- **Removed conflicting rules** from `bj-table-shared.css`, `bj-player-row-layout.css`, `BlackjackPanel.css` (duplicate grid/flex/centering).
- **Panel:** `bj-full-table-card-area` class on card arc row (`FULL_TABLE_CARD_AREA_CLASS`).
- **Tests:** `blackjackFullTableCardColumnLayout.test.ts` guards against `flex: 1`, `align-self: center` regressions.

---

## 2026-06-12 — Full Table card-column contract + game-end flow regression

- **Card area:** Canonical three-zone grid (outcome / stack / fixed value) for Full Table desktop + mobile; card-row slots bottom-aligned; arc height auto.
- **Game end:** Desktop panel re-opens when game-over active; dismiss uses `handleGameOverDismiss` (no ledger/IOU save); summary fallback from chip totals when message generic/null winner.
- **Tests:** `blackjackFullTableCardColumnLayout.test.ts`, `gameEndFlowRegression.test.ts`.

---

## 2026-06-12 — Game Over CTA + desktop card column + command copy

- **Game Over CTA:** **Add to Ledger** checkbox + **Open Ledger** link; **Create IOU** checkbox + expandable **Add message** (180 chars); **Start New Game** (owner-only) saves ledger/creates IOU then reset — toggles alone do nothing; dismiss does not save.
- **Game Over copy:** Round-count comment line via `resolveGameOverRoundComment` helper (extensible tiers).
- **Command text:** Options line omits Stay — `Options: Hit, Double — one card.` / singular `Option:` when one choice.
- **Desktop Full Table cards:** Values anchored at bottom of card column; stacks grow upward; horizontal alignment with boxes; scoped `.bj-view-full-desktop` CSS only.
- **Tests:** Updated overlay, command, desktop layout, game-end UI tests.

---

## 2026-06-12 — Game Over upgrade + desktop table polish

- **Game Over UI:** Title **Game Over**; extensible glyph visuals; winner/result/rounds summary; Magic 8 line; ledger either/or (**Add to Ledger** / **Don't Add**); **Create IOU** toggle + optional **Add message to IOU** (passed as IOU `message` param); **New Game** applies choices then reset — dismiss/close does not save.
- **Desktop polish:** Nav buttons aligned to felt right edge; card values below stacks; game-ended card-row spacing; dealer New Game suppressed while game-over UI active; desktop tray label restored.
- **Mobile:** ~10% larger table typography via scoped CSS tokens (not chip/card scale).
- **Tests:** `blackjackDesktopPolish.test.tsx`, updated game-over overlay/presentation tests.

---

## 2026-06-12 — Box/token placement stabilization

- **Stable UI anchor:** Local chip target is `{ slotNumber }` only; arc React keys are `slot-${slotNumber}`; unified `renderArcSlot`.
- **Online optimistic:** Empty-slot first chip uses pending preview by slot — no client `claimBoxSlot` or visual `boxId` materialization.
- **Payload:** `resolvePlaceBetPayloadTarget` derives `boxId` vs `slotNumber` at send time; rapid taps serialized per slot.
- **Visible row:** `resolveEffectiveVisibleBoxCount` no longer auto-expands from highest occupied slot.
- **Layout:** Fixed stake slot + absolute chip pile in arc row; removed arc `renderBetZone` dual path.
- **Legacy:** `resolveChipTrayBetTarget` deprecated; removed `selectedSeatId` from betting paths (player-turn Card View hero still uses it).
- **Tests:** `blackjackBoxPlacementStability.test.ts`; contract docs in `BLACKJACK_STABILITY_CONTRACTS.md`.

---

## 2026-06-12 — Blackjack cleanup: layout polish + bank-player shared pot

- **Bank value:** `bj-dealer-hand-value` padding under dealer cards (`TableInfoBar.css`).
- **Active value:** tight numeric frame (`border-radius: 0.32em`) replaces oversized ellipse on `bj-phone-view__box-value--active-turn`.
- **Desktop Full Table:** card columns pushed lower toward player boxes (desktop-only CSS).
- **Shared pot accounting:** `sharedBankroll.ts` — same person as bank + player uses one ledger pot; tray/validation via `bankroll.ts` + `blackjackAccountingDisplay`; no duplicate owner allocation when bank already funded.
- **Tests:** `blackjackCleanupFixes.test.ts`, `sharedBankroll.test.ts`.

---

## 2026-06-12 — Blackjack stability regression audit (dealing + accounting fences)

- **Dealing root cause:** First-mount `hydrateInstant` bypass in `useSequentialCardReveal` skipped P→D→P→D natural reveal; `resolveRevealScopeTransition(null)` now returns `reset`; mid-round join uses `shouldSnapCardRevealOnMount`.
- **Dealing display:** All view imports routed through `blackjackDealingContract`; command text + dealer/player phrases use masked `displayState`; “Round finished” gated on `cardRevealComplete`.
- **Accounting:** `evaluateTableGameEnd` uses `resolvePersonEndGameBalances`; tray/This Table parity tests enforced.
- **Docs/tests:** `BLACKJACK_STABILITY_CONTRACTS.md` DEALING/ACCOUNTING fences; expanded contract + dealing regression tests.

---

## 2026-06-12 — Blackjack stability contract layer

- **Protocol:** `blackjackActionContract.ts` — single view import for action permission + hand legality; Panel/Card View migrated off direct engine imports.
- **Layout:** `blackjackLayoutContract.ts` + contract tests for view roots, `displaySlots` alignment, active-value highlight.
- **Dealing:** `blackjackDealingContract.ts` + `dealingRoundRegression.test.ts` (round 1/2 reveal gating).
- **Accounting:** `blackjackAccountingDisplay.ts` — tray + This Table use `resolvePersonDisplayBalances` / `resolveViewerTrayAvailable`.
- **Docs:** `docs/BLACKJACK_STABILITY_CONTRACTS.md`; SXM_MASTER_SPEC stability table.

---

## 2026-06-12 — Blackjack wiring/display fixes (controls, exposure, highlight, alignment)

- **Hit/Stay:** `canShowPlayerDecisionControls` treats engine player-turn + active-hand reveal ready as effective player phase; `resolveViewerActionPermission` gates controls to box caller only.
- **This Table + tray:** `playerCommittedExposure.ts` canonical helper; `bankroll.ts` delegates exposure; `clampAvailableForDisplay` prevents negative tray/This Table available.
- **Active value:** `cardColumnHandValueClassName` — circular highlight on card-column number only; no box turn border.
- **Alignment:** Card row and box row both iterate `displaySlots` in slot order (shared 1fr grid).
- **Box content:** Owner name + rank list (`formatBoxCardRanksLabel`) inside box; committed amount above box.

---

## 2026-06-12 — Insurance targeting fix

- Insurance decision owner follows **stake attribution** (`getInsuranceDecisionPersonIdForBox`): sole staker decides and pays from their bankroll; shared boxes fall back to box caller.
- **One person-scoped decision** covers all pending eligible boxes (`takeInsuranceForPersonOnState` / `declineInsuranceForPersonOnState`); overlay only for viewers with a pending decision.
- Online authority accepts `personId` payload for insurance actions; synced engine `.js` mirrors.

---

## 2026-06-09 — Challenge bank-bust settlement setup option

- **New Table → Challenge:** required **Bank bust settlement** choice — **Fractional / Ranked** (default) or **Winner Takes All**; stored as `tableMeta.bankBustSettlementMode`.
- **Winner takes all:** bank bust awards the sole highest remaining chip total; tied top totals fall back to ranked/fractional without a fake winner.
- **Practice:** selector hidden; behavior unchanged.
- **Ledger:** `settlementMode` on ended table + score ledger entry reflects effective settlement.
- **Tests:** `bankBustSettlement.test.ts`.

---

## 2026-06-09 — Challenge accounting and game-end presentation

- **Challenge bank:** Always a real seated player (no dealer/house option in Challenge setup); bank identity shown as **Bank: [Name]** in dealer/felt info.
- **Fractional settlement:** Default when bank bust leaves multiple non-bank chip holders — ranked final totals in message + score ledger participants (`challengeEndAccounting.ts`); IOU only when one clear debtor/creditor pair.
- **Desktop game end:** **Game Summary** in right-hand This Table panel — table/cards stay visible; no blocking overlay.
- **Mobile game end:** Existing centered overlay retained unchanged.
- **IOU toggle:** Moved below Add to Ledger / Don't Add buttons.
- **Tests:** `challengeEndAccounting.test.ts`, `challengeGameEndPresentation.test.tsx`, game-end UI wiring updates.
- **Docs:** `SXM_MASTER_SPEC.md` §5 table modes + game end presentation.

---

## 2026-06-07 — Challenge flow fixes (bank identity, rematch, chip remove)

- **Chip remove:** `×` control moved below stake pile; pile-only scale; stake slot `overflow: visible`; stable `--bj-full-table-stake-min-height`.
- **Challenge bank:** Bank seat is a real player; wins show `"[Name] wins as Bank"`; ledger/IOU use player ids/emails (`challengeBankDisplay.ts`).
- **Practice:** Bot bank remains house/dealer; anonymous bank winner id allowed in ledger.
- **New Game:** Game-over overlay always dismisses after ledger/IOU confirm; **New Game** opens `TableStakePanel` rematch on same table id/people.
- **Tests:** `challengeBankDisplay.test.ts`, `stakeChipRemove.test.tsx`, game-over overlay integration updates.
- **Docs:** `SXM_MASTER_SPEC.md` §5 table modes, rematch, stake chips.

---

## 2026-06-07 — Mobile chip tray polish

- **Value label:** Removed `Available:` prefix; bankroll shows numeric value only (tabular numerals), left of chip row.
- **Layout:** `ValueAndChipsBar` row 1 = value + chips (nowrap); mobile row 2 = table label when set. Shared Table + card views.
- **Spacing:** Single `--bj-chip-tray-gap` token; stash `overflow: hidden` prevents overlap with value.
- **Mobile plaques:** ~12% smaller visual (`--chip-plaque-visual-*`) with preserved hit target (`--chip-plaque-hit-*`).
- **Tests:** `mobileChipTrayLayout.test.ts` + updates to tray layout specs.
- **Docs:** `SXM_MASTER_SPEC.md` §15.

---

## 2026-06-07 — New Table overlay cleanup

- **Shared overlay:** `NewTableOverlay` — fixed layer over page/table for lobby “Open New Table” and menu “Start New Table”; never reflows underlying content.
- **Same render path:** Lobby and in-table entry points embed `TableStakePanel` with `embeddedInOverlay`; desktop centered modal, mobile bottom sheet (CSS only).
- **Staged UI:** Removed numbered step headings (`1. Game`, etc.); clean fieldset titles (Game, Mode).
- **Compact selection buttons:** `table-stake-panel__select-btn` — smaller yellow Cards/Dice/Continue/mode/Start controls (~40–44px touch height); nav row separated from options.
- **Docs:** `SXM_MASTER_SPEC.md` §5 and §14 updated.

---

## 2026-06-10 — Blackjack UX/protocol fixes

- **Card-column values:** Hand total above each Table View card column (shared `boxHandValueDisplay`).
- **Box stability:** `+` add-box matches player box outer size; turn pulse box-shadow only; reserved stake/composition zones.
- **Insurance:** Fix unfunded auto-skip; offer persists until explicit Play vs Ace; status set before insurance activation.
- **Ace decisions:** Take 1:1 + Play vs Ace buttons with thin yellow border (`blackjackAceDecisionActions`).
- **Card View mobile:** Smaller hero clamps; overlapping cards inside hero — no horizontal canvas stretch.
- **Summary:** Default off; Won/Lost chip labels + visual cards when opened.
- **Short-stack top-up:** Auto top-up to min bet at next round (`shortStackTopUp.ts`).
- **Felt parity:** Card View uses `--bj-table-felt-bg`.

---

## 2026-06-12 — WIN stack badge + round-2 reveal order

- **WIN/EVEN/BJ stack badges:** Full Table desktop/mobile now overlay all outcome markers on the card stack (same pattern as BUST), not the floating command-row marker.
- **Round 2+ reveal:** `nextSequentialRevealStep` no longer falls through to dealer-first `nextGameplayRevealStep` while initial-deal cards are pending; reveal hook no longer snaps to full visibility on partial reveal.

---

## 2026-06-12 — Auto-stop defers to Split/Double

- **Optional actions first:** `processPlayFlowAutoStands` no longer auto-stands when Split or Double is legal (`shouldAutoStopPlayerHandForState`). Pairs like 9+9 and 10+10 at auto-18 wait for player choice.
- **Soft-hand rule retained:** Player auto-stop still uses hard/minimum total when an Ace is present.

---

## 2026-06-12 — Blackjack auto-stand + Card View hand hold

- **Soft-hand auto-stand:** Player auto-stand thresholds use hard/minimum total when the hand contains an Ace (`getAutoStandDecisionTotal` / `shouldAutoStandHand`). Soft A+8 and 3+4+A no longer auto-stand at auto-18; hard 10+8 and 9+9 still do.
- **Card View result hold:** After a hit that busts or auto-stands, Card View keeps the hero on that hand for 3s (`CARD_VIEW_BUST_HOLD_MS`) once the new card is revealed; Hit/Stay disabled during hold. Full Table keeps deal-speed result hold timing via `useHandTransitionHold`.

---

## 2026-06-10 — Blackjack UX fixes

- **Player box stability:** Fixed stake/composition reserved height in slot row — chips no longer reflow box dimensions.
- **Active turn:** Card-column / hero circular `bj-phone-view__box-value--active-turn` only; no box border or slot turn frame.
- **Card View:** Larger hero cards via `clamp()` tokens; score above hero; mobile Stay/Hit me side indicators restored.
- **Bust delay:** Card View holds busted hero 2s (`CARD_VIEW_BUST_HOLD_MS`) before following next box.
- **Dealer info:** Bank Total in felt row; Bank Hand under dealer cards only.
- **Command text:** Strict format — no sentimental copy; Stay wording; natural blackjack label separate from even-money.

---

## 2026-06-10 — Documentation consolidation

- Created `docs/SXM_MASTER_SPEC.md` as the single source of truth from current implementation.
- Archived superseded specs and duplicate docs to `docs/archive/`.
- Retained operational docs (`README.md`, deployment guides, QA checklist, Magic 8 content guide).
- Documented open item: **admin game activation** (e.g. Zilch on/off) — not yet implemented.

### Archived (superseded)

- `Scope.md` — Spec 1.0 (pre-online, local-only assumptions)
- `PROJECT_PLAN.md` — phased build plan (mostly complete; conflicts with current online architecture)
- `docs/multiplayer-invite-roadmap.md` — stated online sync was future; now implemented
- `docs/protocol-engine.md` — merged into master spec §8
- `docs/online-offline-parity.md` — merged into master spec §16
- `docs/settlement-ledger.md` — merged into master spec §11
- `docs/allocation-audit.md` — phase audit; canonical API documented in master spec
- `docs/blackjack-rendering-audit.md` — rendering/CSS audit; reference only
- `docs/blackjack-intel-source-notes.md` — AID research notes

---

## Prior implementation milestones (summary)

These shipped before this changelog was created. Dates approximate from git history and phase labels.

| Milestone | Summary |
|-----------|---------|
| Core table & ledger | Session CRUD, append-only ledger, balance derivation |
| Deck & dealing | 52-card deck, shuffle, deal animations |
| Blackjack engine | Protocol phases, betting, hit/stand/double/split, settlement |
| Texas Hold'em engine | Offline betting streets, hand evaluator (no online path) |
| Casino table UX | Full Table + Card View, chip stacks, box model |
| Protocol presets | Las Vegas, European Shoe, Classic Home + `activeRules` adapter |
| Online mode | Magic-link auth, Postgres people, in-memory tables, Socket.IO sync |
| Entry lobby | Open New / Join / Load slide-outs; no auto-resume on reload |
| Staged new table | `TableStakePanel` game → mode → configure flow |
| Zilch | Dice engine, online actions, `ZilchPanel`, shake-to-roll mobile |
| Challenge mode | Wager, invites, personal score ledger |
| Join requests | Knock / Pending client UI; approve API without host UI |
