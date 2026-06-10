# Card Dealer App — Implementation Plan

This document tracks the phased build for Spec 1.0. See [Scope.md](./Scope.md) for full product requirements.

## Architecture overview

```
┌─────────────────────────────────────────────────────────┐
│  Screens (React)                                        │
│  Start · Setup · Table · Ledger panel · Settings        │
└──────────────────────────┬──────────────────────────────┘
                           │ reads/writes
┌──────────────────────────▼──────────────────────────────┐
│  Session state (React context + localStorage later)     │
└──────────────────────────┬──────────────────────────────┘
                           │ calls
┌──────────────────────────▼──────────────────────────────┐
│  Pure engine (TypeScript, no React)                     │
│  session · deck · ledger · blackjack · poker · eval     │
└─────────────────────────────────────────────────────────┘
```

**Principle:** The ledger is the source of truth. Balances displayed in the UI are derived from ledger entries.

## Repository layout

```
SXMCards/
├── .cursorrules              # Project guardrails for AI and contributors
├── Scope.md                  # Product spec 1.0
├── PROJECT_PLAN.md           # This file
├── README.md                 # Quick start
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── main.tsx              # App entry
    ├── App.tsx               # Root router / screen shell
    ├── index.css             # Global styles + CSS variables
    ├── types/                # Shared TypeScript models
    │   ├── index.ts
    │   ├── session.ts
    │   ├── player.ts
    │   ├── deck.ts
    │   └── ledger.ts
    ├── engine/               # Pure deterministic game logic
    │   ├── index.ts
    │   ├── deck/             # Phase 2 — deck, shuffle, deal
    │   ├── ledger/           # (Phase 1)
    │   ├── session/          # (Phase 1)
    │   ├── blackjack/        # settings, shoe, split, round (Phase 3 + 4.5)
    │   └── holdem/           # settings, betting, streets (Phase 4 + 4.5)
    ├── screens/              # One file per MVP screen
    │   ├── StartScreen.tsx
    │   ├── GameSetupScreen.tsx
    │   └── TableScreen.tsx
    ├── components/           # Reusable UI (table, chips, cards, etc.)
    │   └── LedgerPanel.tsx
    │   └── PlayingCard.tsx
    └── hooks/                # (React state in App.tsx for now)
```

## Build phases

| Phase | Scope | Status |
|-------|-------|--------|
| **0 — Foundation** | `.cursorrules`, scaffold, types, placeholder Start screen | Done |
| **1 — Core table & ledger** | Session CRUD, add/remove players, virtual players, ledger entries, balance display | **Done** |
| **2 — Deck & dealing** | 52-card deck, shuffle (seeded optional), deal, basic card display | **Done** |
| **3 — Blackjack** | Rules, betting, hit/stand/double, resolution, ledger updates | **Done** |
| **4 — Texas Hold'em** | Blinds, streets, betting rounds, hand evaluator, showdown | **Done** |
| **4.5 — Clarity & structure** | Card UI, per-game settings, BJ shoe/split, table ledger UI, player views, multi-seat control | **Done** |
| **4.6 — Blackjack UX** | Casino table layout, bank controls, in-seat betting, chip stacks, game selector | **Done** |
| **4.7 — BJ UX Phase 2** | Table-first, boxes, chip drag/drop, Card View | **Done** |
| **4.8 — BJ Table Phase 3** | Instant table, stake agreement, casino layout, Play/Shuffle, betting zones | **Done** |
| **5 — BJ Flow** | Round phases, manual/auto deal & bank, AID placeholder, dev logger | **Done** |
| **6 — BJ UX** | RTL boxes, empty start, ownership, banker setup, ledger summary, Card View | **Done** |
| **7 — BJ Protocol** | Protocol phases, Shuffle/Cards, bet fix, persistence, Card View refactor | **Done** |
| **8 — BJ UX** | Deal fix, dealer block, clean boxes, profile, card timer, Card View | **Done** |
| **9 — BJ UX Bugfix** | Confirmed-bet SSOT, Cards fix, GU removal, Leave, Card View betting, timer UX | **Done** |
| **10 — BJ Phase 10** | Deal/chip bugs, drag-to-box, banker on stake screen, local invites | **Done** |
| **11 — UX polish** | Hold'em table polish, round summary | Pending |

## Implementation sequence (detailed)

### Phase 0 — Foundation ✅

- [x] Create `.cursorrules`
- [x] Create Vite + React + TypeScript scaffold
- [x] Define TypeScript data models (`src/types/`)
- [x] Placeholder Start screen

### Phase 1 — Core table & ledger ✅

- [x] `engine/session/` — create session, add/remove player, assign bank/dealer, set starting chips
- [x] `engine/ledger/` — append entry, buy-in, manual adjustment, derive balances, validate
- [x] `screens/GameSetupScreen` — game type, players, virtual players, starting chips, bank/dealer
- [x] `screens/TableScreen` — table shell with players, balances, placeholder deck/actions
- [x] `components/LedgerPanel` — read-only ledger list
- [x] React state routing in `App.tsx` (no persistence)

### Phase 2 — Deck & dealing ✅

- [x] `engine/deck/` — standard 52-card deck, Fisher-Yates shuffle (optional seed)
- [x] `drawCard`, `drawCards`, `resetDeck`, `validateDeck`, `runDeckEngineChecks`
- [x] `DealingStatus` on session; deck synced via `applyDeckToGameState`
- [x] `components/PlayingCard` — face-up rank/suit display
- [x] Deal animation mode hooks (`slide`, `flip`, `fast`, `slow`, `mix`)
- [x] Table screen — Shuffle, Deal test card, Reset deck, remaining count, dealt history

### Phase 3 — Blackjack ✅

- [x] `engine/blackjack/` — round state machine, hand value, hit/stand/double
- [x] Dealer rules (stand on 17, blackjack pays 3:2)
- [x] Bet placement → ledger (`bet-placed`, `bet-increased`)
- [x] Round resolution → `win-paid`, `push-refund`, `loss-collected`
- [x] `components/BlackjackPanel` — betting, deal, actions, results
- [x] Virtual players: hit under 16, stand on 16+

### Phase 4 — Texas Hold'em ✅

- [x] `engine/holdem/handEvaluator.ts` — 7-card best hand, full ranking ladder
- [x] `engine/holdem/` — blinds, streets, betting, showdown, fold wins
- [x] Ledger entries: `blind-posted`, `call-placed`, `fold-recorded`, `pot-paid`
- [x] `components/HoldemPanel` — full betting UI with check/bet/call/raise/fold
- [x] Virtual players: conservative fold/call/check (no bluffing)

### Phase 4.5 — Gameplay clarity & table structure ✅

- [x] `components/PlayingCard` — standard rank corners, pip layouts, face/ace center, face-down
- [x] `engine/blackjack/settings.ts` — decks, payout, dealer soft-17, split/double limits, bet limits
- [x] `engine/holdem/settings.ts` — blinds, min raise, player limits, showdown mode
- [x] `engine/blackjack/shoe.ts` — multi-deck shoe with unique ids (`AS-D1`, …), default 6 decks
- [x] Blackjack split pairs, double down, double-after-split (settings), max splits, resolution via ledger
- [x] `components/LedgerPanel` — **Table Balance Log**; Player / Action / Amount / Balance; advanced toggle
- [x] Full Table View / Player View on table screen; seat selector for player-focused actions
- [x] Optional `controllerName` per seat — one person can control multiple positions
- [x] Placeholder note for future table close (carry balance / ignore)

### Phase 4.6 — Blackjack table UX ✅

- [x] Remove shuffle seed from visible UI
- [x] Top-left game selector (Blackjack / Texas Hold'em; sub-variants later)
- [x] Bank/dealer strip: Shuffle, Deal cards, Start new table, Add person to table
- [x] Casino-style felt layout — compact dealer zone, player seat grid, no empty instruction block
- [x] In-seat betting with chip buttons (1, 2, 5, 10), optional amount input, clear/place bet
- [x] Selected seat highlight; hit/stand/double/split for selected seat only
- [x] Open seat slots + inline add form (same controller can hold multiple seats)
- [x] `ChipStack` visual for balance and pending bets
- [x] `engine/session/table.ts` — `startNewTable`, `switchGameType`, `addSeatAtTable`

### Phase 4.7 — Blackjack UX Phase 2 ✅

- [x] Table-first entry — green felt + “Choose a game” prompt (`tableGame` state)
- [x] Game choice drives layout (Blackjack panel only after Blackjack selected)
- [x] Box terminology — playing box vs person (“Played by …”); one person, multiple boxes
- [x] Compact box grid on felt; smaller cards in Full Table
- [x] Chip tray with HTML drag/drop + tap fallback; pending bet until Place bet
- [x] Card View — large cards, dealer compact, play actions, Full Table toggle
- [x] Add box / Play open box / assign played-by inline form

### Phase 4.8 — Blackjack Table UX Phase 3 ✅

- [x] New Game → instant green Blackjack table (`createNewBlackjackTable`)
- [x] Stake agreement panel — “What are we playing for?” + default chips
- [x] `TableMeta` — agreement, outcome placeholder, table status
- [x] Table ledger `table-outcome-recorded` entry type
- [x] Dealer zone — Play / Shuffle only; bank balance + chip stack visible
- [x] Zones — neutral chips at edge, betting circle drop target, card fan
- [x] Curved compact box arc; small open-slot “+” markers
- [x] Play deals only to boxes with confirmed bets
- [x] Join / leave box from table view

### Phase 4.9 — Blackjack Table UX Phase 4 ✅

- [x] Bank zone — `BANK` tag, name, `Balance: N`, compact chip stack
- [x] Box labels — box number, `Played by: [person]`, selected badge (always visible)
- [x] Compact chip stacks — icon + numeric balance; compact bet chips in circles
- [x] Play flow — bet countdown (10s default) or immediate deal when all boxes have confirmed bets
- [x] Deal button — skip countdown / deal when bets are ready
- [x] Shuffle vs shoe — Shuffle = fresh shoe; Play/Deal continue from existing shoe
- [x] Staged initial deal — sequential card reveal with `dealCardDelayMs` / `dealRoundPauseMs`
- [x] Countdown UI — `Bets close in: N`; betting locks when timer ends
- [x] Table status messages — Place bets, Bets closing…, Dealing…, Round in play

### Phase 5 — Blackjack Flow ✅

- [x] Engine phases: betting → initial-deal → player-turns → bank-turn → banking → resolved
- [x] Step-wise initial deal (manual Card / auto sequential)
- [x] Bank turn split from settlement — manual Draw card or auto draw with delay
- [x] Banking phase — brief settle UI then ledger resolution
- [x] Dealer controls by phase (Deal / Card / Draw / Shuffle / Next round)
- [x] Flow settings menu — auto deal, auto bank, countdown, AID on/off, advice cost mode
- [x] Per-box comments + AID placeholder advice
- [x] Client dev logger (`src/utils/logger.ts`)

### Phase 6 — Blackjack UX (table layout & Card View) ✅

- [x] Right-to-left box order, empty table start, ownership, banker setup
- [x] Ledger box summary, Card View basics, Shuffle beside game info

### Phase 8 — Blackjack UX (deal fix & rendering) ✅

- [x] Cards/deal bug — sync confirmed bets, `dealCardsFromState`, extensive logging
- [x] Canonical centered dealer block (Playing for, Balance, Shuffle New Shoe / Cards)
- [x] Clean betting boxes with initials and chip stacks
- [x] Local profile (name/email → initials, localStorage)
- [x] Card timer (5/10/15/30s) with auto-deal at 0
- [x] Card View refactor — shared state, phone betting UI, huge Playing-phase cards

### Phase 9 — Blackjack UX bugfix (confirmed bets & Card View) ✅

- [x] **Single source of truth** — `getConfirmedBetForBox`, `getBoxesWithConfirmedBets`, `canStartCards` in `protocol.ts`
- [x] **Cards bug fixed** — confirmed bets read from ledger + round hand; no false "Place bets first" after confirm
- [x] **GU removed** — Guest/Box labels no longer force initials badges on every box
- [x] **Leave on all claimed boxes** — always visible, releases slot
- [x] **Pending vs confirmed UI** — empty circle when unstaked; pending chips before ✓; larger confirmed amount
- [x] **Dealer block** — Shuffle above Cards (smaller); timer dropdown beside Cards; countdown only in center status
- [x] **Card View betting** — chip tray, confirm, Cards, timer; no felt table; same helpers as Table View
- [x] Dev logs: `pendingBet`, `confirmBet`, `confirmedBetsBeforeCards`, `canStartCards`, `dealPlan`

### Phase 10 — Blackjack bugs, drag/drop, invites ✅

- [x] **Cards deal** — box slots as SSOT; `dealDiagnostics` console snapshot before deal
- [x] **Chip display** — single stake amount in bet circle; no phantom denomination totals
- [x] **Drag/drop** — chips drop directly on any circle; claim-on-drop for open boxes
- [x] **Stake + banker** — same setup screen (“Playing for” + who is bank)
- [x] **Local invites** — mailto/copy placeholder; owner metadata; sidebar invite list
- [x] **Shuffle to start** — renamed button; Cards primary after shuffle

### Phase 11 — Blackjack stake SSOT, shuffle flow, ledger hidden ✅

- [x] **`getStakeForBox` SSOT** — table display, Card View, Cards check, timer auto-deal, and deal plan all use one helper (`tableMeta.boxStakes`)
- [x] **Dev deal sanity** — `[SXMCards] dealSanity` console logs (not production UI)
- [x] **Ledger hidden** — white side ledger panel removed during normal Blackjack play; duplicate box summary not shown beside table
- [x] **Box display** — initials/name, Available balance, Stake (compact)
- [x] **Chip tray** — removed “Drag or tap into a box”; CHIPS + 1/2/5/10 only
- [x] **Chip rendering** — actual placed chips only (`StakeChips`); no auto-rendered fake stacks after confirm
- [x] **Shuffle/countdown/dealing flow** — betting before shuffle → Shuffle to start locks bets → countdown → deal; later rounds Start round + Shuffle fresh shoe
- [x] **Dealing speed** — Fast / Normal / Slow preset in settings (`autoDealDelayMs`)
- [x] **Profile required** — local name/email at table start; no Guest labels when profile unset

### Phase 12 — Stitch design system + mobile gameplay fix ✅

- [x] **Design tokens** — `src/styles/tokens.css` (primary green, gold, navy, typography, spacing, shadows)
- [x] **Design system** — `src/styles/design-system.css` (`ds-panel`, `ds-btn`, `ds-bet-circle`, `ds-chip`, modals)
- [x] **Card View redesign** — SXMCARDS header, compact layout, Stay / Hit me action bar; same state/protocol as Table View
- [x] **Card View turn controls** — auto-focus active box; `[SXMCards] cardViewTurn` dev logs; waiting state when viewing non-active box
- [x] **Compact mobile layout** — one-line game header, mini box strip, compact bet row; one-screen goal
- [x] **Bank pacing** — random `bankDrawMinDelayMs`–`bankDrawMaxDelayMs` (2–5s); `bankStandPauseMs` + `bankingDisplayMs` before payout
- [x] **Bank messages** — Bank thinking… / Bank draws. / Bank stands on N / Bank busts.
- [x] **Table View refinement** — luxury felt gradients, compact dealer block, gold turn glow
- [x] **Reference UI** — `reference-ui/README.md` documents Stitch asset placement

### Phase 13 — Blackjack gameplay correctness ✅

- [x] **Card View controls** — fixed bottom **Stay** / **Card** dock on active turn; “Box N turn” + “Controlled by: …”; visible without scrolling
- [x] **Hand SSOT** — Card View uses `gameState.blackjack.round.playerHands[activeHandKey].cardIds` only; no independent local card state
- [x] **Hit append fix** — Card/Hit appends one card; existing cards preserved; Table View and Card View stay in sync
- [x] **Stay progression** — stand completes hand → next active staked box → bank phase when none remain; auto-focus next box in Card View
- [x] **Box controller model** — one controller per box; passive stakers as “Also staked by”, not controllers
- [x] **Action enablement** — Card/Stay enabled only on active hand during `player-turns`; disabled reason shown otherwise
- [x] **Dev logs** — `[SXMCards] hit`, `[SXMCards] stay`, `[SXMCards] cardViewTurn`

### Phase 15 — Blackjack UX & protocol ✅

- [x] **Full Table player controls** — Stay / Hit / 2× / Split / AID during active box turn
- [x] **Simplified round flow** — Shuffle to start → Deal Cards; no auto-countdown by default (`cardTimerPreset: 0`)
- [x] **Cards persist after payout** — cleared only on next Deal Cards
- [x] **Account box** — compact right-side initials, chips, stack, controlled boxes (replaces bottom bankroll row)
- [x] **Play Ledger** — toolbar modal for table chip/action history
- [x] **Score Ledger** — placeholder modal for wager/outcome ledger (coming next)

### Phase 16 — Account, chips, rules & tokens ✅

- [x] **Larger account box** — name, available chips, betting total, boxes controlled, real chip stack
- [x] **50 chip** + **Change 50** visual toggle (breaks 50s into 10s; no ledger/balance change)
- [x] **Larger betting chips** — centered stake amount + actual staked chips only
- [x] **Token assignment** — owner **Assign chips** control; buy-in/top-up via ledger
- [x] **Las Vegas rules audit** — `settings.ts`, `protocol.ts`, `rules.ts`; 3:2 BJ, soft 17, split/double, push, insurance 2:1
- [x] **Insurance phase** — offered when dealer shows Ace (if enabled); take/decline UI
- [x] **AID rewrite** — engaging basic-strategy advice (local/deterministic)
- [x] **Rule toggles** — soft 17, insurance, max splits, double-after-split in Table settings

### Phase 17 — Chip allocation fix ✅

- [x] **New game setup fields** — playing for / wager, starting chips each seat, starting chips bank (default = seat)
- [x] **Ledger allocation at start** — bank buy-in on setup; box buy-in on claim via `startingChipsEachSeat`
- [x] **Assign chips modal** — owner-only: bank / box / all boxes, amount, reason (starting allocation, top-up, adjustment)
- [x] **No silent balances** — every chip movement is a ledger entry
- [x] **Debug logs** — table setup confirmed, bank/box allocation, assign chips submitted
- [x] **Saved game migration** — `startingChipsEachSeat` / `startingChipsBank` on load

### Phase 18 — Allocation debug/fix ✅

- [x] **`allocateChipsToParticipant`** — single ledger allocation helper for bank + boxes
- [x] **Stable participant IDs** — ledger `playerId` = `session.bankPlayerId` or `tableMeta.boxSlots[].playerId` (controller is display-only)
- [x] **Right-side Accounts panel** — BANK and each claimed box with available + current bet
- [x] **Available chips** — ledger balance minus open-table stake before deal locks bets
- [x] **Audit logs** — setupValues, allocateBank, allocateSeat, ledgerAfterAllocation, derivedBalances, accountPanelBalances
- [x] **Bet validation** — cannot stake more than available chips

### Phase 19 — Accounts merge & box allocation fix ✅

- [x] **Single right-side Accounts block** — BANK + boxes, Assign chips button; no floating duplicate
- [x] **Box claim auto-allocation** — `startingChipsEachSeat` ledger buy-in on claim via box `playerId`
- [x] **Setup stores chip values** — `tableMeta.startingChipsEachSeat` / `startingChipsBank` on Start playing
- [x] **Audit logs** — `tableMetaStartingChips`, `claimBoxBeforeAllocation`, `claimBoxAfterAllocation`, `boxLedgerBalanceAfterAllocation`
- [x] **Removed on-table account card** — balances only in Accounts panel

### Phase 20 — Deal fix & minimum bet ✅

- [x] **`getEligibleDealBoxes`** — single eligibility helper for Deal Cards, block reason, and deal plan
- [x] **`dealCardsAudit` log** — phase, shoe, stakes, min bet, eligible boxes, deal plan before any block
- [x] **Initial deal hand-key fix** — `initialDealHandKeys` on round so `dealNextInitialCard` matches staked boxes
- [x] **Minimum bet** — `tableMeta.minimumBet` (default 5); owner edits during betting phase only
- [x] **Below-min enforcement** — warning on bet zone; confirm rejected below min; deal ignores ineligible boxes

### Phase 21 — Person bankrolls & Next Round ✅

- [x] **Person bankroll model** — ledger keyed to person id; boxes are positions with `bankrollOwnerId`
- [x] **`resolveBankrollOwnerIdForBox`** — compatibility resolver for bet/payout ledger entries + box metadata
- [x] **Accounts panel** — people with available, betting total, and box numbers (not per-box bankrolls)
- [x] **Multi-box claim** — one buy-in per person; additional boxes reuse same bankroll
- [x] **Next Round** — cards stay open after payout; Next Round clears hands and opens betting (same shoe)

### Phase 23 — Blackjack Protocol + AID Knowledge Architecture ✅

- [x] **Las Vegas Protocol** — declarative house rules; AID intel + reasoner
- [x] **Variant-ready types** — future wild cards, side bets, altered rules
- [x] **Source notes** — `docs/blackjack-intel-source-notes.md`

### Phase 24 — Protocol Platform ✅

- [x] **Three Blackjack presets** — Las Vegas house rules, European Shoe, Classic Home Table
- [x] **Protocol selector** — table setup + settings; locked after first deal
- [x] **AID protocol-aware** — advice names active protocol
- [x] **Invite scaffold** — magic link + mailto; `src/engine/table/invites.ts`
- [x] **Admin controls** — owner permission toggles (`AdminPanel`)
- [x] **Natural dealing** — instant / staged / natural modes
- [x] **Design templates** — Premium Casino, Stitch Mobile, Classic Felt
- [x] **Docs** — `docs/protocol-engine.md`

### Phase 25 — Blackjack QA & regression hardening ✅

- [x] **Engine sanity suite** — `src/engine/blackjack/sanity/` + `npm run test`
- [x] **Protocol/dealing/bankroll checks** — presets, RTL order, natural deal plan, multi-box bankroll
- [x] **Gameplay checks** — split, double, 3:2 vs 1:1, insurance gating
- [x] **QA checklist** — `docs/qa-blackjack-checklist.md`
- [x] **Debug panel** — settings toggle, local protocol/phase/accounts view
- [x] **Build/lint/test** — acceptance gate

### Phase 26 — Protocol platform hardening ✅

- [x] **Bank draw bug fix** — `dealerDraw.ts`, S17/H17, hole card at bank turn (European), draw logs
- [x] **This Table panel** — bank + people, chip breakdown, invite action
- [x] **Protocol rule updates** — double any two (Vegas), 9/10/11 (EU/Home), repeat splits, DAS
- [x] **Custom protocol builder** — types, builder, localStorage, settings UI
- [x] **Protocol messages** — `getProtocolMessage` phase-aware comments
- [x] **Join curtain** — `JoinTableCurtain` + `docs/multiplayer-invite-roadmap.md`
- [x] **Sanity tests** — bank turn, custom protocol, table people

### Phase 27 — Chip allocation audit/fix ✅

- [x] **Allocation audit** — `docs/allocation-audit.md`; duplicate routes documented
- [x] **Canonical API** — `allocateChipsToBankrollOwner(state, input)`; log `allocateChipsCanonical`
- [x] **Remove duplicate paths** — `addPlayer` no longer allocates; `startNewTable` uses person/bank ids only
- [x] **Assign chips modal** — `listPersonBankrollOwnerIds`; all-persons once per person
- [x] **Claim box flow** — reuse person bankroll; structured claim logs
- [x] **This Table + debug** — ledger-derived balances; debug bankroll id / exposure / available
- [x] **Sanity tests** — `allocationChecks.ts` (7 scenarios)
- [x] **Build/lint/test** — acceptance gate

### Phase 28 — Settlement & This Table display ✅

- [x] **Available balance** — exposure fix; debug logs `thisTableBalanceDebug`
- [x] **This Table UI** — Bank: Bot / Available; no emails or chip breakdown in panel
- [x] **Round result summary** — `buildRoundResultSummary` in Table/Card view
- [x] **Settlement idempotency** — `round.isSettled`; bank `bank-transfer` entries
- [x] **Next Round** — `ensureBlackjackRoundSettled` before reset
- [x] **Play Ledger** — round/person/box/action columns
- [x] **Sanity tests** — `settlementChecks.ts`
- [x] **Docs** — [settlement-ledger.md](./docs/settlement-ledger.md)

### Phase 29 — Table balance & end condition ✅

- [x] **Player Available display** — always shown for person bankrolls; `thisTablePlayerRow` logs
- [x] **Bank row** — Bank: Bot / Balance / ChipStack visual
- [x] **Dealer block** — bank accounting removed from center
- [x] **Game end** — `tableMeta.gameStatus`, winner, wager voucher placeholder
- [x] **Next Round** — blocked when game ended; Game Over UI instead
- [x] **Sanity tests** — `tableBalanceChecks.ts`

### Phase 31 — Phase / seat assignment ✅

- [x] **Deal Cards regression** — confirmed stake + caller eligibility; `dealBlockedAudit`
- [x] **Player order** — native Box 1/2/… from This Table order; ↑↓ reorder
- [x] **Caller rules** — native vs passive vs free box; single-player multi-box
- [x] **Sanity tests** — `phaseAssignmentChecks.ts`

### Phase 32 — Gameplay / UX ✅

- [x] **Chip tray hint** — insufficient-chips message under tray (`formatInsufficientChipsMessage`)
- [x] **Betting pull-back** — `removeLastChipFromBoxStake` + Clear; pre-deal refund logging
- [x] **Central action area** — turn line only in center status; mini-hand preview below
- [x] **Double fix** — `canDoubleBlackjackForState` uses bankroll owner + available chips
- [x] **Play Flow** — `tableMeta.personPlayFlow` + Profile setting; `processPlayFlowAutoStands`
- [x] **Bust** — immediate `settleBustHandOnState`; cards retract; no double settlement
- [x] **Game over copy** — `buildGameOverSummary`; no duplicate dealer/card-view message
- [x] **Score Ledger** — `src/types/scoreLedger.ts`, engine + localStorage; modal history
- [x] **Sanity tests** — `gameplayUxChecks.ts`

### Phase 33 — Protocol correctness ✅

- [x] **activeRules adapter** — `protocols/activeRules.ts`; all double/split/hit/stand/bet/dealer checks route through it
- [x] **Bust / all-bust** — immediate settlement; `shouldSkipBankDraw` when no live player hands remain
- [x] **Natural blackjack** — `naturalBlackjack.ts`; 3:2 immediate vs weak up-card; even-money UI vs Ace/10
- [x] **Double / split** — protocol totals; one card on double; split stake charged once; J/J by rank
- [x] **Play Flow default** — Auto-stand 18+; skips naturals and busts
- [x] **Bet retraction** — pre-deal chip removal with min-bet multiple validation
- [x] **Min bet multiples** — `isBetValidUnderProtocol`; tray hint `Bet must be a multiple of N.`
- [x] **Sanity tests** — `protocolCorrectnessChecks.ts`
- [x] **Docs** — README, protocol-engine, settlement-ledger

### Phase 34 — Wager, insurance, UX fixes ✅

- [x] **Wager display** — `getTableWagerDisplay()` uses `stakeDescription` ($5), not `defaultChips` (500)
- [x] **Top-chip ×** — `StakeChips` removable top chip in betting circles
- [x] **Insurance gating** — `applySkipBankIfNeeded` + `allInsuranceDecisionsResolved` via activeRules; multi-box
- [x] **Personal ledger offer** — manual `addGameToPersonalLedger` after game ended
- [x] **Invite LAN link** — `getTableInviteOrigin()` + simplified Invite modal
- [x] **Tests** — wager amounts, insurance wait, ledger add, LAN host

## Next step

**Phase 22:** Hold'em table polish, round summary panel.

### Phase 22 — UX polish

1. Hold'em casino-style table layout
2. Round summary panel
3. Touch-native chip drag (beyond tap fallback)
4. Optional Ledger button to reveal side panel during play

### AI assistant (post-MVP)

Separate module; never wired into live rule resolution.

## Data models (defined in `src/types/`)

- **GameSession** — id, game type, status, players, deck ref, round, bank player, ledger
- **Player** — internal seat/box record; `displayName` is box label; optional `controllerName` = person playing that box
- **Deck / Card** — suit, rank, shuffled order, dealt pile
- **LedgerEntry** — id, timestamp, round, player, type, amount, balance before/after, description

## Tech choices

| Choice | Rationale |
|--------|-----------|
| Vite + React + TypeScript | Fast dev, SPA, scales to full UI without backend |
| Pure TS engine | Deterministic, testable, no AI in gameplay path |
| CSS variables + mobile-first | Lightweight; Framer Motion added in Phase 5 if needed |
| localStorage | Spec 1.0 persistence; no backend |

## Out of scope (Spec 1.0)

Real-money features, payments, auth, online multiplayer, AI gameplay control, all-in side pots (deferred), overall balance carry-over (deferred).
