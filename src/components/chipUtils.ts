export const CHIP_VALUES = [50, 20, 10, 5, 2, 1] as const;
export type ChipValue = (typeof CHIP_VALUES)[number];

/** Tray denominations valid for the table minimum bet (multiples, not below min). */
export function chipValuesForMinimumBet(minimumBet: number): ChipValue[] {
  const min = Math.max(1, Math.floor(minimumBet));
  return CHIP_VALUES.filter((value) => value >= min && value % min === 0);
}

const BREAKDOWN_ORDER: ChipValue[] = [...CHIP_VALUES];

/** Greedy breakdown of balance into chip denominations. */
export function breakdownChips(amount: number): Record<ChipValue, number> {
  let remaining = Math.max(0, Math.floor(amount));
  const counts = Object.fromEntries(CHIP_VALUES.map((v) => [v, 0])) as Record<ChipValue, number>;
  for (const value of BREAKDOWN_ORDER) {
    counts[value] = Math.floor(remaining / value);
    remaining %= value;
  }
  return counts;
}

/** Real chip stack from amount — one token per denomination count (no fake cap). */
export function chipsFromAmount(amount: number, maxVisible = 12): ChipValue[] {
  const counts = breakdownChips(amount);
  const chips: ChipValue[] = [];
  for (const value of BREAKDOWN_ORDER) {
    for (let i = 0; i < counts[value] && chips.length < maxVisible; i += 1) {
      chips.push(value);
    }
  }
  return chips;
}

/** Visual-only: one 50 chip or five 10s — no ledger effect. */
export function visualChipStack(amount: number, breakFifties: boolean, maxVisible = 12): ChipValue[] {
  if (amount <= 0) {
    return [];
  }
  if (!breakFifties) {
    return chipsFromAmount(amount, maxVisible);
  }
  const counts = breakdownChips(amount);
  const chips: ChipValue[] = [];
  for (const value of BREAKDOWN_ORDER) {
    if (value === 50 && counts[50] > 0) {
      for (let f = 0; f < counts[50] && chips.length < maxVisible; f += 1) {
        for (let t = 0; t < 5 && chips.length < maxVisible; t += 1) {
          chips.push(10);
        }
      }
      continue;
    }
    for (let i = 0; i < counts[value] && chips.length < maxVisible; i += 1) {
      chips.push(value);
    }
  }
  return chips;
}
