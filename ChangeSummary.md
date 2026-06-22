# Full Work Summary — Blackjack UI Stabilization Pass

## Root cause summary

1. **Reveal sequencing** — Command text, cloth status, and outcome badges read authoritative `gameState` while paced deal still had masked `displayState`. UI rendered blackjack/even-money messaging before both player cards were visually revealed.
2. **Wrong command styling** — Default `DealerBlock.css` green (`.dealer-block__status`) competed with canonical gold; not scoped to command zone on all views.
3. **Mobile card overlap** — Mobile Full Table play-zone used `justify-content:flex-start` and `margin-top:auto` on the arc row, pushing stacks into the boxes/tray band.
4. **Desktop card overlap** — Full Table cards zone had `overflow:visible`, allowing upward stack bleed into the command zone.
5. **Mobile even-money unreadable** — Ace-decision / insurance buttons below 44px tap target on mobile.

## Structural fixes

### A. UI render contract (`src/components/blackjackUiRenderContract.ts`)
- `createUiRevealContext`, `isHandVisiblyRevealed`, `isBoxVisiblyRevealed`
- `resolveUiProtocolPhase`, `canShowInsuranceDecisionUi`, `canShowEvenMoneyDecisionUi`
- `resolveGatedCardAreaOutcomeMarker`, `gateCommandMessageForReveal`, `gateCommandForReveal`
- `CANONICAL_COMMAND_WRAPPER_CLASS`, `CANONICAL_COMMAND_STATUS_CLASS`

### B. Reveal engine hook
- `isHandFullyVisibleInDisplay` in `cardRevealDisplay.ts`
- `getDisplayBlackjackProtocolPhase` defers even-money until offer hand visible

### C. Wired into views
- `tableCommandDisplay.ts` — even-money + final command gated
- `BlackjackPanel.tsx` — gated badges, insurance/even-money overlays, debug reveal diagnostics
- `BlackjackCardView.tsx`, `CardViewDesktopHeroArea.tsx` — gated hero/stack outcome markers
- `DealerBlock.tsx` — `CANONICAL_COMMAND_STATUS_CLASS` on command status

### D. Layout (cards zone only — no box/tray moves)
- Desktop Full Table cards zone: `overflow:hidden`, `justify-content:flex-end`
- Mobile Full Table: cards zone `overflow:hidden`, play-zone `flex-end`, arc row `margin-top:0`
- Canonical yellow command text in `bj-table-shared.css` command zone

### E. Mobile decision UI
- Insurance overlay buttons: `min-height:44px` on mobile insurance phase
- Ace-decision (even-money) buttons: `min-height:44px` in actions zone on mobile

### F. Layout debug (`?layoutDebug=1`)
- Phase, UI protocol phase, reveal complete, command message + source
- Per-box game result vs UI-visible result
- Cards zone overflow, card stack bounds, overlap warnings

## Alternate command route removed/disabled
- **Disabled path:** inline `DealerBlock` command when panel passes `omitCommand` — command renders only via `BlackjackCommandBox` → `DealerCommandArea` in the summary/command zone.
- **Removed competing style:** green default `.dealer-block__status` overridden in command zone with gold (`--ds-color-gold`) for all views.

## Reveal-gating selectors added
- `isHandVisiblyRevealed` / `isBoxVisiblyRevealed`
- `resolveGatedCardAreaOutcomeMarker`
- `gateCommandForReveal` / `gateCommandMessageForReveal`
- `canShowEvenMoneyDecisionUi` / `canShowInsuranceDecisionUi`
- `resolveUiProtocolPhase`

## Layout overlap tests added
- `src/components/blackjackUiRenderContract.test.ts` (reveal gating, canonical command, overlap CSS guards)
- Extended `productionRouteOwnership.test.ts` (yellow command, desktop `overflow:hidden` on cards zone)

## Files changed
- `src/components/blackjackUiRenderContract.ts` (new)
- `src/components/blackjackUiRenderContract.test.ts` (new)
- `src/engine/blackjack/dealing/cardRevealDisplay.ts`
- `src/engine/blackjack/protocol.ts`
- `src/components/blackjackDealingContract.ts`
- `src/components/tableCommandDisplay.ts`
- `src/components/useBlackjackTableFlow.ts`
- `src/components/BlackjackPanel.tsx`
- `src/components/DealerBlock.tsx`
- `src/components/BlackjackCardView.tsx`
- `src/components/CardViewDesktopHeroArea.tsx`
- `src/components/blackjackLayoutDebug.ts`
- `src/components/BlackjackLayoutDebugPanel.tsx`
- `src/components/blackjackLayoutDebug.test.ts`
- `src/components/productionRouteOwnership.test.ts`
- `src/components/InsuranceDecisionOverlay.css`
- `src/styles/bj-table-shared.css`
- `src/styles/bj-blackjack-table-shell.css`
- `src/styles/bj-full-table-card-area.css`
- `package.json`
- `docs/CHANGE_LOG.md`

## Test results
| Command | Result |
|---------|--------|
| `npm run test:ownership` | 27 passed |
| `npm run test:layout:target` | 53 passed |
| `npm run test:blackjack:layout` | 215 passed |
| `npm run build` | Success |

## Browser checklist
1. **Blackjack reveal timing** — Deal natural BJ on box 1; confirm no blackjack badge, box status, or command text until both cards are visible.
2. **Mobile Full Table card overlap** — Cards stay in cards band; no overlap with player boxes or chip tray.
3. **Mobile even-money readability** — Dealer Ace up, player natural; Take 1:1 / Play buttons ≥44px, legible text.
4. **Canonical yellow command box** — Command text gold/yellow on mobile and desktop Full Table + Card View.
5. **Desktop Full Table cards** — Stacks bottom-pinned inside cards zone; no overlap with command box or boxes/tray.

**Spec discipline: checked/updated SXM_MASTER_SPEC.md and CHANGE_LOG.md.**
