# SXM Change Log

Significant product and architecture changes. For the authoritative current-state description, see **[SXM_MASTER_SPEC.md](./SXM_MASTER_SPEC.md)**.

## Process rule

Every significant feature change must update **both**:

1. `docs/SXM_MASTER_SPEC.md` — reflect new behavior
2. `docs/CHANGE_LOG.md` — record what changed and when

before the work is considered complete. This rule is also stated in `.cursorrules`.

## 2026-09-11 — Blackjack mobile vertical contract and responsiveness

- Canonical mobile Full Table/Card View now use the shell-owned command → cards → actions → boxes → tray grid without cross-zone transforms or overlap. HIT/STAY are compact, the command has primary/secondary hierarchy, and the content-sized tray alone owns bottom safe-area padding. Full Table and Card View landscape geometry now have separate owners instead of competing selectors.
- The mobile browser capture now loads the production CSS cascade and asserts non-overlap for both views. Existing `flowSettings`/`dealPacing` remains the single card cadence source; no gameplay timer or rule changed. Opt-in `VITE_BLACKJACK_PERF=true` diagnostics measure local and online action latency, and online actions expose an immediate busy state.

---

## 2026-09-11 — Card View complete settlement results (approved freeze exception, punch-list #15b)

- `BlackjackCardView.tsx` and `CardViewDesktopHeroArea.tsx`: Card View settlement panels now render every settled hand result in canonical `orderedHandKeys` box order. Removed the silent `slice(0, 4)` data truncation; no card geometry, CSS, reveal sequencing, or timing changed. Explicit user-approved exception recorded separately in `docs/BLACKJACK_ENGINE_FREEZE.md`.

---

## 2026-09-10 — Blackjack gameplay reveal order (approved freeze exception, punch-list #15a)

- `cardRevealDisplay.ts` `nextGameplayRevealStep`: pending player cards (hit/double/split draws) now reveal before dealer/bank draw cards — players-before-dealer, same principle as `buildInitialRevealSteps`. Pure reorder of the existing step sequencing; no new timing config, state, or animation. Explicit user-approved exception recorded in `docs/BLACKJACK_ENGINE_FREEZE.md`. The Card View `slice(0,4)` cap was **not** part of this approval and is unchanged.

---

## 2026-09-10 — Multiplayer security hardening + audit punch-list (items 1–14)

- **Socket subscribe gated:** `table:subscribe` now verifies table membership server-side; non-members get `table:subscribe:denied` and never join the room. `/api/tables/active` strips `hostEmail` and player names for viewers without membership.
- **Per-viewer state redaction:** new `server/src/tables/redactState.ts` masks the hidden blackjack dealer hole card, opponent hold'em hole cards, and the shoe `drawOrder` before state leaves the server (socket broadcasts via per-socket `fetchSockets()` emits, plus GET/join/action HTTP responses). Redaction mirrors client visibility rules exactly (protocol `showDealerHoleCardDuringPlay`, showdown, practice-mode virtual seats). The previously noted online-save/offline-resume shoe concern is a confirmed non-issue: SXM does not support that session-overlap flow.
- **Authority fixes:** `assignChips` enforced by `assertTableHost` on `personId` (was spoofable display-name match); `placeBet` requires a finite positive amount; zilch server path no longer falls back to display-name matching.
- **Client sync:** monotonic version guard drops stale states across socket/poll/action/refetch paths; socket reconnect triggers a one-time re-fetch.
- **Debug surface:** `/api/debug/*` requires auth, and in production is root-only (404 otherwise); `/api/debug/routes` inventory refreshed; dev `/test-email` consolidated onto shared SMTP helpers.
- **UI/flow fixes:** `useHandTransitionHold` ordered hold queue + seeded refs (no spurious holds on rejoin); `zilchCompleteRoll` dispatch gated to the acting client; LocalProfileSetup render deduplicated; RoundSummaryOverlay keyed by `handKey`; poker log/pot keys stabilized.
- **Fail-closed IOU handoff:** unverifiable `tableId` now 403s unless the table genuinely doesn't exist (offline fallback preserved).
- **Dead code removed:** unused `HoldemPanel.tsx`/`.css`, `useCardViewBustHold.ts` (+test) — −625 lines.

---

## 2026-07-08 — Game-over after settlement; card reveal timing

- **Game end:** Settled/resolved rounds no longer count in-round `currentBet` as betting exposure for `evaluateTableGameEnd` — prevents `all-players-eliminated` / `single-holder` from being blocked while resolved hands still show bet amounts. **Available: 0 alone does not end the game**; ledger ≤ 0 and betting ≤ 0 (post-settlement) are required for non-bank elimination.
- **Banking timing:** Auto/manual bank settlement waits for `cardRevealComplete` — no early `completeBankingOnState` while bank-draw cards are still revealing.
- **Reveal watchdog:** Wall-clock snap requires stuck steps first; ordered initial-deal wait loops use `scheduleNextCardReveal` instead of breaking without delay.

---

## 2026-07-06 — Blackjack reveal order, Card View hero, bank game-over regressions

- **Reveal:** Initial-deal ordered reveal follows the canonical plan from the round even when authoritative counts grow (online bank-resolve). Watchdog snap is progressive in plan order.
- **Card View:** Hero keeps viewer/settled hand visible when `activeHandKey` is null at round-complete; `selectedSeatId` participates in hero box selection.
- **Settlement:** Banking settlement is engine-immediate; game-over re-evaluated when a settled round lacks `gameStatus: ended`.

---

---

---

---

---

---

---

---

---

## 2026-07-06 — Blackjack canonical engine rule (spec)

**Changes:** Documented WHAT/WHEN/HOW separation — engine vs timing vs reveal; prohibitions on display/timing altering protocol state, turn order, activeHandKey, settlement, authority, or permanently blocking progression.

**Files:** `docs/SXM_MASTER_SPEC.md`

---

## 2026-07-06 — Remove separate bank timer; unified card timing engine

**Changes:** `getNextCardDelay()` + `scheduleNextCardReveal()` as sole timing path; bank auto-draw gated on `cardRevealComplete` (no local bank sleeps); bank timer UI removed; card deal speed 1/2/3/5/custom + random timing in settings.

**Files:** `flowSettings.ts`, `dealPacing.ts`, `cardRevealDisplay.ts`, `useSequentialCardReveal.ts`, `useBlackjackTableFlow.ts`, `BlackjackFlowSettings.tsx`, `TableStakePanel.tsx`, tests, `SXM_MASTER_SPEC.md`

---

## 2026-07-06 — Blackjack double fix + unified card deal speed

**Changes:** Fixed 2× disabled on eligible hard-11 hands during dealer-hole reveal; canonical `resolveDoubleAvailabilityForHand` with `doubleBlockReason` on UI; per-staker exposure fix for co-staked boxes; unified global card interval (default 3000ms); deprecated separate bank timer for per-card pacing; optional random deal timing.

**Files:** `validation.ts`, `blackjackActionContract.ts`, `BlackjackActionPanel.tsx`, `BlackjackPanel.tsx`, `useHandTransitionHold.ts`, `playerCommittedExposure.ts`, `flowSettings.ts`, tests, `SXM_MASTER_SPEC.md`

---


**Changes:** Single phase mapper (`dealEligibility` → `getBlackjackProtocolPhase`); offline hit/double/split use `activeHandKey` only; mobile Full Table split-host parity; reveal regression tests; co-staker split rule documented.

**Files:** `dealEligibility.ts`, `BlackjackPanel.tsx`, `bj-player-row-layout.css`, `round.ts`, test files, `SXM_MASTER_SPEC.md`

---

## 2026-07-05 — Blackjack split reveal (paced dealing)

**Problem:** After Yes/Split, nothing visible happened — no split companion cards, controls blocked, `activeHandKey` turn flow appeared broken. Engine split state was correct; paced reveal stalled.

**Root cause:** `nextSequentialRevealStep` used ordered initial-deal steps from `initialDealHandKeys` only. When original hand + dealer were already visible, a stale dealer step regressed visibility and returned early, never reaching `nextGameplayRevealStep` for the split companion hand (`boxId:1`).

**Fix:** Fall through to gameplay reveal for pending hands outside `initialDealHandKeys`; only accept reveal steps that strictly advance `totalCardCount`.

**Files:** `cardRevealDisplay.ts`, `cardRevealGameplay.test.ts`, `splitAction.test.ts`

---

## 2026-07-04 — Blackjack stabilization pass (test clusters + contracts)

**Problem:** Full test suite red across ownership gate, insurance, round reset, Card View shell, Entry Lobby, command copy, layout CSS guards, and server table actions. Default `npm test` hung on heavy rendered-layout suite.

**Fix:** Restored canonical ownership via `boxRoundCommander` in-round staker/owner fallback; aligned tests with inline player-turn command format, CSS shell ownership split (`bj-blackjack-table-shell.css`), server guest membership helper, co-box caller (first bettor) contract; excluded manual `blackjackRenderedLayout.test.tsx` from default vitest run.

**Files:** `boxRoundCommander.ts`, `boxBetResultDisplay.ts`, `vite.config.ts`, cluster test files, `server/tests/tableActions.test.ts`, `ChangeSummary.md`

---

**Problem:** Game Over **Start New Game** and **Exit Table** appeared to do nothing — leave confirm rendered behind game-over overlay (z-index 60 vs 130); DealerBlock New Game required overlay confirm first; reset permission used display name only (`canUserResetTable`) so online owners with mismatched profile names could not reset.

**Fix:** Dismiss game-over overlay before reset setup or leave prompt; DealerBlock New Game calls same `onBeginTableReset('newGame')` path as modal; `canViewerResetTable` uses `ownerPersonId`; leave dialog z-index 140.

**Files:** `BlackjackPanel.tsx`, `adminControls.ts`, `LeaveTableConfirmDialog.css`, `gameOverTableActions.test.ts`

---

## 2026-06-22 — Blackjack round transition after auto-stop (18+)

**Problem:** After all boxes auto-stood at 18+, command box showed stale player-turn prompts before New Cards; deal could appear stuck because `resolved` mapped to betting protocol phase and temporary box commanders survived settlement.

**Fix:** `getBlackjackProtocolPhase('resolved')` → `round-complete`; `clearTemporaryBoxCommandState` at settlement; `resolveBoxRoundCommander` returns null during round-complete; command builder gates player-turn text on `status === 'player-turns'` + `awaitingNextRound` early exit; co-staked boxes use `formatBoxStakeDisplayLabel` in arc slots.

**Files:** `protocol.ts`, `dealEligibility.ts`, `gameState.ts`, `resetBlackjackRoundOwnership.ts`, `boxRoundCommander.ts`, `stakes.ts`, `tableCommandDisplay.ts`, `BlackjackPanel.tsx`, `blackjackRoundTransition.test.ts`

---

## 2026-06-22 — Blackjack split, stake display, mobile spacing, next-round reset

**Split:** `splitBlackjackPlayer` / `doubleDownBlackjackPlayer` now fund from full `GameState` (not synthetic empty `boxStakes`). Split hands copy `stakerAmountsByPersonId` and `currentBet` onto both post-split hands. `canSplitUnderProtocol` drops incorrect single-staker `ledgerBalance` gate (proportional `availableChips` only).

**Stake display:** Unclaimed/far-left boxes with chips (pending online stake or post-claim open stake) use `bj-arc__slot--has-stake` so the numeric amount renders above the box (CSS previously required `--owned`).

**Mobile spacing:** Slightly larger `--bj-zone-boxes-tray-gap` and `--bj-cards-actions-gap` on mobile Full Table; Card View actions zone `overflow: visible` + primary row wrap so 2× is not clipped.

**Next round:** `createEmptyBlackjackRound` explicitly clears insurance/even-money/split residue; DealerBlock shows hint when New Cards blocked.

---

## 2026-06-22 — Blackjack dealing and overlay presentation stabilization

**Problem:** Insurance/even-money overlays rendered behind or clipped by cards; dealer hole appeared before player deal completed; Card View dealer cards clipped.

**Fix:** Canonical `bj-table-action-overlays` layer (z-index 20); initial-deal reveal defers dealer hole until all player cards visible + result-hold pause; face-down hole visible in display state; Card View dealer overflow visible.

**Files:** `bj-table-action-overlays.css`, `BlackjackTableLayoutShell.tsx`, `BlackjackPanel.tsx`, `cardRevealDisplay.ts`, `useSequentialCardReveal.ts`, `protocolState.ts`, `dealerDisplay.ts`, `bj-blackjack-table-shell.css`

---

## 2026-06-22 — Insurance / double / split per-staker funding

**Problem:** Insurance stalled after the first box when a stake owner lacked chips; double/split could appear enabled or charge the wrong payer.

**Fix:** Canonical `resolveFundableActionParticipants(hand, insurance|double|split)`; per-staker `insuranceStakerDecisions` / skip reasons; auto-skip unfunded stakers; insurance overlay queue progress; double/split gated on all stakers funding; split/double debits proportional to actual stakers.

**Files:** `handFunding.ts`, `insurance.ts`, `validation.ts`, `round.ts`, `gameState.ts`, `stakeSettlement.ts`, `InsuranceDecisionOverlay.tsx`, `BlackjackPanel.tsx`, `blackjackViewPhase.ts`, `insuranceFunding.test.ts`

---

## 2026-06-22 — Table invite login redirect

**Problem:** Email accept link (`/api/tables/invites/accept?token=…`) auto-accepted without auth; when session cookie did not stick, user landed on login/lobby and lost the invite destination.

**Fix:** Pending invite HttpOnly cookie (`sxm_pending_invite_token`, 15 min). Unauthenticated accept → login with invited email context; magic-link verify completes accept and redirects to `/?table={id}`. Authenticated matching session still accepts immediately. Magic-link request/verify support optional same-origin `returnTo`.

**Files:** `server/src/auth/pendingInviteCookie.ts`, `server/src/tables/inviteAcceptHttp.ts`, `server/src/tables/routes.ts`, `server/src/auth/routes.ts`, `server/tests/inviteLoginRedirect.test.ts`

---

## 2026-06-22 — Blackjack stabilization (Phases 1–6)

**Betting:** Strict `stakerAmountsByPersonId` invariant; no caller/native payer fallback; exposure fix; optimistic chip chain.

**Insurance/Double:** Payer-proportional funding via `handFunding.ts`; insurance Box N of M UI; no silent unfunded skip.

**UI:** `SxmModalShell` (New Table); click-target fixes; `dealBlockReason` on disabled Deal Cards.

**Tests:** stake cap, insurance, double payer, settlement regressions.

---

**Problem:** Deal debited actual stakers (Phase A) but round settlement still credited/charged box native `bankrollOwnerId`.

**Fix:**
- `stakeSettlement.ts` — `splitAmountByStakerShares`, `applyProportionalHandBoxSettlement`, `applyProportionalHandBankSettlement`
- Hand snapshot `stakerAmountsByPersonId` at deal; resolve splits win/push/loss by contributor share
- `resolveBlackjackRound`, `settleBustHandOnState`, `payNaturalWin` use proportional helpers
- Native box owner excluded from settlement unless they staked

**Tests:** `stakeSettlement.test.ts` (cross-box win/loss, co-stake 1/3–2/3 split, commander unchanged, free box reset).

**Unchanged:** deal authority, layouts, Zilch, IOU, routing.

---

## 2026-06-22 — Phase A: per-staker stake amounts and deal debits

**Problem:** Deal debited box native `bankrollOwnerId`, not the chip placer. Exposure counted full box amount per staker.

**Fix:**
- `BoxStakeEntry.stakerAmountsByPersonId` + `chipEntries[]` with `payerPersonId`
- `addChipToBoxStake` / `removeLastChipFromBoxStake` maintain per-payer amounts
- `getOpenStakeExposureForPerson` sums payer-specific amounts only
- `placeBlackjackBet` + `applyBoxStakesToRound` debit each staker via `appendBoxLedgerEntryForStaker`

**Tests:** `stakePayerAmounts.test.ts` (cross-box, co-stake, undo, second round).

**Unchanged:** deal authority, box commander, DealerBlock, layouts.

---

**Problem:** Deal Cards could show while click no-opped — split permission helpers (`canCurrentUserDealTable`, `canStartBlackjackDeal`, `getDealBlockReason`, `canStartCards`, server `assertHostDealAction`) disagreed; eligible boxes could be dropped when not in `getBettingPlayerIds` order.

**Fix:**
- `resolvePlayableBoxes(state)` — canonical box ownership (designated owner / active staker / passive); separate from deal.
- `canDealBlackjack(state, viewerPersonId)` — canonical deal authority (host + engine + eligible stakes only).
- `logDealAudit` — `[DEAL AUDIT]` on every deal click.
- Client, server, and engine reducer all call `canDealBlackjack`; first-start path uses `allowPreShuffle`.
- `getEligibleDealBoxes` includes all staked eligible boxes regardless of session player order.

**Tests:** `canDealBlackjack.test.ts`; existing `dealStartAuthority` / `blackjackRoundOwnershipReset` still pass.

**Unchanged:** `DealerBlock` button visibility wiring, layouts, Zilch, ledger, setup.

---

**Host join sync:** `POST /api/tables/join`, invite accept, and join-request approve now emit `table:update` (same channel as table actions). Root cause: guest join updated server state but host socket never received broadcast.

**Layout:** Pot, current bet, blinds, table name, and **Deal Cards** moved to compact `PokerTableHeader` metrics row; felt center reserved for community cards + showdown copy only. Symmetric oval cloth with inner gold rail + texture (`PokerFeltClothLayer`).

**Tests:** `pokerJoinSync.test.tsx`, `holdemJoinBroadcast.test.ts`, updated layout/template tests. Blackjack/Zilch untouched.

---

## 2026-06-23 — Poker route, betting flow, responsive layout stabilization

**Route:** Single path `TableScreen → PokerPanel → PokerTableShell → PokerTableLayout`; dev guard `pokerRouteGuard.ts`. Legacy `HoldemPanel` not routed (file remains unused).

**Betting UI:** Separate Fold/Check/Call/Bet/Raise/All In buttons; never "Stay". Preflop facing blind hides Check/Bet. Practice virtual auto-advance via `processVirtualHoldemTurns` effect. Host proxy uses `canPersonControlHoldemSeat` + `actorSeatId`.

**Layout:** Responsive CSS grid — `clamp()` felt height, `overflow: visible` on table, sticky action bar with safe-area, portrait/landscape media queries.

**Tests:** `pokerBettingFlow.test.tsx`, `pokerResponsiveLayout.test.tsx`, expanded route tests.

---

## 2026-06-23 — Poker High Roller visual template + start flow

**Reference:** `reference-ui/Poker/stitch_professional_casino_poker_redesign` (DESIGN.md + screen.png — High Roller Protocol).

**Visual (`src/games/poker/`)**
- `pokerTemplateContract.ts` — template class contract tied to reference path
- `poker-hr-*` shell: dark premium felt, oval table, seat avatars, centered pot/community, casino action bar below
- Sharp gold/red bordered buttons; chip amount presets; **Deal Cards** on felt
- Waiting-for-guest copy in top bar only (not center); no permanent chat rail

**Start flow (unchanged engine fix)**
- Single click: shuffle if needed → post SB/BB → deal hole cards → preflop
- Practice default: host + 1 virtual, both funded, Deal enabled immediately

**Tests:** `pokerTemplate.test.tsx`; updated poker UI tests. BJ/Zilch untouched.

---

## 2026-06-23 — Poker start flow + This Table panel

**Root cause:** `start-hand` required two engine calls (create round → deal); UI dispatched once, leaving table in `setup` with no blinds/cards.

**Engine**
- `applyHoldemActionToState` — atomic start: validate seats/chips → create round → `startHoldemHandOnState` → preflop in one call
- `holdemStartValidation.ts` — block start when &lt;2 playable seats or zero-chip seat

**UI (`src/games/poker/`)**
- Removed permanent felt-side chat rail; **This Table** opens `PokerTablePanel` (stacks, invite, blinds, add chips, chat, action log, leave/reset)
- `PokerFeltClothLayer` — arc table name + blinds on cloth (Blackjack-style)
- Community board hides generic "Setup" label; street text only during active hand
- Practice default: host + 1 virtual; challenge add-chips disabled with fixed-stack copy

**Tests:** `holdemStartHand.test.ts`, updated server/UI poker tests; Blackjack/Zilch untouched.

---

## 2026-06-23 — Poker live UI route fix (critical)

Live browser QA showed tall pre-hand header (Shuffle/Start/Invite), duplicate blinds, and Zilch/Blackjack-like shell — **root cause:** `isHoldemTable()` returned false when `tableGame` was still `blackjack` after online `createTable` + holdem `configureTable`, so **BlackjackPanel** rendered instead of **PokerPanel**.

**Routing**
- `isHoldemTable` now wins on `cardGame === 'holdem'` / `pokerConfig` before blackjack rejection.
- `isBlackjackTable` excludes holdem identity.
- `TableScreen` exclusive route: holdem → `PokerPanel` first; `table-felt--poker` wrapper.
- `normalizeLoadedGameState` prunes bank/box for holdem challenges on load.

**UI**
- Removed felt shuffle button (shuffle in This Table menu only); start hand on felt.
- `poker-table.css` imported from `PokerPanel` for guaranteed load.

**Setup**
- Removed Total Challenge Value field; optional numeric parse from Play for what.
- Holdem challenge invite message per guest (Blackjack parity).
- Scroll/sticky footer for holdem challenge modal.

**Settlement**
- Non-numeric wagers allowed; cash IOUs gated when no parseable amount.

**Tests:** `pokerLiveRoute.test.tsx`, `zilchTableKind.test.ts`, ownership guard.

---

## 2026-06-23 — Poker UI integration fix pass

Live QA found Poker inheriting a tall Zilch-like header, triple blind display, oversized invite/start controls, setup form overflow, 4-player challenge roster (bank/box), and duplicate chat wiring.

**UI**
- Compact `poker-table-shell__topbar` with status + **This Table** menu (`PokerTableMenu`).
- Table name + single blinds line on felt (`poker-felt__header`); start hand on felt center.
- Invite, edit blinds, shuffle, start hand, end challenge, leave — in menu (not large header buttons).
- Hold'em setup form scrolls (`table-stake-panel__body--scroll`); tighter challenge field spacing.

**Gameplay/setup**
- `holdemPlayableSeats` — challenge excludes bank/box/virtual; practice allows virtuals only.
- `allocateStartingStacks` funds all playable seats once (skip if ledger balance already set).

**Chat**
- `useTableChat` shared hook; `PokerChatDock` / `TableChatDock` use same `tableChatService`.

**Tests:** `pokerUiLayout.test.tsx`, `holdemTableSetup.players.test.ts`, updated `PokerPanel` / stabilization tests.

**Manual QA still required:** mobile felt layout, real 2-browser challenge invite flow, setup scroll on phone.

Blackjack / Zilch gameplay, layout, and CSS **not modified** (shared `TableChatDock` hook refactor + generic setup scroll shell only).

---

## 2026-06-23 — Poker beta hardening pass

- **Heads-up blinds:** dealer/button = SB, other = BB; preflop actor = SB; postflop = BB (`helpers.ts` + tests).
- **Server IOU dedup:** poker challenge nonce includes table + hand + parties + amount; idempotent retry; practice blocked server-side.
- **Challenge join policy:** new players blocked after participant snapshot (`holdemChallengeJoin.ts` + server join guard).
- **Layout QA:** `pokerStabilization.test.tsx` shell render contract (6-seat, actions + chat + pot lines).
- **Docs:** audit + spec updated; remaining risks narrowed.

## 2026-06-23 — Poker final stabilization audit (Phases A–D2)

- **Audit:** `docs/POKER_FINAL_STABILIZATION_AUDIT.md` — PASS WITH RISKS.
- **Fix:** challenge participant snapshot deferred to first hand (not table setup).
- **Fix:** `validatePokerBlinds` at holdem setup + `TableStakePanel` confirm.
- **Fix:** game-over overlay shows blocking reason when IOU settlement fails.
- **Fix:** ALL IN / WIN badge CSS.
- **Tests:** `holdemTableSetup.test.ts`, `pokerStabilization.test.tsx`.

## 2026-06-23 — Poker Phase D2: challenge participant accounting and IOU safety

- **`challengeParticipants.ts`** — canonical participant helper; excludes bank/box/virtual practice seats.
- **`pokerConfig.challengeParticipants`** — frozen snapshot at challenge setup / first hand start.
- **Settlement** — `validatePokerChallengeSettlement`; IOU count and stake use `participantCount` only.
- **UI** — game-over overlay shows participants, stake per participant, missing-email blockers.

## 2026-06-23 — Poker Phase D1: authoritative challenge winner

- **`challengeWinner.ts`** — elimination helpers, automatic last-player-standing winner, host early-end chip leader (tie blocked).
- **`pokerConfig`** — `challengeStatus`, `challengeWinnerSeatId`, `challengeEndReason`, `challengeEndedAt`.
- **Auto end** after hand payout via `maybeAutoEndHoldemChallenge` in `applyHoldemUpdate`.
- **Server action** `endHoldemChallenge` (host-only, no active hand).
- **UI:** End Challenge button; game-over overlay uses authoritative winner; IOUs blocked without winner.
- **IOU math unchanged** — winner source only.

## 2026-06-23 — Poker Phase C2: side-pot payout and uncalled bet return

- **`uncalledBetReturn.ts`** — returns unmatched excess to sole remaining player before payout.
- **`sidePotPayout.ts`** — per-pot winner selection, tie splits, remainder by seat order.
- **`showdownPayout.ts`** — side-pot-aware ledger payout replaces single-pot split.
- **UI:** payout summary + winning hand in pot area; WIN seat badge.
- **Challenge/IOU:** unchanged — settlement still based on challenge result, not chip stack.

## 2026-06-23 — Poker Phase C1: all-in and side-pot foundations

- **`holdemAllIn` TABLE_ACTION** + canonical `{ type: 'all-in' }` — commits full stack, marks seat `all-in`, advances action.
- **`buildHoldemSidePots`** — deterministic side-pot construction from `playerTotalCommitted`; stored on `holdem.sidePots`.
- **Betting completion** — all-in players skipped in turn order; auto runout when all remaining players are all-in.
- **UI:** All In button (online + offline), seat all-in badge, side-pot count label when >1 pot.
- **Deferred:** per-side-pot showdown payout; challenge settlement unchanged.

## 2026-06-23 — Poker Phase B completion: server-authoritative blind edits

- **`updateHoldemBlinds` TABLE_ACTION:** host-only; blocked mid-hand; validates `smallBlind`/`bigBlind` server-side.
- **Reducer:** `updatePokerBlindsOnState` updates `tableMeta.pokerConfig` + `holdemSettings` mirror; persist + broadcast on success.
- **PokerPanel:** online dispatches `updateHoldemBlinds` (no local mutation); offline keeps `updatePokerBlindsOnState`.
- **Tests:** `holdemTableActions.test.ts`, `holdemTurnAuthority.test.ts`, `PokerPanel.test.tsx` blind edit coverage.

## 2026-06-24 — Poker Phase B: server-authoritative Hold'em actions

- **TABLE_ACTIONS:** `startHoldemHand`, `holdemFold`, `holdemCheck`, `holdemCall`, `holdemBet`, `holdemRaise`, `holdemShuffleDeck`.
- **Server:** `applyHoldemTableActionToState`, `holdemTurnAuthority.ts`, authority + applyAction wiring.
- **Client:** `PokerPanel` online → `onlineDispatch`; offline → local wrapper unchanged.
- **Deferred:** all-in, side pots, showdown rewrite, challenge winner authority.

## 2026-06-23 — Poker Phase A completion: PokerPanel wired to canonical wrapper

- **PokerPanel:** All offline gameplay (start-hand, fold, check, call, bet, raise) routes through `pokerHoldemDispatch` → `applyHoldemActionToState()`.
- **Errors:** Failed actions do not mutate state; all-in surfaces “Action unavailable: all-in is not implemented yet.”
- **Tests:** `PokerPanel.test.tsx`, `pokerHoldemDispatch.test.ts`.
- **Deferred:** Server `TABLE_ACTIONS` (Phase B); all-in / side pots / showdown (Phase C).

## 2026-06-23 — Poker Phase A: canonical Hold'em state foundations

- **Shared types:** `PokerTableConfig` moved to `src/types/poker.ts`; engine/setup import shared types (no `src/games/poker` in engine).
- **Canonical holdem types:** `holdemState.ts`, `holdemActions.ts` — target phase/player/hand shapes (legacy `HoldemRound` still runtime).
- **Strangler wrapper:** `applyHoldemActionToState()` delegates to existing `*OnState` helpers; returns `{ ok, state, error? }`.
- **Selectors:** `holdemSelectors.ts` — dealer/SB/BB/acting/phase/blind-edit priority documented; `mapPokerTableViewModel` uses selectors.
- **Tests:** `holdemSelectors.test.ts`, `applyHoldemActionToState.test.ts`.
- **Deferred:** Server `TABLE_ACTIONS` (Phase B); PokerPanel still calls legacy `*OnState` directly.

## 2026-06-23 — Texas Hold'em Phase 1 pre-flight audit (docs only)

- **Inventory:** `docs/POKER_ENGINE_INVENTORY.md` — existing holdem files, reducers, actions, state models, betting/dealer/blind/winner logic, multiplayer sync; each item tagged SAFE TO REUSE / REPLACE / UNKNOWN.
- **State machine plan:** `docs/POKER_STATE_MACHINE_PLAN.md` — state ownership diagram, multiplayer authority audit, canonical type proposals (`HoldemPhase`, `HoldemHandState`, `SidePotState`, `DealerRotationState`), migration phases A–D, compatibility with `PokerTableShell` / mapper / chat / IOU.
- **No code changes** — preparation only; holdem engine not implemented.

## 2026-06-23 — Poker architecture audit + corrective patches

- **Audit:** `docs/POKER_ARCHITECTURE_AUDIT.md` — isolation, state authority, risks before real engine.
- **Fixes:** Removed mock view-model fallback; game-over overlay only on challenge end; blind validation in engine; block new game after IOU error.
- **Tests:** Global chat hidden on poker tables; blind validation; no mock seat injection.

## 2026-06-23 — Poker wired into table flow (Texas Hold'em)

- **New Table setup:** Cards category → card-game step (Blackjack / Poker Texas Hold'em) → Practice or Challenge.
- **Poker challenge:** wager label, total challenge value, invites, starting stack, small/big blind; winner-takes-all IOU handoff per loser.
- **Production route:** `TableScreen` renders isolated `PokerPanel` + `PokerTableShell` (legacy `HoldemPanel` no longer routed).
- **Engine setup:** `holdemTableSetup.ts`, `createNewHoldemTable()`, `tableMeta.pokerConfig`, online `configureTable`/`resetTable` branches.
- **Table UX:** owner blind edit before hand, dealer/SB/BB badges, embedded table chat, challenge game-over IOU overlay.
- **Unchanged:** Blackjack and Zilch layout/gameplay paths.

## 2026-06-23 — Poker table UI scaffold (`src/games/poker/`)

- **New module:** Casino-style Hold'em table shell — elliptical felt, seat ring, community board, pot area, action panel, chat dock.
- **State:** `pokerTypes.ts` view models + `pokerMockState.ts` for offline preview; not yet mapped from `GameState` / `HoldemPanel`.
- **Production route unchanged:** `TableScreen` still renders legacy `HoldemPanel`.

## 2026-06-22 — Per-round box commander (stake-based decisions)

- **`resolveBoxRoundCommander`** — designated owner commands only when they stake; otherwise first staker commands for the round.
- Wired through `getCallerPersonIdForBox`, `syncCallersForDeal`, insurance, action permission, command text, This Table Running/Co-boxes.
- Tests: `boxRoundCommander.test.ts`; updated ownership suites.

## 2026-06-22 — New Table modal layout + desktop player boxes scroll guard

- **New Table modal:** Body-only vertical scroll; fixed header/close; sticky Back/Start Table footer; full-width embedded form; no horizontal overflow (`NewTableOverlay.css`, `TableStakePanel.css`, `mobile-modals.css`).
- **Desktop boxes:** Contain player-box row inside shell zone — felt/shell overflow hidden; boxes-zone tile scale clamp (`bj-blackjack-targeted-fixes.css`, `bj-player-row-layout.css`).
- **Tests:** `newTableModalLayout.test.tsx`.

## 2026-06-22 — Blackjack 2× action row + mobile Card View play swipe

- **2× placement:** Primary action row is Stay / Hit / 2× (`BlackjackActionPanel`); Split remains secondary.
- **Card View variant fix:** `BlackjackPanel` no longer forces `variant="table"` on mobile Card View action row.
- **Play swipe:** `useMobileCardViewPlaySwipe` — mobile Card View swipe left = Stay, right = Hit; disabled during overlays/insurance/even-money/game-over; never triggers double.
- **Tests:** `blackjackDoubleAndSwipe.test.ts`, `useMobileCardViewPlaySwipe.test.ts`.

## 2026-06-22 — Canonical game-over modal (single overlay all views)

- **`blackjackGameOverContract.ts`** — one `GameOverActionOverlay` centered modal for all four modes.
- Removed duplicate desktop paths: side-rail inline game over + `bj-game-over-table-overlay` hero.
- Side rail suppressed while game-over modal is active; buttons use existing `completeGameOverAction` handlers.

## 2026-06-22 — Blackjack layout/playflow frozen

Blackjack cards layout and reveal/play flow frozen after `card-placement-v1` and UI-render-contract stabilization. See `.cursorrules` §7a.

## 2026-06-22 — Card placement contract lock (per-mode cards zone)

Structural layout lock — no gameplay/reveal/command changes:

- **`blackjackCardPlacementContract.ts`** — per-mode placement inside the cards zone:
  `desktopFull`/`mobileFull` = box-column anchored just above box value;
  `desktopCard`/`mobileCard` = centered hero.
- **Removed `overflow:hidden` clipping workaround** on Full Table cards zones — replaced with
  `overflow-x: clip; overflow-y: visible` so stack tops are not clipped; stacks sized/overlapped to fit.
- **Desktop Full Table:** `align-self:flex-end` replaces `margin-top:auto` on card area; taller stack zone formula.
- **Mobile Full Table:** cards zone `justify-content:flex-end`; compact mobile card scale tokens.
- **Desktop Card View:** hero min-heights restored (`min(5.5rem,…)`); fan `overflow:visible`; card height no longer collapses to 0%.
- **Cards zone** exposes `data-card-placement` + `data-placement-overflow` for debug/tests.
- **Tests:** `blackjackCardPlacementContract.test.ts`.

## 2026-06-22 — Blackjack UI stabilization: reveal gating + layout overlap fixes

Structural stabilization pass (no new features):

- **`blackjackUiRenderContract.ts`** — authoritative UI render contract: `isHandVisiblyRevealed`,
  `isBoxVisiblyRevealed`, `resolveGatedCardAreaOutcomeMarker`, `gateCommandForReveal`,
  `canShowEvenMoneyDecisionUi` / `canShowInsuranceDecisionUi`. Game state may know outcomes before UI may show them.
- **Reveal sequencing fix:** command text, blackjack/bust/win badges, and even-money/insurance overlays
  gated on paced reveal (`useSequentialCardReveal` display state). Protocol phase defers even-money until
  offer hand is fully visible.
- **Canonical command box:** yellow/gold text in command zone via `bj-table-shared.css`; single path
  `BlackjackCommandBox` → `DealerCommandArea` with `CANONICAL_COMMAND_STATUS_CLASS`.
- **Layout overlap fixes:** desktop/mobile Full Table cards zone `overflow:hidden`; mobile play-zone
  bottom-pinned (`justify-content:flex-end`); removed mobile `margin-top:auto` arc push.
- **Mobile even-money/insurance:** 44px min tap targets on ace-decision + insurance overlay buttons.
- **`?layoutDebug=1`:** reveal complete, UI protocol phase, command source, per-box game vs UI result,
  cards zone overflow, card stack bounds, overlap warnings (cards vs command/boxes/tray).
- **Tests:** `blackjackUiRenderContract.test.ts` + extended `productionRouteOwnership.test.ts`.

## 2026-06-22 — Table Layout Engine v1.1.1: desktop cards zone regression fix

Follow-up to v1.1 layout pass (desktop only, no gameplay changes):

- **Root cause:** v1.1 removed `felt-main` `height:100%`, zeroed Card View `--bj-zone-cards-min-height`, and set
  Full Table cards zone to `justify-content:flex-start` + shell `padding-bottom` lift. That collapsed the `cards`
  `1fr` row and/or mis-pinned the Full Table arc — stacks rendered as tall columns over box values; Card View hero
  sized to 0-height parent (`height:100%` of collapsed zone).
- **Full Table fix:** restore cards-zone `justify-content:flex-end` (bottom-pin arc); move lift to
  `margin-bottom` on `.bj-full-table-card-area` (content-only); restore `felt-main height:100%` for definite
  `1fr` sizing; stop growing absolute cloth layer in flex flow (`flex:0`).
- **Card View fix:** responsive cards-row floor `min(6.5rem, 20%)` (absorbed by 1fr, no scroll); shell stretches
  `.bj-card-desktop-hero` to fill cards row; hero `overflow:visible` + `min-height:min(5.5rem,100%)` on cards band.
- **v1.1 preserved:** command box parity (both desktop roots), dealer band 6.7rem, shell bounding (`overflow-y:hidden`).
- **Tests:** 3 new regression tests in `productionRouteOwnership.test.ts` (hero visibility, stack overlap, stacks in cards zone).

## 2026-06-22 — Table Layout Engine v1.1: desktop scroll / command / dealer fixes

Follow-up placement + ownership fixes on top of the v1 consolidation (layout only — no gameplay,
betting, ledger, auth, Zilch, or routing changes):

- **Desktop Card View vertical scroll removed (structural).** The shell grid now owns its own
  bounding (`height:100%; min-height:0; max-height:100%; overflow-y:hidden`) so the single stretch
  row (`cards` `1fr`) absorbs slack and the fixed rows can never force a page/table scroll. Removed
  the rigid `--bj-zone-cards-min-height: 9rem` Card View floor that was pushing fixed-rows + floor
  past the shell height; Card View now uses `0` (hero scales to the leftover via its container query).
- **Command box consolidated to one path for both desktop modes.** `BlackjackCommandBox →
  DealerCommandArea` is the only command component (DealerBlock's inline command stays disabled via
  `omitCommand`). The previously Full-Table-only command CSS (status `overflow:visible`, playing-phase
  compaction) now applies to **both** `.bj-view-full-desktop` and `.bj-view-card-desktop`, so the
  command box renders identically across desktop views.
- **Desktop Full Table cards lifted slightly.** Added `padding-bottom`
  (`--bj-full-desktop-cards-lift`) to the Full Table cards zone so each stack sits just above its box
  value — inside the cards zone only (no movers/transforms on actions/boxes/tray).
- **Desktop Card View dealer no longer clipped.** Card View dealer band raised `6.05rem → 6.7rem`
  so the dealer stack (cards + bank label + action) fits without cropping; absorbed by the `cards`
  `1fr` row, so the box/tray baseline is unchanged. Dealer remains owned by the shell dealer zone
  (no Card View dealer engine).
- **Baseline parity.** Boxes/tray heights, gaps and bottom padding are identical across both desktop
  modes and the `cards` row absorbs all dealer/command/actions differences, so box + tray baselines
  stay put when toggling Full Table ↔ Card View.
- **Ownership cleanup.** Removed competing shell geometry (`display/flex-direction/height/overflow`)
  from `bj-table-shared.css`'s desktop `.bj-casino__felt-main` rule — the shell file is now the only
  owner of shell display/height/overflow.
- **Tests added** (`productionRouteOwnership.test.ts`): single command route, desktopFull/desktopCard
  shared command owner + formatting, Card View no fixed-row scroll, dealer zone not re-owned by Card
  View CSS, player-row does not move boxes/tray. Re-baselined the stale `playerRowLayout` mobile
  boxes/tray assertion to the consolidated shell owner.

## 2026-06-21 — Table Layout Engine: one shell owner for all four Blackjack views

- **Canonical engine contract** (`src/components/tableLayoutEngine.ts`): neutral, gameplay-free
  description of the seven zones (`bankInfo → dealer → command → cards → actions → boxes → tray`)
  and the four modes (`desktopFull`, `desktopCard`, `mobileFull`, `mobileCard`). Same zone names,
  same order, phase-invariant; `cards` is the single stretch row; boxes baseline sits directly
  above the tray in every mode. Includes the CSS ownership map.
- **Single grid engine** (`bj-blackjack-table-shell.css`): mobile (portrait) now uses the SAME
  CSS-grid engine as desktop (added mobile grid block). The legacy bare-flex shell + per-zone
  height/`margin-top` overrides previously in `bj-player-row-layout.css` and
  `bj-full-table-card-area.css` were removed so there is ONE shell-geometry owner.
- **Bug fixes via contract (not patches):** desktop Card View hero cards get a non-collapsing
  `cards` row floor (`--bj-zone-cards-min-height`); desktop Full Table card tops read (cards zone
  `overflow: visible`, shell still clips horizontally); mobile Table boxes/tray share the Card View
  baseline (shell owns mobile boxes/tray placement, no zone movers).
- **CSS ownership headers** added to every layout stylesheet (MAY OWN / MUST NOT own), plus leaky
  bare `.bj-cards-area--table` selectors scoped under view roots.
- **Debug overlay** (`?layoutDebug=1`, hidden by default): now reports engine version, resolved
  mode, active phase, per-zone bounding boxes, rendered component per zone, and CSS owner per zone.
- **Tests:** `tableLayoutEngine.test.ts` (contract invariants), `tableLayoutEngineShell.test.tsx`
  (zone-order smoke), and extended `productionRouteOwnership.test.ts` (single shell owner + CSS
  ownership map). Re-baselined frozen-layout assertions to the consolidated engine.
- **Scope:** layout architecture only — no gameplay, payout, betting, invite/auth, people, ledger,
  IOU, Zilch, or table-setup changes.

## 2026-06-13 — Targeted Blackjack mobile/desktop layout cleanup (6 issues)

- **Mobile Full Table cards:** Cards zone uses natural height (`flex: 0 0 auto`) with arc row `margin-top: auto` so stacks sit just above actions; play-zone stays top-anchored on mobile.
- **Mobile actions:** HIT/STAY reduced ~15% (2.34rem / 0.78rem); actions zone `z-index: 6` above cards; felt `touch-action: pan-x pan-y` restores horizontal box swipe.
- **Desktop Full Table stacks:** Play-zone bottom-anchors (`align-self: end` / `flex-end`) so lower card values stay visible inside cards zone.
- **Command route:** Player-turn copy merged into one `BlackjackCommandBox` paragraph; dealer block no longer receives command props; game-over command suppressed when overlay is active (`evaluateTableGameEnd` / `GameOverActionOverlay` remain canonical).
- **Tests:** Added `blackjackMobileCleanup.test.tsx`; updated layout/command contract tests.

---

- **`.cursorrules`:** Expanded SXM Architecture Discipline — canonical routes, CSS ownership, layer model, test tiers, no parallel implementations.
- **Docs:** Added `docs/SXM_ARCHITECTURE.md`; pointers in `README.md` and `docs/TEST_WORKFLOW.md`.
- **Tests:** Added `productionRouteOwnership.test.ts` + `npm run test:ownership`; merged into `test:layout:audit` / `test:layout:fast`.
- **Cleanup:** Removed superseded `blackjackRenderRouteAudit.test.ts`; removed unused `BlackjackDealerAreaSection` export.

---

## 2026-06-13 — Blackjack render route audit (canonical shell + CSS cascade)

- **Wiring:** Confirmed single production path `BlackjackPanel → BlackjackTableLayoutShell`; desktop grid rows live only in `bj-blackjack-table-shell.css` (removed stale shared-grid test assumptions).
- **CSS cascade:** Documented `CANONICAL_BLACKJACK_CSS_IMPORT_ORDER`; moved `sxm-stitch-visual.css` before table layout imports (theme tokens only, not layout geometry).
- **Visual contract fixes:** Compact desktop command row (4.35rem default); mobile play command row 2.85rem (was 6.375rem); Full Table card stacks top-anchored (clip bottom); cloth SVG min-size during play; command text omits bank totals until visible dealer cards justify them.
- **Debug:** `?layoutDebug=1` panel reports layout version, shell name, view mode, phase, CSS route, and zone order.
- **Tests:** `blackjackRenderRouteAudit.test.ts`; extended layout debug, command, and play-zone layout guards.

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

## 2026-07-08 — Co-staked double visibility, mobile actions clearance, IOU handoff contract

- **Double (multiplayer):** Separated rule eligibility from funding in `resolveDoubleAvailabilityForHand`; `showDouble` follows `isDoubleOfferedForHand` so 2× stays visible (disabled + block reason) when co-staked funding blocks; command copy surfaces funding reason.
- **Mobile Full Table:** `--bj-full-mobile-actions-clearance: 10px` lifts actions zone above player boxes (Full Table mobile only).
- **IOU handoff:** `payloadVersion: 1`; personal IOUs send `amountCents: 0` + `currency: 'USD'` contract markers; expanded safe remote diagnostics (`hasIv`, `hasAuthTag`, `payloadVersion`, etc.); `validateIouCreatePayloadContract` + pre-send validation.

---

## 2026-07-06 — IOU handoff rejection diagnostics + game-over continue path

- **Server:** Safe `[SXM][iou-handoff] remote attempt/rejected` logs (source, host, payload shape, HTTP status, nonce prefix); surfaces IOU `message`/`error` fields in API response instead of generic rejection when available.
- **Game-over UX:** IOU failure keeps overlay open with error; **Continue without IOU** + uncheck path; buttons re-enable after pending clears.

---

## 2026-07-04 — IOU handoff env canonicalization

- **Config:** IOU handoff uses only `IOU_HANDOFF_SOURCE`, `IOU_HANDOFF_SECRET`, `IOU_HANDOFF_CREATE_URL`; legacy `SXM_HANDOFF_*` ignored with startup/rename hint.
- **Route:** `/api/iou-handoff/create` returns specific 503 when secret or create URL missing.
- **Path:** Browser → SXM server encrypt → POST IOU Wallet integration URL only (no client secrets, no VITE handoff vars).

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

## 2026-06-23 — Poker 0 canonical layout

**Reference:** `reference-ui/Poker/Poker 0/Poker0Cannonical_Layout.png` (sole Poker visual spec). Deprecated stitch High Roller layout.

**Layout:** Poker 0 header (identity + POT | BLINDS | Deal | This Table), 7x7 grid felt with embossed table name, FLOP/TURN/RIVER community rows, grid seat ring (2/4/6/9), action bar order (buttons → chips → amount), mobile bottom-sheet This Table panel.

**Docs:** `docs/POKER0_CANONICAL_LAYOUT.md`. Snapshot: `dist/poker0-captures/poker0-layout-desktop.html`.

Blackjack/Zilch untouched.

