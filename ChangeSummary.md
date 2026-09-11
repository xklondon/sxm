# Change Summary — Blackjack mobile layout and responsiveness

## 1. Files changed

- **Canonical mobile layout:** `src/styles/bj-blackjack-table-shell.css`, `src/styles/bj-table-shared.css`, `src/styles/bj-full-table-card-area.css`, `src/styles/bj-mobile-landscape-layout.css`, `src/components/ChipStack.css`.
- **Command/actions:** `src/components/BlackjackPanel.tsx`, `BlackjackActionPanel.tsx`, `DealerBlock.tsx`, `tableCommandDisplay.ts`.
- **Performance diagnostics:** new `src/components/blackjackPerfDiagnostics.ts`; online RTT wiring in `src/hooks/useOnlineMultiplayer.ts`. Enable with `VITE_BLACKJACK_PERF=true`.
- **Browser geometry:** `scripts/capture-mobile-card-layout.mts` now loads the production CSS cascade, captures Full Table plus Card View zones, and rejects command/cards/actions/boxes/tray overlap. Updated `reference-ui/captures/Mobile_Card_bounding_boxes*.json`.
- **Docs:** `docs/SXM_MASTER_SPEC.md`, `docs/BLACKJACK_LAYOUT_CONTRACTS.md`, `docs/CHANGE_LOG.md`.
- **Tests:** updated the affected mobile layout, command text, frozen-layout guard, placement-contract, commander, action, and zone-dimension tests; added `src/components/blackjackPerfDiagnostics.test.ts`.

## 2. Tests added / updated

- Added development-only performance diagnostic contract coverage.
- Added/updated guards for canonical actions → boxes → tray order, no mobile zone transforms/absolute positioning, shell-owned row geometry, one tray safe-area owner, compact command hierarchy, online busy state, and updated command copy.
- Extended the Playwright mobile capture to verify actual non-overlapping geometry for Card View (2/3/4 cards) and Full Table.
- Existing hit/stand/double/next-round, box commander, bank Cards authority, version guard, card timing, and reveal pacing regressions remain green.

## 3. Validation run

- **Ownership:** `npm run test:ownership` — run, 28 passed.
- **Layout target:** `npm run test:layout:target` — run, 53 passed.
- **Blackjack layout:** `npm run test:blackjack:layout` — run, 262 passed.
- **Dedicated mobile browser:** `npm run test:mobile-card-layout:browser` — run, capture assertions passed; 8 Vitest tests passed.
- **Changed mobile/action/authority regression set:** run, 101 passed.
- **Portrait/landscape ownership regression set:** run, 69 passed.
- **Blackjack engine:** `npm run test:blackjack:engine` — run, 344 passed.
- **Build:** `npm run build` — run, passed; pre-existing bundle-size warning only.
- **Lint:** `npm run lint` — run, repository baseline remains red (342 errors, 78 warnings across pre-existing files). IDE diagnostics report no errors in changed production files.
- **Full `npm test` / `blackjackRenderedLayout.test.tsx`:** skipped per `.cursorrules`.

## 4. Architecture impact

- Production route remains `App → TableScreen → BlackjackPanel → BlackjackTableLayoutShell`; no alternate render path was added.
- `BlackjackTableLayoutShell` is the mobile vertical geometry owner. Full Table card-area CSS no longer moves command/cards/actions zone wrappers.
- Full Table landscape remains solely owned by `bj-full-mobile-landscape-layout.css`; the generic landscape file is now Card View-only, and the shared wide-mobile flex/grid reset was removed.
- Mobile order is bank/dealer → command → cards (`1fr`) → actions → boxes → tray. The shell uses a definite height so the `1fr` cards row receives remaining space.
- The command still has one source/render path; existing `commandMessage` and `commandLines` now provide primary/secondary hierarchy.
- Existing `flowSettings.getNextCardDelay()` → `scheduleNextCardReveal()` remains the sole card cadence source. No reveal/dealing timer, game rule, settlement, payout, authority, invite, or auth logic changed.

## 5. Deploy readiness

- Required build and targeted validation tiers are green.
- Browser geometry at 390×844 shows exact adjacent cards/actions/boxes/tray boundaries in both mobile views; no cross-zone overlap.
- Lint is not newly clean and remains a repository-wide pre-existing gate issue; changed production files have no IDE lint diagnostics.

Spec discipline: checked/updated SXM_MASTER_SPEC.md and CHANGE_LOG.md.
