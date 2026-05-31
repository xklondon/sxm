import './FullTableMobileFallback.css';

interface FullTableMobileFallbackProps {
  onSwitchToCardView: () => void;
}

/**
 * Mobile replacement for the Full Table felt. Renders no felt container —
 * just a hint and a switch action — so no empty green table is shown.
 */
export function FullTableMobileFallback({ onSwitchToCardView }: FullTableMobileFallbackProps) {
  return (
    <div className="bj-mobile-fallback" role="note">
      <p className="bj-mobile-fallback__msg">Full Table is best on a larger screen.</p>
      <button
        type="button"
        className="ds-btn ds-btn--primary bj-mobile-fallback__btn"
        onClick={onSwitchToCardView}
      >
        Switch to Card View
      </button>
    </div>
  );
}
