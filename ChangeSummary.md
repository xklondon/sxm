# Change Summary — Blackjack round transition after auto-stop (18+)

## Root cause

1. **Protocol phase mismatch:** `getBlackjackProtocolPhase` treated `status === 'resolved'` as `'betting'`, so the command box could show betting/player-turn prompts while the round was still in round-complete (`awaitingNextRound`).
2. **Stale temporary commanders:** `callerPersonId` on box slots/stakes was not cleared at settlement — only on explicit New Cards — so commander resolution could leak into the inter-round window.
3. **Command builder gap:** `buildBlackjackCommandText` could emit player-turn lines when `protocolPhase === 'player'` even if the round was not in `player-turns` or was awaiting New Cards.
4. **Co-staked display:** Arc slot labels showed only combined `betAmount`, hiding per-player contributions.

## Fixes

| Area | Change |
|------|--------|
| Protocol | `resolved` → `round-complete` (not `betting`) |
| Settlement | `completeBankingOnState` calls `clearTemporaryBoxCommandState` |
| Commander | `resolveBoxRoundCommander` returns null when `awaitingNextRound` or `resolved` |
| Reset helpers | `clearTemporaryBoxCommandState`, `resetBlackjackRoundForBetting` (alias) exported from session |
| Command box | Early return for `awaitingNextRound`; player-turn block requires `status === 'player-turns'` + `activeHandKey` |
| Stake UI | `formatBoxStakeDisplayLabel` / `getBoxStakeBreakdown` wired into `BlackjackPanel` betting labels |
| Deal gate | Unchanged — already blocks when `awaitingNextRound` or round in play |

## Files changed

- `src/engine/blackjack/protocol.ts`
- `src/engine/blackjack/dealEligibility.ts`
- `src/engine/blackjack/gameState.ts`
- `src/engine/blackjack/stakes.ts`
- `src/engine/blackjack/index.ts`
- `src/engine/session/resetBlackjackRoundOwnership.ts`
- `src/engine/session/boxRoundCommander.ts`
- `src/engine/session/index.ts`
- `src/components/tableCommandDisplay.ts`
- `src/components/BlackjackPanel.tsx`
- `docs/SXM_MASTER_SPEC.md`
- `docs/CHANGE_LOG.md`

## Tests added/updated

- `src/engine/blackjack/blackjackRoundTransition.test.ts` (new) — 6 cases:
  - Three boxes auto-stop 18+ → bank → resolved: no stale command, commanders cleared, deal blocked
  - New Cards → clean betting → deal after re-stake
  - Native box commanded by other staker; reset after round; native assignment kept
  - Co-staked breakdown label (120 + 80, not single 200)
  - Split hands removed before next betting
  - `resolved` never maps to betting protocol phase
- `src/components/tableCommandDisplay.test.ts` — awaitingNextRound blocks stale player-turn command

## Validation

```
npx vitest run src/engine/blackjack/blackjackRoundTransition.test.ts \
  src/components/tableCommandDisplay.test.ts \
  src/engine/session/boxRoundCommander.test.ts
→ 30 passed

npm run build → pass
```

After `resolved → awaitingNextRound`: `activeHandKey` null, `callerPersonId` null on all slots, `getCallerPersonIdForBox` null, deal blocked until New Cards + fresh stakes.

**Spec discipline: checked/updated SXM_MASTER_SPEC.md and CHANGE_LOG.md.**
