# Poker Staging QA Report

**Date:** 2026-06-25  
**Pass type:** Automated + infra smoke (manual browser checklist pending human sign-off)

## QA status summary

| Area | Automated | Manual browser | Notes |
|------|-----------|----------------|-------|
| 1. Local app start | **PASS** | Pending | `npm run dev` — Vite `http://localhost:5173`, LAN `http://192.168.0.43:5173`, API `:3017` |
| 2. Poker Practice | **Partial** | **Required** | Engine/UI tests pass; handplay needs 2 browsers |
| 3. Poker Challenge | **Partial** | **Required** | Settlement/join/IOU dedup tested in vitest; overlay + Send IOUs needs browser |
| 4. Heads-up | **PASS** | Spot-check | `headsUpBlinds.test.ts` + selectors |
| 5. Online authority | **PASS** | Spot-check | `holdemTableActions.test.ts`, `holdemTurnAuthority.test.ts` |
| 6. Layout | **Partial** | **Required** | Shell render tests; mobile/desktop needs device QA |
| 7. Regression BJ/Zilch | **PASS** | Quick manual | `pokerIntegration` smoke + ownership |
| 8. Deployment smoke | **Partial** | After deploy | Railway health OK; full flow blocked by magic-link cooldown |
| 9. Production decision | **NO** | — | See blockers below |

**Overall:** **PASS for friend-table beta** (automated gate green). **NOT production-ready.**

---

## Automated validation (executed)

```
npx vitest run src/engine/holdem src/games/poker server/tests/holdemTableActions.test.ts \
  server/tests/holdemChallengeJoin.test.ts server/tests/iouHandoff.test.ts
→ 171 passed

npx vitest run src/games/poker/pokerIntegration.test.tsx src/components/tableSetupFlow.test.ts \
  src/engine/session/holdemTableSetup.test.ts → 29 passed

npm run test:ownership → 27 passed

Blackjack/Zilch smoke (pokerIntegration) → 2 passed
```

**Local infra:** dev self-check PASS (`/health` direct + Vite proxy).  
**Deployed:** `https://sxm-production.up.railway.app/health` and `/api/health` → `{"ok":true}`.

---

## Bugs found

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| Q1 | Low | `devLink` returned relative path (`/api/auth/verify?...`) — broke `test-local-flow` `new URL(devLink)` | **Fixed** — returns full `verifyUrl` in dev |

No other clear bugs found in automated pass.

---

## Manual checklist (human — not run in agent session)

Use **host** + **guest/incognito** at `http://192.168.0.43:5173` (or `localhost`).

### Practice
- [ ] New Table → Cards → Poker → Practice
- [ ] Start hand; D / SB / BB badges
- [ ] Fold, check, call, bet, raise, all-in
- [ ] Side pot display (if all-in scenario)
- [ ] Chat; no IOU buttons; new hand

### Challenge
- [ ] 2-player and 4-player challenge setup
- [ ] Invalid blinds blocked; challenge value shown
- [ ] Roster excludes bank/box
- [ ] First hand starts; late join blocked
- [ ] End challenge; overlay: winner, count, stake, losers
- [ ] Send IOUs once; second click → safe duplicate handling

### Heads-up (2 players)
- [ ] Dealer = SB; other = BB
- [ ] Preflop SB acts first; postflop BB first
- [ ] Dealer rotates next hand

### Authority (as guest)
- [ ] Out-of-turn rejected + error shown
- [ ] Non-owner blinds/end challenge rejected

### Layout
- [ ] Desktop 6/9 seats, chat, side pots, ALL IN / WIN badges
- [ ] Mobile: hero cards, action panel, chat not covering actions

### Regression
- [ ] Blackjack one hand; Zilch one turn
- [ ] Global chat on BJ/Zilch; poker embedded chat only

---

## Deploy

| Item | Value |
|------|--------|
| **Staging / production URL** | `https://sxm-production.up.railway.app` |
| **Health** | OK (2026-06-25) |
| **Commit / push** | **Deferred** — pending manual QA sign-off + user commit request |
| **Post-deploy smoke** | health → login → poker table → chat → one hand → challenge overlay |

---

## Production readiness (section 9)

**Do not mark production-ready until:**

1. Manual mobile QA passes
2. Server IOU dedup persisted beyond in-memory map
3. `onlineActionInFlight` guards double-click dispatch
4. At least one real multi-user challenge E2E on staging

**Friend-table beta:** **Yes** — automated gates green, known risks documented in `POKER_FINAL_STABILIZATION_AUDIT.md`.

**Blackjack / Zilch:** not modified in beta hardening pass.
