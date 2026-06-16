export interface LayoutRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

export function measureElement(el: Element): LayoutRect {
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top,
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
    width: rect.width,
    height: rect.height,
  };
}

/** Lower band must start at or below upper band (optional overlap tolerance in px). */
export function isBelow(upper: LayoutRect, lower: LayoutRect, tolerancePx = 1): boolean {
  return lower.top + tolerancePx >= upper.bottom;
}

export function overlaps(a: LayoutRect, b: LayoutRect, tolerancePx = 1): boolean {
  const hOverlap = a.left < b.right - tolerancePx && a.right > b.left + tolerancePx;
  const vOverlap = a.top < b.bottom - tolerancePx && a.bottom > b.top + tolerancePx;
  return hOverlap && vOverlap;
}

export function assertVerticalStack(
  bands: LayoutRect[],
  options?: { label?: string; tolerancePx?: number },
): void {
  const tolerance = options?.tolerancePx ?? 1;
  for (let i = 1; i < bands.length; i += 1) {
    const upper = bands[i - 1]!;
    const lower = bands[i]!;
    if (!isBelow(upper, lower, tolerance)) {
      throw new Error(
        `${options?.label ?? 'layout'}: band ${i - 1} (bottom=${upper.bottom}) overlaps or sits above band ${i} (top=${lower.top})`,
      );
    }
  }
}

export function assertNoPairwiseOverlap(
  bands: LayoutRect[],
  options?: { label?: string; tolerancePx?: number },
): void {
  const tolerance = options?.tolerancePx ?? 1;
  for (let i = 0; i < bands.length; i += 1) {
    for (let j = i + 1; j < bands.length; j += 1) {
      if (overlaps(bands[i]!, bands[j]!, tolerance)) {
        throw new Error(`${options?.label ?? 'layout'}: bands ${i} and ${j} overlap`);
      }
    }
  }
}
