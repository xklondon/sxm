# Online / Offline Gameplay Parity

Goal: online (server-authoritative multiplayer) and offline (single-browser local)
play produce **identical game state**. They differ only in **transport/storage**
and in **rendering/animation**. Mobile vs desktop and Card View vs Full Table are
rendering-only differences.

- **Online** = actions `POST /api/tables/:id/actions` → server applies engine →
  Socket.IO `table:update` broadcasts state.
- **Offline** = actions apply locally via the same engine functions.

## Canonical action path

```
applyBlackjackActionToState(state, action, ctx)   // src/engine/blackjack/applyBlackjackAction.ts
```

| Action | Engine call (offline + online identical) |
|--------|-------------------------------------------|
| `shuffleToStart` | `shuffleToStartOnState` |
| `dealCards` | `syncBankPhaseOnState(processPlayFlowAutoStands(dealCardsButtonOnState))` |
| `hit` / `stand` / `double` / `split` | `*BlackjackOnState` on `activeHandKey` (client `handKey` ignored) |
| `takeInsurance` / `declineInsurance` | `*InsuranceOnState(state, payload.playerId)` |
| `takeEvenMoney` / `waitFor3to2` | `*OnState(state, payload.handKey)` |
| `nextRound` | `startNextRoundOnState` |

`ctx.resolveBankAuto`:

- **Server (online): `true`** — the auto bank turn + settlement are played out
  inside the same action via `resolveBankTurnAuto` so every client receives one
  identical settled state. No client-local bank/settlement.
- **Offline: `false`** — the bank turn is animated card-by-card by a client effect;
  its final frame equals the server's resolved state (same engine, same order).

Pure table/session ops (`assignBox`, `placeBet`, `retractChip`, `clearBet`,
`addGameToPersonalLedger`) stay in `server/src/tables/applyAction.ts` directly —
they touch seating/stakes/ledger only and already share engine functions.

## Transport-only / rendering-only differences (allowed)

| Concern | Offline | Online | Parity |
|---------|---------|--------|--------|
| Initial deal pacing | `instant` / `stepwise` / `natural` (client effect) | one `dealCards` action | Final dealt state identical |
| Bank draw | animated card-by-card (client effect) | resolved server-side in-action | Final settled state identical (`resolveBankTurnAuto`) |
| Next round | local `startNextRoundOnState` | `nextRound` action (host) | Reset state identical |
| View mode | client-local | client-local | Not game state |

## Guards (no local gameplay mutation online)

In `useBlackjackTableFlow.ts`, when `onlineDispatch` is present these effects
early-return (server is authoritative):

- post-deal auto-stand (`processPlayFlowAutoStands`)
- natural deal pacing
- auto bank draw + settlement
- manual bank display
- `handleNextRound` → dispatches `nextRound` instead of mutating locally

## Shared UI selectors (no per-view eligibility)

All views read from `src/components/blackjackViewPhase.ts`:

- `getBlackjackRoundPhase(state)` — canonical phase
- `allowsBettingActions(state)` — betting open/closed
- `getActionableHandForView(state, personId, online)` — the only source of
  HIT/STAY/DOUBLE/SPLIT eligibility; returns the active hand only if the viewer
  is its box caller. A box is actionable only if it matches `activeHandKey`.

## Tests

- `src/engine/blackjack/onlineOfflineParity.test.ts` — server reducer vs offline
  engine pipeline for deal/stand/hit and full-round settlement + next-round reset.
  Comparison normalizes generated ids/timestamps; compares phase, `activeHandKey`,
  hands/cards/status, stakes, balances, and gameplay ledger entries.
- `src/components/actionableHand.test.ts` — selector parity across views; betting
  open/closed; auto-stand 18+ disables hit.
- `server/tests/tableActions.test.ts` — online round settles server-side; `nextRound`
  resets stakes and is host-gated.

## Known remaining divergences / risk

- **Online bank draw is not animated** — it resolves server-side in one step, so
  online players see the bank result without the card-by-card reveal. Game state
  is identical; only the animation differs (acceptable rendering difference).
- **`nextRound` is host-only online** (matches `dealCards`/`shuffleToStart`).
  Offline, any local user advances. Non-host clients get a host-only rejection.
- **Flow settings** (deal mode, bank draw mode, play-flow / auto-stand threshold)
  have no online action — online uses table defaults (instant deal, auto bank).
  Changing these mid-game online is not supported.
