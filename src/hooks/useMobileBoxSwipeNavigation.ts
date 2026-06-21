import { useCallback, useRef } from 'react';

export interface MobileBoxSwipeSlot {
  slotNumber: number;
  playerId: string | null;
}

const SWIPE_MIN_PX = 48;
const SWIPE_HORIZONTAL_BIAS = 1.2;

export function resolveMobileBoxSwipeTarget(
  displaySlots: MobileBoxSwipeSlot[],
  currentSlotNumber: number | null,
  deltaX: number,
  deltaY: number,
): number | null {
  const navigableSlotNumbers = displaySlots
    .filter((slot): slot is MobileBoxSwipeSlot & { playerId: string } => Boolean(slot.playerId))
    .map((slot) => slot.slotNumber);

  if (
    navigableSlotNumbers.length < 2 ||
    Math.abs(deltaX) < SWIPE_MIN_PX ||
    Math.abs(deltaX) < Math.abs(deltaY) * SWIPE_HORIZONTAL_BIAS
  ) {
    return null;
  }

  const direction = deltaX < 0 ? 1 : -1;
  const currentIndex =
    currentSlotNumber != null ? navigableSlotNumbers.indexOf(currentSlotNumber) : -1;
  const baseIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = (baseIndex + direction + navigableSlotNumbers.length) % navigableSlotNumbers.length;
  return navigableSlotNumbers[nextIndex] ?? null;
}

export interface UseMobileBoxSwipeNavigationOptions {
  enabled: boolean;
  displaySlots: MobileBoxSwipeSlot[];
  currentSlotNumber: number | null;
  onSelectSlot: (slotNumber: number) => void;
}

/** Mobile-only horizontal swipe to cycle visible occupied box slots (navigation only). */
export function useMobileBoxSwipeNavigation({
  enabled,
  displaySlots,
  currentSlotNumber,
  onSelectSlot,
}: UseMobileBoxSwipeNavigationOptions) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (!enabled || event.touches.length !== 1) {
        return;
      }
      const touch = event.touches[0]!;
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    },
    [enabled],
  );

  const onTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      if (!enabled || !touchStartRef.current || event.changedTouches.length !== 1) {
        touchStartRef.current = null;
        return;
      }
      const touch = event.changedTouches[0]!;
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      touchStartRef.current = null;

      const nextSlot = resolveMobileBoxSwipeTarget(
        displaySlots,
        currentSlotNumber,
        deltaX,
        deltaY,
      );
      if (nextSlot != null) {
        onSelectSlot(nextSlot);
      }
    },
    [enabled, displaySlots, currentSlotNumber, onSelectSlot],
  );

  const onTouchCancel = useCallback(() => {
    touchStartRef.current = null;
  }, []);

  return {
    onTouchStart,
    onTouchEnd,
    onTouchCancel,
  };
}
