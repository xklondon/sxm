# Change Summary — Table Layout Engine (Blackjack layout stabilization)

**Scope:** Layout architecture only. No gameplay, payout, betting, invite/auth, people, ledger, IOU, Zilch, or table-setup changes.

## What the audit found

- **Component layer was already consolidated.** All four views route through one shell:
  `TableScreen → BlackjackPanel → BlackjackTableLayoutShell → zone wrappers`. Card View only
  swaps the inner component of the `cards` zone; mobile and desktop share components. The
  "duplicate" files in git status are Windows path-separator artifacts (single physical files).
- **The real defect was in CSS: three competing layout engines** positioning the one shell:
  desktop = CSS grid (`bj-blackjack-table-shell.css`), mobile portrait = bare flex
  (`bj-table-shared.css`), mobile landscape = grid in two rival files. Plus leaky bare selectors
  and `margin-top: auto` zone movers, and a mobile boxes/tray override in
  `bj-player-row-layout.css` that fought the shared fixed heights (cause of the mobile
  baseline regression).

## What changed

### New canonical contract
- `src/components/tableLayoutEngine.ts` — neutral engine contract: 7 zones, 4 modes, per-mode
  stretch zone / fixed zones / boxes + cards baselines / allowed overflow / phase-invariant rows,
  plus the CSS ownership map and forbidden zone-mover list. `TABLE_LAYOUT_ENGINE_VERSION = table-layout-engine-v1`.

### One shell owner (all four modes use one CSS-grid engine)
- `bj-blackjack-table-shell.css`: added a **mobile (portrait) grid block** mirroring the desktop
  grid (same zone rows, `cards` = single stretch row, boxes directly above tray, no movers).
  Updated header to declare MAY/MUST-NOT ownership.
- Removed competing mobile zone overrides from `bj-player-row-layout.css` (boxes/tray
  `height:auto; margin-top:0`) and kept only the outer rail-wrap scroll containers.
- Scoped the leaky bare `.bj-cards-area--table` selectors in `bj-card-layout.css` under view roots.
- Added MAY/MUST-NOT ownership headers to: shell, `bj-table-shared.css`, `bj-full-table-card-area.css`,
  `bj-card-layout.css`, `bj-card-desktop-hero-area.css`, `bj-card-mobile-portrait-layout.css`,
  `sxm-stitch-visual.css`, `bj-player-row-layout.css`.

### Targeted bug fixes (via contract, not pixel patches)
- **Desktop Card View hero cards:** `cards` grid row floored with `--bj-zone-cards-min-height: 9rem`
  so the `1fr` row can't collapse to zero.
- **Desktop Full Table clipping:** cards zone `overflow: visible` (shell still clips horizontally —
  no page scroll) so card tops/values read.
- **Mobile boxes baseline:** shell now owns mobile boxes/tray placement identically for `mobileFull`
  and `mobileCard`, so their baselines match; `cards` stretch pins boxes above the tray.

### Debug overlay (`?layoutDebug=1`, hidden by default)
- Now reports: engine version, resolved mode (desktopFull/desktopCard/mobileFull/mobileCard),
  active phase, shell display + grid rows, and **per-zone** bounding box, rendered component, and
  CSS owner file.

### Tests
- `tableLayoutEngine.test.ts` — contract invariants (same zone names/order all modes, boxes baseline
  phase-invariant, cards is sole stretch zone, cards can't own boxes/tray, ownership rules).
- `tableLayoutEngineShell.test.tsx` — rendered zone-order smoke (table + hero modes).
- `productionRouteOwnership.test.ts` — extended: single shell owner, mobile grid block present,
  no competing grid rows, header ownership declarations, no bare `--table` selector, player-row no
  longer moves zones, shell owns mobile boxes/tray.
- Re-baselined frozen-layout assertions in `blackjackVisualCleanup.test.ts` and
  `mobileTableViews.test.tsx` to the consolidated engine.

## Validation (targeted only)
- `npm run test:ownership` → 18 passed
- `npm run test:layout:target` → 53 passed
- `npm run test:blackjack:layout` → 205 passed
- `tableLayoutEngine` + `tableLayoutEngineShell` → 10 passed
- `npm run build` → success

## Visual confirmation checklist (please verify in browser)
- [ ] Desktop Card View: hero cards visible, tops readable, total/status legible.
- [ ] Desktop Full Table: per-box stacks align above box columns; tops/bottoms read; splits stay in column; no clipping.
- [ ] Mobile Table View: boxes baseline matches Mobile Card View; boxes hug tray every phase; cards above boxes; no horizontal scroll.
- [ ] All views: one compact command box; stable tray; no duplicate command/game-over route.

**Spec discipline:** checked/updated SXM_MASTER_SPEC.md and CHANGE_LOG.md.
