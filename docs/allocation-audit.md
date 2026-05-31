# Chip Allocation Audit (Phase 27)

People own bankrolls. Boxes are positions only. The ledger is the single source of truth for chip balances.

## Canonical API

**`allocateChipsToBankrollOwner(state, input)`** in `src/engine/session/allocation.ts`

| Field | Rule |
|-------|------|
| `bankrollOwnerId` | Bank player id or person bankroll id only — never box id or controller name |
| `amount` | Positive integer |
| `reason` | `initial-bank` \| `initial-player` \| `owner-top-up` \| `adjustment` |
| `source` | `setup` \| `claim-box` \| `assign-modal` \| `join-table` |
| Effect | Appends ledger entry only; syncs `player.startingBalance` cache from ledger |

Log tag: `[SXMCards] allocateChipsCanonical`

## Route audit

| Old route | Keep? | Canonical target |
|-----------|-------|------------------|
| `allocateChipsToBankrollOwner` | **Yes — SSOT** | — |
| `allocateChipsToParticipant` | Deprecated wrapper | → `allocateChipsToBankrollOwner` |
| `assignChips` / Assign chips modal | Yes | → `allocateChipsToBankrollOwner` (`source: assign-modal`) |
| `createParticipantWithAllocation` | Yes | `addPlayer(startingChips: 0)` + canonical allocate |
| `assignBankBot` / `assignBankPerson` | Yes | → canonical (`reason: initial-bank`, `source: setup`) |
| `claimBoxSlot` | Yes | First claim: create person + allocate once; reuse person on extra boxes |
| `confirmTableAgreement` / TableStakePanel | Yes (metadata only) | No allocation — chips set in tableMeta only |
| `addPlayer` with `startingChips > 0` | **Removed** | Callers must use canonical API after add |
| `applyStartingChipsToLedger` | **Removed** | → `setStartingChips(state, id, amount)` or canonical API |
| `setStartingChips` | Deprecated wrapper | → `allocateChipsToBankrollOwner` |
| `startNewTable` loop over all `playerIds` + `createBuyInEntry` | **Removed** | Bank + `listPersonBankrollOwnerIds` only |
| Direct `createBuyInEntry` / `appendLedgerEntry` for buy-in | Engine bet/payout paths only | Not for setup/top-up |
| Box `playerId` as ledger `playerId` for buy-in | **Forbidden** | Use `bankrollOwnerId` via `boxLedger.ts` |

## Flow rules

### Bank setup
- `assignBankBot` / `assignBankPerson` allocate once to `session.bankPlayerId`.
- Re-assigning existing bank with zero ledger balance may allocate once (idempotent guard).

### Claim box
1. Resolve controller → person via `findPersonPlayerIdByController`.
2. **No person:** create `role: person`, allocate `startingChipsEachSeat` once.
3. **Existing person:** link box to `bankrollOwnerId`, no allocation.
4. Create box position (`role: box`) — never receives chips.

Logs: `claimBoxResolvePerson`, `claimBoxExistingBankroll`, `claimBoxNewBankrollAllocated`, `claimBoxLinkedToBankroll`

### Assign chips modal
Targets: Bank, each person (`listPersonBankrollOwnerIds`), All persons.
Never: box ids, box labels, controller-name-only rows.

“All persons” iterates distinct person bankroll ids once — not per box.

### This Table panel
- Bank row → bank `playerId` ledger balance.
- Person rows → person bankroll id ledger balance minus open exposure across all controlled boxes.
- Boxes list is display metadata only.

## Helpers

| Helper | Purpose |
|--------|---------|
| `listBankrollParticipantIds` | Bank + all ledger holders (includes bank) |
| `listPersonBankrollOwnerIds` | Distinct person bankrolls for assign modal / bulk assign |
| `resolveBankrollOwnerIdForBox` | Map box position → person bankroll for bets/payouts |
| `getAvailableChipsForBankrollOwner` | Ledger balance − exposure across boxes |

## Related docs

- [settlement-ledger.md](./settlement-ledger.md) — available balance, settlement timing, bank tracking (Phase 28)

`src/engine/blackjack/sanity/allocationChecks.ts` — seven scenarios covering setup, claim, multi-box, betting exposure, assign once, assign all persons, no box ledger buy-ins.
