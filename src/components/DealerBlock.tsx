import { useState } from 'react';
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
  /** AID advice and optional contextual commentary — left column. */
  commentaryText?: string | null;
  /** Primary gameplay instruction — central command area. */
  commandMessage?: string | null;
  /** Extra command lines (round summary, legal-action hints). */
  commandLines?: string[];
  /** Show stacked card backs when no dealer cards (betting). */
  showDealerPlaceholder?: boolean;
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
  commentaryText,
  commandMessage,
  commandLines = [],
  showDealerPlaceholder = false,
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
  const [infoOpen, setInfoOpen] = useState(false);
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
  ) : showDealerPlaceholder ? (
    <div className="dealer-block__card-placeholder" aria-hidden="true">
      <div className="dealer-block__card-stack">
        <div className="dealer-block__card-back dealer-block__card-back--2" />
        <div className="dealer-block__card-back dealer-block__card-back--1" />
      </div>
    </div>
  ) : (
    <div className="dealer-block__cards dealer-block__cards--empty" aria-hidden="true" />
  );

  const hasCommandContent =
    Boolean(commandMessage?.trim()) || commandLines.some((line) => line.trim().length > 0);

  function renderInfoPanelContent() {
    return (
      <>
        <div className="dealer-block__info-chip">
          <span className="dealer-block__info-k">Playing for</span>
          <span className="dealer-block__info-v">{playingFor}</span>
        </div>
        <div className="dealer-block__info-chip dealer-block__info-chip--bet">
          <span className="dealer-block__info-k">Minimum bet</span>
          <span className="dealer-block__info-v">
            {minimumBet}
            {canChangeMinBet && !gameEnded && (
              <button
                type="button"
                className="dealer-block__chip-btn"
                onClick={onChangeMinBet}
                aria-label="Change minimum bet"
                title="Change minimum bet"
              >
                $
              </button>
            )}
          </span>
        </div>
        {hasDeck && (
          <div className="dealer-block__info-chip">
            <span className="dealer-block__info-k">Shoe</span>
            <span className="dealer-block__info-v">
              {deckCount}-deck · {totalCards} / {remaining}
            </span>
          </div>
        )}
        <div className="dealer-block__info-chip">
          <span className="dealer-block__info-k">Deal speed</span>
          <span className="dealer-block__info-v">
            {canChangeDealSpeed && !gameEnded ? (
              <button
                type="button"
                className="dealer-block__chip-btn dealer-block__chip-btn--meta"
                onClick={onCycleDealSpeed}
                aria-label="Change dealing speed"
                title="Change dealing speed"
              >
                <span className="dealer-block__chip-icon" aria-hidden="true">⏱</span>
                {dealSpeedLabel}
              </button>
            ) : (
              <>
                <span className="dealer-block__chip-icon" aria-hidden="true">⏱</span>
                {dealSpeedLabel}
              </>
            )}
          </span>
        </div>
        <div className="dealer-block__info-chip">
          <span className="dealer-block__info-k">Protocol</span>
          <span className="dealer-block__info-v">
            {canChangeProtocol && !gameEnded ? (
              <button
                type="button"
                className="dealer-block__chip-btn dealer-block__chip-btn--meta"
                onClick={onChangeProtocol}
                aria-label="Change protocol"
                title="Change protocol"
              >
                <span className="dealer-block__chip-icon" aria-hidden="true">⚙</span>
                {protocolLabel}
              </button>
            ) : (
              <>
                <span className="dealer-block__chip-icon" aria-hidden="true">⚙</span>
                {protocolLabel}
              </>
            )}
          </span>
        </div>
      </>
    );
  }

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

          <div className="dealer-block__info-wrap">
            <button
              type="button"
              className={`dealer-block__info-toggle${infoOpen ? ' dealer-block__info-toggle--open' : ''}`}
              aria-expanded={infoOpen}
              aria-controls="dealer-block-table-info"
              onClick={() => setInfoOpen((open) => !open)}
            >
              Table info
            </button>
            <div
              id="dealer-block-table-info"
              className={`dealer-block__info-panel${infoOpen ? ' dealer-block__info-panel--open' : ''}`}
              aria-hidden={!infoOpen}
            >
              {renderInfoPanelContent()}
            </div>
          </div>

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
