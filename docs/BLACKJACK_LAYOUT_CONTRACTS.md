# Blackjack layout contracts

Canonical layout rules for all supported blackjack table views. Protocol, betting, and dealing boundaries live in [BLACKJACK_STABILITY_CONTRACTS.md](./BLACKJACK_STABILITY_CONTRACTS.md).

**Code constants:** `src/components/blackjackLayoutContract.ts`  
**Mobile boundary:** `src/styles/mobileLayoutContract.ts` (`MOBILE_MAX_WIDTH`, `MOBILE_LAYOUT_MEDIA`)

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

### Spacing tokens

Scoped under `@media (min-width: 721px) .bj-view-full-desktop` and shared desktop shell tokens for `.bj-view-card-desktop` actions in `bj-full-table-card-area.css`:

- `--bj-full-desktop-actions-boxes-gap: 0.125rem` (Hit/Stay close above box amount labels)
- `--bj-full-desktop-stack-value-gap: 0.3125rem` (gap between stack bottom and hand value)
- `--bj-full-desktop-dealer-command-gap: 0.1875rem`
- Card arc nudge: `translateY(18px)` on `.bj-full-table-card-area` (Full Table desktop only)

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

- `--bj-card-desktop-box-spread: space-evenly` — four boxes + add control span felt width
- `--bj-card-desktop-box-value-scale` — in-box hand total during play

**Grid rows:** `dealer` | `command` | `cards` (1fr) | `hero-value` | `actions` | `boxes` | `tray` — see `CARD_VIEW_DESKTOP_GRID_ROWS` in `blackjackLayoutContract.ts`.

**Structure:** Shell hero fan + dedicated `bj-table-zone--hero-value` below cards; canonical Hit/Stay via shared `BlackjackActionRow` in `bj-table-zone--actions`; shared `BlackjackPlayerBoxRow` / `BlackjackTrayRow`; hero third+ cards use `bj-phone-view__card-wrap--layered`; optional Double/Split in command zone overlay; This Table docked right.

**Player boxes (all views):** During play, box shows owner, card ranks, and in-box hand total (`bj-phone-view__mini-hand-value`); chip tokens hidden inside box; bet amount stays above box. Betting phase still shows chips inside box. **Desktop Card View:** four visible seats + add control only (`DEFAULT_VISIBLE_TABLE_BOXES = 4`).

**Owner files:** `BlackjackCardView.tsx`, `BlackjackCardView.css`, `bj-card-layout.css`, `bj-card-desktop-layout.css`, `bj-table-shared.css`, `bj-player-row-layout.css`, `bj-felt-skins.css`, `BlackjackPanel.tsx`.

**Current risks:** CSS split across 4+ files; optional play in command zone (differs from Full Table desktop overlay).

**Freeze criteria:** Fixed 7-band grid; actions only in shell on desktop; hero value in own grid row; guards against `bj-full-table-card-area` in Card View paths.

**Tests before freeze:** `cardViewDesktopLayoutFrozen.test.ts` (future); consolidate `cardViewLayoutGuards`, `cardViewCentralLayout`, `cardViewDesktopFix`.

---

### C2. Mobile Portrait Card View — PENDING FREEZE

Status: `CARD_VIEW_MOBILE_PORTRAIT_FROZEN = false`  
View root: `CARD_VIEW_MOBILE_ROOT` (`bj-view-card-mobile`)

**Structure:** Same shell action zone as Full Table — canonical `BlackjackActionPanel` for Hit/Stay in `bj-table-zone--actions` (no hero side-action path). Hero value below cards at dealer-value size. Player boxes match all-view in-play total contract.

**Owner files:** Same as C1 + portrait box row (Contract C) in `bj-player-row-layout.css`.

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

## Layout ownership (source guards)

| Role | Owner |
|------|--------|
| Full Table card column grid | `src/styles/bj-full-table-card-area.css` |
| Zone order, flags, media constants | `src/components/blackjackLayoutContract.ts` |
| Full Table arc + overlay wiring | `src/components/BlackjackPanel.tsx` |
| Shell DOM | `src/components/BlackjackTableLayoutShell.tsx` |
| Desktop optional-play overlay position | `src/components/OptionalPlayDecisionOverlay.css` |
| Compact optional-play buttons | `src/components/InsuranceDecisionOverlay.css` |
| Card View hero markup | `src/components/BlackjackCardView.tsx` |
| Mobile boundary | `src/styles/mobileLayoutContract.ts` |

**Guarded CSS** (must not introduce competing Full Table card-column grid):  
`bj-table-shared.css`, `bj-card-layout.css`, `bj-player-row-layout.css`, `BlackjackPanel.css`

**Card View guard:** `BlackjackCardView.tsx` and Card View sections of `bj-card-layout.css` must not import or override `bj-full-table-card-area` / Full Table column grid.

---

## Related docs

- [SXM_MASTER_SPEC.md](./SXM_MASTER_SPEC.md) — product spec (§13 mobile / view rules)
- [BLACKJACK_STABILITY_CONTRACTS.md](./BLACKJACK_STABILITY_CONTRACTS.md) — protocol / dealing / accounting
