import type { PointerEvent as ReactPointerEvent } from 'react';
import { ValueAndChipsBar, type ChipValue } from './ChipStack';

export interface BlackjackTrayRowProps {
  available: number | null;
  showChips?: boolean;
  onChipClick: (value: ChipValue) => void;
  onChipPointerDown?: (value: ChipValue, event: ReactPointerEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  selectedChip?: ChipValue | null;
  minimumBet?: number;
  trayLabel?: string;
  hint?: string | null;
}

/** Canonical tray row — available balance, chip plaques, SxM Casino Challenge label. */
export function BlackjackTrayRow({
  available,
  showChips = true,
  onChipClick,
  onChipPointerDown,
  disabled,
  selectedChip = null,
  minimumBet,
  trayLabel,
  hint,
}: BlackjackTrayRowProps) {
  return (
    <div className="bj-tray-row" data-layout-band="tray-row">
      <div className="bj-casino__tray-wrap">
        <ValueAndChipsBar
          available={available}
          showChips={showChips}
          onChipClick={onChipClick}
          onChipPointerDown={onChipPointerDown}
          disabled={disabled}
          selectedValue={selectedChip}
          minimumBet={minimumBet}
          trayLabel={trayLabel}
        />
        {hint ? (
          <p className="bj-casino__tray-hint" role="status">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
