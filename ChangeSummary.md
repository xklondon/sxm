# Change Summary — Repo audit (double routes / ungated routines / visual sequencing)

1. **Files changed:** None. Read-only audit; findings report delivered in chat. No code, spec, or env files touched.
2. **Tests added/updated:** None.
3. **Validation run:** All tiers skipped — no code changed (Ownership: skipped; Layout: skipped; Blackjack layout: skipped; People/invites: skipped; Build: skipped).
4. **Architecture impact:** None yet. Report flags 3 high-severity server gaps (ungated `table:subscribe` + full-state broadcasts leaking hole cards/deck, display-name-based `assignChips` authority, `/api/tables/active` listing all tables to any user), plus medium findings (no client version guard on `table:update`, unauthenticated `/api/debug`, negative `placeBet` amounts, zilch display-name turn fallback, single-slot `useHandTransitionHold`). Two findings conflict with the blackjack freeze (`cardRevealDisplay.ts` reveal order, Card View `slice(0,4)` results cap) and are flagged, not proposed, pending explicit unfreeze.
5. **Deploy readiness:** Unchanged from before audit; the high-severity information-leak/authority findings should be fixed before any wider deployment.

Spec discipline: checked SXM_MASTER_SPEC.md and CHANGE_LOG.md — no updates made (audit only, no behaviour changed).

---

# Punch-list execution log

## Item 1 — socket `table:subscribe` membership gate + `/api/tables/active` PII scope
- Files: `server/src/app.ts` (subscribe now resolves membership via `tables.getTableForUser` before joining the room; denial emits `table:subscribe:denied`), `server/src/tables/service.ts` (`listActiveTables` strips `hostEmail` and `players` emails for `request`/`pending` rows — Knock flow keeps table visibility per `joinRequests.test.ts` intent).
- Tests: new `server/tests/socketSubscribe.test.ts` (member receives updates, stranger denied); extended `server/tests/joinRequests.test.ts` PII assertions. Ran socketSubscribe + joinRequests + activeTables + multiplayer + multiplayerOwnership — all pass.
- Validation tier: multiplayer/table targeted tests + `npm run build` (pass).

## Item 2 — per-viewer state redaction at the transport boundary
- Files: new `server/src/tables/redactState.ts` (mirrors `getVisibleDealerCardIds` reveal rule incl. `showDealerHoleCardDuringPlay` protocols, `mapPokerTableViewModel` face-up rule via `canPersonControlHoldemSeat`; deck `drawOrder` replaced with sequential dummy, hidden ids swapped for decoy real-card ids so client `getCardById`/keys/counts stay stable); `server/src/tables/broadcast.ts` (per-socket redacted emit with person resolver); `server/src/tables/service.ts` (`getMemberPersonId` pure lookup; `applyAction` returns `personId`); `server/src/tables/routes.ts` (redacted GET /:tableId, POST /join, POST /actions responses + resolver at 3 broadcast sites); `server/src/tables/inviteAcceptHttp.ts` (resolver).
- Tests: new `server/tests/stateRedaction.test.ts` (7 cases: hole hidden/revealed/open-hole protocol, shoe masking, holdem own-vs-opponent, showdown reveal, null viewer). Ran with socketSubscribe, tableActions, multiplayer, holdemTableActions, tableReset — 61 tests pass.
- Validation tier: multiplayer/table targeted tests + `npm run build` (pass).
## Item 3 — assignChips personId authority
- Files: `server/src/tables/authority.ts` (name-based `canUserAssignChips` replaced with `assertTableHost(ctx.personId)` gated by `tableAdminSettings.ownerOnlyCanAssignChips` — same pattern as configureTable/resetTable).
- Tests: new spoof-regression in `server/tests/multiplayerOwnership.test.ts` (member with display name "Host" rejected); existing host assignChips test still passes. 24 tests pass (multiplayerOwnership + tableActions).
- Validation tier: multiplayer targeted tests + build (deferred to item 4 commit; server-only logic change, no client build impact).

## Item 4 — client monotonic version guard
- Files: `src/hooks/useOnlineMultiplayer.ts` (single `applyServerState` guard — `version <= versionRef.current` dropped — used by socket `onTableUpdate`, `pollTable`, HTTP action response, and stale-refetch; socket handler also drops payloads for a different tableId), `src/hooks/onlineSocket.ts` (payload type includes `tableId`, matching what the server emits).
- Tests: new `src/hooks/useOnlineMultiplayer.versionGuard.test.tsx` (4 cases: stale broadcast dropped, own-broadcast double-apply dedup, foreign-table payload ignored, newer-after-older applied); onlineSocket + App.staleTable/infraStability/membership all pass.
- Validation tier: multiplayer targeted tests + `npm run build` (pass).

## Item 5 — zilch display-name fallback removed from server path
- Files: `src/engine/dice/zilch/zilchTurnAuthority.ts` (case-insensitive label-match branch deleted from `canPersonControlZilchPlayer`, which backs the server's `assertZilchPlayerTurn`; the explicit offline name-only helper `canControllerActOnZilchTurn` is untouched, as is the host-drives-any-turn branch pinned by existing tests).
- Tests: new spoof regression in `zilchTurnAuthority.test.ts` (two guests with identical display names — no cross-control). All 82 zilch engine/UI tests pass.
- Validation tier: zilch targeted tests + `npm run build` (pass).
- Note: the `playable.length <= 1 → allow` shortcut was kept — it is load-bearing for offline/local solo tables where no viewer person id exists; server exposure is a seated member driving the only playable seat (low harm, host-equivalent).

## Item 6 — positive-amount validation on placeBet
- Files: `server/src/tables/authority.ts` (placeBet rejects non-finite/zero/negative amounts — identical pattern to holdemBet/holdemRaise in the same switch).
- Tests: new negative/zero-amount regression in `multiplayerOwnership.test.ts`; 34 tests pass (multiplayerOwnership + tableActions + multiplayer).
- Validation tier: multiplayer targeted tests (pass); server-only change, build covered at next commit.

## Item 7 — /api/debug gated
- Files: `server/src/app.ts` (debug router now requires an authenticated session; in production additionally root-only via `isRootEmail`, non-root gets 404 to hide existence; public health checks unaffected at `/health` + `/api/health`); `RAILWAY_DEPLOY.md` (curl examples updated with root session cookie).
- Tests: `debugRoutes.test.ts` (401 unauthenticated + authed happy paths), `emailDebug.test.ts` (root session on all debug calls; new 404-for-non-root and 401-unauthenticated cases). 19 tests pass (debugRoutes + emailDebug + staticAssets).
- Validation tier: server targeted tests (pass); build at next commit.

## Item 8 — zilchCompleteRoll gated to the acting client
- Files: `src/components/useZilchTableFlow.ts` (roll-completion effect early-returns online when `canRunZilchRevealTimer` is false — same gate the reveal timer already used; offline local completion unchanged).
- Tests: 3 new cases in `useZilchTableFlow.test.ts` (acting client dispatches, non-acting never dispatches, offline unaffected). 9 tests pass (flow + turn-advance UI).
- Validation tier: zilch targeted tests + `npm run build` (pass).

## Item 9 — useHandTransitionHold ordered queue + seeded baseline
- Files: `src/components/useHandTransitionHold.ts` (single `pendingHoldHandKey` slot → FIFO array deduped on enqueue, drained one hold at a time in canonical `orderedHandKeys` felt order; first observation of a round now seeds `prevStatusRef`/card counts and returns, so rejoining mid-round no longer replays a hold for an already-busted hand).
- Tests: `blackjackUxFixes` + `optionalPlayDealPacing` (21 pass) and `npm run test:layout:fast` (31 pass, freeze-adjacent guard tier).
- Validation tier: blackjack targeted tests + layout fast tier + `npm run build` (pass).

## Item 10 — LocalProfileSetup single owner on blackjack tables
- Files: `src/App.tsx` (App's copy no longer renders when the table screen routes to BlackjackPanel — the panel owns the dialog there), `src/components/BlackjackPanel.tsx` (panel copy gains `lockedEmail` in online mode so behaviour matches the removed App copy; its richer `onSaved` play-flow sync is preserved). Zilch/hold'em/non-table screens keep the App copy (only BlackjackPanel receives `profileOpen`).
- Tests: App.render/membership/infraStability + productionRouteOwnership + blackjackEngineFreezeGuards — 40 pass.
- Validation tier: ownership + App targeted tests + `npm run build` (pass).

## Item 11 — RoundSummaryOverlay keyed by handKey
- Files: `src/engine/blackjack/roundSummaryOverlay.ts` (entry model gains `handKey` — additive display-model field, no rules change), `src/components/RoundSummaryOverlay.tsx` (list key `boxLabel-playerName` → `handKey`; split children previously produced duplicate keys).
- Tests: blackjackUiResultState + blackjackFiveIssueFixes + challengeGameEndPresentation — 38 pass. (`blackjackFourRegression.test.ts` is excluded by vitest config by design.)
- Validation tier: blackjack targeted tests + `npm run build` (pass).

## Item 12 — IOU handoff fails closed on unverifiable tableId
- Files: `server/src/iouHandoff/routes.ts` (catch narrowed: `TableNotFoundError` keeps the offline/local fallback; any other failure — table exists but membership/auth denied — returns 403 instead of validating the IOU against client-supplied party data).
- Tests: new `server/tests/iouHandoffRouteAccess.test.ts` (403 for non-member with real tableId; unknown tableId still uses offline fallback). 22 tests pass (route access + iouHandoff + iouHandoffConfig).
- Validation tier: server targeted tests (pass); server-only change, client build unaffected.

## Item 2 notes
- Notes: (a) `npm run build:server` fails on a PRE-EXISTING tsconfig rootDir misconfiguration (fails identically on the clean tree; it also emits stray `.js` files beside sources — cleaned up). Canonical `npm run build` (tsc -b + vite) passes. (b) Known limitation: saving an ONLINE table state locally and resuming it OFFLINE now resumes with a masked shoe order (reshuffle-equivalent); online resume is unaffected (server keeps the real deck).
