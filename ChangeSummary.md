# Change Summary — Remove separate bank timer; unified card timing engine

## Timing sources found (audit)

| Source | Location | Status |
|--------|----------|--------|
| `cardTimerPreset` / Turn timer | `BlackjackFlowSettings`, `TableStakePanel` | **Removed from UI**; forced to 0 |
| `getBankTurnDelayMs` / bank-turn-start | `flowSettings.ts`, `useBlackjackTableFlow` | **Removed** — bank loop no longer sleeps |
| `bank-card-draw` / `bank-pause` contexts | `getCardDealDelayMs` | **Deprecated** — all contexts same delay |
| `resolveCardRevealDelayMs` bank branches | `cardRevealDisplay.ts` | **Removed** — calls `getNextCardDelay` only |
| Extra hole/result pre-reveal holds | `useSequentialCardReveal` | **Removed** — one delay via `scheduleNextCardReveal` |
| `bankAutoDrawDelayMs`, `bankDrawMin/Max` | `flowSettings` | Synced from preset; not used for separate pacing |
| Auto bank async draw loop | `useBlackjackTableFlow` | **Refactored** — one draw per `cardRevealComplete` cycle |

## Canonical timing path

```
useSequentialCardReveal
  → scheduleNextCardReveal(state)
    → getNextCardDelay(state, settings)   // fixed preset/custom or random min/max

useBlackjackTableFlow (auto bank)
  → drawBankCardOnState when cardRevealComplete  // WHAT only, no WHEN
```

Presets: **1s / 2s / 3s (default) / 5s / custom** + optional random timing.

## Files changed

- `src/engine/blackjack/flowSettings.ts` — `getNextCardDelay`, `medium` + `custom` presets
- `src/engine/blackjack/dealPacing.ts` — `scheduleNextCardReveal`
- `src/engine/blackjack/dealing/cardRevealDisplay.ts` — unified delay
- `src/hooks/useSequentialCardReveal.ts` — single scheduler
- `src/components/useBlackjackTableFlow.ts` — reveal-gated bank draw; no bank timer
- `src/components/BlackjackFlowSettings.tsx` — card deal speed + random; bank timer removed
- `src/components/TableStakePanel.tsx` — turn timer removed
- `src/components/DealerBlock.tsx` — speed cycle labels
- `src/storage/settingsStorage.ts`, `src/engine/session/tableSetup.ts` — ignore legacy timer
- Tests: `cardTimingEngine.test.ts` (new), `bankTurnPacing`, `dealTimingConsistency`, others updated
- `docs/SXM_MASTER_SPEC.md`, `docs/CHANGE_LOG.md`

## Targeted test results

Run: `npx vitest run src/engine/blackjack/cardTimingEngine.test.ts src/engine/blackjack/bankTurnPacing.test.ts src/engine/blackjack/dealTimingConsistency.test.ts src/engine/blackjack/dealPacing.test.ts src/engine/blackjack/flowSettings.test.ts --reporter=verbose`

## Spec discipline

Checked/updated `SXM_MASTER_SPEC.md` and `CHANGE_LOG.md`.
