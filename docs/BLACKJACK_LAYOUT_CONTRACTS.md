# Blackjack layout contracts

**Single source of truth for all blackjack table layout.** Protocol, betting, and dealing boundaries live in [BLACKJACK_STABILITY_CONTRACTS.md](./BLACKJACK_STABILITY_CONTRACTS.md) — that doc defers layout detail here.

**Engine freeze baseline:** [BLACKJACK_ENGINE_FREEZE.md](./BLACKJACK_ENGINE_FREEZE.md) — frozen scope, new-game gate, unfreeze process.

**Code constants:** `src/components/blackjackLayoutContract.ts`  
**Mobile boundary:** `src/styles/mobileLayoutContract.ts` (`MOBILE_MAX_WIDTH`, `MOBILE_LAYOUT_MEDIA`)

---

## Authority order (resolve conflicts)

1. **Reference screenshots** — [`reference-ui/views/Desktop_Full.png`](../reference-ui/views/Desktop_Full.png) (or legacy [`Mobil.png`](../reference-ui/views/Mobil.png)), [`Desktop_Card.png`](../reference-ui/views/Desktop_Card.png), mobile references when present.
2. **Browser geometry captures** — `npm run test:layout:desktop-full` / `test:layout:desktop-card` (Playwright bounding boxes). **Visual layout truth beats Vitest string guards.**
3. **This document** — zone order, owners, tokens, invariants.
4. **CSS ownership tests** — `npm run test:layout:ownership` (non-owners must not set layout properties).
5. **Frozen/guard Vitest** — token and DOM-path guards only; must not encode obsolete pixel values.

---

## Test categories

| Category | Scripts / files | Purpose |
|----------|-----------------|--------|
| **A — Browser geometry** | `test:layout:desktop-full`, `test:layout:desktop-card` | Overlap, vertical order, action-to-box gap, card/box alignment, hero value visibility |
| **B — CSS ownership** | `test:layout:ownership` | Owner files hold layout; shell placement exception documented below |
| **C — DOM / shared components** | `blackjackRenderedLayout.test.tsx`, panel tests | `BlackjackActionRow`, `BlackjackPlayerBoxRow`, `BlackjackTrayRow`; no duplicate Stay/Hit path |
| **D — Frozen guards** | `blackjackFullTableLayoutFrozen.test.ts`, `cardViewLayoutGuards.test.ts` | Regression guards only — update when browser-validated layout changes |

**Do not run full `npm test` for layout reconciliation.** Use `npm run test:layout:all-fast` + `npm run build`. Full Vitest suite may OOM from repeated heavy `BlackjackPanel` SSR mounts in `blackjackRenderedLayout.test.tsx` — prefer browser captures for geometry.

---

## Layout owners (one owner per view)

### 1. Desktop Full Table (`bj-view-full-desktop`) — FROZEN

| Role | Owner file |
|------|------------|
| Card stack / value band / actions gap / card-column grid | `src/styles/bj-full-table-card-area.css` |
| Player box row spread + slot grid | `src/styles/bj-player-row-layout.css` |
| Shell zone grid-row placement + legacy zone flex | `src/styles/bj-table-shared.css` (migrate to owners over time) |
| Overlay wiring | `src/components/BlackjackPanel.tsx` (classes only, no layout CSS) |

**Browser targets:** action-to-box gap ≈ 0–2px; card stack center aligned to box column (1fr grid); card-column value hidden during play (`bj-arc__slot--card-column--stack-value-in-box`); hand total in box (`bj-phone-view__mini-hand-value`).

### 2. Desktop Card View (`bj-view-card-desktop`) — FROZEN

| Role | Owner file |
|------|------------|
| Seven-band grid, hero value, actions, boxes, tray | `src/styles/bj-card-desktop-layout.css` |
| Hero card fan markup | `src/components/BlackjackCardView.tsx` |
| Hero card cosmetics (not zone placement) | `src/styles/bj-card-layout.css` |

**Browser targets:** hero value visible below cards, above Stay/Hit; **action-to-box gap ≈ 5px** (3–8px tolerance); felt cloth visible behind hero cards.

### 3. Mobile Portrait Full Table (`bj-view-full-mobile`) — FROZEN

Same zone order as desktop Full Table. Card columns: `bj-full-table-card-area.css` + `bj-player-row-layout.css` (Contract C).

### 4. Mobile Portrait Card View (`bj-view-card-mobile`) — PENDING FREEZE

Shell actions via `BlackjackActionRow`; portrait box row in `bj-player-row-layout.css`.

### 5. Mobile Landscape — PENDING FREEZE

Same semantics as portrait; compact tokens in `bj-table-shared.css` landscape blocks.

### Shared presentational components (all views)

| Component | Band | Role |
|-----------|------|------|
| `BlackjackActionRow` | `action-row` | Stay / Hit / Double / Split |
| `BlackjackPlayerBoxRow` | `player-boxes` | Arc player box row |
| `BlackjackTrayRow` | `tray-row` | Balance + chip plaques |
| `renderArcSlot` | — | Shared player box content |
| `BlackjackCardView` | `hero-cards`, `hero-value` | Hero fan + value segment only — **no separate Stay/Hit** |

---

## CSS ownership rules

**Allowed outside owners (shared style only):** color, font, border, background, shadow, radius.

**Forbidden outside owners:** `display`, `grid-*`, `flex*`, `justify-content`, `align-*`, layout `width`/`height`, `position`, `margin-top`/`margin-bottom`, `transform`/`translate`, `overflow` that clips or moves layout.

**Documented exception — legacy shell:** `bj-table-shared.css` may still set layout on Full Table play zones (`cards.bj-cards-area--table`, `actions`, `boxes`) until migrated into owners. Hero cards (`bj-cards-area--hero`) are out of scope for Full Table ownership audit.

**Documented exception — optional play overlay:** `OptionalPlayDecisionOverlay.css` may set absolute/flex layout on `.bj-optional-play-overlay-anchor` inside the Full Table desktop cards zone only.

---

## View freeze status

| View | Status | Constant |
|------|--------|----------|
| Full Table Desktop | **FROZEN** | `FULL_TABLE_DESKTOP_FROZEN` |
| Full Table Mobile Portrait | **FROZEN** | `FULL_TABLE_MOBILE_PORTRAIT_FROZEN` |
| Full Table Mobile Landscape | **PENDING FREEZE** | `FULL_TABLE_MOBILE_LANDSCAPE_FROZEN` |
| Card View Desktop | **FROZEN** | `CARD_VIEW_DESKTOP_FROZEN` |
| Card View Mobile Portrait | **PENDING FREEZE** | `CARD_VIEW_MOBILE_PORTRAIT_FROZEN` |
| Card View Mobile Landscape | **PENDING FREEZE** | `CARD_VIEW_MOBILE_LANDSCAPE_FROZEN` |

**Regression tests (frozen):** `blackjackFullTableLayoutFrozen.test.ts`, `blackjackFullTablePlayZoneLayout.test.ts`  
**Rendered-position tests (all views):** `blackjackRenderedLayout.test.tsx`, `layoutMeasure.test.ts` — measure `data-layout-band` bounding boxes; fail on overlap.  
**Audit guards (pending areas):** `blackjackLayoutContractGuards.test.ts`

### Shared presentational rows (Full Table + Card View)

| Component | Band marker | Role |
|-----------|-------------|------|
| `BlackjackActionRow` | `data-layout-band="action-row"` | Stay / Hit / Double / Split (via inner `BlackjackActionPanel`) |
| `BlackjackPlayerBoxRow` | `data-layout-band="player-boxes"` | Arc player box row wrapper |
| `BlackjackTrayRow` | `data-layout-band="tray-row"` | Available balance, chip plaques, tray label |

Card View explicit shell order: **Dealer → Command → HeroCards → HeroValue → ActionRow → PlayerBoxRow → TrayRow** (`heroValue` zone between cards and actions; no hero value/action overlay).

---

## Before changing layout

### Frozen views (A, B1)

1. Update **this document** with rationale.
2. Add or update tests in `blackjackFullTableLayoutFrozen.test.ts`.
3. Update `blackjackLayoutContract.ts` if zone order, tokens, or owner files change.
4. Run `npm test` and `npm run build`.
5. Verify against reference screenshots; confirm other views unchanged unless in scope.

### Pending-freeze views (B2, C1–C3)

1. Update the relevant section below (freeze criteria, tests required).
2. Add guard or freeze tests **before** setting the flag to `true`.
3. Do not change frozen Full Table Desktop / Mobile Portrait visuals unless a proven bug is found.

---

## Recommended freeze order

Work remaining views in this order (highest risk first):

1. **Mobile Landscape Full Table** (B2) — consolidate landscape tokens, orientation tests
2. **Desktop Card View** (C1) — consolidate hero CSS ownership, freeze gaps/actions
3. **Mobile Portrait Card View** (C2) — resolve or document dual action path, then freeze
4. **Mobile Landscape Card View** (C3) — extend B2 + C2 contracts at landscape breakpoints

---

## A. Full Table Desktop — FROZEN

Status: **FROZEN** (`FULL_TABLE_DESKTOP_FROZEN = true`)

View root: `bj-view-full-desktop`  
Reference: [`reference-ui/views/Mobil.png`](../reference-ui/views/Mobil.png) (canonical desktop mockup — Full Table panel)

Legacy reference: [`reference-ui/views/a_digital_blackjack_poker_style_casino_game_ui_scr.png`](../reference-ui/views/a_digital_blackjack_poker_style_casino_game_ui_scr.png)

### Zone order (top → bottom)

| Zone | Shell class | Content |
|------|-------------|---------|
| Bank info | (felt header) | Table name, bank total |
| Dealer | `bj-table-zone--dealer` | Dealer cards, hole card |
| Command | `bj-table-zone--summary` | Command box; insurance overlay when offered |
| Cards | `bj-table-zone--cards` `bj-cards-area--table` | Per-box stacks + values; **optional Double/Split overlay anchor** |
| Actions | `bj-table-zone--actions` | **Hit / Stay only** (primary row) |
| Player boxes | `bj-table-zone--boxes` | Box seats, committed amounts |
| Chip tray | `bj-table-zone--bottom` | Value + chip stash |

Vertical rules: stack above value (grid row 2 → 3); actions below card area; boxes below actions.

### Action region (frozen)

| Control | Location | Notes |
|---------|----------|-------|
| **Stay / Hit** | `bj-table-zone--actions` | `ds-btn--stand` / `ds-btn--hit` |
| **Double / Split / Play Hand** | **Cards zone** — `bj-optional-play-overlay-anchor` above stacks | `bj-insurance-overlay__btn`; **not** in the Hit/Stay row |
| **AID** | Hidden | `FULL_TABLE_DESKTOP_AID_VISIBLE = false` |

Double/Split are **not** duplicated in `BlackjackActionRow` (`showDouble={false}`, `showSplit={false}`).

### Spacing tokens (browser-validated)

Scoped under `@media (min-width: 721px) .bj-view-full-desktop` in `bj-full-table-card-area.css`:

- `--bj-full-desktop-actions-boxes-gap: 0.125rem` (Hit/Stay just above box row)
- `--bj-full-desktop-cards-actions-gap: 0.125rem` (margin between cards zone and actions row)
- `--bj-full-desktop-stack-value-gap: 0.3125rem`
- Card columns: `repeat(var(--slot-count), minmax(0, 1fr))` aligned with player boxes
- Play phase: card-column stack value suppressed; total in player box only

### Player boxes (all views)

During **play**: box shows owner, card ranks, and in-box hand total (`bj-phone-view__mini-hand-value`); **chip tokens hidden** inside the box frame; bet amount label stays **above** the box. During **betting**: chip stacks render inside the box as before.

### Invariants

- No internal scrollbars in card zone (`overflow: visible`).
- Single Hit/Stay path: `renderActionsContent()` → `BlackjackActionRow`.
- Card column geometry owned by `bj-full-table-card-area.css` + `BlackjackPanel.tsx`.

---

## B1. Full Table Mobile Portrait — FROZEN

Status: **FROZEN** (`FULL_TABLE_MOBILE_PORTRAIT_FROZEN = true`)

View root: `bj-view-full-mobile` (portrait orientation within mobile boundary)

**Media boundary:** `FULL_TABLE_MOBILE_PORTRAIT_MEDIA` in `blackjackLayoutContract.ts` — portrait `@media` lists in `bj-player-row-layout.css` (Contract C). JS mobile detection uses `MOBILE_LAYOUT_MEDIA` + viewport width/height (`MOBILE_MAX_WIDTH = 720`).

### Rules (same logic as desktop Full Table)

- Canonical zone order: dealer → command → cards → actions → boxes → tray.
- Same card column grid as desktop (outcome / stack / value); `bj-full-table-card-area.css` paired with `.bj-view-full-mobile`.
- **Optional Double/Split** in **command zone** (`renderSummaryContent`) — **not** the desktop cards-zone anchor.
- **Hit/Stay** only in `bj-table-zone--actions`.
- **AID** may show when `adviceEnabled`.
- Player boxes: Contract C (equal `1fr` columns) in `bj-player-row-layout.css`.

### Isolation

- Desktop polish tokens only under `@media (min-width: 721px) .bj-view-full-desktop`.
- Card View CSS must not override Full Table card-column layout.

**Backward-compatible alias:** `FULL_TABLE_MOBILE_FROZEN = true` (same as portrait).

---

## B2. Full Table Mobile Landscape — PENDING FREEZE

Status: **PENDING FREEZE** (`FULL_TABLE_MOBILE_LANDSCAPE_FROZEN = false`)

View root: still `bj-view-full-mobile` (device stays mobile when width > 720 on rotated phones).

**Media boundary:** `FULL_TABLE_MOBILE_LANDSCAPE_MEDIA` — sync with `MOBILE_LAYOUT_MEDIA_LANDSCAPE` in `mobileLayoutContract.ts`.

### Current layout (intended contract target)

- **Same zone order and card-column logic as B1** — landscape must not change gameplay layout semantics.
- **Different size tokens** — compressed dealer/command/actions/box/tray heights via `--bj-mobile-landscape-compact` and related `--bj-zone-*` overrides.
- Player boxes: Contract D (compact horizontal row) in `bj-player-row-layout.css`.
- Optional Double/Split: command zone (same as portrait).

### Owner files

| Role | Owner |
|------|--------|
| Landscape grid / zone bands | `src/styles/bj-full-mobile-landscape-layout.css` (landscape `@media` under `.bj-view-full-mobile` only) |
| Landscape zone tokens | `src/styles/bj-table-shared.css` (landscape `@media` blocks) |
| Landscape felt flex / tray pin | `bj-table-shared.css`, `BlackjackPanel.css` |
| Box row Contract D | `bj-player-row-layout.css` |
| Card columns (unchanged from B1) | `bj-full-table-card-area.css` |

### Current risks (documented, not fixed yet)

1. **Duplicate landscape `@media` blocks** in `bj-table-shared.css` — `(orientation: landscape)` inside the mobile block and `(min-width: 721px) and (orientation: landscape)` for wide phones; token values can drift.
2. **`overflow: hidden` on mobile felt/shell in landscape** — clip risk for card stacks if zone math is wrong.
3. **Same view root as portrait** — portrait CSS changes can break landscape silently.
4. **Tests often simulate width only** — orientation-specific behavior under-covered.

### Freeze criteria (before setting flag `true`)

- Single authoritative landscape token block (or documented parity between both blocks).
- Orientation-aware tests at e.g. 844×390 using `createMobileLayoutMatchMedia`.
- Zone order, visible cards, value below stack, actions below cards asserted.
- Portrait vs landscape media constants remain distinguishable.
- No `--bj-mobile-landscape-compact` on `.bj-view-full-desktop`.

### Tests required before freezing

- `fullTableMobileLandscapeFrozen.test.ts` (future) — markup + token guards
- Extend `blackjackLayoutContractGuards.test.ts` landscape section

---

## C. Card View — PENDING FREEZE (overview)

Card View shares `BlackjackTableLayoutShell` zone order but uses **`bj-cards-area--hero`** instead of `bj-cards-area--table`. Hero UI lives in `BlackjackCardView.tsx`. Do not treat Card View CSS as authoritative for Full Table.

**Canonical vertical order (shell):**

1. **Hero cards** (`bj-cards-area--hero` — card fan inside `BlackjackCardView`)
2. **Hero hand value** (reserved band inside hero cards zone, below fan)
3. **Hit / Stay** (`bj-table-zone--actions` — shared `BlackjackActionPanel` from `BlackjackPanel`, `variant="table"`)
4. **Player boxes** (`bj-table-zone--boxes` — shared `renderPlayerBoxesArc` / `renderArcSlot`)
5. **Shared tray** (`bj-table-zone--bottom` — shared `ValueAndChipsBar` / `renderTrayInner`)

No overlay of hero value or actions on hero cards. No Card View-specific Stay/Hit, player box, or tray implementation paths.

**Player boxes (all views):** During play, box shows owner, card ranks, and in-box hand total (`bj-phone-view__mini-hand-value`); chip tokens hidden inside box; bet amount stays above box. Betting phase still shows chips inside box.

Aggregate flag: `CARD_VIEW_FROZEN = false` until C1–C3 are frozen.

---

### C1. Desktop Card View — FROZEN

Status: **FROZEN** (`CARD_VIEW_DESKTOP_FROZEN = true`)  
View root: `CARD_VIEW_DESKTOP_ROOT` (`bj-view-card-desktop`)  
Reference: [`reference-ui/views/Desktop_Card.png`](../reference-ui/views/Desktop_Card.png)

**Vertical zone model (top → bottom):** Top nav → **7-band CSS grid** on felt: Dealer → Command → Hero cards → Hero value → Actions → Player boxes → Tray. Each band is one grid row; no cross-band margin/flex-flow offsets.

**Layout tokens** (scoped under `.bj-view-card-desktop` in `bj-card-desktop-layout.css`):

- `--bj-card-desktop-box-spread: space-between`
- `--bj-card-desktop-actions-boxes-gap: 0.0625rem` + `margin-bottom: -0.3125rem` on actions zone → **~5px** action-to-box gap (browser capture)
- `--bj-desktop-zone-actions-height: 3.35rem` with `justify-content: flex-end` (buttons at bottom of actions band)
- Felt cloth: `display: flex` on `.bj-felt-cloth-layer` in cards zone

**Grid rows:** `dealer` | `command` | `cards` (1fr) | `hero-value` | `actions` | `boxes` | `tray` — see `CARD_VIEW_DESKTOP_GRID_ROWS` in `blackjackLayoutContract.ts`.

**Structure:** Shell hero fan + dedicated `bj-table-zone--hero-value` below cards; canonical Hit/Stay via shared `BlackjackActionRow` in `bj-table-zone--actions`; shared `BlackjackPlayerBoxRow` / `BlackjackTrayRow`; hero third+ cards use `bj-phone-view__card-wrap--layered`; optional Double/Split in command zone overlay; This Table docked right.

**Player boxes (all views):** During play, box shows owner, card ranks, and in-box hand total (`bj-phone-view__mini-hand-value`); chip tokens hidden inside box; bet amount stays above box. Betting phase still shows chips inside box. **Desktop Card View:** four visible seats + add control only (`DEFAULT_VISIBLE_TABLE_BOXES = 4`).

**Owner files:** `bj-card-desktop-layout.css` (sole layout owner), `BlackjackCardView.tsx`, `bj-card-layout.css` (hero cosmetics), `BlackjackPanel.tsx`.

**Current risks:** CSS split across 4+ files; optional play in command zone (differs from Full Table desktop overlay).

**Freeze criteria:** Fixed 7-band grid; actions only in shell on desktop; hero value in own grid row; guards against `bj-full-table-card-area` in Card View paths.

**Tests before freeze:** `cardViewDesktopLayoutFrozen.test.ts` (future); consolidate `cardViewLayoutGuards`, `cardViewCentralLayout`, `cardViewDesktopFix`.

---

### C2. Mobile Portrait Card View — PENDING FREEZE

Status: `CARD_VIEW_MOBILE_PORTRAIT_FROZEN = false`  
View root: `CARD_VIEW_MOBILE_ROOT` (`bj-view-card-mobile`)

**Structure:** Same shell action zone as Full Table — canonical `BlackjackActionPanel` for Hit/Stay in `bj-table-zone--actions` (no hero side-action path). Hero value below cards at dealer-value size. Player boxes match all-view in-play total contract.

**Owner files:** `bj-card-mobile-portrait-layout.css` (portrait `@media` only under `.bj-view-card-mobile`).

**Current risks (documented):**

- Hero `overflow: hidden` on cards slot — fan clipping on short viewports.

**Freeze criteria:** `CARD_VIEW_CANONICAL_SHELL_ACTIONS_ONLY`; shell zone order; shared `fullArcBox` boxes with mobile Full Table; no horizontal page scroll.

**Tests before freeze:** `cardViewMobilePortraitFrozen.test.ts` (future); extend `mobileCardViewComposition.test.tsx`.

---

### C3. Mobile Landscape Card View — PENDING FREEZE

Status: `CARD_VIEW_MOBILE_LANDSCAPE_FROZEN = false`  
View root: `bj-view-card-mobile` at landscape media (`FULL_TABLE_MOBILE_LANDSCAPE_MEDIA` / `MOBILE_LAYOUT_MEDIA_LANDSCAPE`)

**Structure:** Same as C2 with Contract D box row and landscape shell tokens from `bj-table-shared.css`.

**Current risks:** Inherits B2 landscape token drift; C2 dual action path; hero fit at short heights (844×390).

**Freeze criteria:** B2 landscape tokens stable; C2 portrait frozen or dual-path resolved; landscape-specific composition tests pass.

**Tests before freeze:** `cardViewMobileLandscapeFrozen.test.ts` (future); landscape cases in `mobileCardViewComposition.test.tsx`.

---

## Layout ownership (enforced by `test:layout:ownership`)

| View | Layout owners |
|------|----------------|
| Desktop Full Table | `bj-full-table-card-area.css`, `bj-player-row-layout.css` (+ shell placement in `bj-table-shared.css`) |
| Desktop Card View | `bj-card-desktop-layout.css` only |
| Shell DOM order | `BlackjackTableLayoutShell.tsx` |
| Flags / constants | `blackjackLayoutContract.ts` |

**Guarded non-owners:** must not set forbidden layout properties on view zone selectors (see ownership tests).

**Card View guard:** `bj-card-desktop-layout.css` must not import or override Full Table card-column grid from `bj-full-table-card-area.css`.

---

## Related docs

- [SXM_MASTER_SPEC.md](./SXM_MASTER_SPEC.md) — product spec (defers layout detail here)
- [BLACKJACK_STABILITY_CONTRACTS.md](./BLACKJACK_STABILITY_CONTRACTS.md) — protocol / dealing / accounting
