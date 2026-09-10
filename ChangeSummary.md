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
