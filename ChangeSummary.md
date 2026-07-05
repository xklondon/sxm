# Change Summary — Blackjack canonical flow cleanup

## Duplicate paths removed

| Before | After |
|--------|-------|
| Private `getProtocolPhase()` in `dealEligibility.ts` | Single mapper: `getBlackjackProtocolPhase()` from `protocol.ts` |
| Offline panel passed `actionable.handKey` to hit/double/split | Offline uses `activeHandKey` only (same as server/`applyBlackjackActionToState`) |
| Mobile Full Table skipped split-host cluster (`deviceView === 'desktop'`) | Split companion tiles render on mobile Full Table too |

## Canonical flow changes

1. **Phase mapping** — Deal eligibility and min-bet change checks use the same phase source as all views; insurance during initial deal maps to `dealing`, not `insurance`.
2. **Player actions** — `BlackjackPanel` hit/double/split call `*OnState(s)` without handKey override.
3. **Reveal regression** — Tests guard against visibility regression on hit, double, split, and resplit (`:2`) hands outside `initialDealHandKeys`.
4. **Mobile split parity** — `.bj-view-full-mobile` CSS + split-host cluster in `renderArcSlot` (real hand keys, companion left of main).
5. **Co-staker split rule** — Documented and tested: caller split funds all participating stakers proportionally; per-staker opt-in marked TODO in spec + `round.ts`.

## Files changed

- `src/engine/blackjack/dealEligibility.ts`
- `src/engine/blackjack/dealEligibility.test.ts` (new)
- `src/engine/blackjack/round.ts`
- `src/engine/blackjack/splitAction.test.ts`
- `src/engine/blackjack/dealing/cardRevealGameplay.test.ts`
- `src/components/BlackjackPanel.tsx`
- `src/styles/bj-player-row-layout.css`
- `docs/SXM_MASTER_SPEC.md`
- `docs/CHANGE_LOG.md`

## Tests

**Targeted:** 32/32 passed

```
dealEligibility.test.ts, splitAction.test.ts, cardRevealGameplay.test.ts,
blackjackStabilityContracts.test.tsx
```

**Full suite:** 346 files, **2448 passed**, 5 skipped — 81.7s

**Build:** `npm run build` — success

## Spec discipline

Checked/updated `SXM_MASTER_SPEC.md` and `CHANGE_LOG.md`.
