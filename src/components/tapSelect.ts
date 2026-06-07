import type { PointerEvent } from 'react';

/** Dedupe pointerdown + click so box selection fires once per tap. */
export function createTapSelectHandler() {
  let lastAt = 0;
  return function tapSelect(action: () => void) {
    const now = performance.now();
    if (now - lastAt < 350) {
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
  const run = () => tapSelect(action);
  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) {
        return;
      }
      run();
    },
    onClick: run,
  };
}
