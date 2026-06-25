# Change Summary — Poker Staging QA

## QA status

**Automated gate: PASS** | **Manual browser: PENDING human sign-off** | **Production: NO** | **Friend-table beta: YES**

Full report: `docs/POKER_STAGING_QA_REPORT.md`

## Local app

| Check | Result |
|-------|--------|
| `npm run dev` | Running — `http://localhost:5173`, LAN `http://192.168.0.43:5173`, API `127.0.0.1:3017` |
| Health (proxy + direct) | PASS (dev self-check) |

## Automated test matrix (checklist coverage)

| Checklist item | Coverage |
|----------------|----------|
| Practice setup / no IOU | `pokerIntegration`, `pokerStabilization`, `holdemTableSetup` |
| Challenge settlement / roster | `pokerChallengeSettlement.test.ts`, `challengeParticipants.test.ts` |
| Invalid blinds | `validatePokerBlinds`, `holdemTableSetup.test.ts` |
| Join after first hand blocked | `holdemChallengeJoin.test.ts` (engine + server) |
| IOU dedup / practice block | `iouHandoff.test.ts` |
| Heads-up blinds | `headsUpBlinds.test.ts`, `holdemSelectors.test.ts` |
| Online authority | `holdemTableActions.test.ts`, `holdemTurnAuthority.test.ts` |
| Layout shell (6-seat, chat, actions, pots) | `pokerStabilization.test.tsx` |
| BJ/Zilch regression smoke | `pokerIntegration` smoke block |
| Global vs embedded chat | `pokerStabilization` TableScreen test |

**171** holdem/poker/server + **29** integration/setup + **27** ownership + **2** BJ/Zilch smoke — all passed.

## Bugs found / fixed

| Bug | Fix |
|-----|-----|
| `devLink` was relative path → `test-local-flow` threw `Invalid URL` | `server/src/auth/service.ts` — return full `verifyUrl` in dev |

No gameplay/layout bugs found in automated pass.

## Manual QA (you must run)

Open host + guest/incognito at **http://192.168.0.43:5173** and walk sections 2–7 in `docs/POKER_STAGING_QA_REPORT.md`.

## Deployment

| Item | Status |
|------|--------|
| Deploy URL | `https://sxm-production.up.railway.app` |
| Health smoke | PASS (`/health`, `/api/health`) |
| Full live flow | Blocked by magic-link rate limit during automated run — retry after cooldown or use SMTP inbox |
| Commit / push | **Not done** — pending your manual QA sign-off (large uncommitted Poker tree) |

## Production blockers (unchanged)

1. Manual mobile QA
2. Persistent server IOU dedup store
3. Double-click action dispatch guard
4. Real multi-user challenge E2E on staging

**Blackjack / Zilch:** not modified.

**Spec discipline:** QA report added; no spec change required for QA-only pass.
