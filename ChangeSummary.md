# Change Summary — Test hygiene: layout scripts

## Problem

`blackjackRenderedLayout.test.tsx` hangs in Vitest/happy-dom batch runs, causing marathon test sessions and worker crashes. Targeted Card View guard tests are the reliable fast signal.

## Changes (test/package hygiene only)

### `src/components/blackjackRenderedLayout.test.tsx`

- Expanded header comment: **heavy/manual** suite, not for routine audit, run via `npm run test:layout:rendered`, known happy-dom hang risk.

### `package.json`

Added:

- **`test:layout:fast`** — ownership + `cardViewDesktopBoundingBox`, `cardViewDisplayRegressions`, `cardViewLayoutGuards` (no `blackjackRenderedLayout`).
- **`test:layout:rendered`** — `blackjackRenderedLayout.test.tsx` only, `--pool=forks --maxWorkers=1`.

Unchanged:

- **`test:layout:audit`** — `build` + `test:layout:ownership`
- **`test:layout:all-fast`** — browser captures + ownership (explicit full geometry step)

### `.cursorrules`

Routine layout check documented as:

1. `npm run test:layout:audit`
2. `npm run test:layout:fast`
3. `npm run build`
4. `npx tsx scripts/runtime-visual-branch-audit.mts`

Manual heavy suite: `npm run test:layout:rendered`.

## Verification

| Command | Result |
|---------|--------|
| `npm run test:layout:audit` | ✅ build + 8 ownership tests |
| `npm run test:layout:fast` | ✅ 26 tests (8 ownership + 18 Card View guards) ~4s |
| `npm run build` | ✅ |

`blackjackRenderedLayout.test.tsx` is **excluded** from all routine scripts; only referenced by `test:layout:rendered`.
