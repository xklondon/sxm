# Poker Staging QA Report

**Date:** 2026-06-25 (updated after UI integration fix pass)  
**Pass type:** Automated + infra smoke (manual browser checklist pending human sign-off)

## QA status summary

| Area | Automated | Manual browser | Notes |
|------|-----------|----------------|-------|
| 1. Local app start | **PASS** | Pending | `npm run dev` |
| 2. Poker Practice | **Partial** | **Required** | UI layout tests pass; handplay needs browser |
| 3. Poker Challenge | **Partial** | **Required** | 2-seat roster + funding tested; real invite flow needs browser |
| 4. Heads-up | **PASS** | Spot-check | `headsUpBlinds.test.ts` |
| 5. Online authority | **PASS** | Spot-check | server holdem tests |
| 6. Layout | **Partial** | **Required** | Compact header/felt/menu automated; mobile device QA pending |
| 7. Regression BJ/Zilch | **PASS** | Quick manual | smoke + ownership |
| 8. Deployment smoke | **Partial** | After deploy | health OK |
| 9. Production decision | **NO** | — | See blockers below |

**Overall:** **PASS for friend-table beta** (automated gate green). **NOT production-ready.**

### Live QA issues found (UI pass)

| ID | Issue | Status |
|----|-------|--------|
| U1 | Tall Zilch-like header / off-felt controls | **Fixed** — compact topbar + felt start |
| U2 | Blinds shown 3× | **Fixed** — felt only |
| U3 | Invite as large table button | **Fixed** — This Table menu |
| U4 | Setup form unreachable | **Fixed** — scroll body |
| U5 | 1 guest → 4 players (bank/box) | **Fixed** — playable seat pruning |
| U6 | Starting stacks missing / double-funded | **Fixed** — allocate once per seat |
| U7 | Poker-only chat path | **Fixed** — shared `useTableChat` |
| U8 | Generic flat felt / wrong visual shell | **Fixed** — High Roller template (`poker-hr-*`) from stitch reference |
| U9 | Start required two clicks / no auto blinds+deal | **Fixed** — atomic `start-hand`; **Deal Cards** one click |
| U10 | Practice shows "Waiting for invited player" | **Fixed** — host + 1 virtual default; waiting only in challenge |

**Remaining manual QA:** 2-browser challenge invite, mobile device pass on new template, production deploy smoke.

---

## Visual template (2026-06-23)

Production Poker UI now implements **`reference-ui/Poker/stitch_professional_casino_poker_redesign`** (High Roller Protocol):

- Dark `#041710` session shell, hunter-green oval felt, gold outlines
- Compact top bar + **This Table** slide panel (chat/stacks/invite)
- Seat avatars with D/SB/BB badges; centered pot + community cards
- Casino action bar: chip presets + Fold / Check-Call / Bet-Raise / All In
- **Deal Cards** on felt when idle (Practice immediately playable)

---

## Automated validation (executed — UI integration pass)

```
npx vitest run src/engine/holdem src/games/poker \
  src/components/tableSetupFlow.test.ts src/components/tableSetupRouting.test.tsx \
  server/tests/holdemTableActions.test.ts
→ 187 passed

npx vitest run src/engine/session/holdemTableSetup.players.test.ts → 4 passed

npx vitest run src/games/poker/pokerIntegration.test.tsx (BJ/Zilch smoke) → 2 passed

npm run test:ownership → 27 passed

npx tsc -b && npx vite build → PASS (full `npm run build` blocked by Prisma file lock on Windows)
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
- [ ] Compact top bar (status + This Table menu only)
- [ ] Table name + blinds on felt (once)
- [ ] Start hand on felt when idle
- [ ] Invite / edit blinds in This Table menu (not large header buttons)
- [ ] Desktop 6/9 seats, chat, side pots, ALL IN / WIN badges
- [ ] Mobile: hero cards, action panel, setup form scroll, chat not covering actions

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

**Blackjack / Zilch:** not modified in UI integration pass (shared `TableChatDock` hook + generic setup scroll shell only).
