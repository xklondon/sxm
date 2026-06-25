# Poker Final Stabilization Audit

**Date:** 2026-06-23 (updated after beta hardening pass)  
**Scope:** Phases A–D2 complete — setup, practice, challenge, online authority, hold'em engine, UI, regression safety.

## Status

**PASS WITH RISKS** (beta hardening applied 2026-06-23)

## Summary

Poker is **functionally complete** for practice and challenge flows with server-authoritative online gameplay, side-pot payout, authoritative challenge winner, and canonical IOU participant roster. This audit found **three actionable defects** (participant snapshot timing, setup blind validation, game-over overlay when settlement blocked) and **one cosmetic gap** (ALL IN / WIN badge CSS). All defects were patched; remaining risks are documented below and do not block dev/staging use.

Blackjack and Zilch were **not modified** (gameplay, layout, or CSS).

---

## Manual QA Checklist

| Area | Item | Result |
|------|------|--------|
| **1. Setup** | Cards → Poker — Texas Hold'em selectable | PASS — `TableStakePanel` |
| | Practice starts with virtual players | PASS — `virtualPlayerCount` in `holdemTableSetup` |
| | Challenge requires wager, value, invites, stack, blinds | PASS — confirm validation in `TableStakePanel` |
| | Invalid blinds rejected (`bb > sb`) | PASS — patched `validatePokerBlinds` at setup + panel |
| | Participant snapshot once (first hand) | PASS — patched: no snapshot at table setup |
| **2. Practice** | No IOU / End Challenge controls | PASS — `PokerPanel` gates |
| | Virtual players excluded from settlement | PASS — `challengeParticipants` |
| | Host proxies virtual turns (practice) | PASS — `canPersonControlHoldemSeat` |
| | Practice does not end as challenge | PASS — `isHoldemChallengeTable` guards |
| | Blind posting with practice ledger ids | PASS — engine `postBlinds` |
| **3. Challenge** | Participants exclude bank/box artifacts | PASS — tests + D2 |
| | Snapshot stable after elimination | PASS — frozen records |
| | Auto winner when one survivor | PASS — `maybeAutoEndHoldemChallenge` |
| | Host early-end (no active hand) | PASS — server + client |
| | Chip-leader tie blocks early-end | PASS — server test #13 |
| | IOUs blocked without authoritative winner | PASS — `validatePokerChallengeSettlement` |
| | 4-player $100 → 3 × $25 IOUs | PASS — `pokerChallengeSettlement.test.ts` |
| **4. Online authority** | No local gameplay mutation online | PASS — `PokerPanel` + `onlineDispatch` |
| | Server validates acting seat / turn | PASS — `holdemTurnAuthority` |
| | Out-of-turn rejected | PASS — server + unit tests |
| | Non-owner blind edits rejected | PASS — server tests |
| | Mid-hand blind edits rejected | PASS — server + UI hide |
| | Non-owner challenge end rejected | PASS — server test #10 |
| | Server errors in Poker UI | PASS — `role="alert"` (all-in, blinds tested) |
| **5. Hold'em engine** | Dealer rotation | PASS — `rotatePokerDealerOnState` (limited multi-hand test) |
| | SB/BB after rotation | PASS — selectors + integration test |
| | Blinds post once per hand | PASS — `postBlinds` (no dedicated unit test) |
| | Player actions advance | PASS — betting engine |
| | Fold/check/call/bet/raise/all-in | PASS — tests |
| | All-in skipped in turn order | PASS — betting round logic |
| | Betting round closes | PASS — `afterHoldemAction` |
| | Auto-showdown when all all-in | PARTIAL — engine path exists; no dedicated E2E test |
| | Uncalled bet return | PASS — `uncalledBetReturn.test.ts` |
| | Side pots to eligible players | PASS — `sidePotPayout.test.ts` |
| | Tie splits | PASS — `sidePotPayout.test.ts` |
| **6. UI/layout** | D / SB / BB badges | PASS — `PokerSeat` + integration test |
| | ALL IN / WIN badges | PASS — patched CSS |
| | Pot / side-pot summary | PASS — `PokerPotArea` |
| | Chat dock visible/collapsible | PASS — `PokerChatDock` |
| | Desktop page scroll | NOT AUDITED (manual) |
| | Mobile action panel vs cards | NOT AUDITED (manual) |
| | 6/7/8/9 seat rings | PASS — smoke render test |
| **7. Regression** | Blackjack loads/plays | PASS — smoke tests |
| | Zilch loads/plays | PASS — smoke tests |
| | Global chat hidden on poker only | PASS — `TableScreen` + test |
| | No BJ/Zilch CSS changed | PASS — diff scope |

---

## Bugs Found

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| B1 | **High** | Challenge participant snapshot taken at table setup (host-only) froze roster before guests joined → wrong IOU math | **Fixed** — snapshot only on first hand deal |
| B2 | **Medium** | Setup allowed `bigBlind <= smallBlind` (panel + engine) | **Fixed** — `validatePokerBlinds` at confirm + `applyHoldemTableStakeSetup` |
| B3 | **Medium** | Game-over overlay hidden when challenge ended but settlement validation failed | **Fixed** — fallback settlement view with `blockingReason` |
| B4 | **Low** | ALL IN / WIN badge classes had no CSS rules | **Fixed** — `poker-table.css` |

---

## Patches Applied

| File | Change |
|------|--------|
| `src/engine/session/holdemTableSetup.ts` | Removed early snapshot; validate blinds at setup |
| `src/components/TableStakePanel.tsx` | `validatePokerBlinds` on holdem practice/challenge confirm |
| `src/games/poker/components/PokerPanel.tsx` | Game-over fallback when settlement blocked |
| `src/games/poker/styles/poker-table.css` | ALL IN / WIN badge styles |

### Tests added

| File | Coverage |
|------|----------|
| `src/engine/session/holdemTableSetup.test.ts` | No snapshot at setup; blind reject; snapshot on first hand |
| `src/games/poker/pokerStabilization.test.tsx` | 2-player challenge settlement; bank/box exclusion; chat; seat ring |
| `src/components/tableSetupRouting.test.tsx` | Blind validation helper |
| `src/engine/holdem/headsUpBlinds.test.ts` | HU dealer=SB, BB, preflop/postflop action order |
| `src/engine/holdem/holdemChallengeJoin.test.ts` | Join lock before/after snapshot |
| `server/tests/holdemChallengeJoin.test.ts` | Server invite join policy |
| `server/tests/iouHandoff.test.ts` | Poker IOU dedup, partial failure, practice block |

### Beta hardening patches (2026-06-23)

| File | Change |
|------|--------|
| `src/engine/holdem/helpers.ts` | Standard heads-up blind + preflop actor rules |
| `src/engine/holdem/holdemChallengeJoin.ts` | Join-after-start lock helper |
| `server/src/tables/service.ts` | Block new challenge joins after snapshot |
| `src/lib/iouHandoffPayload.ts` | Poker challenge nonce material + request fields |
| `server/src/lib/iouHandoffPayload.ts` | Server poker nonce hash |
| `server/src/iouHandoff/service.ts` | Poker IOU validation + idempotency |
| `src/games/poker/state/pokerChallengeSettlement.ts` | Challenge IOU request fields |
| `src/games/poker/styles/poker-table.css` | `overflow-x: hidden` on shell |

---

## Remaining Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Partial call all-in** — short stacks must use explicit All In, not Call | UX confusion | Document in poker help |
| **Dual dealer rotation** — `pokerConfig.dealerSeatId` + `session.dealerButtonPlayerId` | Rare desync if paths diverge | Canonical start-hand sync exists |
| **No poker layout contract** — unlike blackjack frozen layouts | Visual regressions | Manual QA on mobile/desktop; basic shell render tests |
| **`handEvaluator`** — no direct unit tests | Ranking bugs at real showdown | Indirect coverage via `showdownPayout.test.ts` mocks |
| **`PokerPanel`** — no `onlineActionInFlight` disable | Double-click dispatch window | Low severity |
| **Players joining after first-hand snapshot** | Excluded from IOU roster | By design (frozen roster); join blocked for new players |
| **IOU dedup store** — in-memory per server process | Duplicate IOU across server restarts | Accept for beta; persist nonce store if needed |

---

## Ready for Production?

**NO** — ready for **dev/staging** and friend-table beta.

Blockers for production hardening (not in scope of this audit):

1. Manual mobile/desktop layout QA on real devices
2. Optional: full-hand E2E integration test (blinds → all-in → showdown → challenge end)
3. Persistent server-side IOU nonce store across process restarts

---

## Validation Run

| Command | Result |
|---------|--------|
| `npx vitest run src/engine/holdem src/games/poker server/tests/holdemTableActions.test.ts server/tests/holdemChallengeJoin.test.ts server/tests/iouHandoff.test.ts` | **171 passed** |
| Blackjack + Zilch smoke | **2 passed** (pokerIntegration smoke) |
| `npm run test:ownership` | **27 passed** |
| `npm run build` | **PASS** |

**Blackjack / Zilch:** not modified.
