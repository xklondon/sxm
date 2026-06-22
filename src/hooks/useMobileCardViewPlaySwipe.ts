import { useCallback, useRef } from 'react';

export const MOBILE_CARD_VIEW_SWIPE_MIN_PX = 48;
export const MOBILE_CARD_VIEW_SWIPE_HORIZONTAL_BIAS = 1.2;

export type MobileCardViewSwipeAction = 'stand' | 'hit' | null;

/** Swipe left = stand, swipe right = hit (horizontal play gestures only). */
export function resolveMobileCardViewPlaySwipe(
  deltaX: number,
  deltaY: number,
): MobileCardViewSwipeAction {
  if (
    Math.abs(deltaX) < MOBILE_CARD_VIEW_SWIPE_MIN_PX ||
    Math.abs(deltaX) < Math.abs(deltaY) * MOBILE_CARD_VIEW_SWIPE_HORIZONTAL_BIAS
  ) {
    return null;
  }
  return deltaX < 0 ? 'stand' : 'hit';
}

export interface UseMobileCardViewPlaySwipeOptions {
  enabled: boolean;
  canHit: boolean;
  canStand: boolean;
  onStand: () => void;
  onHit: () => void;
}

/** Mobile Card View — swipe left Stay, swipe right Hit (never double/split). */
export function useMobileCardViewPlaySwipe({
  enabled,
  canHit,
  canStand,
  onStand,
  onHit,
}: UseMobileCardViewPlaySwipeOptions) {
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

      const action = resolveMobileCardViewPlaySwipe(deltaX, deltaY);
      if (action === 'stand' && canStand) {
        onStand();
      } else if (action === 'hit' && canHit) {
        onHit();
      }
    },
    [enabled, canHit, canStand, onHit, onStand],
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
