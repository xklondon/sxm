# Change Summary — Per-round box commander ownership

## Root cause

`getCallerPersonIdForBox` returned `nativeAssignedPersonId` **unconditionally** for designated boxes, ignoring whether that player actually staked this round. `assignTemporaryBoxOwnerOnFirstBet` also forced the native owner as caller on first bet even when they had no chips on the box. `syncCallersForDeal` locked the same native owner at deal time.

Result: Player 1 could command Box 1 without staking while Player 2 (first staker) was treated as co-bettor only.

## Canonical rule (`resolveBoxRoundCommander`)

| Situation | Round commander |
|-----------|-----------------|
| Designated owner staked (before or after others) | Designated owner (`designated-owner-staked`) |
| Designated owner did **not** stake | First staker (`first-staker-on-designated-box`) |
| Free box (no designated owner) | First staker (`first-staker-on-free-box`) |
| No stake and no in-round hand | `null` |

Co-bettors = other `stakerPersonIds` on the box. Native assignment (`assignedBoxByPersonId` / `nativeAssignedPersonId`) is unchanged across rounds. Temporary `callerPersonId` clears on next round for all slots.

## Files changed

| File | Change |
|------|--------|
| `src/engine/session/boxRoundCommander.ts` | **New** — `resolveBoxRoundCommander()` |
| `src/engine/session/boxRoundCommander.test.ts` | **New** — rules 1–6 coverage |
| `src/engine/session/playerAssignment.ts` | `getCallerPersonIdForBox`, `syncCallersForDeal` use commander resolver |
| `src/engine/session/boxDecisionOwnership.ts` | `assignTemporaryBoxOwnerOnFirstBet` stake-based; `getBoxDecisionOwner` → caller path |
| `src/engine/blackjack/gameState.ts` | Clear all slot `callerPersonId` on next round |
| `src/engine/session/index.ts` | Export commander API |
| Tests updated | `boxDecisionOwnership`, `boxOwnershipRules`, `multiplayerOwnership`, `tableBoxDisplay`, `server/tests/multiplayerOwnership` |

**Not changed:** Layout/CSS, payout math, invite/auth/people, card placement, reveal flow.

## Test results

| Command | Result |
|---------|--------|
| `npm run test:blackjack:engine` | 261 passed |
| `npm run test:ownership` | 28 passed |
| `npm run build` | Success |
| `boxRoundCommander.test.ts` + session tests | 24 passed |
| `tableBoxDisplay.test.ts` + server multiplayer | passed |

## Rules checklist

1. Designated owner stakes → owner commands (others co-bettors) ✓  
2. Designated owner does not stake → first staker commands ✓  
3. Free box → first staker commands ✓  
4. Next round clears temporary caller; assignment persists ✓  
5. Insurance follows round commander ✓  
6. Online authority via `getCallerPersonIdForBox` in `authority.ts` ✓  
7. This Table Running / Co-boxes from commander + stakers ✓  

Spec discipline: checked/updated `docs/CHANGE_LOG.md`.
