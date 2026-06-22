# Change Summary — Table Layout Engine v1.1.1 (desktop cards zone regression fix)

**Scope:** Blackjack desktop layout only. No gameplay, betting, IOU, ledger, auth, Zilch, or routing changes.
v1.1 command/dealer/baseline fixes preserved.

## Root cause

**Both regressions share one failure mode: the `cards` `1fr` row collapsed or mis-pinned.**

1. **Desktop Full Table — vertical card column over box values.** v1.1 set the cards zone to
   `justify-content: flex-start` and moved lift to shell `padding-bottom`, while also removing `felt-main
   height:100%`. The `1fr` cards row lost definite height; the bottom-pinned arc lost its overlap band geometry,
   so per-box stacks rendered as full-height columns extending into the player-box value band instead of tight
   upward-overlapping stacks above it.

2. **Desktop Card View — hero cards invisible.** With `--bj-zone-cards-min-height: 0` and no definite
   `felt-main` height, the cards zone computed to ~0. Hero uses `height: 100%` + container-query sizing —
   100% of 0 = invisible. DOM was present (tests passed) but CSS dimensions collapsed.

## Files changed

- `src/styles/bj-blackjack-table-shell.css`
  - Card View: `--bj-zone-cards-min-height: min(6.5rem, 20%)` (responsive, absorbed by 1fr).
  - Full Table cards zone: `justify-content: flex-end` (restore bottom-pin); remove shell padding-bottom lift.
  - Card View: shell stretches `.bj-card-desktop-hero` (`flex:1 1 auto`) inside hero cards zone.
  - Felt cloth layer: `flex: 0 0 auto` (absolute — must not consume cards-zone flow space).
- `src/styles/bj-table-shared.css` — restore `height: 100%` on desktop `.bj-casino__felt-main` (definite height
  for grid `1fr` without re-adding `display:flex` on the shell element).
- `src/styles/bj-full-table-card-area.css` — lift via `margin-bottom: var(--bj-full-desktop-cards-lift, 0.35rem)`
  on `.bj-full-table-card-area` (content-only; boxes/tray untouched).
- `src/styles/bj-card-desktop-hero-area.css` — hero `overflow: visible`; hero cards band
  `min-height: min(5.5rem, 100%)`.
- `src/components/productionRouteOwnership.test.ts` — updated Card View floor assertion + 3 regression tests.
- `docs/CHANGE_LOG.md`, `ChangeSummary.md` (this file).

## v1.1 fixes confirmed preserved

- Command box: single route (`BlackjackCommandBox`); playing-phase + status overflow rules still cover **both**
  `.bj-view-full-desktop` and `.bj-view-card-desktop`.
- Dealer: Card View band `6.7rem` unchanged; shell dealer zone ownership unchanged.
- Shell bounding: `height:100%; max-height:100%; overflow-y:hidden` unchanged (no vertical scroll restored).
- Boxes/tray baselines: no changes to boxes/tray/actions zone geometry or movers.

## Tests

- `npm run test:ownership` → **27 passed** (3 new regression tests)
- `npm run test:layout:target` → **53 passed**
- `npm run test:blackjack:layout` → **205 passed**
- `npm run build` → **success**

New regression tests:
- Card View hero visible (shell stretches hero; hero not `display:none`; responsive cards-row floor).
- Full Table stack uses `column-reverse` overlap (not plain tall column); cards zone `justify-content:flex-end`.
- Full Table stacks stay in cards zone (not boxes zone); `felt-main height:100%` restores `1fr` sizing.

## Browser checklist

- [ ] **Desktop Full Table:** per-box stacks overlap upward, sit just above box amount/value, aligned to columns;
      3/4/5+ cards do not clip; boxes/tray unmoved.
- [ ] **Desktop Card View:** hero cards visible in cards zone; no vertical page/table scroll; dealer + command
      same as v1.1 (readable, identical formatting).
- [ ] **Toggle Full Table ↔ Card View (same phase):** boxes/tray baseline stable.

**Spec discipline:** checked/updated CHANGE_LOG.md.
