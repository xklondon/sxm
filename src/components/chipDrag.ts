import type { ChipValue } from './chipUtils';
import { CHIP_VALUES } from './chipUtils';

/** MIME type for chip drag-and-drop between tray and boxes. */
export const CHIP_DRAG_MIME = 'application/x-sxmcards-chip';

export function readChipDragValue(dataTransfer: DataTransfer): ChipValue | null {
  const raw = dataTransfer.getData(CHIP_DRAG_MIME);
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value <= 0) {
    return null;
  }
  if (!(CHIP_VALUES as readonly number[]).includes(value)) {
    return null;
  }
  return value as ChipValue;
}

export function setChipDragData(dataTransfer: DataTransfer, value: number): void {
  dataTransfer.setData(CHIP_DRAG_MIME, String(value));
  dataTransfer.effectAllowed = 'copy';
}
