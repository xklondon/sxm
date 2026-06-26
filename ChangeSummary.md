# Change Summary — Poker High Roller Visual Template + Start Flow Fix

## Reference files used

- `reference-ui/Poker/stitch_professional_casino_poker_redesign/DESIGN.md` — High Roller Protocol tokens, typography, layout, component rules
- `reference-ui/Poker/stitch_professional_casino_poker_redesign/screen.png` — visual target screenshot

## Root cause (start flow)

After offline shuffle, `handleStartHand` updated parent state but `gameStateRef` still pointed at the pre-shuffle state, so the subsequent `start-hand` dispatch failed silently. Fixed by syncing `gameStateRef` after shuffle.

## Files changed

**Template / UI (`src/games/poker/`)**
- `pokerTemplateContract.ts` — NEW: template class contract + reference path
- `styles/poker-table.css` — rewritten for High Roller tokens (dark shell, oval felt, sharp gold/red buttons)
- `components/PokerTableShell.tsx` — `poker-hr-*` shell, **Deal Cards**, waiting copy in top bar only
- `components/PokerTableLayout.tsx` — stage/table/center structure
- `components/PokerSeat.tsx` — circular avatars, D/SB/BB badges
- `components/PokerActionPanel.tsx` — chip presets + casino action bar
- `components/PokerPotArea.tsx` — compact centered pot
- `components/PokerSeatRing.tsx`, `PokerFeltClothLayer.tsx` — template classes
- `components/PokerPanel.tsx` — ref sync after shuffle; challenge waiting in status bar
- `pokerTemplate.test.tsx` — NEW: template + start-flow UI tests

**Docs**
- `docs/POKER_STAGING_QA_REPORT.md`, `docs/POKER_FINAL_STABILIZATION_AUDIT.md`, `docs/CHANGE_LOG.md`, `docs/SXM_MASTER_SPEC.md`

## Tests run

| Tier | Command | Result |
|------|---------|--------|
| Poker template + UI | `vitest run src/games/poker` + `holdemStartHand.test.ts` | **PASS** |
| Server holdem | `vitest run server/tests/holdemTableActions.test.ts` | **PASS** (23) |
| Ownership | `npm run test:ownership` | **PASS** (28) |
| Build | `npx tsc -b` + `npx vite build` | **PASS** |
| Full `npm run build` | — | **Skipped** (Prisma EPERM on Windows) |

## Confirmations

- **Practice** starts immediately: host + 1 virtual, Deal Cards enabled, no “Waiting for invited player” in center
- **One click Deal Cards**: shuffle → post SB/BB (pot 15) → deal 2 hole cards → preflop actor set
- **Visual shell** follows High Roller reference (`poker-hr-shell`, oval felt, avatars, action bar below)
- **No permanent chat rail** — chat in This Table panel
- **Blackjack/Zilch** not modified

**Spec discipline: checked/updated SXM_MASTER_SPEC.md and CHANGE_LOG.md.**
