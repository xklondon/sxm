import type { BoxStakeEntry } from '../../types/table';

export class StakePayerInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StakePayerInvariantError';
  }
}

function prunePositive(amounts: Record<string, number>): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [personId, amount] of Object.entries(amounts)) {
    if (amount > 0) {
      next[personId] = amount;
    }
  }
  return next;
}

function sumAmounts(amounts: Record<string, number>): number {
  return Object.values(amounts).reduce((sum, amount) => sum + amount, 0);
}

/** Validate payer map matches box stake total. */
export function assertStakePayerInvariant(
  boxPlayerId: string,
  stake: BoxStakeEntry,
  amounts: Record<string, number>,
): Record<string, number> {
  const cleaned = prunePositive(amounts);
  const sum = sumAmounts(cleaned);
  if (sum !== stake.amount) {
    throw new StakePayerInvariantError(
      `Box ${boxPlayerId} stake payer invariant failed: sum(stakerAmounts)=${sum}, amount=${stake.amount}`,
    );
  }
  return cleaned;
}

/** Reconstruct payer map from chipEntries only — no caller/native guessing. */
export function reconstructStakerAmountsFromChipEntries(
  boxPlayerId: string,
  stake: BoxStakeEntry,
): Record<string, number> {
  const entries = stake.chipEntries ?? [];
  if (entries.length === 0) {
    throw new StakePayerInvariantError(
      `Box ${boxPlayerId} has stake amount ${stake.amount} but no chipEntries or stakerAmountsByPersonId`,
    );
  }
  const amounts: Record<string, number> = {};
  for (const chip of entries) {
    if (!chip.payerPersonId) {
      throw new StakePayerInvariantError(
        `Box ${boxPlayerId} chip entry missing payerPersonId`,
      );
    }
    amounts[chip.payerPersonId] = (amounts[chip.payerPersonId] ?? 0) + chip.value;
  }
  return assertStakePayerInvariant(boxPlayerId, stake, amounts);
}
