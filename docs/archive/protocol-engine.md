# Protocol Engine

SXMCards separates **games**, **rule protocols**, **design templates**, and **table governance** into distinct layers.

> **Las Vegas Protocol** = SXMCards house rules — inspired by Vegas-style play, **not** official universal casino rules.

## Games vs protocols

| Layer | Role |
|-------|------|
| **Game** | Blackjack, Texas Hold'em — core engine modules under `src/engine/blackjack/` and `src/engine/holdem/` |
| **Protocol** | Declarative house-rule preset — decks, dealer draw, payouts, double/split/insurance, dealing rules, AID profile |
| **Design template** | Visual tokens only — colors, typography, density; no gameplay logic |
| **Table admin** | Local permission toggles for owner vs invited players |

A game reads its active protocol at runtime via `GameState.blackjackProtocolId`.

## Blackjack protocol presets

Three built-in presets:

1. **Las Vegas Protocol — house rules** (`las-vegas-house`) — default; 6 decks, S17, 3:2, insurance; **double any first two cards**; repeat splits
2. **European Shoe** (`european-shoe`) — 6 decks, no insurance, hole card at bank turn; **double hard 9/10/11**; DAS
3. **Classic Home Table** (`classic-home`) — 2 decks, even-money naturals; **double hard 9/10/11**; DAS

### Dealer draw

- Engine: `src/engine/blackjack/dealerDraw.ts`, `bankTurn.ts`
- Hit below 17; stand hard 17+; S17 vs H17 for soft 17
- European `holeCardDealtLast`: second dealer card dealt at bank turn if missing
- Logs: `dealerDrawDecision` with total, isSoft, protocol id, `shouldDealerDraw`, transition reason

### Double / split (Phase 26 → 33)

| Preset | Double | Splits |
|--------|--------|--------|
| Las Vegas | Any first two cards | Repeat up to cap (8); same rank |
| European / Home | Hard 9, 10, 11 only | Repeat up to cap; double after split |

**Phase 33 — single rule source:** `src/engine/blackjack/protocols/activeRules.ts`

All gameplay rule checks must call this adapter — not scattered helpers or UI-only logic:

| Function | Purpose |
|----------|---------|
| `canDoubleUnderProtocol` | First-two-cards, hard-total limits, bankroll, DAS |
| `canSplitUnderProtocol` | Pair rank, max splits, bankroll |
| `canHitUnderProtocol` / `canStandUnderProtocol` | Turn + hand status guards |
| `getAllowedActionsForHand` | Unified action list (incl. even-money, insurance) |
| `getBlackjackPayout` / `getInsuranceRules` / `getDealerPeekPolicy` | Payouts and peek |
| `getDealerDrawDecision` | Bank draw vs stand |
| `isBetValidUnderProtocol` | Min bet + **multiple-of-min** validation |
| `shouldPayNaturalImmediately` / `shouldOfferEvenMoney` | Natural blackjack flow |

State-aware UI guards: `canDoubleBlackjackForState`, `canSplitBlackjackForState` in `validation.ts` delegate to `buildActiveRulesHandContext` + adapter.

**Insurance (Phase 34):** When dealer shows Ace, `insuranceOfferPending` blocks bank draw (`roundFlow.applySkipBankIfNeeded`). Eligibility via `isHandEligibleForInsuranceOffer`, `getInsuranceEligiblePlayerIds`, `allInsuranceDecisionsResolved` — skips busted/natural-resolved hands. All active eligible boxes must accept or decline before peek/resolution continues.

Files:

- `src/engine/blackjack/protocols/types.ts` — variant-ready schema
- `src/engine/blackjack/protocols/lasVegasProtocol.ts`
- `src/engine/blackjack/protocols/europeanShoeProtocol.ts`
- `src/engine/blackjack/protocols/classicHomeProtocol.ts`
- `src/engine/blackjack/protocols/index.ts` — registry + `protocolToBlackjackSettings()`

Protocol is chosen at **table setup** and in settings until first deal locks it (`tableMeta.protocolLocked`).

## Custom protocol builder

Local-only scaffold — no arbitrary code execution.

- Types: `src/engine/protocols/customProtocolTypes.ts`
- Builder: `src/engine/protocols/customProtocolBuilder.ts`
- Storage: `src/storage/customProtocolStorage.ts`
- UI: `CustomProtocolBuilder` in table settings

**Rule types:**

| Type | Enforced by engine? |
|------|---------------------|
| `executable` | Schema stored; safe subset may run later; others marked “not yet executable” |
| `social` | Shown in protocol instructions / `getProtocolMessage` reminders only |

Custom protocols inherit base preset engine rules and appear in the protocol selector as `custom:{uuid}`.

## Protocol table messages

`getProtocolMessage(state, phase, context)` in `protocolMessages.ts` drives center status / betting hints:

- Default phase messages
- Protocol double-rule hints
- Custom social rule reminders
- Custom protocol message overrides
- When shoe is ready and eligible stakes exist: **Ready — press Deal Cards.**

## Blackjack phase flow (Phase 31)

Explicit round phases:

1. **Betting** — place confirmed stakes (≥ min bet); shuffle prepares shoe (bets stay open)
2. **Deal Cards** — all playable boxes with confirmed stake + valid caller
3. **Dealing** — initial cards (stepwise or natural)
4. **Insurance** — when protocol offers and dealer shows Ace
5. **Player** — caller for each box decides Hit/Stay/Split/Double/AID; naturals may pay immediately or offer even-money
6. **Bank** — dealer draw
7. **Banking** — payout settlement
8. **Next Round** — or Game Over when end condition met

Deal eligibility (`getEligibleDealBoxes`): playable box position · `isBoxStakeConfirmed` · stake ≥ `minimumBet` · valid `callerPersonId`. Block audit log: `[SXMCards] dealBlockedAudit`.

## Native assigned boxes & caller rules

**This Table player order** (`tableMeta.playerOrder`) assigns native boxes: first player → Box 1, second → Box 2, etc. Owner can reorder with ↑↓ controls.

| Concept | Rule |
|---------|------|
| Native box | Slot assigned by player order |
| Caller | Person who calls Hit/Stay/Split/Double for that box |
| Passive bettor | May stake on another player's native box; does **not** become caller |
| Free box | No native assignee; first staker becomes caller for the round |
| Single player | May call every box they stake |

Box state: `nativeAssignedPersonId`, `callerPersonId` (locked at deal). Passive stake contribution settlement uses existing bankroll-owner model (limitation documented — no per-contributor payout split yet).

## AID protocol-aware reasoning

AID (`src/engine/blackjack/aid/aidReasoner.ts`) receives the selected protocol and prefixes advice with `[Protocol name]`.

## Invite / magic-link architecture

Local scaffold — no backend email or live sync yet. See [multiplayer-invite-roadmap.md](./multiplayer-invite-roadmap.md).

- Types: `src/types/invites.ts`
- Engine: `src/engine/table/invites.ts`
- Magic link: `/join-table?tableId=...&inviteId=...&token=...`
- UI: `InviteModal` (mailto/copy); **This Table** panel invite button
- Join curtain: `JoinTableCurtain` — parse params, name/email form, “coming online next”

## Admin controls

Local owner toggles in `AdminPanel` — assign chips, change protocol/design, invite permissions.

## Design templates

Visual only — `src/design/templates/`. Do not encode gameplay in templates.

## Tests

```bash
npm run test
```

Includes bank-turn (dealer 13 draws), protocol double rules, custom protocol save/load, This Table people rows, phase assignment, **protocol correctness** (bust, all-bust skip bank, naturals, min-bet multiples, activeRules adapter).
