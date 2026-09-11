import type { PointerEvent } from 'react';

const CLICK_DEDUPE_MS = 500;
const TAP_SLOP_PX = 16;

/** Dedupe pointerup + click for one gesture; do not block a later tap. */
export function createTapSelectHandler() {
  let lastPointerId: number | null = null;
  let lastAt = 0;
  return function tapSelect(action: () => void, source: 'pointer' | 'click' = 'click', pointerId?: number) {
    const now = performance.now();
    if (source === 'pointer') {
      lastPointerId = pointerId ?? null;
      lastAt = now;
      action();
      return;
    }
    if (lastPointerId != null && now - lastAt < CLICK_DEDUPE_MS) {
      lastPointerId = null;
      return;
    }
    lastAt = now;
    action();
  };
}

export function bindTapSelect(
  tapSelect: ReturnType<typeof createTapSelectHandler>,
  action: () => void,
) {
  let startX = 0;
  let startY = 0;
  let startId = 0;
  let tracking = false;

  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) {
        return;
      }
      tracking = true;
      startX = e.clientX;
      startY = e.clientY;
      startId = e.pointerId;
    },
    onPointerUp: (e: PointerEvent) => {
      if (!tracking || e.pointerId !== startId) {
        return;
      }
      tracking = false;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (dx * dx + dy * dy > TAP_SLOP_PX * TAP_SLOP_PX) {
        return;
      }
      tapSelect(action, 'pointer', e.pointerId);
    },
    onPointerCancel: () => {
      tracking = false;
    },
    onClick: () => {
      tapSelect(action, 'click');
    },
  };
}
