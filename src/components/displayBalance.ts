/** Tray/header balance — never show negative available chips. */
export function clampAvailableForDisplay(available: number | null): number | null {
  if (available === null) {
    return null;
  }
  return Math.max(0, available);
}
