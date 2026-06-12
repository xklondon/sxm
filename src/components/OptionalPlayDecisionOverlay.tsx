import './InsuranceDecisionOverlay.css';

export interface OptionalPlayDecisionOverlayProps {
  canDouble: boolean;
  canSplit: boolean;
  showDouble: boolean;
  showSplit: boolean;
  actionsEnabled: boolean;
  onDouble: () => void;
  onSplit: () => void;
}

/** Compact Double / Split offers — sits directly under the command area. */
export function OptionalPlayDecisionOverlay({
  canDouble,
  canSplit,
  showDouble,
  showSplit,
  actionsEnabled,
  onDouble,
  onSplit,
}: OptionalPlayDecisionOverlayProps) {
  const showDoubleBtn = showDouble && canDouble;
  const showSplitBtn = showSplit && canSplit;
  if (!showDoubleBtn && !showSplitBtn) {
    return null;
  }

  return (
    <div className="bj-insurance-overlay" role="group" aria-label="Optional play decisions">
      <div className="bj-insurance-overlay__actions">
        {showDoubleBtn ? (
          <button
            type="button"
            className="bj-insurance-overlay__btn bj-insurance-overlay__btn--primary"
            disabled={!actionsEnabled}
            onClick={onDouble}
          >
            Double
          </button>
        ) : null}
        {showSplitBtn ? (
          <button
            type="button"
            className="bj-insurance-overlay__btn bj-insurance-overlay__btn--secondary"
            disabled={!actionsEnabled}
            onClick={onSplit}
          >
            Split
          </button>
        ) : null}
      </div>
    </div>
  );
}
