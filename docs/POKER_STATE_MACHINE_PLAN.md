# Texas Hold'em State Machine Plan (Phase 1 — Definition Only)

**Date:** 2026-06-23  
**Status:** Proposal — **do not implement** until Phase A kickoff.  
**Goal:** Define canonical structures and migration path for replacing the implicit holdem engine with an explicit state machine and server-authoritative multiplayer.

---

## 1. State ownership audit

### 1.1 Current ownership map

```
┌─────────────────────────────────────────────────────────────────┐
│ SERVER (online tables)                                          │
│  MemoryStore / Postgres: GameState snapshot per table           │
│  applyAction: configureTable | resetTable (holdem setup only)   │
│  Socket.IO: table:update broadcasts full GameState              │
│  NO holdem gameplay actions today                               │
└────────────────────────────┬────────────────────────────────────┘
                             │ hydrate / mutate setup
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ GameState (canonical app state)                                 │
│  session — seats, gameType, dealerButtonPlayerId, round number  │
│  ledger — AUTHORITATIVE chip balances                           │
│  deck — AUTHORITATIVE card draw order + dealt card ids          │
│  holdem: HoldemRound | null — AUTHORITATIVE in-hand (local only)│
│  holdemSettings — blind defaults + feature flags (partial dup)  │
│  tableMeta.pokerConfig — AUTHORITATIVE table poker config       │
│  players — display + DERIVED mirrors (currentBet, cardIds)      │
└────────────────────────────┬────────────────────────────────────┘
                             │ PokerPanel controller (local *OnState)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ mapPokerTableViewModel / mapPokerActionAvailability             │
│  Single translation layer (target)                              │
│  Reads: holdem + ledger + pokerConfig + deck                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ PokerTableViewModel + PokerActionAvailability (UI-only)           │
│  PokerTableShell — pure render                                  │
└─────────────────────────────────────────────────────────────────┘

PARALLEL (independent):
  usePokerTableChat → tableChatService (no GameState.holdem)
  pokerChallengeSettlement → IOU API (uses pokerConfig + winnerId)
```

### 1.2 Authoritative vs derived vs UI-only

| Data | Authoritative source | Derived? | UI-only? |
|------|---------------------|----------|----------|
| Chip stacks | `ledger` | No | No |
| Hole / community cards | `deck` + ids on `holdem` | No | No |
| Pot amount | sum of `holdem.playerStates[].playerTotalCommitted` | Yes (computed) | No |
| Street / phase | `holdem.status` + `bettingStreet` | No | No |
| Acting player | `holdem.activePlayerId` | No | No |
| Blinds (between hands) | `pokerConfig` (+ synced `holdemSettings`) | No | No |
| Blinds (in hand) | `holdem.smallBlind/bigBlind` | Copied at round create | No |
| Dealer (between hands) | **`pokerConfig.dealerSeatId`** (intended) | No | No |
| Dealer (in hand) | **`holdem.dealerButtonPlayerId`** + **`session.dealerButtonPlayerId`** | No | No |
| SB/BB seat ids | `holdem.smallBlindPlayerId/bigBlindPlayerId` | No | No |
| Seat badges in UI | `PokerSeatViewModel` | Yes | Yes |
| Action buttons enabled | `PokerActionAvailability` | Yes | Yes |
| Chat messages | server / localStorage poll | No | Poll state local |
| Challenge settlement $ | `pokerConfig.totalChallengeValue` | No | No |

### 1.3 Duplicated state (violations)

| Duplication | Locations | Risk | Resolution |
|-------------|-----------|------|------------|
| Dealer button | `pokerConfig.dealerSeatId`, `session.dealerButtonPlayerId`, `holdem.dealerButtonPlayerId` | First deal may ignore config rotation | **DealerRotationState** single source; sync all three on hand boundary |
| Blind amounts | `pokerConfig`, `holdemSettings`, `holdem.round` | Drift if only one updated | Read from `PokerTableConfig` at hand start; drop round-level copy or treat as snapshot |
| Phase | `holdem.status` vs `holdem.bettingStreet` | Redundant; `blinds` vs `setup` ambiguity | **HoldemPhase** single enum |
| Player bets | `holdem.playerStates[].playerBetsThisStreet` vs `players[].currentBet` | Legacy HoldemPanel | View model reads holdem only; remove Player mirror |
| Winner (challenge) | `tableMeta.pokerConfig.challengeWinnerSeatId` (authoritative) | Wrong IOU recipient | **Done (Phase D1)** |

### 1.4 UI-only state (correct isolation)

- `PokerPanel`: `error`, `gameOverOpen`, `iouFeedback`, `iouPending` — local React state ✓
- `usePokerTableChat`: poll timestamps, unread count ✓
- `pokerSeatPosition` / `rotateSeatsForViewer` — layout only ✓

---

## 2. Multiplayer audit

### 2.1 Client actions today

| User action | Implementation | Server action? | Authority |
|-------------|----------------|----------------|-----------|
| Shuffle deck | `shuffleGameDeck` local | No | **Client authoritative** |
| Start Hold'em hand | `createHoldemRoundOnState` → `startHoldemHandOnState` | No | **Client authoritative** |
| CHECK | `checkHoldemOnState` | No | **Client authoritative** |
| CALL | `callHoldemOnState` | No | **Client authoritative** |
| BET | `betHoldemOnState(amount)` | No | **Client authoritative** |
| RAISE | `raiseHoldemOnState(amount)` | No | **Client authoritative** |
| FOLD | `foldHoldemOnState` | No | **Client authoritative** |
| New hand (after resolved) | `rotatePokerDealerOnState` → `newHoldemRoundOnState` → start | No | **Client authoritative** |
| Save blinds | `updatePokerBlindsOnState` | Yes (`updateHoldemBlinds`) | **Server authoritative** (online); local offline |
| Table setup | `applyHoldemTableStakeSetup` | Yes (`configureTable`) | **Server authoritative** (online) |
| Table reset | `applyHoldemTableResetSetup` | Yes (`resetTable`) | **Server authoritative** (online) |

There is **no** `START_HAND` / `BET` / etc. in `TABLE_ACTIONS`.

### 2.2 Target authority (mirror Blackjack / Zilch)

| Mode | Gameplay mutations |
|------|-------------------|
| Offline (`VITE_ONLINE_MODE=false`) | Local `applyHoldemActionToState` |
| Online | `POST /api/tables/:id/actions` only; `PokerPanel` must not call `onGameStateChange` for gameplay when `onlineDispatch` present |

### 2.3 Multiplayer risks (priority order)

1. **Cheat surface** — any online client can apply arbitrary holdem transitions.
2. **Desync** — dealer/blind config vs engine round on first hand.
3. **No expectedVersion guard** on gameplay — stale actions cannot be rejected.
4. **Virtual players** — must run server-side in online mode after human acts.
5. **Split pot / showdown** — client-only resolution untrusted for challenges.

---

## 3. Canonical type proposal

> Types below are **spec-only**. Names may be aliased to existing exports during migration.

### 3.1 `HoldemPhase`

Single phase enum replacing dual `status` + `bettingStreet`.

```typescript
type HoldemPhase =
  | 'idle'           // no active hand (between hands)
  | 'posting_blinds' // SB/BB commits
  | 'preflop'
  | 'flop'
  | 'turn'
  | 'river'
  | 'runout'         // all-in runout (optional, Phase C+)
  | 'showdown'
  | 'settled';       // hand complete, pot awarded
```

Mapping from current `HoldemRoundStatus`:

| Current | Proposed |
|---------|----------|
| `setup` | `idle` |
| `blinds` | `posting_blinds` |
| `preflop`–`river` | same |
| `showdown` | `showdown` |
| `resolved` | `settled` |

### 3.2 `PlayerHandState`

Per-player in-hand record (replaces `HoldemPlayerState`).

```typescript
type PlayerHandActionStatus =
  | 'waiting'      // not yet dealt / sitting out
  | 'active'       // can act when turn arrives
  | 'acted'        // acted this street
  | 'folded'
  | 'all_in';      // committed full stack (Phase C)

interface PlayerHandState {
  playerId: string;
  holeCardIds: string[];
  streetBet: number;           // was playerBetsThisStreet
  totalCommitted: number;      // was playerTotalCommitted
  hasActedThisStreet: boolean;
  actionStatus: PlayerHandActionStatus;
  /** Showdown only — evaluated hand cache (optional) */
  shownHand?: RankedHoldemHand | null;
}
```

### 3.3 `SidePotState`

Not implemented today (`allowSidePots: false`). Defined for Phase C+.

```typescript
interface SidePotState {
  id: string;
  amount: number;
  eligiblePlayerIds: string[];
}
```

Main pot = side pot with all non-folded players. Engine allocates contributions when all-in introduced.

### 3.4 `HoldemHandState`

One hand from blind post through settlement (replaces core of `HoldemRound`).

```typescript
interface HoldemHandState {
  handNumber: number;
  phase: HoldemPhase;
  smallBlind: number;
  bigBlind: number;
  dealerSeatId: string;
  smallBlindSeatId: string;
  bigBlindSeatId: string;
  activeSeatId: string | null;
  communityCardIds: string[];
  currentBet: number;
  lastRaiseSize: number;
  playerHands: Record<string, PlayerHandState>;
  sidePots: SidePotState[];     // empty until all-in
  mainPotAmount: number;        // derived or cached
  actionLog: string[];
  winners: string[];
  resultSummary: string;
}
```

**Storage:** remains `GameState.holdem` (may rename type to `HoldemHandState` after migration).

### 3.5 `DealerRotationState`

Cross-hand dealer tracking — **one authority**, mirrored to session/round at hand start.

```typescript
interface DealerRotationState {
  dealerSeatId: string;
  handNumber: number;
  rotationOrder: string[];  // copy of session.playerIds at hand start
}
```

**Source of truth:** embed in `PokerTableConfig` today (`dealerSeatId`, `handNumber`) — promote to explicit struct shared with engine. On `startHand`:

1. Read `DealerRotationState` from config.
2. Set `session.dealerButtonPlayerId`.
3. Compute SB/BB from rotation order.
4. Initialize `HoldemHandState` with same ids.

### 3.6 `HoldemTableState` (optional aggregate)

For clarity in docs/tests — not necessarily a new runtime object.

```typescript
interface HoldemTableState {
  config: PokerTableConfig;       // mode, challenge value, blinds
  settings: HoldemSettings;       // feature flags
  dealerRotation: DealerRotationState;
  currentHand: HoldemHandState | null;
}
```

Runtime equivalent: `{ tableMeta.pokerConfig, holdemSettings, holdem }` today.

### 3.7 `PokerTableViewModel` (unchanged role)

Keep as pure UI projection. `mapPokerTableViewModel` maps:

- `HoldemHandState` → seats, pot, street, community cards
- `DealerRotationState` → dealer badge when between hands
- `ledger` → chip counts
- viewer seat → hole card visibility rules

Add fields only if UI needs them (e.g. `sidePots[]` display later).

---

## 4. Migration plan

### Current system → Target system

```
[Today]
  PokerPanel → *HoldemOnState → holdem/round.ts (implicit FSM)
  mapPokerTableViewModel → PokerTableShell
  Server: setup only

[Target]
  PokerPanel → onlineDispatch | applyHoldemActionToState
                    ↓
              applyHoldemActionToState (canonical)
                    ↓
              holdem state machine (explicit HoldemPhase)
                    ↓
              mapPokerTableViewModel (single mapper)
                    ↓
              PokerTableShell
  Server: applyAction + authority for all gameplay
```

### Phase A — State machine foundations (2026-06-23 — **partial complete**)

1. ~~Move `PokerTableConfig` type to `src/types/poker.ts`~~ **Done**
2. ~~Introduce `HoldemPhase`, `HoldemHandState`, canonical types in `holdemState.ts`~~ **Done** (target shapes; legacy `HoldemRound` still runtime)
3. ~~Implement `applyHoldemActionToState` strangler~~ **Done** — delegates to existing `*OnState`
4. ~~Partial dealer unification~~ **Done** — `holdemSelectors.ts` + `withDealerFromPokerConfig` on start-hand
5. Replace dual status/street with single `phase` — **Deferred** (adapter via `getHoldemPhase` only)
6. ~~PokerPanel calls canonical action layer only~~ **Done (2026-06-23)** — `PokerPanel` → `pokerHoldemDispatch` → `applyHoldemActionToState` for offline gameplay.

**Remaining Phase A exit items:** Full phase migration off `HoldemRound`.

### Phase B — Server actions (2026-06-24 — **complete**)

1. ~~Add holdem actions to `TABLE_ACTIONS`~~ **Done** — `startHoldemHand`, `holdemFold/Check/Call/Bet/Raise`, `holdemShuffleDeck`
2. ~~Wire `server/src/tables/applyAction.ts` → `applyHoldemTableActionToState`~~ **Done**
3. ~~Extend `authority.ts`~~ **Done** — host-only start/shuffle; seated actor turn checks via `holdemTurnAuthority.ts`
4. ~~PokerPanel: `onlineDispatch` when online~~ **Done** — no local gameplay mutation online
5. Server-side virtual turn processing via existing `processVirtualHoldemTurns` in engine wrapper
6. Socket broadcast via existing `table:update`

**Deferred:** all-in / side pots (Phase C); challenge winner authority (Phase D).

### Phase B completion — Server-authoritative blind edits (2026-06-23)

1. ~~Add `updateHoldemBlinds` to `TABLE_ACTIONS`~~ **Done**
2. ~~Authority: host-only, no active hand, valid blind amounts~~ **Done** — `assertUpdateHoldemBlindsAuthorized`
3. ~~Reducer: `updatePokerBlindsOnState` on success~~ **Done**
4. ~~PokerPanel: online `onlineDispatch`; offline local~~ **Done**
5. Tests in `holdemTableActions.test.ts`, `holdemTurnAuthority.test.ts`, `PokerPanel.test.tsx`

**Rules:** Owner-only; locked once a hand starts (`isHoldemHandInProgress`); server validates `smallBlind > 0`, `bigBlind > 0`, `smallBlind < bigBlind`.

### Phase C1 — All-in + side-pot foundations (2026-06-23 — **complete**)

1. **`all-in` action** — `allInHoldemPlayer`, `allInHoldemOnState`, `applyHoldemActionToState`, server `holdemAllIn`
2. **`buildHoldemSidePots`** — pure helper in `src/engine/holdem/sidePots.ts`; recomputed on every bet/call/raise/all-in via `syncHoldemPot`
3. **Betting round completion** — skips all-in players in turn order; auto runout through remaining streets when betting closes with multiple all-in players
4. **UI** — All In button, seat all-in badge, optional side-pot count in `PokerPotArea`

**Deferred (Phase C2+):** per-side-pot showdown payout; hand ranking rewrite; challenge winner authority.

### Phase C2 — Side-pot payout + uncalled bet return (2026-06-23 — **complete**)

1. **`uncalledBetReturn.ts`** — return excess above second-highest contribution when one player remains
2. **`sidePotPayout.ts`** — `calculateSidePotPayouts` per pot with tie splits and remainder by seat order
3. **`showdownPayout.ts`** — `executeHoldemPayout` replaces single-pot split in `resolveHoldemShowdown` / `awardPotToSingleWinner`
4. **UI** — payout summary + winning hand label in pot area; WIN badge on seats

**Deferred:** hand ranking rewrite.

### Phase D — Challenge winner authority (D1 complete)

1. **Automatic end:** after hand payout, when exactly one non-eliminated player remains (`stack > 0`, or all-in with committed chips), challenge ends with reason `last-player-standing`.
2. **Host early end:** server action `endHoldemChallenge` (host-only, no active hand); winner = highest chip stack (`chip-leader`); tied chip leaders block with error.
3. **Persisted fields:** `pokerConfig.challengeStatus`, `challengeWinnerSeatId`, `challengeWinnerPlayerId`, `challengeEndReason`, `challengeEndedAt`.
4. **IOU flow** — `stakePerParticipant = totalChallengeValue / participantCount` (canonical roster); winner from authoritative challenge fields only.
5. **Practice mode:** no challenge winner, no End Challenge / Send IOUs.

**Exit criteria:** Challenge IOU uses authoritative winner; practice mode unaffected. ✓

### Phase D2 — Challenge participant accounting (complete)

1. **`getHoldemChallengeParticipants`** — real seated challenge players only; excludes bank, box, virtual practice seats.
2. **Frozen snapshot** — `pokerConfig.challengeParticipants` at challenge setup / first hand start; eliminated players remain.
3. **Settlement validation** — `validatePokerChallengeSettlement`; blocks IOUs when winner not in roster, participantCount &lt; 2, or missing emails.
4. **No partial IOUs** — all-or-nothing send after validation.

**Exit criteria:** IOU math uses participantCount, not `session.playerIds`. ✓

### Phase C — Showdown (remaining)

1. Wire `allowSidePots` / `allowAllIn` from `HoldemSettings` (default off until ready).
2. Implement `SidePotState` allocation and multi-winner pot split.
3. Integrate `handEvaluator` in showdown path only (no change to evaluator algo).
4. Hole card muck rules; runout when all active all-in.

**Exit criteria:** Showdown tests; split pot tests; evaluator unchanged API.

### Phase D — Settlement

1. ~~Challenge end: tie winner to engine rules~~ **Done (D1)** — last player standing (auto) or chip leader (host early end).
2. ~~Remove manual `handleEndGameMock` fallback~~ **Done** — `getAuthoritativeChallengeWinnerId`.
3. IOU flow unchanged math — consumes authoritative `challengeWinnerSeatId` + `pokerConfig.totalChallengeValue`.
4. ~~Persist challenge status server-side~~ **Done** — `challengeStatus`, winner fields on `pokerConfig`.

**Exit criteria:** Challenge IOU uses authoritative winner; practice mode unaffected. ✓

---

## 5. Compatibility check

### 5.1 `PokerTableShell` can consume future state machine output

**Yes.** Shell props are `PokerTableViewModel` + `PokerActionAvailability` only — no direct `GameState` access. Required mapper fields already exist:

| View model field | Source today | Future source |
|------------------|--------------|---------------|
| `street` | `mapStreet(holdem.status, …)` | `HoldemHandState.phase` |
| `pot` | `computeHoldemPot` | `mainPotAmount` + side pots sum |
| `seats[].isDealer/SB/BB` | holdem round ids | `HoldemHandState` seat ids |
| `activePlayerId` | `holdem.activePlayerId` | `activeSeatId` |
| `actionLog` | `holdem.actionLog` | same |

Optional future: pass `sidePots` to `PokerPotArea` — additive prop.

### 5.2 `mapPokerTableViewModel` as single translation layer

**Yes — target confirmed.** Today:

- `PokerPanel` does not render cards directly ✓
- `HoldemPanel` bypasses mapper — **REMOVE LATER**
- Eligibility in `mapPokerActionAvailability` uses shared `can*Holdem` ✓

Phase A: extend mapper to read new types via adapter; no PokerTableShell changes required.

### 5.3 Poker chat remains independent

**Yes.** `usePokerTableChat` uses `tableChatService` only — no imports from `src/engine/holdem/`. State machine changes do not affect chat.

### 5.4 IOU settlement remains independent

**Yes.** `pokerChallengeSettlement.ts` / `pokerGameOverFlow.ts` depend on:

- `tableMeta.pokerConfig` (mode, totalChallengeValue, handNumber, `challengeParticipants` snapshot)
- Authoritative winner (`challengeWinnerSeatId` / `challengeWinnerPlayerId` — D1)
- Canonical participant roster (`getHoldemChallengeParticipants` — D2); not raw `session.playerIds`
- Player emails from invites / owner meta

No dependency on `holdem` pot logic or betting engine.

---

## 6. Recommended implementation order

1. **Phase A.1** — Move `PokerTableConfig` to shared types; fix engine import direction.
2. **Phase A.2** — Define canonical types + `applyHoldemActionToState` shell (delegate to existing functions).
3. **Phase A.3** — Dealer rotation unification (`DealerRotationState`).
4. **Phase A.4** — Single `HoldemPhase`; adapter in mapper.
5. **Phase A.5** — PokerPanel uses canonical layer; delete direct `*OnState` imports.
6. **Phase B** — Server actions + authority (online parity).
7. **Phase C** — Showdown + side pots (feature-flagged).
8. **Phase D** — Challenge settlement winner authority.
9. **Cleanup** — Remove `HoldemPanel`, `pokerMockState`, `Player` bet mirrors.

---

## 7. Architecture summary

SXM poker today has a **working offline holdem engine** under `src/engine/holdem/` with a **clean UI boundary** (`PokerTableShell` + view model mapper). Multiplayer is **setup-only** on the server; all betting is **client-authoritative**. State is **split across three dealer/blind sources**, which must converge before online gameplay.

The canonical path follows Blackjack discipline:

- One engine entry: `applyHoldemActionToState`
- One mapper: `mapPokerTableViewModel`
- One view shell: `PokerTableShell`
- Chat and IOU stay outside the state machine

---

## 8. Risks (consolidated)

| # | Risk | Phase |
|---|------|-------|
| R1 | Engine imports UI config path | A |
| R2 | Dealer desync config vs session vs round | A |
| R3 | No holdem server actions | B |
| R4 | No side pots / all-in | C |
| R5 | Challenge winner not engine-authoritative | D |
| R6 | Zero dedicated holdem engine unit tests | A |
| R7 | Legacy HoldemPanel duplicate path | Cleanup |

---

**Related:** `docs/POKER_ENGINE_INVENTORY.md`, `docs/POKER_ARCHITECTURE_AUDIT.md`, `docs/SXM_ARCHITECTURE.md`
