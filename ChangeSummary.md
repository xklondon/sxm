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

## Item 2 notes
- Notes: (a) `npm run build:server` fails on a PRE-EXISTING tsconfig rootDir misconfiguration (fails identically on the clean tree; it also emits stray `.js` files beside sources — cleaned up). Canonical `npm run build` (tsc -b + vite) passes. (b) Known limitation: saving an ONLINE table state locally and resuming it OFFLINE now resumes with a masked shoe order (reshuffle-equivalent); online resume is unaffected (server keeps the real deck).
