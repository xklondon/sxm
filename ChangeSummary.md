# Change Summary — Table Layout Engine v1.1 (Blackjack desktop placement/ownership fixes)

**Scope:** Blackjack layout only. No gameplay, betting, IOU, ledger, auth, Zilch, table setup, or
non-Blackjack routing changes. One shell, one CSS-grid engine owner (`bj-blackjack-table-shell.css`).

## Root-cause audit per issue

1. **Desktop Card View vertical scroll.** The shell grid (`bj-casino__felt-main` + `bj-table-layout-shell`)
   had no self-bounding; `bj-table-shared.css` set `display:flex; height:100%; overflow:visible` on the
   same element, and Card View added a rigid `--bj-zone-cards-min-height: 9rem` floor. Fixed rows + the
   9rem floor exceeded the bounded `.bj-table-desktop-shell` height, so the `cards 1fr` row could not
   absorb the slack → overflow/scroll. **Fix:** shell owns its own bounding (`height:100%; min-height:0;
   max-height:100%; overflow-y:hidden`) and Card View floor is `0`, so `cards 1fr` always fits.
2. **Command box inconsistency.** Component was already single (`BlackjackCommandBox → DealerCommandArea`);
   the divergence was CSS — status `overflow:visible` and the playing-phase command compaction were scoped
   to `.bj-view-full-desktop` only. **Fix:** those rules now target both desktop view roots; Card View
   matches Full Table exactly. The DealerBlock inline command remains the disabled alternate path
   (`omitCommand` always set by the panel).
3. **Desktop Full Table card placement.** Stacks sat at the very bottom of the cards zone. **Fix:** added
   `padding-bottom: var(--bj-full-desktop-cards-lift, 0.5rem)` to the Full Table cards zone only — lifts
   the bottom-pinned stacks just above the box value with no movers/transforms on actions/boxes/tray.
4. **Dealer broken in Desktop Card View.** Card View dealer band (`6.05rem`) was shorter than the dealer
   stack (cards + bank label + action ≈ 6.1rem), and the band is `overflow:hidden; justify-content:flex-end`
   → top (cards) cropped. **Fix:** Card View dealer band → `6.7rem`. Absorbed by `cards 1fr`, so the
   box/tray baseline is unchanged. Dealer stays owned by the shell dealer zone (no Card View dealer engine).
5. **Card View vs Full Table baseline mismatch.** Boxes/tray heights, gaps and bottom padding are already
   identical across both desktop modes, and the `cards 1fr` row absorbs all dealer/command/actions
   differences. The 9rem Card View cards floor was the only thing perturbing it. **Fix:** removing the
   floor (see #1) restores identical box/tray baselines on toggle.

## Files changed

- `src/styles/bj-blackjack-table-shell.css`
  - Desktop shell grid: added `height:100%; min-height:0; max-height:100%`, `overflow-y: hidden`.
  - Card View: `--bj-zone-cards-min-height: 9rem → 0`; dealer band `6.05rem → 6.7rem`.
  - Full Table cards zone: `padding-bottom: var(--bj-full-desktop-cards-lift, 0.5rem)`.
  - Command status `overflow:visible` + playing-phase command compaction now cover both desktop roots.
- `src/styles/bj-table-shared.css`
  - Desktop `.bj-casino__felt-main` rule: removed competing shell geometry
    (`display/flex-direction/height/overflow/align/justify`); shell file now owns it.
- `src/components/productionRouteOwnership.test.ts` — new tests (see below).
- `src/components/playerRowLayout.test.tsx` — re-baselined the stale mobile boxes/tray assertion to the
  consolidated shell owner; kept the player-row "no movers" negative checks.
- `docs/CHANGE_LOG.md`, `docs/ChangeSummary.md` (this file) — updated.

## Routes removed / consolidated

- **Command:** one component (`BlackjackCommandBox`); DealerBlock inline command path stays disabled via
  `omitCommand`. No second command style path — the Full-Table-only command CSS now applies to both
  desktop view roots (single formatting contract).
- **Shell geometry:** removed from `bj-table-shared.css` `.bj-casino__felt-main` (desktop); single owner
  is `bj-blackjack-table-shell.css`.

## Tests

New (`productionRouteOwnership.test.ts`):
- Exactly one canonical command route (`BlackjackCommandBox` + dealer `omitCommand`).
- `desktopFull` and `desktopCard` share one command zone owner + formatting class + playing-phase rule.
- Desktop Card View shell is height-bounded and clips (no fixed-row scroll); no rigid Card View cards floor.
- Dealer zone is not re-owned by Card View CSS (card-layout / card-area / hero-area carry no dealer geometry).
- `bj-player-row-layout.css` does not move boxes/tray (no `margin-top:auto` / transform).

Results:
- `npm run test:ownership` → 24 passed
- `npm run test:layout:target` → 53 passed
- `npm run test:blackjack:layout` → 205 passed
- Touched view-parity suites (player-row, mobile parity/composition, felt skin, engine, clip/central,
  visual cleanup, mobile table views, ux contract, engine shell) → 173 passed
- `npm run build` → success (tsc + vite)

Pre-existing (not introduced here, outside layout-ownership scope; confirmed failing on the baseline
commit before these edits):
- `boxBorderVisual.test.ts` — 1 stale assertion wanting `.bj-table-desktop-shell { height: var(--bj-shell-height) }`
  directly instead of the indirection token `--bj-desktop-table-height`.
- `cardViewLayoutPolish.test.tsx` — 1 rendered-text assertion ("Box N — your turn.") about command
  message content, not layout geometry.

## Browser checklist (please verify)

- [ ] **Desktop Card View:** no vertical scroll; dealer cards + bank label centered and fully readable;
      command box identical to Full Table (typography, border, padding, wrapping).
- [ ] **Desktop Full Table:** each card stack sits slightly higher, just above its box value;
      3/4/5+ card hands do not clip and stay in their box column.
- [ ] **Toggle Full Table ↔ Card View (same phase):** box baseline and tray baseline do not jump.

**Spec discipline:** checked/updated SXM_MASTER_SPEC.md and CHANGE_LOG.md.
