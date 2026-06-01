import './FullTableMobileFallback.css';

interface FullTableMobileFallbackProps {
  onSwitchToCardView: () => void;
}

/**
 * Last-resort hint shown ONLY on ultra-narrow screens (< 360px), where the
 * Full Table felt cannot render usefully. Normal phones render the real
 * (mobile-optimized) Full Table instead of this.
 */
export function FullTableMobileFallback({ onSwitchToCardView }: FullTableMobileFallbackProps) {
  return (
    <div className="bj-mobile-fallback" role="note">
      <p className="bj-mobile-fallback__msg">This screen is too narrow for Full Table.</p>
      <button
        type="button"
        className="ds-btn ds-btn--primary bj-mobile-fallback__btn"
        onClick={onSwitchToCardView}
      >
        Use Card View
      </button>
    </div>
  );
}
