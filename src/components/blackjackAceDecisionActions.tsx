import { TABLE_UX } from './tableUxContract';

export const ACE_DECISION_ACTIONS_CLASS = 'bj-table-actions--ace-decision';
export const ACE_DECISION_BTN_CLASS = 'bj-table-actions__btn--ace';

interface AceDecisionButtonRowProps {
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
  primaryDisabled?: boolean;
  secondaryDisabled?: boolean;
  panelClassName?: string;
  ariaLabel?: string;
}

/** Thin yellow-bordered single-line Take 1:1 / Play vs Ace (and insurance) buttons — all views. */
export function AceDecisionButtonRow({
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  primaryDisabled = false,
  secondaryDisabled = false,
  panelClassName = '',
  ariaLabel = 'Ace decision',
}: AceDecisionButtonRowProps) {
  return (
    <div
      className={[
        TABLE_UX.playerActions,
        'bj-table-actions',
        ACE_DECISION_ACTIONS_CLASS,
        panelClassName,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <div className="bj-table-actions__row bj-table-actions__row--ace">
        <button
          type="button"
          className={[
            'ds-btn',
            'ds-btn--secondary',
            'bj-table-actions__btn',
            'bj-table-actions__btn--sm',
            ACE_DECISION_BTN_CLASS,
          ].join(' ')}
          disabled={primaryDisabled}
          onClick={onPrimary}
        >
          {primaryLabel}
        </button>
        <button
          type="button"
          className={[
            'ds-btn',
            'ds-btn--ghost',
            'bj-table-actions__btn',
            'bj-table-actions__btn--sm',
            ACE_DECISION_BTN_CLASS,
          ].join(' ')}
          disabled={secondaryDisabled}
          onClick={onSecondary}
        >
          {secondaryLabel}
        </button>
      </div>
    </div>
  );
}
