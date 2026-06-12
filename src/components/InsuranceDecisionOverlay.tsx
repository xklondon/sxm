import './InsuranceDecisionOverlay.css';

export interface InsuranceDecisionOverlayProps {
  boxLabel: string;
  maxBet: number;
  canAfford: boolean;
  onInsurance: () => void;
  onDecline: () => void;
}

/** Compact insurance prompt — sits directly under the command area. */
export function InsuranceDecisionOverlay({
  boxLabel,
  maxBet,
  canAfford,
  onInsurance,
  onDecline,
}: InsuranceDecisionOverlayProps) {
  return (
    <div
      className="bj-insurance-overlay"
      role="group"
      aria-label={`${boxLabel} insurance decision`}
    >
      <p className="bj-insurance-overlay__hint">Insurance pays 2:1</p>
      <div className="bj-insurance-overlay__actions">
        <button
          type="button"
          className="bj-insurance-overlay__btn bj-insurance-overlay__btn--primary"
          disabled={!canAfford}
          onClick={onInsurance}
        >
          Insurance{maxBet > 0 ? ` ${maxBet}` : ''}
        </button>
        <button
          type="button"
          className="bj-insurance-overlay__btn bj-insurance-overlay__btn--secondary"
          onClick={onDecline}
        >
          Don&apos;t Insure
        </button>
      </div>
    </div>
  );
}
