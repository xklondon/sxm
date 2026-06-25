# Poker / Hold'em Engine Inventory

**Date:** 2026-06-23  
**Purpose:** Pre-flight audit before canonical Texas Hold'em state machine implementation.  
**Scope:** Existing holdem logic, reducers, state, actions, multiplayer sync — **no gameplay changes in this pass**.

Classification key:

| Tag | Meaning |
|-----|---------|
| **SAFE TO REUSE** | Keep as-is or adapt with thin wrapper; behavior is correct or UI-only |
| **REPLACE** | Must be superseded by canonical state machine / server action path |
| **UNKNOWN** | Exists but incomplete, duplicated, or authority unclear — decide during Phase A |

---

## 1. File inventory

### 1.1 Hold'em engine (`src/engine/holdem/`)

| File | Role | Classification | Notes |
|------|------|----------------|-------|
| `gameState.ts` | `*OnState` entry points | **REPLACE** | Superseded gradually by `applyHoldemActionToState` (Phase A strangler added). |
| `round.ts` | Round lifecycle: `createHoldemRound`, `postBlinds`, `dealHoleCards`, `dealFlop/Turn/River`, `afterHoldemAction`, `advanceHoldemStreet`, `resolveHoldemShowdown`, `awardPotToSingleWinner`, `resetHoldemRound`, `startHoldemHand` | **REPLACE** | Core implicit state machine; no side pots; dealer rotation uses `session.dealerButtonPlayerId` not `pokerConfig.dealerSeatId`. |
| `betting.ts` | Player actions: `check/bet/call/raise/foldHoldemPlayer`, `postBlind`, `validateHoldemAction` | **REPLACE** | No all-in partial calls; no side-pot allocation; ledger commits are synchronous per action. |
| `helpers.ts` | Seat order, SB/BB resolution, `initHoldemPlayerStates`, `syncHoldemPot`, `resetStreetBets`, `rotateDealerButton`, action log | **SAFE TO REUSE** | Pure helpers; re-home under canonical module with same semantics. |
| `validation.ts` | `canCheck/canCall/canBet/canRaise/canFoldHoldem`, `hasEnoughCardsForHoldemStart`, `runHoldemEngineChecks` | **SAFE TO REUSE** | Eligibility selectors; align field names when `HoldemRound` is replaced. |
| `virtual.ts` | `getVirtualHoldemAction`, `isVirtualHoldemPlayer` | **SAFE TO REUSE** | Practice-mode AI; consumes round + ledger only. |
| `ledgerEntries.ts` | `appendHoldemLedgerEntry`, `payPotToWinner` | **SAFE TO REUSE** | Ledger is authoritative for chip balances; keep entry types. |
| `settings.ts` | `HoldemSettings`, `DEFAULT_HOLDEM_SETTINGS`, `mergeHoldemSettings` | **SAFE TO REUSE** | `allowAllIn` / `allowSidePots` flags exist but are **not wired** in betting/round. |
| `handEvaluator.ts` | `evaluateBestHoldemHand`, `compareHoldemHands`, `rankHoldemHand` | **SAFE TO REUSE** | Phase C (showdown); no engine tests today. |
| `index.ts` | Public engine exports | **UNKNOWN** | Surface will change when canonical action layer is introduced. |

### 1.2 Hold'em types (`src/types/holdem.ts`)

| Item | Classification | Notes |
|------|----------------|-------|
| `HoldemRoundStatus` (`setup` → `resolved`) | **REPLACE** | Overlaps `bettingStreet`; dual status/street tracking is fragile. |
| `HoldemPlayerState` | **REPLACE** | Missing all-in, side-pot eligibility, mucked cards. |
| `HoldemRound` | **REPLACE** | Single main pot only (`pot` derived from `playerTotalCommitted`). No `SidePotState`. |
| `createEmptyHoldemRound`, `computeHoldemPot`, `nextBettingStreet` | **SAFE TO REUSE** | Pure functions; pot sum logic valid for single-pot model. |

### 1.3 Session / table setup

| File / symbol | Classification | Notes |
|---------------|----------------|-------|
| `src/engine/session/holdemTableSetup.ts` | **SAFE TO REUSE** | Setup + blind edit + dealer rotate between hands. |
| `applyHoldemTableStakeSetup` | **SAFE TO REUSE** | Creates `tableMeta.pokerConfig`, allocates stacks, practice virtuals. |
| `updatePokerBlindsOnState` | **SAFE TO REUSE** | Syncs `holdemSettings` + `pokerConfig`; throws mid-hand. |
| `rotatePokerDealerOnState` | **UNKNOWN** | Updates `pokerConfig.dealerSeatId` only — does not set `session.dealerButtonPlayerId`. |
| `parseHoldemTableStakePayload` | **SAFE TO REUSE** | Server + client setup parsing. |
| `createNewHoldemTable()` (`table.ts`) | **SAFE TO REUSE** | Empty table shell; no `pokerConfig` until stake setup. |
| `isHoldemTable` / `ensureHoldemTableIdentity` (`zilchTableKind.ts`) | **SAFE TO REUSE** | Routing identity guard. |

**Cross-layer violation:** ~~`holdemTableSetup.ts` imports `pokerTableConfig` from `src/games/poker/`~~ **Fixed Phase A (2026-06-23):** `PokerTableConfig` lives in `src/types/poker.ts`; engine imports shared types only.

### 1.4 Poker UI module (`src/games/poker/`)

| File | Classification | Notes |
|------|----------------|-------|
| `components/PokerTableShell.tsx` | **SAFE TO REUSE** | Pure view; consumes `PokerTableViewModel` + `PokerActionAvailability`. |
| `components/PokerPanel.tsx` | **REPLACE** | Controller: local `*OnState` calls, no `onlineDispatch`, manual challenge end. |
| `state/mapPokerTableViewModel.ts` | **SAFE TO REUSE** | Target single translation layer GameState → view model. |
| `state/pokerTypes.ts` | **SAFE TO REUSE** | View-model types only. |
| `state/pokerTableConfig.ts` | **SAFE TO REUSE** | Re-exports from `src/types/poker.ts`; validation helpers remain. |
| `state/pokerChallengeSettlement.ts` | **SAFE TO REUSE** | Challenge IOU math independent of hand engine. |
| `state/pokerGameOverFlow.ts` | **SAFE TO REUSE** | IOU submission flow independent of hand engine. |
| `hooks/usePokerTableChat.ts` | **SAFE TO REUSE** | Chat via `tableChatService`; no game state. |
| `components/PokerGameOverOverlay.tsx` | **SAFE TO REUSE** | Challenge settlement UI. |
| `components/PokerBlindsControl.tsx` | **SAFE TO REUSE** | Owner blind edit UI. |
| `state/pokerMockState.ts` | **REMOVE LATER** | Preview/fixture data; not used in production mapper. |
| `components/HoldemPanel.tsx` (legacy, `src/components/`) | **REMOVE LATER** | Not routed; duplicate controller + inline eligibility. |

### 1.5 Server multiplayer

| File | Classification | Notes |
|------|----------------|-------|
| `server/src/tables/actions.ts` | **SAFE TO REUSE** (extended) | Holdem gameplay actions added Phase B |
| `server/src/tables/applyAction.ts` | **SAFE TO REUSE** (extended) | Routes holdem via `applyHoldemTableActionToState` |
| `server/src/tables/authority.ts` | **SAFE TO REUSE** (extended) | Holdem authority via `holdemTurnAuthority.ts` |

---

## 2. Reducers and state transitions

There is **no named reducer** (no Redux). State changes are **pure functions** returning new `GameState`.

| Function | Trigger | Output fields | Classification |
|----------|---------|---------------|----------------|
| `applyHoldemUpdate` | All `*OnState` | `session`, `players`, `ledger`, `deck`, `holdem` | **REPLACE** |
| `createHoldemRound` | Start round shell | `holdem` status `setup` | **REPLACE** |
| `postBlinds` + `dealHoleCards` | `startHoldemHand` | `preflop`, blinds posted, hole cards dealt | **REPLACE** |
| `check/bet/call/raise/foldHoldemPlayer` | Player action | ledger + round player state | **REPLACE** |
| `afterHoldemAction` | Post-action | next actor OR advance street OR award pot | **REPLACE** |
| `advanceHoldemStreet` | Street complete | deal community / showdown / fold win | **REPLACE** |
| `resolveHoldemShowdown` | Showdown | winners, pot paid (split evenly) | **REPLACE** (Phase C) |
| `resetHoldemRound` | New hand | rotates `session.dealerButtonPlayerId` | **REPLACE** |
| `syncPlayersFromRound` | After engine step | copies `holeCardIds`, `currentBet`, `status` onto `Player` | **UNKNOWN** — derived mirror on `Player`; may be UI legacy |
| `applyHoldemTableStakeSetup` | Table setup | `tableMeta.pokerConfig`, stacks, virtuals | **SAFE TO REUSE** |
| `updatePokerBlindsOnState` | Owner blind edit | `pokerConfig` + `holdemSettings` | **SAFE TO REUSE** |
| `rotatePokerDealerOnState` | New hand (PokerPanel) | `pokerConfig.dealerSeatId`, `handNumber++` | **UNKNOWN** — not synced to engine dealer |

---

## 3. Actions inventory

### 3.1 Engine-level actions (local)

| Action | Entry point | Engine function | Classification |
|--------|-------------|-----------------|----------------|
| CREATE_ROUND | `createHoldemRoundOnState` | `createHoldemRound` | **REPLACE** |
| START_HAND | `startHoldemHandOnState` | `postBlinds` → `dealHoleCards` | **REPLACE** |
| NEW_ROUND | `newHoldemRoundOnState` | `resetHoldemRound` | **REPLACE** |
| CHECK | `checkHoldemOnState` | `checkHoldemPlayer` | **REPLACE** |
| CALL | `callHoldemOnState` | `callHoldemPlayer` | **REPLACE** |
| BET | `betHoldemOnState(amount)` | `betHoldemPlayer` | **REPLACE** |
| RAISE | `raiseHoldemOnState(amount)` | `raiseHoldemPlayer` | **REPLACE** |
| FOLD | `foldHoldemOnState` | `foldHoldemPlayer` | **REPLACE** |
| (implicit) ADVANCE_STREET | inside `afterHoldemAction` | `advanceHoldemStreet` | **REPLACE** |
| (implicit) SHOWDOWN | inside `advanceHoldemStreet` | `resolveHoldemShowdown` | **REPLACE** |

There is **no explicit `START_HAND` action type** — `PokerPanel.handleStartHand` orchestrates shuffle → create round → start hand locally.

### 3.2 Server `TABLE_ACTIONS` (online)

Hold'em-related today:

| Action | Purpose | Classification |
|--------|---------|----------------|
| `configureTable` | Hold'em stake setup payload | **SAFE TO REUSE** |
| `resetTable` | Hold'em reset setup | **SAFE TO REUSE** |

**Missing (Phase B):** `holdemCheck`, `holdemCall`, `holdemBet`, `holdemRaise`, `holdemFold`, `holdemStartHand`, `holdemNewHand` (names TBD — mirror Zilch naming).

### 3.3 UI controller actions (`PokerPanel`)

| UI action | Local engine? | Server? | Classification |
|-----------|---------------|---------|----------------|
| Shuffle deck | `shuffleGameDeck` | No | **SAFE TO REUSE** |
| Start hand | `createHoldemRoundOnState` + `startHoldemHandOnState` | No | **REPLACE** (server path) |
| Check/Call/Bet/Raise/Fold | `*HoldemOnState` | No | **REPLACE** |
| Save blinds | `updatePokerBlindsOnState` | No (local only) | **UNKNOWN** |
| End challenge | mutates `tableMeta.gameStatus` only | No | **SAFE TO REUSE** (settlement layer) |
| Send IOUs | `sendPokerChallengeIous` | API | **SAFE TO REUSE** |

---

## 4. State models

### 4.1 `GameState` (authoritative container)

```typescript
GameState {
  session: GameSession          // playerIds, dealerButtonPlayerId, gameType, status
  players: Record<string, Player>
  ledger: Ledger                // chip balances — authoritative for stacks
  deck: Deck | null
  holdem: HoldemRound | null    // in-hand authoritative gameplay state
  holdemSettings: HoldemSettings
  tableMeta.pokerConfig?: PokerTableConfig  // table-level poker config
}
```

| Field | Authority | Classification |
|-------|-----------|----------------|
| `ledger` | **Authoritative** (chips) | **SAFE TO REUSE** |
| `holdem` | **Authoritative** (in-hand) | **REPLACE** (shape) |
| `deck` | **Authoritative** (card ids) | **SAFE TO REUSE** |
| `session.dealerButtonPlayerId` | **Authoritative** for engine deal | **UNKNOWN** — conflicts with `pokerConfig.dealerSeatId` |
| `tableMeta.pokerConfig` | **Authoritative** between hands (blinds, mode, challenge) | **SAFE TO REUSE** |
| `holdemSettings` | Duplicate of blinds with extra flags | **UNKNOWN** — sync via `updatePokerBlindsOnState` |
| `players[].currentBet`, `cardIds` | **Derived** from `holdem` | **UNKNOWN** — legacy mirror |

There is **no separate `TableState`** type — table concerns live in `GameState.tableMeta` + `session`.

### 4.2 `HoldemRound` (current in-hand model)

See `src/types/holdem.ts`. Single pot, no side pots, dual phase tracking (`status` + `bettingStreet`).

### 4.3 `PokerTableConfig`

See `src/games/poker/state/pokerTableConfig.ts`. Table-level, persists across hands.

### 4.4 `PokerTableViewModel`

See `src/games/poker/state/pokerTypes.ts`. **UI-only** — built by `mapPokerTableViewModel`.

---

## 5. Helper functions by domain

### 5.1 Betting logic

| Symbol | Location | Classification |
|--------|----------|----------------|
| `validateHoldemAction` | `betting.ts` | **REPLACE** |
| `commitChips` | `betting.ts` (private) | **REPLACE** |
| `resetOthersActed` | `betting.ts` | **SAFE TO REUSE** (concept) |
| `can*Holdem` | `validation.ts` | **SAFE TO REUSE** |
| `streetBettingComplete` | `round.ts` | **SAFE TO REUSE** (concept) |
| `findNextActor` / `setNextActor` | `round.ts` | **SAFE TO REUSE** (concept) |

**Gaps:** no all-in, no side pots, no uncalled bet return, no minimum raise beyond `lastRaiseSize`.

### 5.2 Dealer logic

| Symbol | Location | Classification |
|--------|----------|----------------|
| `rotateDealerButton` | `helpers.ts` | **SAFE TO REUSE** |
| `rotatePokerDealerOnState` | `holdemTableSetup.ts` | **UNKNOWN** — config-only rotation |
| `resetHoldemRound` | `round.ts` | **REPLACE** — uses session dealer, ignores `pokerConfig` |
| `mapPokerTableViewModel` dealer display | prefers `holdem.dealerButtonPlayerId` then `pokerConfig.dealerSeatId` | **SAFE TO REUSE** |

### 5.3 Blind logic

| Symbol | Location | Classification |
|--------|----------|----------------|
| `postBlind` | `betting.ts` | **REPLACE** |
| `postBlinds` | `round.ts` | **REPLACE** |
| `getSmallBlindSeat` / `getBigBlindSeat` | `helpers.ts` | **SAFE TO REUSE** |
| `updatePokerBlindsOnState` | `holdemTableSetup.ts` | **SAFE TO REUSE** |
| `validatePokerBlinds` | `pokerTableConfig.ts` | **SAFE TO REUSE** |

Blind **amounts** live in three places: `holdemSettings`, `pokerConfig`, and `holdem.smallBlind/bigBlind` per round.

### 5.4 Winner logic

| Symbol | Location | Classification |
|--------|----------|----------------|
| `awardPotToSingleWinner` | `round.ts` | **REPLACE** |
| `resolveHoldemShowdown` | `round.ts` | **REPLACE** (Phase C) |
| `evaluateBestHoldemHand` | `handEvaluator.ts` | **SAFE TO REUSE** |
| `computePokerWinnerTakesAllSettlement` | `pokerChallengeSettlement.ts` | **SAFE TO REUSE** — challenge IOU, not hand pot |
| `PokerPanel` `resolvedWinnerId` | fallback chain | **UNKNOWN** — manual challenge end |

---

## 6. Multiplayer synchronization

### 6.1 Current sync model

| Layer | What syncs | Mechanism |
|-------|------------|-----------|
| Table setup | stake, blinds, mode, invites | `configureTable` / `resetTable` → server `applyAction` |
| Gameplay | **nothing online** | Client calls `*HoldemOnState` locally via `PokerPanel` |
| Chat | messages | `tableChatService` poll — independent of game state |
| IOU | challenge settlement | `createIouHandoff` API — independent of hand engine |

### 6.2 Authority classification

| Action group | Authority today | Target |
|--------------|-----------------|--------|
| Setup / reset | **Server authoritative** (when online) | Keep |
| Shuffle / deal / betting | **Client authoritative** | **Server authoritative** (Phase B) |
| Showdown / pot pay | **Client authoritative** | **Server authoritative** (Phase C) |
| Chat | Server/store | Keep independent |
| Challenge IOU | Client-triggered API | Keep independent |

### 6.3 Risks

1. **No versioned gameplay actions** — online tables cannot safely share one holdem state.
2. **Dual dealer sources** — clients can desync dealer/SB/BB between `pokerConfig` and `session.dealerButtonPlayerId`.
3. **No turn authority** — any client could mutate `holdem.activePlayerId` locally.
4. **Ledger mutations local-only** — chip counts not validated server-side during betting.
5. **Virtual player loop** — `processVirtualHoldemTurns` runs client-side only; unbounded loop guard (30) is local.
6. **Challenge winner** — not tied to chip leader or tournament rules; manual end button.

---

## 7. Summary lists

### SAFE TO REUSE

- `src/engine/holdem/helpers.ts` (seat order, pot sync, street reset helpers)
- `src/engine/holdem/validation.ts` (eligibility selectors)
- `src/engine/holdem/virtual.ts`
- `src/engine/holdem/ledgerEntries.ts`
- `src/engine/holdem/settings.ts`
- `src/engine/holdem/handEvaluator.ts` (Phase C)
- `src/engine/session/holdemTableSetup.ts` (after moving `PokerTableConfig` import)
- `createNewHoldemTable`, `isHoldemTable`, `ensureHoldemTableIdentity`
- `src/games/poker/components/PokerTableShell.tsx` + layout children
- `src/games/poker/state/mapPokerTableViewModel.ts`
- `src/games/poker/state/pokerTypes.ts`
- `src/games/poker/state/pokerTableConfig.ts` (relocate type)
- `src/games/poker/state/pokerChallengeSettlement.ts`
- `src/games/poker/state/pokerGameOverFlow.ts`
- `src/games/poker/hooks/usePokerTableChat.ts`
- Server `configureTable` / `resetTable` holdem branches

### REPLACE

- `src/engine/holdem/gameState.ts` — canonical action layer
- `src/engine/holdem/round.ts` — state machine core
- `src/engine/holdem/betting.ts` — betting + blinds commit path
- `src/types/holdem.ts` — `HoldemRound` / player state shapes
- `src/games/poker/components/PokerPanel.tsx` — online dispatch + authority
- Server `TABLE_ACTIONS` + `authority.ts` — holdem gameplay actions
- `HoldemPanel.tsx` — legacy duplicate UI (stop routing already done)

### REMOVE LATER

- `src/games/poker/state/pokerMockState.ts` — fixture only
- `src/components/HoldemPanel.tsx` + `HoldemPanel.css` — legacy panel
- Duplicate `Player.currentBet` / `cardIds` sync if view model reads `holdem` only

### UNKNOWN (resolve in Phase A)

- `rotatePokerDealerOnState` vs `resetHoldemRound` dealer rotation
- `holdemSettings` vs `pokerConfig` blind duplication
- `syncPlayersFromRound` — still needed for HoldemPanel legacy?
- `players[].status` `'all-in'` — type exists, engine never sets it
- Online blind edit — needs server action or owner-only local rule

---

## 8. Test coverage

| Area | Tests | Notes |
|------|-------|-------|
| Poker UI / integration | `pokerIntegration.test.tsx`, `pokerTableShell.test.tsx` | Setup, mapper, chat, blinds |
| Table setup routing | `tableSetupFlow.test.ts`, `tableSetupRouting.test.tsx` | Hold'em setup path |
| Hold'em engine unit | `holdemSelectors.test.ts`, `applyHoldemActionToState.test.ts` | Selectors, strangler wrapper, import boundary |
| Server holdem gameplay | **None** | No actions to test |

---

**Related:** `docs/POKER_STATE_MACHINE_PLAN.md`, `docs/POKER_ARCHITECTURE_AUDIT.md`
