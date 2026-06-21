# SXM Architecture — Version 1.0 target

Canonical product spec: [SXM_MASTER_SPEC.md](./SXM_MASTER_SPEC.md).  
Layout contracts: [BLACKJACK_LAYOUT_CONTRACTS.md](./BLACKJACK_LAYOUT_CONTRACTS.md).  
Test tiers: [TEST_WORKFLOW.md](./TEST_WORKFLOW.md).

**Before architecture, layout, auth, invite, or game-flow changes:** read `.cursorrules` and this document.

---

## Version 1.0 goal

One stable implementation per concern:

- One table shell for Blackjack (Full Table + Card View share it).
- One CSS cascade per layout concern (documented import order).
- One gameplay action path per protocol (engine → server action layer → panel dispatch).
- No competing production routes, shells, or geometry owners.

---

## Layer separation

### App level

Users, auth, session, people management, invites, ledger, saved/open tables.

| Area | Primary locations |
|------|-------------------|
| Auth / session | `server/src/auth`, magic-link flow |
| People / invites | `server/src/people`, invite APIs |
| Ledger | `src/engine/ledger`, personal ledger modals |
| Navigation | `App.tsx`, `StartScreen`, `EntryLobbyScreen`, `GameSetupScreen` |
| Messaging | `src/features/messaging/TableChatDock` |

### Table engine level

Table model, seating/boxes/chips, table lifecycle, layout shell, game-flow orchestration shared across protocols.

| Area | Primary locations |
|------|-------------------|
| Table screen | `src/screens/TableScreen.tsx` |
| Table setup / stake | `TableStakePanel`, `beginTableResetSetup` |
| Session / boxes | `src/engine/session/` |
| Shared UX contracts | `tableUxContract.ts`, `sxmLayoutContract.ts` |
| Blackjack shell | `BlackjackTableLayoutShell.tsx`, zone components in `blackjackViewZones.tsx` |

### Game protocol level

Blackjack, Zilch, Hold'em (future), protocol rules, variations — **isolated from layout**.

| Game | Engine | Panel | Routed from |
|------|--------|-------|-------------|
| Blackjack | `src/engine/blackjack/` | `BlackjackPanel` | `TableScreen` when `isBlackjackTable` |
| Zilch | `src/engine/zilch/` | `ZilchPanel` | `TableScreen` when `isZilchTable` |
| Hold'em | `src/engine/holdem/` | `HoldemPanel` | `TableScreen` when `isHoldemTable` |

Gameplay mutations online: `POST /api/tables/:id/actions` → `applyAction` → engine `*OnState` functions.

---

## Canonical production routes

### Blackjack

```
App.tsx
  └─ TableScreen.tsx
       └─ BlackjackPanel.tsx
            └─ BlackjackTableLayoutShell.tsx
                 ├─ TableInfoBar (felt row)
                 ├─ BlackjackDealerArea
                 ├─ BlackjackCommandZone → BlackjackCommandBox
                 ├─ BlackjackCardsAreaZone (Full Table arc OR Card View hero)
                 ├─ BlackjackActionsZone
                 ├─ BlackjackPlayerBoxesZone
                 └─ chip tray (ValueAndChipsBar)
```

View differences: `viewMode` (`full` | `card`), `deviceView`, view-root classes (`bj-view-*`), CSS only.

### Zilch / Hold'em

Separate panels; share table shell concerns (auth, invites, ledger, stake setup) but **not** Blackjack layout CSS.

---

## What must not be duplicated

- `BlackjackTableLayoutShell` or alternate shell wrappers in production.
- Desktop grid row definitions outside `bj-blackjack-table-shell.css`.
- Full Table card stack geometry outside `bj-full-table-card-area.css` (+ documented owners in `blackjackLayoutContract.ts`).
- Card View hero layout outside `bj-card-layout.css`, `BlackjackCardView.css`, and scoped Card View CSS files.
- Second gameplay action path (online local mutation vs server dispatch).
- Parallel command/action render paths between Full Table and Card View.

Legacy CSS class names (`bj-card-layout__command`, etc.) may remain as **hooks** on canonical components — they are not a second layout system.

---

## Reference / stitch / frozen

| Asset | Role |
|-------|------|
| `reference-ui/` | Screenshots and design reference — **never imported by production** |
| Frozen layout tests | Guard approved geometry; live under `src/components/*.test.*` |
| `src/design/templates/` | Theme token registry (`sxm-stitch-visual.css` variables) — allowed in production |
| `src/engine/blackjack/sanity/fixtures` | Test/check fixtures — **not** for runtime UI imports |

---

## Adding a new game protocol

1. Add engine module under `src/engine/<game>/`.
2. Add panel under `src/components/<Game>Panel.tsx` (or `screens/` if thin).
3. Route in `TableScreen` by `tableGame` / `tableMeta.gameCategory`.
4. Extend `TABLE_ACTIONS`, `applyAction`, `authority.ts` for gameplay actions.
5. Reuse table stake setup, ledger, invites — do not duplicate.
6. Document protocol in `SXM_MASTER_SPEC.md` + `CHANGE_LOG.md`.

Do **not** fold protocol logic into `BlackjackPanel` or blackjack CSS files.

---

## Adding a Blackjack variation (without forking layout)

- Rule/setting changes: engine + `blackjackSettings` / protocol config only.
- UI copy or phase labels: `tableCommandDisplay`, view selectors — not a new shell.
- Visual tweaks: scoped CSS under existing owners; update layout contract tests if geometry changes.
- Never add a second `*LayoutShell` for the same view mode.

---

## CSS ownership map

Documented import order: `CANONICAL_BLACKJACK_CSS_IMPORT_ORDER` in `blackjackLayoutContract.ts` (mirrors `src/index.css`).

| Order | File | Responsibility |
|-------|------|----------------|
| 1 | `tokens.css` | Global design tokens |
| 2 | `sxm-stitch-visual.css` | Theme variables on `.bj-casino.sxm-layout-root` |
| 3 | `bj-table-shared.css` | Shared tokens, mobile flex shell, zone chrome |
| 4 | `bj-player-row-layout.css` | Player box row spread |
| 5 | `bj-card-layout.css` | Card View layout hooks, legacy neutralization |
| 6 | `bj-full-table-card-area.css` | Full Table card stacks, cloth band, play zone |
| 7 | `bj-felt-skins.css` | Felt cloth SVG typography |
| 8 | `bj-blackjack-table-shell.css` | **Desktop grid geometry**, zone row heights |
| 9+ | Card View / mobile / targeted / debug / hero-final | View-specific overrides (scoped by view root) |

Enforced by: `productionRouteOwnership.test.ts`, `fullTableDesktopLayoutOwnership.test.ts`, `cardViewDesktopLayoutOwnership.test.ts`.

---

## Testing tiers

| Tier | Command | When |
|------|---------|------|
| Ownership smoke | `npm run test:ownership` | Route/CSS canonical checks |
| Layout patch | `npm run test:layout:target` | Full Table layout contracts |
| Extended layout | `npm run test:blackjack:layout` | Broader blackjack layout batch |
| Engine | `npm run test:blackjack:engine` | Gameplay rules |
| Pre-commit | `npm run check:patch` | Targeted layout + build |
| Pre-deploy | `npm run check:deploy` | Full `npm test` + build (manual) |

Do not run full `npm test` inside Cursor agent loops.
