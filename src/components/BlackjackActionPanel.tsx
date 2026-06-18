import { SXM_LAYOUT, sxmSectionProps } from './sxmLayoutContract';
import { TABLE_UX } from './tableUxContract';

export interface BlackjackActionPanelProps {
  variant?: 'table' | 'card';
  waitMessage?: string | null;
  actionsEnabled: boolean;
  canHit: boolean;
  canStand: boolean;
  canDouble: boolean;
  canSplit: boolean;
  showDouble: boolean;
  showSplit: boolean;
  showAid: boolean;
  /** Desktop Full Table — AID sits to the right of Hit instead of a second row. */
  aidInlineWithHit?: boolean;
  onHit: () => void;
  onStand: () => void;
  onDouble: () => void;
  onSplit: () => void;
  onAid: () => void;
}

/** Shared Hit/Stand/2×/Split/AID panel for Full Table and Card View. */
export function BlackjackActionPanel({
  variant = 'table',
  waitMessage = null,
  actionsEnabled,
  canHit,
  canStand,
  canDouble,
  canSplit,
  showDouble,
  showSplit,
  showAid,
  aidInlineWithHit = false,
  onHit,
  onStand,
  onDouble,
  onSplit,
  onAid,
}: BlackjackActionPanelProps) {
  if (waitMessage) {
    return (
      <div
        className={[
          TABLE_UX.playerActions,
          variant === 'table' ? 'bj-table-actions bj-table-actions--wait' : '',
          variant === 'card' ? 'bj-phone-view__action-bar bj-phone-view__action-bar--wait' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-live="polite"
      >
        <p className="bj-table-actions__wait-msg">{waitMessage}</p>
      </div>
    );
  }

  const rootClass = [
    TABLE_UX.playerActions,
    variant === 'table' ? 'bj-table-actions' : '',
    variant === 'card'
      ? `${TABLE_UX.cardViewBareActions} bj-phone-view__action-bar bj-phone-view__action-bar--playing`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  const primaryRowClass =
    variant === 'table'
      ? 'bj-table-actions__row'
      : 'bj-phone-view__action-bar-row bj-phone-view__action-bar-row--primary';
  const secondaryRowClass =
    variant === 'table'
      ? 'bj-table-actions__row'
      : 'bj-phone-view__action-bar-row bj-phone-view__action-bar-row--secondary';

  const aidBtnClass =
    variant === 'table'
      ? 'ds-btn ds-btn--ghost bj-table-actions__btn bj-table-actions__btn--sm'
      : `bj-phone-view__action-bar-extra ${TABLE_UX.cardViewActionCompact} bj-phone-view__action-btn--tappable bj-phone-view__action-bar-extra--aid`;

  const showSecondaryRow =
    variant === 'table'
      ? showDouble || showSplit || (showAid && !aidInlineWithHit)
      : showDouble || showSplit || showAid || !aidInlineWithHit;

  const standBtnClass =
    variant === 'table'
      ? 'ds-btn ds-btn--stand bj-table-actions__btn'
      : [
          'bj-phone-view__action-bar-btn',
          'bj-phone-view__action-bar-btn--stand',
          'ds-btn',
          'ds-btn--stand',
          actionsEnabled ? 'bj-phone-view__action-bar-btn--live' : '',
        ]
          .filter(Boolean)
          .join(' ');
  const hitBtnClass =
    variant === 'table'
      ? 'ds-btn ds-btn--hit bj-table-actions__btn'
      : [
          'bj-phone-view__action-bar-btn',
          'bj-phone-view__action-bar-btn--hit',
          'ds-btn',
          'ds-btn--hit',
          actionsEnabled ? 'bj-phone-view__action-bar-btn--live' : '',
        ]
          .filter(Boolean)
          .join(' ');
  const extraBtnClass = (legal: boolean) =>
    variant === 'table'
      ? [
          'ds-btn',
          'ds-btn--secondary',
          'bj-table-actions__btn',
          'bj-table-actions__btn--sm',
          legal ? 'bj-table-actions__btn--legal' : '',
        ]
          .filter(Boolean)
          .join(' ')
      : [
          'bj-phone-view__action-bar-extra',
          TABLE_UX.cardViewActionCompact,
          'bj-phone-view__action-btn--tappable',
          legal ? 'bj-phone-view__action-bar-extra--legal' : '',
        ]
          .filter(Boolean)
          .join(' ');

  return (
    <div className={rootClass} aria-label="Player actions" aria-live="polite">
      <div {...sxmSectionProps(SXM_LAYOUT.primaryActions, primaryRowClass)}>
        <button
          type="button"
          className={standBtnClass}
          disabled={!actionsEnabled || !canStand}
          onClick={onStand}
        >
          {variant === 'table' ? 'Stay' : 'Stand'}
        </button>
        <button
          type="button"
          className={hitBtnClass}
          disabled={!actionsEnabled || !canHit}
          onClick={onHit}
        >
          Hit
        </button>
        {aidInlineWithHit && showAid ? (
          <button
            type="button"
            className={aidBtnClass}
            disabled={!actionsEnabled}
            onClick={onAid}
          >
            AID
          </button>
        ) : null}
      </div>
      {showSecondaryRow ? (
        variant === 'table' ? (
          <div {...sxmSectionProps(SXM_LAYOUT.secondaryActions, secondaryRowClass)}>
            {showDouble ? (
              <button
                type="button"
                className={extraBtnClass(canDouble)}
                disabled={!canDouble}
                onClick={onDouble}
              >
                2×
              </button>
            ) : null}
            {showSplit ? (
              <button
                type="button"
                className={extraBtnClass(canSplit)}
                disabled={!canSplit}
                onClick={onSplit}
              >
                Split
              </button>
            ) : null}
            {showAid && !aidInlineWithHit ? (
              <button
                type="button"
                className={aidBtnClass}
                disabled={!actionsEnabled}
                onClick={onAid}
              >
                AID
              </button>
            ) : null}
          </div>
        ) : (
      <div {...sxmSectionProps(SXM_LAYOUT.secondaryActions, secondaryRowClass)}>
        {showDouble ? (
          <button
            type="button"
            className={extraBtnClass(canDouble)}
            disabled={!canDouble}
            onClick={onDouble}
          >
            2×
          </button>
        ) : (
          <span
            className="bj-phone-view__action-bar-extra bj-phone-view__action-bar-extra--placeholder"
            aria-hidden="true"
          />
        )}
        {showSplit ? (
          <button
            type="button"
            className={extraBtnClass(canSplit)}
            disabled={!canSplit}
            onClick={onSplit}
          >
            Split
          </button>
        ) : (
          <span
            className="bj-phone-view__action-bar-extra bj-phone-view__action-bar-extra--placeholder"
            aria-hidden="true"
          />
        )}
        {showAid && !aidInlineWithHit ? (
          <button
            type="button"
            className={aidBtnClass}
            disabled={!actionsEnabled}
            onClick={onAid}
          >
            AID
          </button>
        ) : (
          <span
            className="bj-phone-view__action-bar-extra bj-phone-view__action-bar-extra--placeholder"
            aria-hidden="true"
          />
        )}
      </div>
        )
      ) : null}
    </div>
  );
}
