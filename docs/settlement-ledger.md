# Settlement & Play Ledger (Phases 28–29)

Local chip accounting only — no payments or real-money processing.

## This Table display model (Phase 29)

**Right panel (This Table)** is the only place for bank/person chip accounting.

| Row | Format |
|-----|--------|
| Bank | `Bank: Bot` (or person name) · `Balance: N` · visual `ChipStack` |
| Person | Name · Status · `Available: N` · `Betting: N` (if > 0) · `Boxes: 1, 2` |

- Person rows always show **Available** when they have a bankroll record (`showBalance: true`).
- Owner status is applied to the real person row — no duplicate owner placeholder with zero balance.
- Emails are not shown in This Table (still stored in `tableMeta.owner`).

Logs: `[SXMCards] thisTablePlayerRow` with `personId`, `name`, `ledgerBalance`, `exposure`, `available`, `betting`, `boxes`.

**Central dealer block** shows only: Blackjack title, playing-for stake, minimum bet, shoe info, dealer cards, phase button. It does **not** repeat bank identity or balance.

## Available balance (This Table)

**Available = ledger balance − active betting exposure**

| Phase | Exposure source |
|-------|-----------------|
| Open betting (unlocked) | Open box stakes (`boxStakes`) |
| Mid-round (locked) | Confirmed in-round bets across all hands |
| After settlement / awaiting Next Round | **0** — chips are in ledger totals |

Logs: `[SXMCards] thisTableBalanceDebug` with `personId`, `ledgerBalance`, `exposure`, `available`, `ledgerEntriesForPerson`.

## Settlement timing

1. **Bet placed** — `bet-placed` deducts from person bankroll (and optional `bet-increased` on double).
2. **Bank turn completes** — cards stay visible; center status shows bank total.
3. **Banking phase** — auto/manual pause, then `completeBankingOnState` runs settlement once.
4. **Round resolved** — `round.isSettled = true`; per-box outcomes in `round.outcomes`; result summary in UI.
5. **Next Round** — idempotent; calls `ensureBlackjackRoundSettled` if needed, then clears stakes and starts new betting round (same shoe).

### Idempotency

- `BlackjackRound.isSettled` prevents duplicate payout ledger entries.
- `resolveBlackjackRound` returns immediately when already settled.
- `ensureBlackjackRoundSettled` safe to call from Next Round.

## Bank bankroll

The house bank is tracked in the table ledger (This Table shows **Bank: Bot / Balance: N**).

| Outcome | Player ledger | Bank ledger |
|---------|---------------|-------------|
| Loss | Bet already deducted; `loss-collected` audit | `bank-transfer` +bet |
| Win 1:1 | `win-paid` +2×bet | `bank-transfer` −winnings |
| Push | `push-refund` +bet | No change |
| Blackjack 3:2 | `win-paid` bet + 1.5×bet | `bank-transfer` −1.5×bet |
| Insurance win | `win-paid` insurance payout | `bank-transfer` −insurance winnings |
| Insurance loss | Bet already deducted | `bank-transfer` +insurance bet |

## Play Ledger

All movements append to the session ledger with:

- `roundNumber`
- `playerId` (person or bank bankroll id)
- `boxPlayerId` / `boxSlotNumber` when box-related
- `entryType`: bet-placed, win-paid, push-refund, loss-collected, bank-transfer, etc.

The Play Ledger modal lists round, person, box, action, amount, and balance after.

## Round result summary

After settlement, center status shows lines like:

```
Bank has 20.
Box 1: 19 loses — bank takes 5.
Box 2: 21 wins — K wins 10.
```

Generated from `buildRoundResultSummary(state)` — not hard-coded.

## Game end condition (Phase 29)

`tableMeta.gameStatus`: `active` | `ended`

End triggers (evaluated after settlement via `evaluateTableGameEnd`):

- One holder has **all** table chips (bank or person)
- Bank has all chips after players eliminated
- Bank ledger/available is zero and a player holds the remainder
- All non-bank persons have 0 available, 0 betting, and 0 ledger

When ended:

- `tableMeta.winnerId`, `endedAt`, `wagerVoucherStatus: 'pending'`
- Betting/dealing disabled (`canStartCards` returns false)
- UI shows a **single centered message** (no duplicate in dealer block or card view):
  ```
  Bank Bot won!!
  Alice owes you: $500
  ```
  Built by `buildGameOverSummary` — winner line + owes line from table agreement.
- A **Score Ledger** entry is appended locally (`sxmcards:score-ledger:v1`) — see below.
- **Next Round** is hidden; `startNextRoundOnState` throws if game ended

## Natural blackjack & even money (Phase 33)

After initial deal, `resolveNaturalsAfterInitialDeal`:

| Dealer up-card | Player natural | Behavior |
|----------------|----------------|----------|
| Not Ace / 10-value | Yes | Pay 3:2 (or protocol multiplier) immediately; hand `done` |
| Ace or 10-value | Yes | Offer **even money (1:1)** or wait for 3:2 after dealer peek |
| Any | Dealer also BJ | Push (unless protocol differs) |

Engine: `src/engine/blackjack/naturalBlackjack.ts`

- `takeEvenMoneyOnState` — 1:1 payout now
- `waitForBlackjackPayoutOnState` — decline even money; resolve after peek via `resolvePendingNaturalsAfterDealerPeek`

UI: minimal “Take 1:1” / “Wait for 3:2” buttons when `round.evenMoneyOfferHandKey` is set. Naturals are never offered Hit/Stay.

## Bust behavior (Phase 32 → 33)

When a hand busts during play:

1. `settleBustHandOnState` — `loss-collected` + `bank-transfer` once (`bustSettled` flag)
2. Cards cleared from that box display
3. Result message: **BUST, my friend.**
4. Turn advances to next active box
5. `resolveBlackjackRound` skips `bustSettled` hands (no double deduct)

**All bust:** if every active box/hand is busted or otherwise eliminated, `applySkipBankIfNeeded` skips bank drawing and completes the round — bank already collected stakes. Message: *All players busted — bank wins this round.*

Engine: `roundFlow.ts` — `shouldSkipBankDraw`, `ALL_PLAYERS_BUST_MESSAGE`

## Betting chip removal (Phase 32 → 33)

During open betting (`bettingLocked === false`), before **Deal Cards**:

| Action | Engine | Effect |
|--------|--------|--------|
| × on betting circle | `removeLastChipFromBoxStake` | Removes last chip from `boxStakes`; logs refund |
| Clear | `clearBoxStake` | Clears all pending chips for that box |

- Available balance restores immediately (exposure drops with `boxStakes`).
- No ledger movement until cards are dealt and bets are placed in-round.
- After deal, bets lock — pull-back is disabled.
- **Confirmed stakes** must be **multiples of minimum bet** (`isBetValidUnderProtocol`); chip tray shows `Bet must be a multiple of N.`
- **Top-chip ×** — click × on the latest chip in a betting circle to remove one chip (`removeLastChipFromBoxStake`); logs betting-phase refund; Clear removes all

## Per-player Play Flow (Phase 32 → 33)

`tableMeta.personPlayFlow[personId]` or Profile **Play Flow** (default: **Auto-stand 18+**):

| Setting | Behavior |
|---------|----------|
| Manual | Caller chooses Hit/Stay |
| Auto-stand 18+ … 21 | When that person's box reaches threshold, engine stands automatically |

Engine: `processPlayFlowAutoStands` after player actions and on turn advance. Applies only to boxes that person controls (caller rules unchanged). Skips naturals, even-money offers, and busted hands.

## Wager vs starting chips (Phase 34)

| Field | Meaning | Example |
|-------|---------|---------|
| `agreement.stakeDescription` | Honor-system “playing for” label | `$5`, dinner |
| `agreement.defaultChips` / `startingChipsEachSeat` | Virtual chips at the table | 500 |

UI **Playing for** uses `getTableWagerDisplay()` → `stakeDescription` only. Game-over summary and Score Ledger use the same wager text.

## Personal ledger offer (Phase 34)

After `gameStatus === 'ended'`, the table shows **Add game to personal ledger** (opt-in). `addGameToPersonalLedger` appends to Score Ledger (`localStorage`) with table id, players, owed direction, timestamp, status `open`. Not offered mid-round; not auto-added at game end.

## Invite join link (Phase 34)

`getTableInviteOrigin()` — `VITE_TABLE_HOST` → non-localhost `window.location` → `http://192.168.0.56:5137` dev fallback. Invite modal shows copyable join link; email/mailto hidden unless `VITE_EMAIL_INVITES=true`.

## Score Ledger vs Play Ledger

| Ledger | Records | Storage |
|--------|---------|---------|
| **Play Ledger** | Every chip action — bets, wins, losses, bank transfers, per round | Session `ledger` in game state |
| **Score Ledger** | Wager-level outcome — who owes whom for what you agreed to play for | `localStorage` key `sxmcards:score-ledger:v1` |

Score entry fields: `wagerDescription`, winner/loser names, `owedDescription`, `status` (`open` | `settled` | `cancelled`).

Created at game end via `recordScoreLedgerForGameEnd` — honor-system only, no payment handling.

## Related docs

- [allocation-audit.md](./allocation-audit.md) — chip allocation (Phase 27)
- [protocol-engine.md](./protocol-engine.md) — payout rules by protocol
