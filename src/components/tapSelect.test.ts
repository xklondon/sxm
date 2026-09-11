import { describe, expect, it, vi } from 'vitest';
import { bindTapSelect, createTapSelectHandler } from './tapSelect';

function pointerEvent(overrides: {
  type: string;
  pointerId?: number;
  pointerType?: string;
  button?: number;
  clientX?: number;
  clientY?: number;
}) {
  return {
    pointerId: overrides.pointerId ?? 1,
    pointerType: overrides.pointerType ?? 'touch',
    button: overrides.button ?? 0,
    clientX: overrides.clientX ?? 10,
    clientY: overrides.clientY ?? 10,
  } as unknown as Parameters<ReturnType<typeof bindTapSelect>['onPointerDown']>[0];
}

describe('tapSelect — one gesture, repeat taps allowed', () => {
  it('pointerup + click of the same tap fires once', () => {
    const action = vi.fn();
    const bind = bindTapSelect(createTapSelectHandler(), action);
    bind.onPointerDown(pointerEvent({ type: 'pointerdown' }));
    bind.onPointerUp(pointerEvent({ type: 'pointerup' }));
    bind.onClick();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('a second tap immediately after the first still fires', () => {
    const action = vi.fn();
    const bind = bindTapSelect(createTapSelectHandler(), action);
    bind.onPointerDown(pointerEvent({ type: 'pointerdown', pointerId: 1 }));
    bind.onPointerUp(pointerEvent({ type: 'pointerup', pointerId: 1 }));
    bind.onPointerDown(pointerEvent({ type: 'pointerdown', pointerId: 2, clientX: 12, clientY: 12 }));
    bind.onPointerUp(pointerEvent({ type: 'pointerup', pointerId: 2, clientX: 12, clientY: 12 }));
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('a drag/scroll past slop does not fire', () => {
    const action = vi.fn();
    const bind = bindTapSelect(createTapSelectHandler(), action);
    bind.onPointerDown(pointerEvent({ type: 'pointerdown', clientX: 10, clientY: 10 }));
    bind.onPointerUp(pointerEvent({ type: 'pointerup', clientX: 10, clientY: 40 }));
    expect(action).not.toHaveBeenCalled();
  });

  it('cancelled pointer does not place; later click without prior pointer still places once', () => {
    const action = vi.fn();
    const bind = bindTapSelect(createTapSelectHandler(), action);
    bind.onPointerDown(pointerEvent({ type: 'pointerdown' }));
    bind.onPointerCancel();
    bind.onClick();
    expect(action).toHaveBeenCalledTimes(1);
  });
});
