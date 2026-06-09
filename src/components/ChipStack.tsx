import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { CHIP_VALUES, chipValuesForMinimumBet, type ChipValue } from './chipUtils';
import { setChipDragData } from './chipDrag';
import { SXM_LAYOUT, sxmSectionProps } from './sxmLayoutContract';
import { TABLE_UX } from './tableUxContract';
import './ChipStack.css';

interface ChipStackProps {
  amount: number;
  variant?: 'balance' | 'bet';
  maxVisiblePerDenom?: number;
  className?: string;
  compact?: boolean;
}

export function CompactBalance({
  amount,
  className = '',
  variant = 'balance',
}: {
  amount: number;
  className?: string;
  variant?: 'balance' | 'bet';
}) {
  if (amount <= 0) {
    return null;
  }
  return (
    <div
      className={`compact-balance compact-balance--${variant} ${className}`.trim()}
      aria-label={`${amount} chips`}
    >
      <span className="compact-balance__icons" aria-hidden="true">
        <span className="chip-token chip-token--5 chip-token--mini" />
        <span className="chip-token chip-token--10 chip-token--mini chip-token--mini-offset" />
      </span>
      <span className="compact-balance__amount">{amount}</span>
    </div>
  );
}

export function StakeChips({
  chips,
  className = '',
  variant = 'default',
  onRemoveTopChip,
  removable = false,
}: {
  chips: number[];
  className?: string;
  variant?: 'default' | 'bet';
  onRemoveTopChip?: () => void;
  removable?: boolean;
}) {
  if (chips.length === 0) {
    return null;
  }
  const topIndex = chips.length - 1;
  return (
    <div
      className={[
        'stake-chips',
        variant === 'bet' ? 'stake-chips--bet' : '',
        className,
      ].filter(Boolean).join(' ')}
      aria-hidden={variant === 'bet'}
    >
      {chips.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className={`chip-token chip-token--${value} chip-token--mini stake-chips__chip${index === topIndex ? ' stake-chips__chip--top' : ''}`}
          style={{ '--chip-layer': index } as CSSProperties}
        >
          {variant === 'bet' ? value : ''}
          {removable && index === topIndex && onRemoveTopChip && (
            <button
              type="button"
              className="stake-chips__remove"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveTopChip();
              }}
              aria-label={`Remove ${value} chip`}
            >
              ×
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

export function ChipStack({
  amount,
  variant = 'balance',
  maxVisiblePerDenom = 5,
  className = '',
  compact = false,
}: ChipStackProps & { compact?: boolean }) {
  if (amount <= 0) {
    return null;
  }

  if (variant === 'bet') {
    return null;
  }

  if (compact || variant === 'balance') {
    return (
      <CompactBalance amount={amount} className={className} variant="balance" />
    );
  }

  let remaining = Math.max(0, Math.floor(amount));
  const chips: ChipValue[] = [];
  for (const value of CHIP_VALUES) {
    const denomCount = Math.min(Math.floor(remaining / value), maxVisiblePerDenom);
    for (let i = 0; i < denomCount; i += 1) {
      chips.push(value);
    }
    remaining -= denomCount * value;
  }

  const totalShown = chips.reduce((s, v) => s + v, 0);
  const overflow = amount - totalShown;

  return (
    <div
      className={`chip-stack chip-stack--${variant} ${className}`.trim()}
      aria-label={`${amount} chips`}
    >
      <div className="chip-stack__pile">
        {chips.map((value, index) => (
          <span
            key={`${value}-${index}`}
            className={`chip-token chip-token--${value}`}
            style={{ '--chip-offset': index } as CSSProperties}
          >
            {value}
          </span>
        ))}
      </div>
      {overflow > 0 && <span className="chip-stack__more">+{overflow}</span>}
    </div>
  );
}

export function ChipButton({ value, onClick, disabled, draggable = false, onPointerDragStart }: {
  value: ChipValue;
  onClick: () => void;
  disabled?: boolean;
  draggable?: boolean;
  onPointerDragStart?: (value: ChipValue, e: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      className={`chip-token chip-token--${value} chip-token--btn`}
      onClick={onClick}
      disabled={disabled}
      draggable={draggable && !disabled}
      onDragStart={(e) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        setChipDragData(e.dataTransfer, value);
      }}
      onPointerDown={(e) => {
        if (disabled || !onPointerDragStart) {
          return;
        }
        onPointerDragStart(value, e);
      }}
      aria-label={`Add ${value} to bet`}
    >
      {value}
    </button>
  );
}

export function ChipTray({
  onChipClick,
  onChipPointerDown,
  disabled,
  minimumBet = 1,
  className = '',
  showLabel = true,
}: {
  onChipClick: (value: ChipValue) => void;
  onChipPointerDown?: (value: ChipValue, e: ReactPointerEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  minimumBet?: number;
  className?: string;
  showLabel?: boolean;
}) {
  const denominations = chipValuesForMinimumBet(minimumBet);
  return (
    <div className={['chip-tray', className].filter(Boolean).join(' ')} aria-label="Chip tray">
      {showLabel ? <span className="chip-tray__label">Chips</span> : null}
      <div className="chip-tray__chips">
        {denominations.map((v) => (
          <ChipButton
            key={v}
            value={v}
            disabled={disabled}
            draggable={!disabled}
            onPointerDragStart={onChipPointerDown}
            onClick={() => onChipClick(v)}
          />
        ))}
      </div>
    </div>
  );
}

export function ValueAndChipsBar({
  available,
  showChips,
  onChipClick,
  onChipPointerDown,
  disabled,
  minimumBet = 1,
  trayLabel,
}: {
  available: number | null;
  showChips: boolean;
  onChipClick: (value: ChipValue) => void;
  onChipPointerDown?: (value: ChipValue, e: ReactPointerEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  minimumBet?: number;
  trayLabel?: string;
}) {
  return (
    <div
      className={[
        TABLE_UX.valueAndChips,
        'bj-value-chips',
        trayLabel ? 'bj-value-chips--with-label' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="bj-value-chips__row bj-value-chips__row--main">
        <p
          {...sxmSectionProps(
            SXM_LAYOUT.playerBalance,
            'bj-value-chips__balance',
            'bj-casino__player-balance',
            available === null ? 'bj-casino__player-balance--placeholder' : '',
          )}
          aria-label={available !== null ? `Available ${available} chips` : undefined}
          aria-hidden={available === null}
        >
          {available !== null ? `Available: ${available}` : '\u00a0'}
        </p>
        <div
          {...sxmSectionProps(
            SXM_LAYOUT.chipTray,
            'bj-value-chips__stash',
            showChips ? '' : TABLE_UX.trayReserved,
            showChips ? '' : 'bj-value-chips__stash--reserved',
            showChips && disabled ? 'bj-value-chips__stash--inactive' : '',
          )}
        >
          {showChips ? (
            <ChipTray
              onChipClick={onChipClick}
              onChipPointerDown={onChipPointerDown}
              disabled={disabled}
              minimumBet={minimumBet}
              showLabel={false}
              className="chip-tray--inline"
            />
          ) : (
            <span className="bj-value-chips__stash-placeholder" aria-hidden="true">
              &nbsp;
            </span>
          )}
        </div>
      </div>
      {trayLabel ? (
        <p className="bj-value-chips__row bj-value-chips__row--label" aria-label="Table label">
          {trayLabel}
        </p>
      ) : null}
    </div>
  );
}

export { CHIP_VALUES, chipValuesForMinimumBet } from './chipUtils';
export type { ChipValue } from './chipUtils';
