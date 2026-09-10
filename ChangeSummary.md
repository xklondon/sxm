# Change Summary — Audit punch-list execution (items 1–14 + approved #15 reveal-order fix)

## Item #15 (partial) — reveal order, approved freeze exception (2026-09-10)

- **Files changed:** `src/engine/blackjack/dealing/cardRevealDisplay.ts` (`nextGameplayRevealStep` only — player-hand catch-up now precedes dealer/bank-draw catch-up; pure reorder, no new timing/state/config), `docs/BLACKJACK_ENGINE_FREEZE.md` (exception recorded), `docs/CHANGE_LOG.md`.
- **Tests added/updated:** `src/engine/blackjack/dealing/cardRevealGameplay.test.ts` — new case pinning players-before-dealer during gameplay catch-up (double card + bank draws in one state).
- **Validation:** targeted engine reveal/pacing suites (`src/engine/blackjack/dealing` + bankTurnPacing, dealPacing, cardTimingEngine, dealerDisplay, doubleAction, blackjackPolish) — 16 files, 121 passed; dependent component suites (blackjackFiveIssueFixes, blackjackPresentationStability, blackjackStabilityContracts, cardViewHeroHand, tableInfoDisplay) — 5 files, 44 passed; `npm run build` green. `blackjackRenderedLayout.test.tsx` / full `npm test` not run per rules.
- **Not touched (outside approval):** Card View `slice(0,4)` results cap; all other frozen files.

---

Date: 2026-09-10. All 14 approved punch-list items implemented, each as its own commit on `main`. Item #15 was **not** touched (frozen — see Deploy readiness).

## 1. Files changed

**Server (security/authority):**
- `server/src/app.ts` — `table:subscribe` membership gate (`getTableForUser`, emits `table:subscribe:denied` on failure); `/api/debug` gated behind `requireAuth` + production root-only (404 for non-root).
- `server/src/tables/redactState.ts` — **new**: `redactStateForViewer(state, viewerPersonId)` masks hidden blackjack dealer hole card, opponent hold'em holes, and shoe `drawOrder` with decoy real-card ids; mirrors client visibility rules exactly (protocol `showDealerHoleCardDuringPlay`, showdown/resolved, `canPersonControlHoldemSeat`).
- `server/src/tables/broadcast.ts` — rewritten: per-socket redacted emits via `io.in(room).fetchSockets()` with per-viewer cache (replaces room-level `io.to().emit()`).
- `server/src/tables/service.ts` — `/api/tables/active` strips `hostEmail` + `players` for non-member viewers; new `getMemberPersonId`; `applyAction` returns `personId`.
- `server/src/tables/routes.ts`, `server/src/tables/inviteAcceptHttp.ts` — redaction applied to GET/join/action responses; person resolver passed to all broadcast sites.
- `server/src/tables/authority.ts` — `assignChips` via `assertTableHost` on `personId` (when `ownerOnlyCanAssignChips`); `placeBet` requires finite positive amount.
- `server/src/iouHandoff/routes.ts` — fail closed: non-`TableNotFoundError` lookup failures → 403.
- `server/src/debug/emailRoutes.ts` — `/routes` inventory refreshed; `server/src/dev/routes.ts` — `/test-email` uses shared SMTP helpers.

**Client:**
- `src/hooks/useOnlineMultiplayer.ts` — monotonic version guard across socket/poll/action/refetch ingestion.
- `src/hooks/onlineSocket.ts` — `tableId` in payload type; one-time re-fetch on reconnect.
- `src/engine/dice/zilch/zilchTurnAuthority.ts` — display-name fallback removed from server-relevant path (offline `playable.length <= 1` shortcut deliberately kept).
- `src/components/useZilchTableFlow.ts` — `zilchCompleteRoll` dispatch gated to the acting client.
- `src/components/useHandTransitionHold.ts` — ordered FIFO hold queue + seeded prev-refs (no spurious holds on rejoin).
- `src/App.tsx` + `src/components/BlackjackPanel.tsx` — LocalProfileSetup render deduplicated (App copy suppressed on blackjack table screen; panel copy gains `lockedEmail`).
- `src/engine/blackjack/roundSummaryOverlay.ts` + `src/components/RoundSummaryOverlay.tsx` — entries keyed by `handKey`.
- `src/games/poker/components/PokerTablePanel.tsx`, `PokerChatDock.tsx`, `PokerPotArea.tsx` — stable list keys.
- **Deleted (dead code, −625 lines):** `src/components/HoldemPanel.tsx`, `HoldemPanel.css`, `useCardViewBustHold.ts` (+ its test).

**Docs:** `docs/SXM_MASTER_SPEC.md` (assignChips authority, subscribe gate, redaction, version guard, placeBet validation), `docs/CHANGE_LOG.md` (2026-09-10 entry), `RAILWAY_DEPLOY.md` (debug curl examples need root session).

## 2. Tests added / updated

**New:** `server/tests/socketSubscribe.test.ts` (member broadcast + stranger denied), `server/tests/stateRedaction.test.ts` (7 cases: hole hidden/revealed/open-protocol, shoe masking, holdem own/opponent/showdown/null-viewer), `src/hooks/useOnlineMultiplayer.versionGuard.test.tsx` (4 cases), `server/tests/iouHandoffRouteAccess.test.ts`.

**Updated:** `server/tests/joinRequests.test.ts` (PII stripping), `multiplayerOwnership.test.ts` (spoofed-name assignChips, invalid placeBet), `zilchTurnAuthority.test.ts` (same-name guests), `useZilchTableFlow.test.ts` (roll gate), `debugRoutes.test.ts` + `emailDebug.test.ts` + `authRoutes.test.ts` + `emailProvider.test.ts` (root-auth for debug endpoints), `holdemJoinBroadcast.test.ts` (per-socket broadcast contract), `onlineSocket.test.ts` (reconnect re-fetch).

## 3. Validation run

| Tier | Command | Result |
|------|---------|--------|
| Server/multiplayer | `npx vitest run server/tests` | **Run — 40 files, 259 passed, 5 skipped, 0 failed** |
| Ownership | `npm run test:ownership` | **Run — 28 passed** |
| People/invites | `npm run test:people-invite` | **Run — 35 passed** |
| Blackjack layout | `npm run test:blackjack:layout` | **Run — 19 files, 261 passed** |
| Layout target | `npm run test:layout:target` | Skipped — no Full Table layout/CSS contract changes (only React keys + hold-queue logic; covered by blackjack layout tier) |
| Build | `npm run build` | **Run — green** (only pre-existing chunk-size warning) |
| Full `npm test` | — | Skipped — forbidden in agent loop per `.cursorrules` |

Per-item targeted tests were also run and recorded at each commit. Note: `npm run build:server` is **pre-existing broken** (tsconfig rootDir errors on clean tree, verified via stash) — canonical gate is `npm run build`.

## 4. Architecture impact

- **New transport-boundary module** `server/src/tables/redactState.ts`: server state now differs per viewer. Broadcast is asynchronous per-socket; any future broadcast callers must pass a personId resolver.
- Canonical routes unchanged (App → TableScreen → panels). No parallel render paths added; one dead path (HoldemPanel) removed.
- Authority now consistently personId-based; no display-name matching remains on server-relevant paths.
- **Confirmed non-issue:** SXM does not support saving an online table and resuming it offline, so the masked shoe `drawOrder` cannot affect a supported session-overlap flow.

## 5. Deploy readiness

- All validation tiers green; each item independently revertable by commit.
- **Item #15 (blackjack reveal-order in `cardRevealDisplay.ts` + Card View `slice(0,4)` cap) NOT implemented** — inside `docs/BLACKJACK_ENGINE_FREEZE.md`; requires explicit unfreeze approval.
- Production `/api/debug/*` now requires a root session — `RAILWAY_DEPLOY.md` curl examples updated accordingly.
- No open test failures.

Spec discipline: checked/updated SXM_MASTER_SPEC.md and CHANGE_LOG.md.
