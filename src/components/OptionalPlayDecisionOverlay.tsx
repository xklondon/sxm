import './InsuranceDecisionOverlay.css';
import './OptionalPlayDecisionOverlay.css';

export interface OptionalPlayDecisionOverlayProps {
  canDouble: boolean;
  canSplit: boolean;
  showDouble: boolean;
  showSplit: boolean;
  actionsEnabled: boolean;
  onDouble: () => void;
  onSplit: () => void;
  /** Decline split and continue with Hit/Stay — no engine action. */
  onPlayHand?: () => void;
}

/** Compact Double / Split offers — command zone on mobile; cards zone on desktop Full Table. */
export function OptionalPlayDecisionOverlay({
  canDouble,
  canSplit,
  showDouble,
  showSplit,
  actionsEnabled,
  onDouble,
  onSplit,
  onPlayHand,
}: OptionalPlayDecisionOverlayProps) {
  const showDoubleBtn = showDouble && canDouble;
  const showSplitBtn = showSplit && canSplit;
  if (!showDoubleBtn && !showSplitBtn) {
    return null;
  }

  return (
    <div
      className="bj-insurance-overlay bj-optional-play-overlay"
      role="group"
      aria-label="Optional play decisions"
    >
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
        {showSplitBtn && onPlayHand ? (
          <button
            type="button"
            className="bj-insurance-overlay__btn bj-insurance-overlay__btn--secondary"
            disabled={!actionsEnabled}
            onClick={onPlayHand}
          >
            Play Hand
          </button>
        ) : null}
      </div>
    </div>
  );
}
