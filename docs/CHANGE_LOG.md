# SXM Change Log

Significant product and architecture changes. For the authoritative current-state description, see **[SXM_MASTER_SPEC.md](./SXM_MASTER_SPEC.md)**.

## Process rule

Every significant feature change must update **both**:

1. `docs/SXM_MASTER_SPEC.md` — reflect new behavior
2. `docs/CHANGE_LOG.md` — record what changed and when

before the work is considered complete. This rule is also stated in `.cursorrules`.

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
- **Active turn:** Shared `bj-box--turn` highlight in Full Table and Card View (betting pulse separate).
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
