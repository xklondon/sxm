# Blackjack Rendering & CSS Architecture Audit

**Date:** 2026-06-03  
**Scope:** Desktop + mobile table layout, zone hierarchy, CSS sources, Stitch reference comparison  
**Immediate fix applied:** Cloth layer moved from shell sibling into `CardsArea` so dealer/command/actions are no longer covered by felt markings.

---

## 1. Current render tree

```
BlackjackPanel
└── .bj-casino (+ view root: bj-view-full-desktop | bj-view-card-desktop | mobile variants)
    ├── Magic8Ball (optional, felt overlay — pointer-events none)
    └── .bj-casino__felt / .bj-table-surface
        └── .bj-casino__felt-main / .bj-table-layout-shell
            ├── Dealer          → .bj-table-zone--dealer → BlackjackDealerArea → DealerBlock (omitCommand)
            ├── Command         → .bj-table-zone--summary → BlackjackCommandBox → DealerCommandArea
            │                     (+ summaryExtras: round summary overlay when active)
            ├── Actions           → .bj-table-zone--actions → BlackjackActionPanel | insurance/even-money rows
            ├── CardsArea         → .bj-table-zone--cards (+ bj-cards-area--table | --hero)
            │   ├── Cloth         → .bj-felt-cloth-layer (classic-casino skin only)
            │   └── Content       → Full Table: .bj-arc--cards | Card View: BlackjackCardView
            ├── PlayerBoxes       → .bj-table-zone--boxes → .bj-arc--player-boxes
            └── ValueAndChips     → .bj-table-zone--bottom → ValueAndChipsBar
```

**Mobile-specific additions (not separate shell):**

| Addition | Where | Purpose |
|----------|-------|---------|
| `.bj-table-layout-shell::after` | `BlackjackCardView.css` (card-mobile only) | Opaque hero gameplay backdrop |
| `.bj-phone-view__*` controls | Inside CardsArea hero mode | Side Hit/Stand on mobile Card View |
| Mobile cloth scale vars | `bj-table-shared.css` `:root` in mobile media | `--bj-cloth-mobile-width`, `--bj-cloth-mobile-scale` |
| Portrait/landscape compress rules | `bj-table-shared.css` mobile blocks | Dealer/command/boxes height tokens |

**Panel wiring:** `BlackjackPanel.tsx` owns a single `BlackjackTableLayoutShell`. Command text comes from `buildBlackjackCommandText` → `BlackjackCommandBox`. Cloth from `BlackjackFeltClothLayer` via `feltClothLayer` prop (classic-casino skin only).

---

## 2. Canonical hierarchy

Required order (DOM + visual):

1. **Dealer Area** — cards/deck, Deal/Shuffle, Table Details  
2. **Command Box** — status pill (`DealerCommandArea` / `bj-card-layout__command`)  
3. **Hit / Stand** — `BlackjackActionPanel` in actions zone  
4. **CardsArea / Cloth** — playable cards + felt cloth decor (cloth is child of CardsArea)  
5. **Player Boxes** — flat arc of mini-hand tiles  
6. **Amount & Chips** — `ValueAndChipsBar` centered in tray row  

Shell comment and tests enforce: **Dealer → Command → Actions → CardsArea → PlayerBoxes → Tray**.

---

## 3. Actual CSS grid / flex model

### Desktop (`min-width: 721px`)

| Property | Value |
|----------|-------|
| Shell display | `grid` (one column) |
| Flexible row | `[cards] minmax(0, 1fr)` only |
| Row tokens | dealer `9rem`, gap-dc `0.55rem`, command `3.5rem`, actions `5rem`, boxes `6.65rem`, tray `3.85rem` |
| Gaps | `[gap-ca] 0.25rem`, `[gap-ac] 0.65rem`, `[gap-cb] 0.35rem`, `[gap-bt] 1.25rem` |

**Grid row assignment (`bj-table-shared.css`):**

| Zone | grid-row | z-index | overflow | notes |
|------|----------|---------|----------|-------|
| dealer | dealer | 2 | hidden | `isolation: isolate`, felt background |
| summary (command) | command | 3 | hidden | centered pill |
| actions | actions | 4 | hidden | opaque action panel bg |
| cards | cards | 5 | hidden | `position: relative`; cloth absolute inside |
| boxes | boxes | 6 | hidden | |
| bottom (tray) | tray | 7 | hidden | centered ValueAndChips |

**Cloth (`bj-felt-skins.css`):**

- Parent: `.bj-table-zone--cards` (`position: relative`)
- Layer: `.bj-felt-cloth-layer` — `absolute; inset: 0; z-index: 0`
- Card stacks: `.bj-table-zone--cards > :not(.bj-felt-cloth-layer)` — `z-index: 1`
- SVG text: top-aligned, `max-height: 48%` of CardsArea

### Mobile (`max-width: 720px` + coarse landscape)

| Property | Value |
|----------|-------|
| Shell display | `flex` column |
| CardsArea | `flex: 1 1 auto; min-height: 0` (grows) |
| Player boxes | `margin-top: auto` (pinned above tray) |
| Tray gap | `margin-top: var(--bj-zone-boxes-tray-gap)` on bottom zone |
| Zone heights | Mobile token overrides (dealer `6.5rem`, command `2.25rem`, etc.) |

**Cloth on mobile:** Scoped to `.bj-table-zone--cards .bj-felt-cloth-layer`; SVG uses scale/width vars, fills cards band (no shell-level `--bj-cloth-mobile-top` positioning in felt CSS after fix).

---

## 4. View differences

| Aspect | Desktop Full Table | Desktop Card View | Mobile Full Table | Mobile Card View |
|--------|-------------------|-------------------|-------------------|------------------|
| Shell zones | Same 6 zones | Same 6 zones | Same 6 zones | Same 6 zones |
| CardsArea content | `.bj-arc--cards` table stacks | `BlackjackCardView` hero fan | Table arc (smaller cards) | Hero fan + side controls |
| CardsArea modifier | `bj-cards-area--table` | `bj-cards-area--hero` | same | same + `::after` backdrop |
| Outer zone heights | Shared desktop grid tokens | **Identical** | Shared mobile flex tokens | **Identical** |
| Command route | Panel → CommandBox | **Same** | **Same** | **Same** |
| Action route | Shared ActionPanel | **Same** | **Same** | Hides duplicate Hit/Stand row in CSS |
| Player boxes | Shell-scoped arc rules | **Same shell rules** | Compact mobile tile rules | **Same** |
| Legacy routes | None in Panel | None | None | No `bj-card-layout` wrapper |

**Only intentional per-view difference:** CardsArea inner branch (`viewMode === 'full'` vs `BlackjackCardView`).

**Duplicate routes (audit result):**

- ✅ Single command: `BlackjackCommandBox` + `omitCommand` on dealer  
- ✅ No second `DealerCommandArea` in production Panel path  
- ⚠️ `BlackjackActionPanel` still supports `waitMessage` API but Panel never passes it (command zone owns wait text)  
- ⚠️ `DealerBlock` inline command when `omitCommand={false}` — legacy fallback, unused by Panel  

---

## 5. CSS source map

| File | Controls |
|------|----------|
| **`bj-table-shared.css`** | Canonical shell: flex (mobile) / grid (desktop), zone height tokens, grid-row assignment, dealer/command/actions/cards/boxes/tray sizing, player-box chrome, mobile portrait rules, desktop stage/rail, action panel chrome, ValueAndChips tray row |
| **`bj-card-layout.css`** | CardsArea **inner** content only: hero card dimensions, hero flex chains, table arc overflow inside cards, legacy `.bj-card-layout__command` wrapper width (command chrome still in shared) |
| **`BlackjackPanel.css`** | Casino chrome: arc rotation for **card columns only**, betting pulse states, mobile rail, Magic8 placement, legacy arc helpers — **not** shell zone heights |
| **`BlackjackCardView.css`** | Phone-view hero layout, mobile Card View side Hit/Stand, hero gameplay backdrop (`::after`), card-view-specific play stacks |
| **`DealerBlock.css`** | Dealer grid internals: bank column, card slot, action slot, command pill styling (when not omitted), Table Details button |
| **`ChipStack.css`** | Chip tokens (1/2/5/10/20/50), ValueAndChips centered row, tray button hit targets |
| **`bj-felt-skins.css`** | Cloth layer: SVG typography tokens, CardsArea-scoped absolute layer, desktop top-aligned text band, mobile scale |

---

## 6. Competing selectors / risks

### Outer zone sizing outside shared shell

| Risk | Location | Severity |
|------|----------|----------|
| Per-view desktop zone **heights** | None found (tests enforce) | ✅ Low |
| `bj-card-layout.css` outer cards `flex:1` / `height:100%` | Removed in prior refactor | ✅ Fixed |
| `.bj-view-full-desktop .bj-arc--cards` padding | `bj-table-shared.css` desktop block | ⚠️ Full Table only (cards content, not boxes) |

### Player boxes per-view

| Selector | Issue |
|----------|-------|
| `.bj-view-full-desktop .bj-table-zone--boxes` + card-desktop | Both in shared flex-end rule | ✅ Parity restored |
| `.bj-table-layout-shell .bj-table-zone--boxes .bj-arc--player-boxes` | Canonical shell-scoped arc | ✅ Preferred |
| Mobile-only mini-hand dimension locks | Many `.bj-view-*-mobile` rules | Expected; do not duplicate on desktop |

### Command / dealer per-view

| Selector | Issue |
|----------|-------|
| `.bj-view-*-desktop .dealer-block__center-col` | Shared desktop dealer chrome | OK |
| Mobile dealer `height: auto; max-height: none` | Intentional mobile overflow | OK |
| `.bj-table-layout-shell .bj-table-zone--summary .dealer-block__status` | Ellipsis on desktop | May clip long command text |

### Absolute positioning

| Element | Scope |
|---------|-------|
| `.bj-felt-cloth-layer` | **CardsArea only** (post-fix) |
| `.bj-felt-cloth-layer__svg` | Inside cloth layer |
| Magic8 answer zone | `.magic8-table-zone` on felt |
| Stitch reference | Entire stage uses `absolute` layers (not our model) |

### z-index above normal zones

| Layer | z-index |
|-------|---------|
| Cloth | 0 (inside cards) |
| Card content | 1 (inside cards) |
| Dealer | 2 |
| Command | 3 |
| Actions | 4 |
| Cards zone | 5 |
| Boxes | 6 |
| Tray | 7 |
| Magic8 | 2 on mobile column layout |

No z-index overlap hacks between dealer and command after fix.

### Overflow / scroll risks

- Desktop shell: `overflow: hidden` on all grid rows — intentional, prevents bleed  
- Command row: `overflow: hidden` + ellipsis on status — long text may clip  
- Mobile boxes: `overflow: hidden` on arc — prevents tile growth  

### Legacy / duplicate behavior

- `.bj-card-layout` wrapper — removed from Panel  
- `.bj-casino__tray` centered duplicate — removed  
- `BlackjackActionPanel` wait-message branch — dormant in Panel  
- `--bj-cloth-mobile-top` token — still defined in shared CSS but **no longer used** by felt CSS (cleanup candidate)  

---

## 7. Stitch design linkage

**Reference:** `reference-ui/stitch-export/Stitch Master/stitch_professional_casino_blackjack_redesign/desktop_card_view_standardized/`

### Implemented (conceptually)

| Stitch concept | SXM implementation |
|----------------|-------------------|
| Felt gradient stage | `--ds-color-felt`, classic-casino radial overlay |
| Dealer hand top-center | Dealer zone row + `DealerBlock` |
| Command pill | `DealerCommandArea` / `bj-card-layout__command` rounded pill |
| Hero hand focus (Card View) | `BlackjackCardView` in CardsArea hero mode |
| Hit/Stand prominence | Gold hit / stand buttons in `BlackjackActionPanel` |
| Player box row bottom | PlayerBoxes zone + flat arc |
| Chip tray / balance | `ValueAndChipsBar` centered in tray |
| Gold pulse on active box | `bj-box--selected`, `bj-bet-pulse` keyframes |
| Table name on felt | `BlackjackFeltClothLayer` title arc |

### Not implemented / diverges

| Stitch | SXM |
|--------|-----|
| Absolute-positioned entire stage | **CSS grid/flex shell** with fixed zone rows |
| Command at `top-[180px]` over hero | Command in **dedicated row above actions** |
| Actions below hero inside same band | Actions in **separate row above CardsArea** |
| Sidebar accounts (`sidebar-width: 320px`) | `.bj-casino__this-table--dock` rail (similar intent, different markup) |
| Stitch typography (Manrope / Libre Caslon) | Design-system + Georgia cloth titles |
| 7-box absolute `bottom-6` row | Grid boxes row with shell-scoped arc |
| Integrated insurance/split row under Hit/Stand | Secondary action row in same panel |

### Canonical going forward

**Treat as canonical:**

- `BlackjackTableLayoutShell` zone order and DOM ownership  
- `bj-table-shared.css` zone tokens + desktop grid rows  
- Single command route via `BlackjackCommandBox`  
- Cloth as **CardsArea child** (not shell sibling)  
- CardsArea as only view-divergent branch  

**Do not revert to Stitch's absolute overlay stack** for desktop — it caused the overlap bugs this fix addresses.

---

## 8. Recommendations

### Stable — freeze

- Shell zone order and `BlackjackTableLayoutShell` API  
- Desktop grid row tokens (`--bj-desktop-zone-*`)  
- Command route (`omitCommand` + `BlackjackCommandBox`)  
- Cloth inside CardsArea with `z-index: 0` / content `z-index: 1`  
- Chip denominations `[50, 20, 10, 5, 2, 1]`  
- Player-box shell-scoped rules (`.bj-table-layout-shell .bj-table-zone--boxes …`)  

### Refactor (low priority)

- Remove unused `--bj-cloth-mobile-top` / `--bj-cloth-mobile-bottom` if mobile cloth stays cards-scoped  
- Consolidate duplicate dealer-block padding rules (base vs desktop `@media`)  
- Consider `overflow: visible` on command row with fixed height if ellipsis clips legitimate messages  

### Never touch again (without full regression pass)

- Shell grid row names and order  
- Moving cloth back to shell sibling / full-shell `inset: 0`  
- Per-view outer zone height overrides on desktop  
- Second command mount on `DealerBlock` in Panel path  

### Grid vs flex

| Viewport | Model | Rationale |
|----------|-------|-----------|
| Desktop | **Grid** | Fixed dealer/command/actions/boxes/tray; CardsArea flex-grow row |
| Mobile | **Flex** | CardsArea grows; boxes `margin-top: auto`; simpler portrait reflow |

### Cloth placement (resolved)

**Cloth should be a CardsArea child** — implemented. Shell-level cloth with `position: absolute; inset: 0` caused markings to visually overlap dealer/command because absolute grid items with full inset could bleed visually; scoping to CardsArea containing block fixes separation.

---

## Appendix: Immediate fix summary (2026-06-03)

**Root cause:** `BlackjackFeltClothLayer` was a **direct shell child** sharing the CardsArea grid row with `position: absolute; inset: 0`, allowing felt SVG typography to render visually over dealer/command despite z-index stacking.

**Fix:**

1. Moved `{feltClothLayer}` inside `BlackjackCardsAreaZone` (before `{cardsArea}`).  
2. Re-scoped felt CSS to `.bj-table-zone--cards > .bj-felt-cloth-layer`.  
3. Removed `.bj-table-layout-shell > .bj-felt-cloth-layer` grid-row rule.  
4. Added `isolation: isolate` + felt background on dealer/command/actions desktop rows.  

**Files changed:**

- `src/components/BlackjackTableLayoutShell.tsx`  
- `src/styles/bj-felt-skins.css`  
- `src/styles/bj-table-shared.css`  
- `src/components/blackjackZoneSeparation.test.ts` (new)  
- Test updates: `blackjackRenderArchitecture`, `desktopCanonicalGrid`, `tableFeltSkin`, `mobileHeroGameplayPanel`, `mobileCardViewComposition`  

**Tests:** 1013 passed, 5 skipped · `tsc -b` OK · `vite build` OK  
