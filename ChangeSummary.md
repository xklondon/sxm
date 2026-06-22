# Change Summary — New Table modal + desktop player boxes scroll

## Root cause

### New Table popup
1. **`mobile-modals.css` scrolled the entire panel** (`overflow-y: auto` on `.new-table-overlay__panel`), so header, close X, and footer nav scrolled together with ugly native scrollbars.
2. **`TableStakePanel` embedded mode** used `overflow: visible` and a **768px+ two-column grid**, wider than the ~22rem modal — causing horizontal overflow.
3. **Back / Start Table** lived inside the scrollable body with no sticky footer, so long forms could push buttons partially off-screen.

### Desktop player boxes scroll
1. **Box tiles used `overflow: visible`** with **2× value scale** and fixed stake bands, so content exceeded the shell’s fixed **boxes zone** (~6.1rem).
2. **Desktop felt had `overflow-y: visible`** — spill from boxes increased shell height and caused page/table vertical scroll.
3. **Prior fix in `bj-blackjack-targeted-fixes.css`** only covered Full Table during deal/play — not betting, not Card View desktop.

## What changed

### New Table modal
- **`NewTableOverlay.css`** — panel `overflow: hidden`; body-only vertical scroll with thin scrollbar; fixed header; safe-area padding; capped width `24rem`.
- **`TableStakePanel.css`** — embedded overlay: flex column, single-column form, full-width inputs, **sticky nav footer** (Back / Start Table) with gradient backdrop.
- **`mobile-modals.css`** — New Table panel no longer scrolls as a whole; body scrolls inside overlay.

### Desktop player boxes
- **`bj-blackjack-targeted-fixes.css`** — desktop Full + Card View: felt/shell/boxes zone `overflow: hidden`.
- **`bj-player-row-layout.css`** — boxes-zone-only tile scale (`--bj-desktop-box-value-scale: 1.55`), `max-height: 100%`, `overflow: hidden` on tiles.

## Files changed

| File | Change |
|------|--------|
| `src/components/NewTableOverlay.css` | Header/body split, body scroll, safe-area |
| `src/components/TableStakePanel.css` | Embedded overlay layout + sticky nav |
| `src/styles/mobile-modals.css` | Panel overflow hidden (body scrolls) |
| `src/styles/bj-blackjack-targeted-fixes.css` | Desktop boxes zone containment |
| `src/styles/bj-player-row-layout.css` | Boxes-zone tile sizing clamp |
| `src/components/newTableModalLayout.test.tsx` | **New** layout contract tests |
| `src/components/newTableOverlay.test.tsx` | Updated width/sticky assertions |
| `package.json` | Added test to `test:blackjack:layout` |

## Frozen / untouched

**Not modified:** `tableLayoutEngine.ts`, `blackjackCardPlacementContract.ts`, `blackjackUiRenderContract.ts`, card layout CSS, reveal/play flow, Game Over modal, 2×/swipe, command box, gameplay, IOU/ledger/auth/Zilch.

## Test results

| Command | Result |
|---------|--------|
| `npm run test:ownership` | 27 passed |
| `npm run test:layout:target` | 53 passed |
| `npm run test:blackjack:layout` | 259 passed |
| `npm run build` | Success |

## Browser checklist

1. **New Table popup** — no horizontal scrollbar  
2. **Header / close X** — fixed at top, always visible  
3. **Start Table / Back** — fixed at bottom, always clickable  
4. **Desktop player boxes** — no page/table vertical scroll from boxes row  

Spec discipline: checked/updated `docs/CHANGE_LOG.md`; `SXM_MASTER_SPEC.md` unchanged (modal/boxes CSS-only).
