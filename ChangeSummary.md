# Change Summary — Mobile Card View + Full Table landscape fixes

## Part A — Mobile Card View portrait (390×844)

**Root cause:** Play-phase mobile shell applied `--bj-zone-command-height: 6.375rem` to Card View, starving the hero cards zone. Portrait rules also capped hero cards at `5.5rem` inside a ~57px band.

**Fix (`bj-card-mobile-portrait-layout.css`):**
- Card View play phases keep compact command/dealer heights (not Full Table playing band).
- Hero cards zone `min-height: 7.75rem`; removed `5.5rem` max-height cap; `min-width`/`min-height` on hero cards.
- Cards slot overflow `visible` so stitched fan is not clipped.

**Capture after:** hero playing card ~**50.4×70.5px** (was ~45.6×63.8px); hero value hidden.

## Part B — Mobile Full Table landscape (844×390)

**Root causes:**
1. Landscape grid targeted `.bj-table-zone--dealer` but shell uses `.bj-dealer-area` + felt bank row — extra auto-placed rows pushed zones off-screen.
2. Play-phase command height `6.375rem` overrode landscape compact tokens.
3. Felt/shell height chain did not flex below toolbar + Magic 8.

**Fix (`bj-full-mobile-landscape-layout.css`):**
- Grid areas on `.bj-dealer-area`; hide `.bj-table-info-bar--felt-row` in landscape.
- Play phases use landscape compact command/dealer heights.
- Flex chain: rail → felt → layout shell; shell `height: auto; max-height: 100%`.
- Canvas height reserves header chrome.

**Capture after:** all zones (dealer, command, cards, actions, boxes, tray) within viewport; playing cards visible.

## Files changed

| File | Scope |
|------|--------|
| `src/styles/bj-card-mobile-portrait-layout.css` | Mobile Card View portrait only |
| `src/styles/bj-full-mobile-landscape-layout.css` | Mobile Full Table landscape only |
| `scripts/capture-mobile-card-layout.mts` | Hero card rect assertions |
| `scripts/capture-mobile-full-landscape-layout.mts` | New landscape capture |
| `src/components/mobileCardPortraitLayout.test.ts` | Portrait owner guards |
| `src/components/mobileLandscapeFullLayout.test.ts` | `.bj-dealer-area` grid guard |
| `src/components/cardViewMobileLayout.test.tsx` | Command text regex (includes caller name) |

**Desktop:** unchanged — no desktop view-root selectors modified.

## Verification

- `npm run build` ✅
- `npm run test:layout:fast` ✅
- `npx tsx scripts/capture-mobile-card-layout.mts` ✅
- `npx tsx scripts/capture-mobile-full-landscape-layout.mts` ✅

Spec discipline: checked `SXM_MASTER_SPEC.md` and `CHANGE_LOG.md`.
