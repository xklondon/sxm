import type { PointerEvent as ReactPointerEvent } from 'react';
import type { ChipValue } from './chipUtils';

/** Drop-target markers on player box shells (Full Table arc + Card View mini row). */
export const CHIP_DROP_SLOT_ATTR = 'data-chip-drop-slot';
export const CHIP_DROP_BOX_ATTR = 'data-chip-drop-box';

export interface ChipDropTarget {
  slotNumber: number;
  boxId: string | null;
}

export function chipDropKey(target: ChipDropTarget): string {
  return target.boxId ? `box-${target.boxId}` : `slot-${target.slotNumber}`;
}

export function resolveChipDropTargetFromElement(el: Element | null): ChipDropTarget | null {
  if (!el) {
    return null;
  }
  const node = el.closest(`[${CHIP_DROP_SLOT_ATTR}]`);
  if (!node) {
    return null;
  }
  const slotRaw = node.getAttribute(CHIP_DROP_SLOT_ATTR);
  const slotNumber = slotRaw ? Number.parseInt(slotRaw, 10) : Number.NaN;
  if (Number.isNaN(slotNumber) || slotNumber <= 0) {
    return null;
  }
  const boxId = node.getAttribute(CHIP_DROP_BOX_ATTR);
  return { slotNumber, boxId: boxId && boxId.length > 0 ? boxId : null };
}

export function createChipPointerDragHandlers(options: {
  enabled: boolean;
  onDrop: (value: ChipValue, target: ChipDropTarget) => void;
  onHighlight: (dropKey: string | null) => void;
}): {
  onChipPointerDown: (value: ChipValue, e: ReactPointerEvent<HTMLElement>) => void;
} {
  function onChipPointerDown(value: ChipValue, e: ReactPointerEvent<HTMLElement>) {
    if (!options.enabled || e.button !== 0) {
      return;
    }
    e.preventDefault();
    const pointerId = e.pointerId;
    const origin = e.currentTarget;
    origin.setPointerCapture(pointerId);

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) {
        return;
      }
      const target = resolveChipDropTargetFromElement(
        document.elementFromPoint(ev.clientX, ev.clientY),
      );
      options.onHighlight(target ? chipDropKey(target) : null);
    };

    const finish = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) {
        return;
      }
      origin.releasePointerCapture(pointerId);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', finish);
      document.removeEventListener('pointercancel', finish);
      const target = resolveChipDropTargetFromElement(
        document.elementFromPoint(ev.clientX, ev.clientY),
      );
      options.onHighlight(null);
      if (target) {
        options.onDrop(value, target);
      }
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', finish);
    document.addEventListener('pointercancel', finish);
  }

  return { onChipPointerDown };
}
