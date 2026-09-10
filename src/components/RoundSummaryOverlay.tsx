import { useState } from 'react';
import type { Deck } from '../types';
import type { RoundSummaryOverlayModel } from '../engine/blackjack/roundSummaryOverlay';
import { getCardById } from '../engine/deck';
import { PlayingCard } from './PlayingCard';
import './RoundSummaryOverlay.css';

interface RoundSummaryOverlayProps {
  open: boolean;
  model: RoundSummaryOverlayModel;
  deck: Deck | null;
  onPlayOn: () => void;
  onClose: () => void;
  onDontShowAgain?: () => void;
  pending?: boolean;
}

function formatOutcomeChips(net: number): string {
  const amount = Math.abs(net);
  if (net > 0) {
    return `Won ${amount}c`;
  }
  if (net < 0) {
    return `Lost ${amount}c`;
  }
  return 'Push 0c';
}

function formatBankNetSummary(entries: RoundSummaryOverlayModel['entries']): string {
  const tableNet = entries.reduce((sum, entry) => sum + entry.netChips, 0);
  if (tableNet > 0) {
    return `Players net +${tableNet}c this round`;
  }
  if (tableNet < 0) {
    return `Bank net +${Math.abs(tableNet)}c this round`;
  }
  return 'Table net even';
}

function outcomeTone(net: number): 'win' | 'lose' | 'push' {
  if (net > 0) {
    return 'win';
  }
  if (net < 0) {
    return 'lose';
  }
  return 'push';
}

function SummaryCardStrip({ deck, cardIds }: { deck: Deck | null; cardIds: string[] }) {
  if (!deck || cardIds.length === 0) {
    return null;
  }
  return (
    <span className="bj-round-summary__cards" aria-label="Hand cards">
      {cardIds.map((id) => {
        const card = getCardById(deck, id);
        if (!card) {
          return null;
        }
        return <PlayingCard key={id} card={card} compact className="bj-round-summary__card" />;
      })}
    </span>
  );
}

export function RoundSummaryOverlay({
  open,
  model,
  deck,
  onPlayOn,
  onClose,
  onDontShowAgain,
  pending = false,
}: RoundSummaryOverlayProps) {
  const [hideFuture, setHideFuture] = useState(false);

  if (!open) {
    return null;
  }

  const tableNet = model.entries.reduce((sum, entry) => sum + entry.netChips, 0);
  const tableTone = outcomeTone(tableNet);

  return (
    <div
      className="invite-modal-overlay bj-table-panel-overlay bj-round-summary-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className={[
          'invite-modal',
          'invite-modal--ledger',
          'invite-modal--table-panel',
          'bj-round-summary',
          `bj-round-summary--${tableTone}`,
        ].join(' ')}
        role="dialog"
        aria-labelledby="bj-round-summary-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bj-round-summary__sparkles" aria-hidden="true">
          {tableTone === 'win' ? '💸✨🎉' : tableTone === 'lose' ? '🥒😬' : '🤝'}
        </div>

        <div className="invite-modal__header bj-round-summary__header">
          <h2 id="bj-round-summary-title" className="invite-modal__title">
            Round Summary
          </h2>
          <button
            type="button"
            className="invite-modal__close secondary"
            onClick={onClose}
            aria-label="Close round summary"
          >
            ×
          </button>
        </div>

        <div className="bj-round-summary__bank">
          <span className="bj-round-summary__bank-emoji" aria-hidden="true">
            {model.bankFlavorEmoji}
          </span>
          <div className="bj-round-summary__bank-copy">
            <p className="bj-round-summary__bank-total">
              Bank {model.dealerTotal}
              <SummaryCardStrip deck={deck} cardIds={model.dealerCardIds} />
            </p>
            <p className="bj-round-summary__bank-flavor">{formatBankNetSummary(model.entries)}</p>
            <p className="bj-round-summary__bank-detail">{model.bankFlavorLine}</p>
          </div>
        </div>

        <ul className="bj-round-summary__list">
          {model.entries.map((entry) => {
            const tone = outcomeTone(entry.netChips);
            return (
              <li
                key={entry.handKey}
                className={[
                  'bj-round-summary__row',
                  `bj-round-summary__row--${tone}`,
                ].join(' ')}
              >
                <div className="bj-round-summary__row-head">
                  <span className="bj-round-summary__box">{entry.boxLabel}</span>
                  <span className="bj-round-summary__player">{entry.playerName}</span>
                  <span
                    className={[
                      'bj-round-summary__outcome',
                      entry.netChips > 0 ? 'bj-round-summary__outcome--win' : '',
                      entry.netChips < 0 ? 'bj-round-summary__outcome--lose' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {entry.outcomeLabel}
                  </span>
                </div>
                <div className="bj-round-summary__row-body">
                  <span className="bj-round-summary__hand">
                    <span className="bj-round-summary__hand-value">{entry.handValue}</span>
                    <SummaryCardStrip deck={deck} cardIds={entry.cardIds} />
                  </span>
                  <span
                    className={[
                      'bj-round-summary__chips',
                      entry.netChips > 0 ? 'bj-round-summary__chips--win' : '',
                      entry.netChips < 0 ? 'bj-round-summary__chips--lose' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {formatOutcomeChips(entry.netChips)}
                  </span>
                </div>
                <p className="bj-round-summary__flavor">
                  <span aria-hidden="true">{entry.flavorEmoji}</span> {entry.flavorLine}
                </p>
              </li>
            );
          })}
        </ul>

        <p className="bj-round-summary__next-round-hint">
          Press <strong>New Cards</strong> to begin the next betting round.
        </p>

        <label className="bj-round-summary__opt-out">
          <input
            type="checkbox"
            checked={hideFuture}
            onChange={(e) => {
              const checked = e.target.checked;
              setHideFuture(checked);
              if (checked) {
                onDontShowAgain?.();
              }
            }}
          />
          <span>Don&apos;t show again</span>
        </label>

        <div className="bj-round-summary__actions">
          <button
            type="button"
            className="ds-btn ds-btn--primary bj-round-summary__play-on"
            disabled={pending}
            onClick={onPlayOn}
          >
            {pending ? 'Starting…' : 'Play On'}
          </button>
          <button type="button" className="ds-btn ds-btn--secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
