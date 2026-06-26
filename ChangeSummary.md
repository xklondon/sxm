# Change Summary — Poker Route, Betting Flow, Responsive Layout Stabilization

## Duplicate / legacy paths found

| Path | Status |
|------|--------|
| `HoldemPanel.tsx` | **Not routed** — `TableScreen` uses `PokerPanel` only; ownership test guards |
| `BlackjackPanel` for holdem | **Blocked** — `isBlackjackTable` excludes `isHoldemTable` |
| Permanent `TableChatDock` on poker | **Hidden** — `!isHoldem` guard in `TableScreen` |
| `poker-table-layout__controls` chat rail | **Removed** — chat in `PokerTablePanel` only |
| Zilch-like tall header | **Not used** on poker route |

**Canonical route:** `TableScreen → PokerPanel → PokerTableShell → PokerTableLayout`

## Root causes fixed

### Betting (Raise unavailable / confusing actions)
- `mapPokerActionAvailability` passed `lastRaiseSize` to `canRaiseHoldem` as **target total** — should be `currentBet + lastRaiseSize`
- `canRaise` now requires `currentBet > 0` (Bet vs Raise separation)
- Action panel merged Check+Call on one button — now **separate** Fold / Check / Call / Bet / Raise / All In
- No “Stay” in poker UI (blackjack term)

### Practice virtual blocking
- Offline practice: `useEffect` runs `processVirtualHoldemTurns` when virtual is actor
- Host acts via `canPersonControlHoldemSeat` + `actorSeatId` for virtual proxy

### Layout overlap / clipping
- Felt used `overflow: hidden` + fixed heights — seats/cards clipped
- **New model:** CSS grid shell, `clamp()` felt height, `overflow: visible` on table, sticky action bar with `safe-area-inset-bottom`, portrait/landscape media queries

## Files changed

- `src/games/poker/pokerRouteGuard.ts` — NEW dev route guard
- `src/games/poker/state/mapPokerTableViewModel.ts` — raise availability fix
- `src/games/poker/components/PokerActionPanel.tsx` — separate poker action buttons
- `src/games/poker/components/PokerPanel.tsx` — virtual auto-advance, turn authority, route guard
- `src/games/poker/components/PokerTableShell.tsx` — waiting/canAct props
- `src/games/poker/styles/poker-table.css` — responsive layout contract
- `src/games/poker/pokerBettingFlow.test.tsx` — NEW
- `src/games/poker/pokerResponsiveLayout.test.tsx` — NEW
- `src/games/poker/pokerLiveRoute.test.tsx` — single shell + no chat rail
- `docs/POKER_STAGING_QA_REPORT.md`, `docs/CHANGE_LOG.md`

## Tests run

| Tier | Result |
|------|--------|
| Poker UI/start/action/layout (92) | **PASS** |
| Server holdem actions (23) | **PASS** |
| Ownership + live route smoke | **PASS** |
| `tsc -b` + `vite build` | **PASS** |

## Confirmations

- Single `poker-hr-shell` per holdem table; no HoldemPanel / BlackjackPanel / permanent chat rail
- Preflop: Call + Raise (not Check/Bet facing blind); postflop: Check/Bet or Call/Raise as appropriate
- No “Stay” in poker action UI
- Action bar outside felt clipping (`poker-hr-layout__actions` sticky)
- Blackjack/Zilch not modified

**Spec discipline: checked/updated docs/CHANGE_LOG.md and POKER_STAGING_QA_REPORT.md.**
