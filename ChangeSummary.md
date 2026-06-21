# Change Summary — SXM V1.0 stabilization (architecture rules, ownership tests, audit)

## Part 1 — `.cursorrules`

Added/expanded **SXM Architecture Discipline (Version 1.0)** with:

- Canonical route over parallel implementations
- Required audit checklist before layout/auth/invite/table/game-flow changes
- No duplicate shells, layout systems, or CSS geometry
- Canonical Blackjack route: `App → TableScreen → BlackjackPanel → BlackjackTableLayoutShell`
- CSS ownership table (shell, shared, card area, Card View, stitch theme)
- Reference/stitch/frozen rules + `design/templates` theme exception
- Test discipline (targeted patch, build on commit, full suite manual deploy only)
- Three-layer model: App / Table Engine / Game Protocol
- `ChangeSummary.md` output requirement

## Part 2 — Documentation

| File | Change |
|------|--------|
| `docs/SXM_ARCHITECTURE.md` | **New** — V1.0 target, layers, routes, CSS map, testing tiers, how to add games/variations |
| `docs/TEST_WORKFLOW.md` | Pointer to `.cursorrules` + `SXM_ARCHITECTURE.md`; `test:ownership` in script table |
| `README.md` | Link to `SXM_ARCHITECTURE.md` |
| `docs/CHANGE_LOG.md` | Entry for this pass |

## Part 3 — Ownership tests

**New:** `src/components/productionRouteOwnership.test.ts`  
**Script:** `npm run test:ownership`

Covers:

1. Single `BlackjackTableLayoutShell` in `BlackjackPanel`
2. Production import scan (no `reference-ui`, frozen layout, sanity fixtures)
3. `index.css` matches `CANONICAL_BLACKJACK_CSS_IMPORT_ORDER`
4. Full route chain App → TableScreen → BlackjackPanel → Shell
5. Shell class ownership; no competing grid in `bj-table-shared.css`
6. CSS geometry guards (shell, card area, Card View, stitch theme-only)

## Part 4 — Audit report (no deletions beyond proven obsolete)

### Active production route

```
App.tsx
  → TableScreen.tsx
       → BlackjackPanel.tsx (when isBlackjackTable)
            → BlackjackTableLayoutShell.tsx
                 → zone components (dealer, command, cards, actions, boxes, tray)
       → ZilchPanel.tsx (when isZilchTable)
       → HoldemPanel.tsx (when isHoldemTable)
```

Single layout shell component: **`BlackjackTableLayoutShell.tsx`** only.

### Duplicate candidates (same concern, different files — documented owners)

| Concern | Files | Status |
|---------|-------|--------|
| Route ownership tests | `productionRouteOwnership.test.ts`, `blackjackRenderArchitecture.test.ts`, `blackjackLayoutDebug.test.ts` | Overlap by design; **removed** redundant `blackjackRenderRouteAudit.test.ts` |
| CSS geometry guards | `productionRouteOwnership.test.ts`, `fullTableDesktopLayoutOwnership.test.ts`, `cardViewDesktopLayoutOwnership.test.ts` | Complementary scopes |
| Legacy class hooks | `bj-card-layout__command` etc. in `tableUxContract.ts` | **Not** a second shell — CSS hooks on canonical command box |
| Shared vs shell tokens | `bj-table-shared.css` + `bj-blackjack-table-shell.css` | Shell wins desktop grid; shared owns mobile flex + tokens |

### Obsolete candidates

| Item | Evidence | Action |
|------|----------|--------|
| `blackjackRenderRouteAudit.test.ts` | Superseded by `productionRouteOwnership.test.ts` | **Deleted** |
| `BlackjackDealerAreaSection` | Exported, zero imports | **Removed** |

### Safe-to-delete (done this pass)

- `src/components/blackjackRenderRouteAudit.test.ts`
- `BlackjackDealerAreaSection` export in `BlackjackDealerArea.tsx`

### Keep as reference / test-only

| Asset | Role |
|-------|------|
| `reference-ui/` | Screenshot reference — never production |
| `blackjackLayoutContract.ts` reference image path constants | Test/doc anchors only |
| `src/engine/blackjack/sanity/fixtures` | Tests + capture scripts |
| `src/design/templates/stitchMobile.ts` | Theme registry entry (allowed) |
| Frozen layout test files (`*Frozen*.test.ts`, `blackjackEngineFreezeGuards.test.ts`) | Guard approved geometry |

### Risky / needs review (not changed)

| Item | Risk | Recommendation |
|------|------|----------------|
| `bj-table-shared.css` unscoped `.bj-table-layout-shell` rules | May compete with shell on specificity edge cases | Monitor via `test:ownership`; migrate stragglers only when proven |
| `TABLE_UX.cardLayout*` legacy class names | Naming suggests old layout system | Rename in dedicated pass; hooks are canonical today |
| `cardViewPhaseChecks.ts` imports `blackjackTableLayout` from components | Engine → UI coupling | Future refactor to move layout constants to neutral module |
| 100+ layout regression tests with overlapping guards | Maintenance cost | Keep; use tiered scripts (`test:ownership`, `test:layout:target`) |
| `blackjackRenderedLayout.test.tsx` | Happy-dom hangs | Manual only (`test:layout:rendered`) |

### CSS files touching layout selectors

All under `src/styles/bj*.css` + `BlackjackCardView.css` — ownership mapped in `SXM_ARCHITECTURE.md`. No duplicate `*LayoutShell*` components found.

### JS/TS duplicates

No `.js`/`.jsx` production sources under `src/` (TypeScript only).

## Part 5 — Cleanup performed

- Removed `blackjackRenderRouteAudit.test.ts` from repo and `test:blackjack:layout` script
- Removed dead `BlackjackDealerAreaSection` export
- Wired `test:ownership` into `test:layout:audit` and `test:layout:fast`

No gameplay, UI redesign, or layout geometry changes.

## Part 6 — Validation

```
npm run test:ownership   → 10/10 pass
npm run test:layout:target → 53/53 pass
npm run build            → pass
```

**Spec discipline: checked/updated SXM_MASTER_SPEC.md (prior pass) and CHANGE_LOG.md.**
