# Blackjack engine & layout freeze

**Freeze date:** 2026-06-13

This document marks the **frozen baseline** for SXM Blackjack. New card/dice games must use **separate protocol modules and table panels** — not changes to the frozen paths below unless an explicit **unfreeze** is requested and documented.

Related guards:

- Layout zones & view roots: [BLACKJACK_LAYOUT_CONTRACTS.md](./BLACKJACK_LAYOUT_CONTRACTS.md)
- Protocol / dealing / accounting boundaries: [BLACKJACK_STABILITY_CONTRACTS.md](./BLACKJACK_STABILITY_CONTRACTS.md)
- Contract constants: `src/components/blackjackLayoutContract.ts`
- Guard tests: `src/components/blackjackEngineFreezeGuards.test.ts`, `blackjackLayoutContractGuards.test.ts`

---

## Frozen scope

| Area | Frozen paths / behaviour |
|------|---------------------------|
| **Rules & settlement** | `src/engine/blackjack/` — protocols, stakes, insurance, split/double, bust, bank draw, payouts, `applyBlackjackActionToState` |
| **Dealing flow** | Initial deal order, natural/staged reveal, `blackjackDealingContract`, `useSequentialCardReveal` |
| **Phase model** | `protocol.ts`, `blackjackViewPhase.ts`, `getBlackjackRoundPhase`, command/action text model (`tableCommandDisplay.ts`) |
| **Desktop Full Table** | `bj-view-full-desktop`, `bj-full-table-card-area.css`, frozen desktop polish tokens |
| **Desktop Card View** | `bj-view-card-desktop`, `CardViewDesktopHeroArea`, `bj-card-desktop-*` layout owners |
| **Mobile portrait** | `bj-view-card-mobile` portrait owner, `bj-view-full-mobile` portrait shell |
| **Mobile landscape Full Table** | `bj-full-mobile-landscape-layout.css`, landscape grid on `.bj-dealer-area` |
| **Split flow** | Split hand keys, companion cluster display, active-hand progression (display only; engine keys unchanged) |
| **Shared shell** | `BlackjackTableLayoutShell` zone order, `blackjackViewZones`, `BlackjackDealerArea`, `BlackjackActionRow` / `renderActionsContent`, player boxes arc, tray row |

**Frozen view flags** (see `blackjackLayoutContract.ts`):

- `FULL_TABLE_DESKTOP_FROZEN`
- `FULL_TABLE_MOBILE_PORTRAIT_FROZEN`
- `FULL_TABLE_MOBILE_LANDSCAPE_FROZEN`
- `CARD_VIEW_DESKTOP_FROZEN`
- `CARD_VIEW_MOBILE_PORTRAIT_FROZEN`

---

## Allowed without unfreeze

- Small **visual polish** (tokens, spacing) scoped under a single view root
- **Copy** fixes (labels, tooltips, outcome badge text)
- **Bug fixes** with targeted tests proving parity (online/offline, engine/UI)
- Mobile landscape Card View (C3) — not yet frozen (`CARD_VIEW_MOBILE_LANDSCAPE_FROZEN = false`)

---

## Blocked without explicit unfreeze

- Blackjack **engine rules**, phase transitions, betting/settlement logic
- **Shell zone order** or shared dealer / command / cards / actions / boxes / tray components
- Second gameplay code path (online vs offline divergence)
- Folding **Zilch / Hold'em** (or future games) into `BlackjackPanel` or `applyBlackjackActionToState`
- Broad responsive rewrites or desktop selector changes for mobile fixes

---

## New games gate

**New games** (dice, poker, etc.) must:

1. Add an engine module under `src/engine/<game>/`
2. Add a dedicated panel (or extend `TableScreen` routing by `tableGame` / `gameCategory`)
3. Extend server `TABLE_ACTIONS` + `applyAction` + `authority.ts` for that protocol only
4. **Not** modify frozen Blackjack engine files or shared blackjack shell layout unless unfreezing

See `.cursorrules` — Cards vs Dice categories; do not fold dice logic into `BlackjackPanel`.

---

## Routine validation

```bash
npm run test:layout:audit
npm run test:layout:fast
npm run build
npx tsx scripts/runtime-visual-branch-audit.mts
```

Heavy rendered geometry (`blackjackRenderedLayout.test.tsx`) is **manual only**: `npm run test:layout:rendered`.

---

## Unfreeze process

1. State scope in a PR / task (engine vs layout vs one view root)
2. Update this doc and `CHANGE_LOG.md`
3. Adjust freeze flags in `blackjackLayoutContract.ts` deliberately
4. Run full validation including any affected browser captures
