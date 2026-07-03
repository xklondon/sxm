import './InsuranceDecisionOverlay.css';

export interface InsuranceDecisionOverlayProps {
  boxLabel: string;
  boxIndex: number;
  boxCount: number;
  maxBet: number;
  canAfford: boolean;
  blockReason?: string | null;
  pendingTake?: boolean;
  onInsurance: () => void;
  onDecline: () => void;
}

/** Compact insurance prompt — sits directly under the command area. */
export function InsuranceDecisionOverlay({
  boxLabel,
  boxIndex,
  boxCount,
  maxBet,
  canAfford,
  blockReason,
  pendingTake = false,
  onInsurance,
  onDecline,
}: InsuranceDecisionOverlayProps) {
  const takeDisabled = pendingTake || !canAfford;
  const declineDisabled = pendingTake;
  return (
    <div
      className="bj-insurance-overlay"
      role="group"
      aria-label={`${boxLabel} insurance decision`}
    >
      <p className="bj-insurance-overlay__hint">
        Insurance: Box {boxIndex} of {boxCount} — pays 2:1
      </p>
      {!canAfford && blockReason ? (
        <p className="bj-insurance-overlay__block" role="status">
          {blockReason}
        </p>
      ) : null}
      <div className="bj-insurance-overlay__actions">
        <button
          type="button"
          className="bj-insurance-overlay__btn bj-insurance-overlay__btn--primary"
          disabled={takeDisabled}
          onClick={onInsurance}
        >
          Insurance{maxBet > 0 ? ` ${maxBet}` : ''}
        </button>
        <button
          type="button"
          className="bj-insurance-overlay__btn bj-insurance-overlay__btn--secondary"
          disabled={declineDisabled}
          onClick={onDecline}
        >
          Don&apos;t Insure
        </button>
      </div>
    </div>
  );
}
