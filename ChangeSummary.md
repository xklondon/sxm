# Change Summary — Targeted Blackjack cleanup (6 issues)

## 1. Files changed

| File | Change |
|------|--------|
| `src/styles/bj-full-table-card-area.css` | Mobile cards zone sizing/anchor; split desktop vs mobile play-zone stack anchoring |
| `src/styles/bj-table-shared.css` | Mobile HIT/STAY −15%; actions z-index 6; felt `pan-x` for box swipe |
| `src/components/tableCommandDisplay.ts` | Single player-turn command paragraph; empty command when `gameEnded` (overlay owns copy) |
| `src/components/DealerBlock.tsx` | Gold styling when command includes detail lines |
| `src/components/BlackjackPanel.tsx` | Removed dealer command props; suppress command when game-over overlay active |
| `src/components/blackjackMobileCleanup.test.tsx` | **New** — mobile layout, command, game-over route guards |
| `src/components/tableCommandDisplay.test.ts` | Updated for merged player-turn command |
| `src/components/blackjackFullTablePlayZoneLayout.test.ts` | Desktop stack band expects bottom anchor |
| `docs/CHANGE_LOG.md` | Entry for this cleanup pass |

## 2. Tests added/updated

| Test | Action |
|------|--------|
| `src/components/blackjackMobileCleanup.test.tsx` | **Added** — 8 tests: cards zone, stack anchor, button size, z-index/swipe, single command DOM, game-over route |
| `src/components/tableCommandDisplay.test.ts` | Updated merged player-turn expectations |
| `src/components/blackjackFullTablePlayZoneLayout.test.ts` | Desktop play-zone bottom-anchor contract |

## 3. Validation run

### Ownership — **RUN** `npm run test:ownership`

**Why run:** Touched `BlackjackPanel` wiring, command route, and layout CSS ownership.

**Result:** 10/10 pass (run at task start and after panel/command edits)

### Layout — **RUN** `npm run test:layout:target`

**Why run:** Card-area and play-zone CSS changed; layout contract tests guard regressions.

**Result:** 53/53 pass

### Blackjack engine — **RUN** `npm run test:blackjack:engine`

**Why run:** Verified end-game evaluator path unchanged (`evaluateTableGameEnd` / `gameOverEvaluation.test.ts`).

**Result:** 259/259 pass

### Mobile cleanup — **RUN** `npx vitest run src/components/blackjackMobileCleanup.test.tsx`

**Why run:** New targeted tests for this task.

**Result:** 8/8 pass

### Build — **RUN** `npm run build`

**Result:** pass

### Blackjack Layout — **SKIPPED** `npm run test:blackjack:layout`

**Why skipped:** No frozen stitch/reference imports; targeted layout + new cleanup tests cover this pass. Full 214-test batch reserved for broad shell geometry edits.

### People / Invites — **SKIPPED** `npm run test:people-invite`

**Why skipped:** Out of scope.

## 4. Architecture impact

- **Route confirmed:** `App → TableScreen → BlackjackPanel → BlackjackTableLayoutShell` (unchanged)
- **Issue 5 duplicate removed:** Obsolete second command source was dual `<p>` routes (green turn line + gold `commandLines`) plus unused `commandMessage`/`commandLines` on `dealerBlockProps`. Now one `BlackjackCommandBox` paragraph via `formatPlayerTurnCommand`; dealer uses `omitCommand` with no command props.
- **Issue 6 canonical route:** `evaluateTableGameEnd` → `applyTableGameEndIfNeeded` → `gameEnded` → `GameOverActionOverlay` (mobile overlay + desktop rail/table overlay). Command zone stays empty while overlay is active.
- **Issue 3 swipe:** Existing `useMobileBoxSwipeNavigation` on `.bj-casino__felt`; fixed pointer stacking (actions above cards) and horizontal `touch-action`.

## 5. Deploy readiness

| Gate | Status |
|------|--------|
| Ownership | Pass |
| Layout target | Pass |
| Engine | Pass |
| Mobile cleanup tests | Pass |
| Build | Pass |

**Ready for commit** after human review.

**Spec discipline: checked/updated `docs/CHANGE_LOG.md`.**
