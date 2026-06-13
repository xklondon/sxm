# SXM Change Log

Significant product and architecture changes. For the authoritative current-state description, see **[SXM_MASTER_SPEC.md](./SXM_MASTER_SPEC.md)**.

## Process rule

Every significant feature change must update **both**:

1. `docs/SXM_MASTER_SPEC.md` — reflect new behavior
2. `docs/CHANGE_LOG.md` — record what changed and when

before the work is considered complete. This rule is also stated in `.cursorrules`.

---

## 2026-06-12 — Game Over upgrade + desktop table polish

- **Game Over UI:** Title **Game Over**; extensible glyph visuals; winner/result/rounds summary; Magic 8 line; ledger either/or (**Add to Ledger** / **Don't Add**); **Create IOU** toggle + optional **Add message to IOU** (passed as IOU `message` param); **New Game** applies choices then reset — dismiss/close does not save.
- **Desktop polish:** Nav buttons aligned to felt right edge; card values below stacks; game-ended card-row spacing; dealer New Game suppressed while game-over UI active; desktop tray label restored.
- **Mobile:** ~10% larger table typography via scoped CSS tokens (not chip/card scale).
- **Tests:** `blackjackDesktopPolish.test.tsx`, updated game-over overlay/presentation tests.

---

## 2026-06-12 — Box/token placement stabilization

- **Stable UI anchor:** Local chip target is `{ slotNumber }` only; arc React keys are `slot-${slotNumber}`; unified `renderArcSlot`.
- **Online optimistic:** Empty-slot first chip uses pending preview by slot — no client `claimBoxSlot` or visual `boxId` materialization.
- **Payload:** `resolvePlaceBetPayloadTarget` derives `boxId` vs `slotNumber` at send time; rapid taps serialized per slot.
- **Visible row:** `resolveEffectiveVisibleBoxCount` no longer auto-expands from highest occupied slot.
- **Layout:** Fixed stake slot + absolute chip pile in arc row; removed arc `renderBetZone` dual path.
- **Legacy:** `resolveChipTrayBetTarget` deprecated; removed `selectedSeatId` from betting paths (player-turn Card View hero still uses it).
- **Tests:** `blackjackBoxPlacementStability.test.ts`; contract docs in `BLACKJACK_STABILITY_CONTRACTS.md`.

---

## 2026-06-12 — Blackjack cleanup: layout polish + bank-player shared pot

- **Bank value:** `bj-dealer-hand-value` padding under dealer cards (`TableInfoBar.css`).
- **Active value:** tight numeric frame (`border-radius: 0.32em`) replaces oversized ellipse on `bj-phone-view__box-value--active-turn`.
- **Desktop Full Table:** card columns pushed lower toward player boxes (desktop-only CSS).
- **Shared pot accounting:** `sharedBankroll.ts` — same person as bank + player uses one ledger pot; tray/validation via `bankroll.ts` + `blackjackAccountingDisplay`; no duplicate owner allocation when bank already funded.
- **Tests:** `blackjackCleanupFixes.test.ts`, `sharedBankroll.test.ts`.

---

## 2026-06-12 — Blackjack stability regression audit (dealing + accounting fences)

- **Dealing root cause:** First-mount `hydrateInstant` bypass in `useSequentialCardReveal` skipped P→D→P→D natural reveal; `resolveRevealScopeTransition(null)` now returns `reset`; mid-round join uses `shouldSnapCardRevealOnMount`.
- **Dealing display:** All view imports routed through `blackjackDealingContract`; command text + dealer/player phrases use masked `displayState`; “Round finished” gated on `cardRevealComplete`.
- **Accounting:** `evaluateTableGameEnd` uses `resolvePersonEndGameBalances`; tray/This Table parity tests enforced.
- **Docs/tests:** `BLACKJACK_STABILITY_CONTRACTS.md` DEALING/ACCOUNTING fences; expanded contract + dealing regression tests.

---

## 2026-06-12 — Blackjack stability contract layer

- **Protocol:** `blackjackActionContract.ts` — single view import for action permission + hand legality; Panel/Card View migrated off direct engine imports.
- **Layout:** `blackjackLayoutContract.ts` + contract tests for view roots, `displaySlots` alignment, active-value highlight.
- **Dealing:** `blackjackDealingContract.ts` + `dealingRoundRegression.test.ts` (round 1/2 reveal gating).
- **Accounting:** `blackjackAccountingDisplay.ts` — tray + This Table use `resolvePersonDisplayBalances` / `resolveViewerTrayAvailable`.
- **Docs:** `docs/BLACKJACK_STABILITY_CONTRACTS.md`; SXM_MASTER_SPEC stability table.

---

## 2026-06-12 — Blackjack wiring/display fixes (controls, exposure, highlight, alignment)

- **Hit/Stay:** `canShowPlayerDecisionControls` treats engine player-turn + active-hand reveal ready as effective player phase; `resolveViewerActionPermission` gates controls to box caller only.
- **This Table + tray:** `playerCommittedExposure.ts` canonical helper; `bankroll.ts` delegates exposure; `clampAvailableForDisplay` prevents negative tray/This Table available.
- **Active value:** `cardColumnHandValueClassName` — circular highlight on card-column number only; no box turn border.
- **Alignment:** Card row and box row both iterate `displaySlots` in slot order (shared 1fr grid).
- **Box content:** Owner name + rank list (`formatBoxCardRanksLabel`) inside box; committed amount above box.

---

## 2026-06-12 — Insurance targeting fix

- Insurance decision owner follows **stake attribution** (`getInsuranceDecisionPersonIdForBox`): sole staker decides and pays from their bankroll; shared boxes fall back to box caller.
- **One person-scoped decision** covers all pending eligible boxes (`takeInsuranceForPersonOnState` / `declineInsuranceForPersonOnState`); overlay only for viewers with a pending decision.
- Online authority accepts `personId` payload for insurance actions; synced engine `.js` mirrors.

---

## 2026-06-09 — Challenge bank-bust settlement setup option

- **New Table → Challenge:** required **Bank bust settlement** choice — **Fractional / Ranked** (default) or **Winner Takes All**; stored as `tableMeta.bankBustSettlementMode`.
- **Winner takes all:** bank bust awards the sole highest remaining chip total; tied top totals fall back to ranked/fractional without a fake winner.
- **Practice:** selector hidden; behavior unchanged.
- **Ledger:** `settlementMode` on ended table + score ledger entry reflects effective settlement.
- **Tests:** `bankBustSettlement.test.ts`.

---

## 2026-06-09 — Challenge accounting and game-end presentation

- **Challenge bank:** Always a real seated player (no dealer/house option in Challenge setup); bank identity shown as **Bank: [Name]** in dealer/felt info.
- **Fractional settlement:** Default when bank bust leaves multiple non-bank chip holders — ranked final totals in message + score ledger participants (`challengeEndAccounting.ts`); IOU only when one clear debtor/creditor pair.
- **Desktop game end:** **Game Summary** in right-hand This Table panel — table/cards stay visible; no blocking overlay.
- **Mobile game end:** Existing centered overlay retained unchanged.
- **IOU toggle:** Moved below Add to Ledger / Don't Add buttons.
- **Tests:** `challengeEndAccounting.test.ts`, `challengeGameEndPresentation.test.tsx`, game-end UI wiring updates.
- **Docs:** `SXM_MASTER_SPEC.md` §5 table modes + game end presentation.

---

## 2026-06-07 — Challenge flow fixes (bank identity, rematch, chip remove)

- **Chip remove:** `×` control moved below stake pile; pile-only scale; stake slot `overflow: visible`; stable `--bj-full-table-stake-min-height`.
- **Challenge bank:** Bank seat is a real player; wins show `"[Name] wins as Bank"`; ledger/IOU use player ids/emails (`challengeBankDisplay.ts`).
- **Practice:** Bot bank remains house/dealer; anonymous bank winner id allowed in ledger.
- **New Game:** Game-over overlay always dismisses after ledger/IOU confirm; **New Game** opens `TableStakePanel` rematch on same table id/people.
- **Tests:** `challengeBankDisplay.test.ts`, `stakeChipRemove.test.tsx`, game-over overlay integration updates.
- **Docs:** `SXM_MASTER_SPEC.md` §5 table modes, rematch, stake chips.

---

## 2026-06-07 — Mobile chip tray polish

- **Value label:** Removed `Available:` prefix; bankroll shows numeric value only (tabular numerals), left of chip row.
- **Layout:** `ValueAndChipsBar` row 1 = value + chips (nowrap); mobile row 2 = table label when set. Shared Table + card views.
- **Spacing:** Single `--bj-chip-tray-gap` token; stash `overflow: hidden` prevents overlap with value.
- **Mobile plaques:** ~12% smaller visual (`--chip-plaque-visual-*`) with preserved hit target (`--chip-plaque-hit-*`).
- **Tests:** `mobileChipTrayLayout.test.ts` + updates to tray layout specs.
- **Docs:** `SXM_MASTER_SPEC.md` §15.

---

## 2026-06-07 — New Table overlay cleanup

- **Shared overlay:** `NewTableOverlay` — fixed layer over page/table for lobby “Open New Table” and menu “Start New Table”; never reflows underlying content.
- **Same render path:** Lobby and in-table entry points embed `TableStakePanel` with `embeddedInOverlay`; desktop centered modal, mobile bottom sheet (CSS only).
- **Staged UI:** Removed numbered step headings (`1. Game`, etc.); clean fieldset titles (Game, Mode).
- **Compact selection buttons:** `table-stake-panel__select-btn` — smaller yellow Cards/Dice/Continue/mode/Start controls (~40–44px touch height); nav row separated from options.
- **Docs:** `SXM_MASTER_SPEC.md` §5 and §14 updated.

---

## 2026-06-10 — Blackjack UX/protocol fixes

- **Card-column values:** Hand total above each Table View card column (shared `boxHandValueDisplay`).
- **Box stability:** `+` add-box matches player box outer size; turn pulse box-shadow only; reserved stake/composition zones.
- **Insurance:** Fix unfunded auto-skip; offer persists until explicit Play vs Ace; status set before insurance activation.
- **Ace decisions:** Take 1:1 + Play vs Ace buttons with thin yellow border (`blackjackAceDecisionActions`).
- **Card View mobile:** Smaller hero clamps; overlapping cards inside hero — no horizontal canvas stretch.
- **Summary:** Default off; Won/Lost chip labels + visual cards when opened.
- **Short-stack top-up:** Auto top-up to min bet at next round (`shortStackTopUp.ts`).
- **Felt parity:** Card View uses `--bj-table-felt-bg`.

---

## 2026-06-10 — Blackjack UX fixes

- **Player box stability:** Fixed stake/composition reserved height in slot row — chips no longer reflow box dimensions.
- **Active turn:** Card-column / hero circular `bj-phone-view__box-value--active-turn` only; no box border or slot turn frame.
- **Card View:** Larger hero cards via `clamp()` tokens; score above hero; mobile Stay/Hit me side indicators restored.
- **Bust delay:** Card View holds busted hero 2s (`CARD_VIEW_BUST_HOLD_MS`) before following next box.
- **Dealer info:** Bank Total in felt row; Bank Hand under dealer cards only.
- **Command text:** Strict format — no sentimental copy; Stay wording; natural blackjack label separate from even-money.

---

## 2026-06-10 — Documentation consolidation

- Created `docs/SXM_MASTER_SPEC.md` as the single source of truth from current implementation.
- Archived superseded specs and duplicate docs to `docs/archive/`.
- Retained operational docs (`README.md`, deployment guides, QA checklist, Magic 8 content guide).
- Documented open item: **admin game activation** (e.g. Zilch on/off) — not yet implemented.

### Archived (superseded)

- `Scope.md` — Spec 1.0 (pre-online, local-only assumptions)
- `PROJECT_PLAN.md` — phased build plan (mostly complete; conflicts with current online architecture)
- `docs/multiplayer-invite-roadmap.md` — stated online sync was future; now implemented
- `docs/protocol-engine.md` — merged into master spec §8
- `docs/online-offline-parity.md` — merged into master spec §16
- `docs/settlement-ledger.md` — merged into master spec §11
- `docs/allocation-audit.md` — phase audit; canonical API documented in master spec
- `docs/blackjack-rendering-audit.md` — rendering/CSS audit; reference only
- `docs/blackjack-intel-source-notes.md` — AID research notes

---

## Prior implementation milestones (summary)

These shipped before this changelog was created. Dates approximate from git history and phase labels.

| Milestone | Summary |
|-----------|---------|
| Core table & ledger | Session CRUD, append-only ledger, balance derivation |
| Deck & dealing | 52-card deck, shuffle, deal animations |
| Blackjack engine | Protocol phases, betting, hit/stand/double/split, settlement |
| Texas Hold'em engine | Offline betting streets, hand evaluator (no online path) |
| Casino table UX | Full Table + Card View, chip stacks, box model |
| Protocol presets | Las Vegas, European Shoe, Classic Home + `activeRules` adapter |
| Online mode | Magic-link auth, Postgres people, in-memory tables, Socket.IO sync |
| Entry lobby | Open New / Join / Load slide-outs; no auto-resume on reload |
| Staged new table | `TableStakePanel` game → mode → configure flow |
| Zilch | Dice engine, online actions, `ZilchPanel`, shake-to-roll mobile |
| Challenge mode | Wager, invites, personal score ledger |
| Join requests | Knock / Pending client UI; approve API without host UI |
