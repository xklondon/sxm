import type { ChipValue } from './chipUtils';
import { isTestRuntime, isVerboseDevLogging } from '../utils/devFlags';

export type ChipTapBlockReason = 'betting-locked' | 'no-denomination' | 'invalid-slot';
export type ChipTapReason = 'armed-denomination' | ChipTapBlockReason;

export type ChipTapDecision =
  | { place: true; slotNumber: number; denomination: ChipValue; reason: 'armed-denomination' }
  | { place: false; slotNumber: number; denomination: ChipValue | null; reason: ChipTapBlockReason };

export function resolveBoxTapChipPlacement(input: {
  bettingOpen: boolean;
  denomination: ChipValue | null;
  slotNumber: number;
  slotOnTable: boolean;
}): ChipTapDecision {
  const { bettingOpen, denomination, slotNumber, slotOnTable } = input;
  if (!slotOnTable) {
    return { place: false, slotNumber, denomination, reason: 'invalid-slot' };
  }
  if (!bettingOpen) {
    return { place: false, slotNumber, denomination, reason: 'betting-locked' };
  }
  if (denomination == null) {
    return { place: false, slotNumber, denomination, reason: 'no-denomination' };
  }
  return { place: true, slotNumber, denomination, reason: 'armed-denomination' };
}

export function persistArmedChipDenomination(
  current: ChipValue | null,
  next: ChipValue,
): ChipValue {
  return next ?? current;
}

/** Dev-only chip tap diagnostic — one line, no PII. */
export function logChipTap(detail: {
  box: number | null;
  denomination: ChipValue | null;
  targetResolved: boolean;
  placementDispatched: boolean;
  placementAccepted: boolean;
  reason: string;
}): void {
  if (isTestRuntime()) {
    return;
  }
  if (!isVerboseDevLogging()) {
    try {
      if (import.meta.env?.DEV !== true) {
        return;
      }
    } catch {
      return;
    }
  }
  console.debug(
    `[chip-tap] box=${detail.box ?? ''} denomination=${detail.denomination ?? ''} targetResolved=${detail.targetResolved} placementDispatched=${detail.placementDispatched} placementAccepted=${detail.placementAccepted} reason=${detail.reason}`,
  );
}
