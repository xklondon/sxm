import type { BlackjackProtocolPhase } from '../engine/blackjack/protocol';
import type { DealSpeedPreset } from '../engine/blackjack/flowSettings';
import './DealerBlock.css';

interface DealerBlockProps {
  awaitingNextRound: boolean;
  gameEnded: boolean;
  /** AID advice and optional contextual commentary — left column. */
  commentaryText?: string | null;
  /** Primary gameplay instruction — central command area. */
  commandMessage?: string | null;
  /** Extra command lines (round summary, legal-action hints). */
  commandLines?: string[];
  onOpenTableDetails?: () => void;
  tableDetailsOpen?: boolean;
  onNextRound: () => void;
  dealerCards: React.ReactNode;
  protocolPhase: BlackjackProtocolPhase;
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
  awaitingNextRound,
  gameEnded,
  commentaryText,
  commandMessage,
  commandLines = [],
  onOpenTableDetails,
  tableDetailsOpen = false,
  onNextRound,
  dealerCards,
  protocolPhase,
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

  const primaryAction = renderBettingActions();

  const cardsSlot = dealerCards ? (
    <div className="dealer-block__cards">{dealerCards}</div>
  ) : (
    <div className="dealer-block__card-placeholder" aria-hidden="true">
      <div className="dealer-block__card-stack">
        <div className="dealer-block__card-back dealer-block__card-back--2" />
        <div className="dealer-block__card-back dealer-block__card-back--1" />
      </div>
    </div>
  );

  const hasCommandContent =
    Boolean(commandMessage?.trim()) || commandLines.some((line) => line.trim().length > 0);

  return (
    <div className="dealer-block">
      <div className="dealer-block__grid">
        <div className="dealer-block__commentary-col">
          {commentaryText ? (
            <p className="dealer-block__commentary" aria-live="polite">
              {commentaryText}
            </p>
          ) : (
            <p className="dealer-block__commentary dealer-block__commentary--placeholder" aria-hidden="true">
              &nbsp;
            </p>
          )}
        </div>

        <div className="dealer-block__center-col">
          <p className="dealer-block__brand">Blackjack</p>
          <div className="dealer-block__cards-slot">{cardsSlot}</div>
          <div className="dealer-block__action-slot">
            {primaryAction ?? <span className="dealer-block__action-spacer" aria-hidden="true" />}
          </div>

          {onOpenTableDetails && (
            <button
              type="button"
              className="dealer-block__details-btn"
              onClick={onOpenTableDetails}
              aria-expanded={tableDetailsOpen}
              aria-controls="table-details-slide-title"
            >
              Table details
            </button>
          )}

          <div className="dealer-block__command" aria-live="polite">
            {hasCommandContent ? (
              <>
                {commandMessage ? (
                  <p
                    className={`dealer-block__status${
                      gameEnded ? ' dealer-block__status--game-over' : ''
                    }`}
                  >
                    {commandMessage}
                  </p>
                ) : null}
                {commandLines.map((line, i) => (
                  <p key={`${i}-${line}`} className="dealer-block__status dealer-block__status--summary">
                    {line}
                  </p>
                ))}
              </>
            ) : (
              <p className="dealer-block__status dealer-block__status--placeholder" aria-hidden="true">
                &nbsp;
              </p>
            )}
          </div>
          {!bankerReady && !gameEnded && (
            <p className="dealer-block__hint">Choose banker first.</p>
          )}
        </div>
      </div>
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
