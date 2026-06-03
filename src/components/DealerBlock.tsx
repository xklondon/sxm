import type { BlackjackProtocolPhase } from '../engine/blackjack/protocol';
import type { DealSpeedPreset } from '../engine/blackjack/flowSettings';
import './DealerBlock.css';

interface DealerBlockProps {
  deckCount: number;
  totalCards: number;
  remaining: number;
  playingFor: string;
  minimumBet: number;
  canChangeMinBet: boolean;
  onChangeMinBet: () => void;
  dealSpeedLabel: string;
  canChangeDealSpeed: boolean;
  onCycleDealSpeed: () => void;
  protocolLabel: string;
  canChangeProtocol: boolean;
  onChangeProtocol: () => void;
  awaitingNextRound: boolean;
  gameEnded: boolean;
  /** Shown in center status by parent — not duplicated in dealer block. */
  gameOverMessage?: string;
  /** Consolidated per-box round summary, shown above the Next Round action. */
  roundSummaryLines?: string[];
  onNextRound: () => void;
  dealerCards: React.ReactNode;
  protocolPhase: BlackjackProtocolPhase;
  hasDeck: boolean;
  bankerReady: boolean;
  shoeStarted: boolean;
  bettingOpen: boolean;
  canDeal: boolean;
  hasStakes: boolean;
  onShuffleToStart: () => void;
  onDealCards: () => void;
  onDealNextCard: () => void;
  onDrawBank: () => void;
  dealActionPending?: boolean;
  engineStatus?: string;
  initialDealManual: boolean;
  bankDrawManual: boolean;
}

export function DealerBlock({
  deckCount,
  totalCards,
  remaining,
  playingFor,
  minimumBet,
  canChangeMinBet,
  onChangeMinBet,
  dealSpeedLabel,
  canChangeDealSpeed,
  onCycleDealSpeed,
  protocolLabel,
  canChangeProtocol,
  onChangeProtocol,
  awaitingNextRound,
  gameEnded,
  roundSummaryLines,
  onNextRound,
  dealerCards,
  protocolPhase,
  hasDeck,
  bankerReady,
  shoeStarted,
  bettingOpen,
  canDeal,
  hasStakes,
  onShuffleToStart,
  onDealCards,
  onDealNextCard,
  onDrawBank,
  dealActionPending = false,
  engineStatus,
  initialDealManual,
  bankDrawManual,
}: DealerBlockProps) {
  const status = engineStatus;

  function renderInPlayAction() {
    if (gameEnded) {
      return null;
    }
    if (status === 'initial-deal' && initialDealManual) {
      return (
        <button type="button" className="dealer-block__action dealer-block__action--primary" onClick={onDealNextCard}>
          Card
        </button>
      );
    }
    if (status === 'bank-turn' && bankDrawManual) {
      return (
        <button type="button" className="dealer-block__action dealer-block__action--primary" onClick={onDrawBank}>
          Draw
        </button>
      );
    }
    return null;
  }

  function renderBettingActions() {
    if (gameEnded) {
      return null;
    }

    if (protocolPhase === 'round-complete' && awaitingNextRound) {
      return (
        <button
          type="button"
          className="dealer-block__action dealer-block__action--primary"
          onClick={onNextRound}
        >
          Next Round
        </button>
      );
    }

    if (protocolPhase !== 'betting') {
      return renderInPlayAction();
    }

    if (!shoeStarted) {
      return (
        <button
          type="button"
          className="dealer-block__action dealer-block__action--primary"
          onClick={onShuffleToStart}
          disabled={!bankerReady || !hasStakes || dealActionPending}
        >
          Shuffle to start
        </button>
      );
    }

    if (canDeal && bettingOpen) {
      return (
        <button
          type="button"
          className="dealer-block__action dealer-block__action--primary dealer-block__action--cards"
          onClick={onDealCards}
          disabled={!bankerReady || dealActionPending}
        >
          {dealActionPending ? 'Dealing…' : 'Deal Cards'}
        </button>
      );
    }

    return null;
  }

  return (
    <div className="dealer-block">
      <p className="dealer-block__title">Blackjack</p>
      <p className="dealer-block__line">Playing for: {playingFor}</p>
      <p className="dealer-block__line dealer-block__line--min-bet">
        Minimum bet: {minimumBet}
        {canChangeMinBet && !gameEnded && (
          <button
            type="button"
            className="dealer-block__icon-btn"
            onClick={onChangeMinBet}
            aria-label="Change minimum bet"
            title="Change minimum bet"
          >
            $
          </button>
        )}
      </p>
      {hasDeck && (
        <p className="dealer-block__line">
          {deckCount}-deck · Total Cards: {totalCards} / {remaining}
        </p>
      )}

      <p className="dealer-block__meta-line">
        {canChangeDealSpeed && !gameEnded ? (
          <button
            type="button"
            className="dealer-block__icon-btn dealer-block__icon-btn--meta"
            onClick={onCycleDealSpeed}
            aria-label="Change dealing speed"
            title="Change dealing speed"
          >
            <span className="dealer-block__icon" aria-hidden="true">⏱</span>
            {dealSpeedLabel}
          </button>
        ) : (
          <>
            <span className="dealer-block__icon" aria-hidden="true">⏱</span>
            {dealSpeedLabel}
          </>
        )}
      </p>

      <p className="dealer-block__meta-line">
        {canChangeProtocol && !gameEnded ? (
          <button
            type="button"
            className="dealer-block__icon-btn dealer-block__icon-btn--meta"
            onClick={onChangeProtocol}
            aria-label="Change protocol"
            title="Change protocol"
          >
            <span className="dealer-block__icon" aria-hidden="true">⚙</span>
            {protocolLabel}
          </button>
        ) : (
          <>
            <span className="dealer-block__icon" aria-hidden="true">⚙</span>
            {protocolLabel}
          </>
        )}
      </p>

      {!bankerReady && !gameEnded && <p className="dealer-block__hint">Choose banker first.</p>}

      <div className="dealer-block__actions">{renderBettingActions()}</div>

      {dealerCards && <div className="dealer-block__cards">{dealerCards}</div>}

      {roundSummaryLines && roundSummaryLines.length > 0 && (
        <div className="dealer-block__summary" aria-live="polite">
          {roundSummaryLines.map((line, i) => (
            <p key={i} className="dealer-block__summary-line">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export const DEAL_SPEED_CYCLE: DealSpeedPreset[] = ['fast', 'normal', 'slow'];

export function dealSpeedDisplayLabel(preset: DealSpeedPreset): string {
  switch (preset) {
    case 'fast':
      return '1s deal';
    case 'slow':
      return '5s deal';
    default:
      return '3s deal';
  }
}
