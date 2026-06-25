# Poker Architecture Audit

**Date:** 2026-06-23  
**Scope:** `src/games/poker/**`, Poker routing/setup/chat/IOU integration

## Status

**PASS WITH RISKS**

## Summary

Poker is correctly isolated under `src/games/poker/` with a single production route through `PokerPanel` → `mapPokerTableViewModel` → `PokerTableShell`. Blackjack and Zilch routes are unchanged. The audit found a few state-authority and game-over edge cases; small corrective patches were applied. Larger items (online gameplay actions, explicit seat-role config, layout scaling for 8–9 players) are documented for the real Hold'em state-machine phase.

## Confirmed Safe

* Poker UI, CSS, hooks, settlement helpers, and tests live under `src/games/poker/` only.
* No Blackjack table shell, Zilch layout, or `HoldemPanel` imports in the Poker module.
* Shared imports are generic: `PlayingCard`, `GameOverIouFeedback` type, `tableChatService`, holdem engine `*OnState` functions, session helpers.
* `TableScreen` routes: Blackjack → `BlackjackPanel`, Zilch → `ZilchPanel`, Hold'em → `PokerPanel`.
* Legacy `HoldemPanel.tsx` remains in repo but is **not** routed from `TableScreen`.
* Global `TableChatDock` is hidden when `isHoldem`; Poker uses embedded `PokerChatDock` + `usePokerTableChat` (same API, separate poll instance).
* `tableMeta.pokerConfig` stores mode, protocol, wager, challenge value, currency, starting stack, blinds, dealer seat id, hand number, IOU guard.
* Starting stack (`startingStack` / `seatChips`) is used for ledger buy-in only; settlement uses `totalChallengeValue / playerCount` only.
* Owner blind edit is gated by `isTableOwner` + `!isPokerHandInProgress()`; engine throws if mid-hand.
* Challenge IOU math: winner-takes-all per loser; practice mode returns no IOU payloads.
* IOU duplicate guard: `pokerConfig.iouSubmittedAt` + per-loser `localStorage` keys in `pokerChallengeSettlement.ts`.
* Blackjack/Zilch smoke tests still pass alongside Poker integration tests.

## State Authority Path

```
GameState (session + holdem + tableMeta.pokerConfig + ledger)
  ↓
PokerPanel (controller: actions, chat hook, game-over orchestration)
  ↓ mapPokerTableViewModel / mapPokerActionAvailability
PokerTableShell (view)
  ↓
PokerSeatRing, PokerCommunityBoard, PokerPotArea, PokerActionPanel, PokerChatDock
```

**Authoritative sources**

| Concern | Source of truth |
|---------|-----------------|
| Blinds (between hands) | `tableMeta.pokerConfig` + `holdemSettings` (kept in sync via `updatePokerBlindsOnState`) |
| Dealer (between hands) | `tableMeta.pokerConfig.dealerSeatId` |
| Dealer/SB/BB/acting (in hand) | `GameState.holdem` round fields |
| Pot / street / cards | `GameState.holdem` + `deck` |
| Challenge settlement | `tableMeta.pokerConfig.totalChallengeValue` (not chip stacks) |
| Chat | `tableChatService` / server messages (UI-local poll state only) |

## Risks Found

* **Engine → UI module import:** `holdemTableSetup.ts` imports `pokerTableConfig` from `src/games/poker/`. Config type should eventually move to `src/types/` or `src/engine/holdem/` to avoid engine depending on UI package path.
* **SB/BB not in `pokerConfig`:** Small/big blind seat ids exist only on `holdem` round during a hand; pre-hand UI shows dealer from config but not SB/BB badges until deal.
* **`pokerConfig.dealerSeatId` vs holdem engine:** `createHoldemRoundOnState` uses holdem engine rotation, not necessarily `pokerConfig.dealerSeatId`. Rotation on new hand updates config but engine may pick different button on first deal.
* **Winner resolution for challenge end:** Manual “End challenge & settle” uses `holdem.winners[0]` or falls back to first player — not a full tournament/chip-leader model yet.
* **Game-over overlay was tied to `holdem.status === 'resolved'`** — could flash settlement UI after every hand (patched).
* **Mock view model fallback** — `POKER_MOCK_TABLE` could override real empty tables without config (patched).
* **Online gameplay:** No holdem actions in server `TABLE_ACTIONS` / `authority.ts`; local engine only.
* **CSS coupling:** `PokerPanel` uses `table-stake-panel__confirm` class from TableStakePanel styles (cosmetic only).
* **Dual chat poll:** Poker and global chat both poll the same API when switching table types in one session — acceptable but two hook implementations exist.
* **Layout:** Fixed `min-height: 24rem` felt + elliptical seat ring may clip/overlap with 8–9 players; mobile controls stack below felt (no overlap fix yet).

## Corrective Patches Applied

* Removed `POKER_MOCK_TABLE` fallback from `mapPokerTableViewModel`; legacy/no-config tables now map real session seats.
* Restricted game-over overlay to challenge end (`gameOverOpen` or `tableMeta.gameStatus === 'ended'`) — not every resolved hand.
* Added `validatePokerBlinds()` in engine + UI; rejects zero/negative blinds and `bigBlind <= smallBlind`.
* Blocked “New Hand / New Game” when IOU handoff returns error feedback.
* Added tests: global chat hidden on poker tables, blind validation, view model without mock injection.

## Deferred Work

* Move `PokerTableConfig` out of `src/games/poker/` into shared types/engine layer.
* Add explicit `smallBlindSeatId` / `bigBlindSeatId` / `actingSeatId` to config or documented holdem adapter.
* Sync `pokerConfig.dealerSeatId` into `createHoldemRoundOnState` / first deal.
* Replace manual challenge winner with chip-leader or engine showdown winner only.
* Online holdem action dispatch + server authority (mirror Zilch/Blackjack pattern).
* Responsive seat-ring scaling for 8–9 players; reduce felt `min-height` clipping on short viewports.
* Extract shared `useTableChat` hook from `TableChatDock` and `usePokerTableChat` to dedupe polling logic.

## Required Before Real Engine

* Single canonical Hold'em state machine module (online + offline) with explicit seat roles and street transitions.
* Server `TABLE_ACTIONS` + `authority.ts` for holdem gameplay when online.
* Wire `createHoldemRoundOnState` to read blinds/dealer from `pokerConfig` (not stale `holdemSettings` alone).
* Challenge end triggered by defined tournament rule (one winner), not mock button / first-player fallback.
* Integration tests for full hand lifecycle: deal → streets → showdown → rotate dealer → next hand.
* Remove or quarantine legacy `HoldemPanel` once parity proven.

## Test Coverage (audit)

| Check | Test location |
|-------|----------------|
| Poker routing | `pokerIntegration.test.tsx` |
| Global chat hidden | `pokerIntegration.test.tsx` |
| Config persists blinds/challenge | `pokerIntegration.test.tsx` |
| Blind edit before hand | `pokerIntegration.test.tsx` |
| Blind edit blocked mid-hand | `pokerIntegration.test.tsx` |
| Invalid blind values | `pokerIntegration.test.tsx` |
| Dealer / SB / BB badges | `pokerIntegration.test.tsx` |
| IOU winner-takes-all math | `pokerIntegration.test.tsx` |
| Practice blocks IOU | `pokerIntegration.test.tsx` |
| No mock seat injection | `pokerIntegration.test.tsx` |
| BJ / Zilch smoke | `pokerIntegration.test.tsx` |
| Setup flow card-game step | `tableSetupFlow.test.ts`, `tableSetupRouting.test.tsx` |
| Production ownership | `productionRouteOwnership.test.ts` |
