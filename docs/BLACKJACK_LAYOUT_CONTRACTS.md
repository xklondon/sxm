# Blackjack layout contracts

Canonical **Full Table** layout rules for desktop and mobile. Card View is not frozen yet.

**Reference (desktop Full Table):** [`reference-ui/views/a_digital_blackjack_poker_style_casino_game_ui_scr.png`](../reference-ui/views/a_digital_blackjack_poker_style_casino_game_ui_scr.png)

**Code constants:** `src/components/blackjackLayoutContract.ts`  
**Regression tests:** `src/components/blackjackFullTableLayoutFrozen.test.ts`, `src/components/blackjackFullTablePlayZoneLayout.test.ts`

---

## Before changing Full Table Desktop or Mobile layout

1. Update **this document** with the intended change and rationale.
2. Add or update **contract tests** in `blackjackFullTableLayoutFrozen.test.ts` (and related files).
3. Update **`blackjackLayoutContract.ts`** constants if zone order, allowed buttons, or owner files change.
4. Run `npm test` and `npm run build`.
5. Verify desktop Full Table against the reference image and confirm mobile Full Table + Card View are unchanged unless explicitly in scope.

**Full Table Desktop and Mobile layouts are frozen unless this checklist is followed.**

---

## A. Full Table Desktop — frozen

Status: **FROZEN** (`FULL_TABLE_DESKTOP_FROZEN`)

View root: `bj-view-full-desktop`

### Zone order (top → bottom)

| Zone | Shell class | Content |
|------|-------------|---------|
| Bank info | (felt header) | Table name, bank total |
| Dealer | `bj-table-zone--dealer` | Dealer cards, hole card |
| Command | `bj-table-zone--summary` | Command box text; insurance overlay when offered |
| Cards | `bj-table-zone--cards` `bj-cards-area--table` | Per-box card stacks + values; optional Double/Split overlay |
| Actions | `bj-table-zone--actions` | Hit / Stay primary row |
| Player boxes | `bj-table-zone--boxes` | Box seats, committed amounts |
| Chip tray | `bj-table-zone--bottom` | Value + chip stash |

Exact vertical rule:

1. **Cards stack above value** — grid row 2 (stack host `bj-arc__play-zone`), cards grow **upward**.
2. **Value below cards** — grid row 3 (`bj-phone-view__box-value--card-column-below`).
3. **Actions below card area** — `bj-table-zone--actions` follows `bj-table-zone--cards` in DOM.
4. **Player boxes below actions** — `bj-table-zone--boxes` follows actions.

### Action region (frozen)

| Control | Location | Size / style |
|---------|----------|--------------|
| **Stay / Hit** | Actions zone primary row | `ds-btn--stand` / `ds-btn--hit` — primary row buttons |
| **Double / Split** | Optional play overlay above card stacks (`bj-optional-play-overlay-anchor`) | `bj-insurance-overlay__btn` — compact; smaller chrome than Hit/Stay |
| **Play Hand** | Same overlay (decline split) | Same compact overlay buttons |
| **AID** | **Hidden** on desktop Full Table (`FULL_TABLE_DESKTOP_AID_VISIBLE = false`) | — |

Double and Split are **not** duplicated in the Hit/Stay action row (`showDouble={false}`, `showSplit={false}` in `BlackjackActionPanel`).

### Spacing tokens (desktop polish)

Scoped under `@media (min-width: 721px) .bj-view-full-desktop` in `bj-full-table-card-area.css`:

- `--bj-full-desktop-actions-boxes-gap: 0.625rem` (~10px Hit/Stay → box amounts)
- `--bj-full-desktop-stack-value-gap: 0.3125rem` (~5px stack → value)
- `--bj-full-desktop-dealer-command-gap: 0.1875rem` (~3px command clearance)
- Card arc nudge: `translateY(18px)` on `.bj-full-table-card-area`

### Invariants

- **No internal scrollbars** in the Full Table card zone (`overflow: visible`; no `overflow-x: hidden` + `overflow-y: visible` pair).
- **No vertical centering** of the card column grid in the card area (`justify-content: flex-end` on card zone).
- **Single Hit/Stay render path** — `renderActionsContent()` → `BlackjackActionPanel` (one instance in `BlackjackPanel.tsx`).
- **Layout ownership** — card column geometry only in `bj-full-table-card-area.css` + Full Table render path in `BlackjackPanel.tsx` (see contract constants).

---

## B. Full Table Mobile — frozen

Status: **FROZEN** (`FULL_TABLE_MOBILE_FROZEN`)

View root: `bj-view-full-mobile`

### Rules

- **Same canonical zone order** as desktop Full Table (dealer → command → cards → actions → boxes → tray).
- **Same card column contract** — outcome / stack / value grid rows; stacks visible; values below cards.
- **Same DOM components** as desktop Full Table (`BlackjackPanel`, `BlackjackTableLayoutShell`, shared selectors in `bj-full-table-card-area.css` paired with `.bj-view-full-mobile`).
- **Optional Double/Split overlay** renders in the **command zone** (not cards-zone anchor) when legal.
- **Hit/Stay** only in `bj-table-zone--actions` (never inside card area).
- **AID** may show when `adviceEnabled` (mobile Full Table is not subject to desktop AID freeze).

### Isolation

- Desktop-only polish (`translateY(18px)`, desktop gap tokens) must stay under `@media (min-width: 721px) .bj-view-full-desktop` — **no desktop CSS may change mobile Full Table**.
- Card View CSS (`bj-view-card-desktop`, `bj-view-card-mobile`, `bj-cards-area--hero`) must **not** override Full Table card-column layout.
- View boundary: `MOBILE_MAX_WIDTH` (720) — JS (`useIsMobileViewport`) and CSS media queries must agree.

---

## C. Card View — not frozen yet

Status: **PENDING FREEZE** (`CARD_VIEW_FROZEN = false`)

View roots: `bj-view-card-desktop`, `bj-view-card-mobile`

Card View shares the table shell zone order but uses `bj-cards-area--hero` instead of the Full Table arc card row. Layout polish and hero/action-bar rules may still change. Do not treat Card View CSS as authoritative for Full Table.

---

## Layout ownership (source guards)

| Role | Owner |
|------|--------|
| Full Table card column grid, stack/value pinning, actions zone height | `src/styles/bj-full-table-card-area.css` |
| Zone order, view roots, frozen constants | `src/components/blackjackLayoutContract.ts` |
| Full Table arc render, overlay placement, action wiring | `src/components/BlackjackPanel.tsx` |
| Shell DOM structure | `src/components/BlackjackTableLayoutShell.tsx` |
| Desktop optional-play overlay positioning | `src/components/OptionalPlayDecisionOverlay.css` |
| Compact optional-play button chrome | `src/components/InsuranceDecisionOverlay.css` (`.bj-insurance-overlay__btn`) |

**Guarded files** (must not introduce competing card-column layout):  
`bj-table-shared.css`, `bj-card-layout.css`, `bj-player-row-layout.css`, `BlackjackPanel.css`

**Card View guard:** `BlackjackCardView.tsx` and Card View sections of `bj-card-layout.css` must not import or override Full Table layout classes (`bj-full-table-card-area`, Full Table card-column grid).

---

## Related docs

- [SXM_MASTER_SPEC.md](./SXM_MASTER_SPEC.md) — product spec
- [BLACKJACK_STABILITY_CONTRACTS.md](./BLACKJACK_STABILITY_CONTRACTS.md) — protocol / dealing / accounting boundaries
