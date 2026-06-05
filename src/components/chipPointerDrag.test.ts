// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';

import {
  CHIP_DROP_BOX_ATTR,
  CHIP_DROP_SLOT_ATTR,
  chipDropKey,
  createChipPointerDragHandlers,
  resolveChipDropTargetFromElement,
} from './chipPointerDrag';

describe('chipPointerDrag', () => {
  it('resolves drop target from data attributes on player box shells', () => {
    document.body.innerHTML = `
      <div ${CHIP_DROP_SLOT_ATTR}="2" ${CHIP_DROP_BOX_ATTR}="box-abc">
        <span class="inner">target</span>
      </div>
    `;
    const inner = document.querySelector('.inner')!;
    expect(resolveChipDropTargetFromElement(inner)).toEqual({
      slotNumber: 2,
      boxId: 'box-abc',
    });
    expect(chipDropKey({ slotNumber: 2, boxId: 'box-abc' })).toBe('box-box-abc');
  });

  it('resolves empty slot targets without box id', () => {
    document.body.innerHTML = `<div ${CHIP_DROP_SLOT_ATTR}="3"></div>`;
    const node = document.querySelector(`[${CHIP_DROP_SLOT_ATTR}]`)!;
    expect(resolveChipDropTargetFromElement(node)).toEqual({
      slotNumber: 3,
      boxId: null,
    });
    expect(chipDropKey({ slotNumber: 3, boxId: null })).toBe('slot-3');
  });

  it('routes pointer drop through highlight + onDrop callback', () => {
    const onDrop = vi.fn();
    const onHighlight = vi.fn();
    const { onChipPointerDown } = createChipPointerDragHandlers({
      enabled: true,
      onDrop,
      onHighlight,
    });

    document.body.innerHTML = `
      <button id="chip" type="button">5</button>
      <div ${CHIP_DROP_SLOT_ATTR}="1" ${CHIP_DROP_BOX_ATTR}="player-1"></div>
    `;
    const chip = document.getElementById('chip') as HTMLButtonElement;
    const target = document.querySelector(`[${CHIP_DROP_SLOT_ATTR}]`) as HTMLElement;

    const rect = { left: 0, top: 0, width: 40, height: 40, right: 40, bottom: 40 } as DOMRect;
    chip.getBoundingClientRect = () => rect;
    target.getBoundingClientRect = () => ({
      left: 100,
      top: 100,
      width: 50,
      height: 50,
      right: 150,
      bottom: 150,
    } as DOMRect);

    chip.setPointerCapture = vi.fn();
    chip.releasePointerCapture = vi.fn();

    const elementFromPoint = vi.spyOn(document, 'elementFromPoint').mockImplementation(
      (x, y) => {
        if (x >= 100 && y >= 100) {
          return target;
        }
        return chip;
      },
    );

    onChipPointerDown(5, {
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 10,
      currentTarget: chip,
      preventDefault: vi.fn(),
    } as unknown as ReactPointerEvent<HTMLElement>);

    document.dispatchEvent(
      new PointerEvent('pointermove', { pointerId: 1, clientX: 120, clientY: 120, bubbles: true }),
    );
    expect(onHighlight).toHaveBeenCalledWith('box-player-1');

    document.dispatchEvent(
      new PointerEvent('pointerup', { pointerId: 1, clientX: 120, clientY: 120, bubbles: true }),
    );
    expect(onDrop).toHaveBeenCalledWith(5, { slotNumber: 1, boxId: 'player-1' });
    expect(onHighlight).toHaveBeenLastCalledWith(null);
    elementFromPoint.mockRestore();
  });
});
