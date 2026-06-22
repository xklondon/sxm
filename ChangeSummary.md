# Full Work Summary — Card Placement Contract Lock

## Root cause

The cards zone was treated as one fluid area with shared rules (`overflow:hidden`, `justify-content:flex-start`, `margin-top:auto`, `height: min(..., 100%)`). That caused:

| Mode | Symptom | Cause |
|------|---------|-------|
| Desktop Full Table | Stack tops clipped | `overflow:hidden` on cards zone band |
| Mobile Full Table | Cards too high | `justify-content:flex-start` floated arc away from box value band |
| Desktop Card View | Hero invisible | Hero card `height: min(max-height, 100%)` collapsed when parent height was indefinite; fan `overflow:hidden` |
| Mobile Card View | (was OK) | Needed regression protection only |

## New card placement contract

**`src/components/blackjackCardPlacementContract.ts`** (`card-placement-v1`)

| Mode | Anchor | Vertical anchor | Overflow |
|------|--------|---------------|----------|
| desktopFull | boxColumn | justAboveBoxValue | clip-x |
| mobileFull | boxColumn | justAboveBoxValue | clip-x |
| desktopCard | heroCenter | centerHero | visible |
| mobileCard | heroCenter | centerHero | visible |

Wired via `data-card-placement` + `data-placement-overflow` on `BlackjackCardsAreaZone`.

## Structural fixes (no gameplay/reveal/command changes)

- **Shell** — Full Table cards zones: `overflow-x:clip; overflow-y:visible` (not `overflow:hidden`). Hero zones: `overflow:visible` + deterministic `min-height`.
- **Full Table card area** — Desktop: `align-self:flex-end` (removed `margin-top:auto`). Mobile: `justify-content:flex-end`, compact card scale tokens. Taller stack-zone formula for 3–5 card overlap.
- **Desktop hero** — `min-height:min(5.5rem,…)` on hero/cards/fan; card `height:auto`; fan `overflow:visible`.
- **Debug** — `?layoutDebug=1` shows placement contract, zone/stack/amount/command/tray bboxes, overlap warnings (`stack-clipped-top`, `stack-overlaps-*`, `hero-cards-height-zero`).

## Files changed

- `src/components/blackjackCardPlacementContract.ts` (new)
- `src/components/blackjackCardPlacementContract.test.ts` (new)
- `src/components/blackjackViewZones.tsx`
- `src/components/BlackjackTableLayoutShell.tsx`
- `src/components/BlackjackPanel.tsx`
- `src/components/blackjackLayoutDebug.ts`
- `src/components/BlackjackLayoutDebugPanel.tsx`
- `src/components/blackjackLayoutDebug.test.ts`
- `src/components/productionRouteOwnership.test.ts`
- `src/components/blackjackUiRenderContract.test.ts`
- `src/styles/bj-blackjack-table-shell.css`
- `src/styles/bj-full-table-card-area.css`
- `src/styles/bj-card-desktop-hero-area.css`
- `package.json`
- `docs/CHANGE_LOG.md`
- `docs/SXM_MASTER_SPEC.md`

## Tests added

`blackjackCardPlacementContract.test.ts` — per-mode contract, clip-x vs hidden, mobile bottom-pin, desktop hero min-height, mobile Card View protection, zone ownership.

## Test results

| Command | Result |
|---------|--------|
| `npm run test:ownership` | 27 passed |
| `npm run test:layout:target` | 53 passed |
| `npm run test:blackjack:layout` | 227 passed |
| `npm run build` | Success |

## Confirmation checklist (browser)

1. **Mobile Card View** — unchanged/working (hero visible, no scroll regression)
2. **Mobile Full Table** — cards sit just above amount/value on each box; no tray overlap
3. **Desktop Full Table** — 2–5 card stacks not clipped at top; no command/box overlap
4. **Desktop Card View** — hero cards visible with non-zero height; no vertical scroll

**Spec discipline: checked/updated SXM_MASTER_SPEC.md and CHANGE_LOG.md.**
