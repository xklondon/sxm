import type { ReactNode } from 'react';
import type { BlackjackProtocolPhase } from '../engine/blackjack/protocol';
import type { DealSpeedPreset } from '../engine/blackjack/flowSettings';
import { isTableInstructionMessage } from './tableCommandDisplay';
import { TABLE_UX } from './tableUxContract';
import { SXM_LAYOUT, sxmSectionProps } from './sxmLayoutContract';
import './DealerBlock.css';

interface DealerBlockProps {
  awaitingNextRound: boolean;
  gameEnded: boolean;
  /** AID advice and optional contextual commentary — left column. */
  commentaryText?: string | null;
  /** Playful / dynamic content in the left-of-dealer column (e.g. Magic 8 Ball). */
  dynamicTextSlot?: ReactNode;
  /** Primary gameplay instruction — central command area. */
  commandMessage?: string | null;
  /** Extra command lines (round summary, legal-action hints). */
  commandLines?: string[];
  onNextRound: () => void;
  /** Finished table — opens reset setup (owner only). */
  onNewGame?: () => void;
  canStartNewGame?: boolean;
  newGameDisabledReason?: string | null;
  dealerCards: React.ReactNode;
  /** Bank value + chip balance — rendered under dealer cards. */
  bankInfo?: ReactNode;
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
  nextRoundPending?: boolean;
  shuffleAnimating?: boolean;
  engineStatus?: string;
  initialDealManual: boolean;
  bankDrawManual: boolean;
  /** Card View: command renders in layout summary row (between dealer and hero). */
  omitCommand?: boolean;
}

export function DealerCommandArea({
  commandMessage,
  commandLines = [],
  gameEnded,
}: {
  commandMessage?: string | null;
  commandLines?: string[];
  gameEnded: boolean;
}) {
  const hasCommandContent =
    Boolean(commandMessage?.trim()) || commandLines.some((line) => line.trim().length > 0);

  return (
    <div className="dealer-block__command" aria-live="polite">
      {hasCommandContent ? (
        <>
          {commandMessage ? (
            <p
              className={[
                'dealer-block__status',
                gameEnded ? 'dealer-block__status--game-over' : '',
                isTableInstructionMessage(commandMessage) ? 'dealer-block__status--summary' : '',
              ]
                .filter(Boolean)
                .join(' ')}
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
  );
}

export function DealerBlock({
  awaitingNextRound,
  gameEnded,
  commentaryText,
  dynamicTextSlot,
  commandMessage,
  commandLines = [],
  onNextRound,
  onNewGame,
  canStartNewGame = false,
  newGameDisabledReason = null,
  dealerCards,
  bankInfo,
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
  nextRoundPending = false,
  shuffleAnimating = false,
  engineStatus,
  initialDealManual,
  bankDrawManual,
  omitCommand = false,
}: DealerBlockProps) {
  const status = engineStatus;

  function resolvePrimaryAction(): {
    label: string;
    disabled: boolean;
    onClick: () => void;
    cardsVariant?: boolean;
    hint?: string | null;
  } {
    if (gameEnded && onNewGame) {
      return {
        label: 'New Game',
        disabled: !canStartNewGame,
        onClick: onNewGame,
        hint: !canStartNewGame ? newGameDisabledReason : null,
      };
    }

    if (protocolPhase === 'round-complete' && awaitingNextRound) {
      const pending = nextRoundPending || dealActionPending;
      return {
        label: pending ? 'Starting…' : 'New Cards',
        disabled: pending,
        onClick: onNextRound,
      };
    }

    if (protocolPhase !== 'betting') {
      if (status === 'initial-deal' && initialDealManual) {
        return {
          label: 'Card',
          disabled: false,
          onClick: onDealNextCard,
        };
      }
      if (status === 'bank-turn' && bankDrawManual) {
        return {
          label: 'Draw',
          disabled: false,
          onClick: onDrawBank,
        };
      }
      return {
        label: 'Deal Cards',
        disabled: true,
        onClick: onDealCards,
        cardsVariant: true,
      };
    }

    if (!shoeStarted) {
      return {
        label: 'Shuffle to start',
        disabled: !bankerReady || !hasStakes || dealActionPending,
        onClick: onShuffleToStart,
      };
    }

    return {
      label: dealActionPending ? 'Dealing…' : 'Deal Cards',
      disabled: !canDeal || !bettingOpen || !bankerReady || dealActionPending,
      onClick: onDealCards,
      cardsVariant: true,
    };
  }

  function renderPrimaryAction() {
    const { label, disabled, onClick, cardsVariant, hint } = resolvePrimaryAction();
    return (
      <>
        <button
          type="button"
          className={[
            'dealer-block__action',
            'dealer-block__action--primary',
            TABLE_UX.dealerActionReserved,
            cardsVariant ? 'dealer-block__action--cards' : '',
            disabled ? 'dealer-block__action--disabled' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={onClick}
          disabled={disabled}
          aria-disabled={disabled}
        >
          {label}
        </button>
        {hint ? (
          <p className="dealer-block__hint dealer-block__hint--new-game">{hint}</p>
        ) : null}
      </>
    );
  }

  const primaryAction = renderPrimaryAction();

  const cardsSlot = dealerCards ? (
    <div className={['dealer-block__cards', shuffleAnimating ? 'dealer-block__cards--shuffling' : ''].filter(Boolean).join(' ')}>
      {dealerCards}
    </div>
  ) : (
    <div className="dealer-block__card-placeholder" aria-hidden="true">
      <div
        className={[
          'dealer-block__card-stack',
          shuffleAnimating ? 'dealer-block__card-stack--shuffling' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="dealer-block__card-back dealer-block__card-back--2" />
        <div className="dealer-block__card-back dealer-block__card-back--1" />
      </div>
    </div>
  );

  return (
    <div {...sxmSectionProps(SXM_LAYOUT.dealerZone, 'dealer-block')}>
      <div className="dealer-block__grid">
        <div className="dealer-block__commentary-col">
          {dynamicTextSlot}
          {commentaryText ? (
            <p className="dealer-block__commentary" aria-live="polite">
              {commentaryText}
            </p>
          ) : !dynamicTextSlot ? (
            <p className="dealer-block__commentary dealer-block__commentary--placeholder" aria-hidden="true">
              &nbsp;
            </p>
          ) : null}
        </div>

        <div className="dealer-block__center-col">
          <div className="dealer-block__stack">
            <div className="dealer-block__cards-slot">{cardsSlot}</div>
            {bankInfo ?? (
              <div
                {...sxmSectionProps(
                  SXM_LAYOUT.bankSummary,
                  'dealer-block__bank-info dealer-block__bank-info--placeholder',
                )}
                aria-hidden="true"
              >
                &nbsp;
              </div>
            )}
            <div className="dealer-block__action-slot">{primaryAction}</div>
          </div>
          {!omitCommand ? (
            <DealerCommandArea
              commandMessage={commandMessage}
              commandLines={commandLines}
              gameEnded={gameEnded}
            />
          ) : null}
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
