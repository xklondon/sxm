# Change Summary — Revert Card View tall dealer band; shared Full Table dealer path

## Reverted (Card View only)

| Token / rule | Removed |
|--------------|---------|
| `--bj-desktop-zone-dealer-height: 10.85rem` | ✅ |
| `--bj-dealer-cards-slot-min-height: 6rem` | ✅ |
| `.bj-view-card-desktop … cards-slot { overflow: visible }` | ✅ |
| `.bj-view-card-desktop … cards { max-height: none; height: auto }` | ✅ |

## Restored / aligned

- Card View dealer zone: **`6.05rem`** (pre-expansion compact value)
- Shared slot: **`3.35rem`** via `--bj-dealer-cards-slot-min-height`
- **Same compact dealer cards** as Full Table under `.bj-dealer-area`:
  - `.playing-card--compact`: `2.05rem × 2.7rem`
  - Placeholder stack/back: same as legacy `.bj-table-zone--dealer` tokens

## Measurements (1280×800, playing)

| Metric | Full Table | Card View | Δ |
|--------|------------|-----------|---|
| Dealer playing-card | 32.8×**43.2** | 32.8×**43.2** | **0px** |
| `dealer-block__cards-slot` height | 53.6 | 53.6 | 0 |
| `bj-dealer-area` height | 96.8 | 96.8 | 0 |
| Cards clip in slot | ✅ | ✅ | — |
| Command top | — | **272.9** | pre-expansion baseline restored |
| Boxes top | — | 521.6 | unchanged vs compact layout |
| Tray top | — | 617.0 | unchanged |

No Card View-only tall dealer band remains.

## Verification

- `npm run build` ✅
- `npm run test:layout:fast` ✅
- `npx tsx scripts/runtime-visual-branch-audit.mts` ✅

Spec discipline: updated `SXM_MASTER_SPEC.md`.
