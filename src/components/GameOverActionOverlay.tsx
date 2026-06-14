import { useState } from 'react';
import type { GameOverPresentationModel } from './gameOverPresentation';
import { IOU_HANDOFF_MESSAGE_MAX_LENGTH } from './gameOverIouMessage';
import './GameOverActionOverlay.css';

export type GameOverIouFeedback = {
  tone: 'success' | 'info' | 'error';
  message: string;
  openUrl?: string;
};

export type GameOverCompleteOptions = {
  saveLedger: boolean;
  createIou: boolean;
  iouMessage?: string;
};

export interface GameOverActionOverlayProps {
  open: boolean;
  /** Mobile: centered overlay. Desktop: inline in This Table side panel. */
  layout?: 'overlay' | 'inline';
  presentation: GameOverPresentationModel;
  canSaveToLedger: boolean;
  ledgerAlreadyAdded: boolean;
  canCreateIou: boolean;
  iouDisabledReason?: string;
  iouPending?: boolean;
  iouFeedback?: GameOverIouFeedback | null;
  pending?: boolean;
  canStartNewGame?: boolean;
  newGameDisabledReason?: string | null;
  onOpenLedger?: () => void;
  onComplete: (options: GameOverCompleteOptions) => void | Promise<void>;
  onDismiss: () => void;
}

/** Game-end sheet — summary, ledger/IOU choices, Start New Game. */
export function GameOverActionOverlay({
  open,
  layout = 'overlay',
  presentation,
  canSaveToLedger,
  ledgerAlreadyAdded,
  canCreateIou,
  iouDisabledReason,
  iouPending = false,
  iouFeedback = null,
  pending = false,
  canStartNewGame = true,
  newGameDisabledReason = null,
  onOpenLedger,
  onComplete,
  onDismiss,
}: GameOverActionOverlayProps) {
  const [addToLedger, setAddToLedger] = useState(false);
  const [createIou, setCreateIou] = useState(false);
  const [showIouMessage, setShowIouMessage] = useState(false);
  const [iouMessage, setIouMessage] = useState('');

  if (!open) {
    return null;
  }

  const busy = pending || iouPending;
  const iouToggleDisabled = !canCreateIou || busy;
  const ledgerToggleDisabled = !canSaveToLedger || ledgerAlreadyAdded || busy;
  const startNewGameDisabled = !canStartNewGame || busy;

  async function handleStartNewGame() {
    if (startNewGameDisabled) {
      return;
    }
    const trimmedMessage = iouMessage.trim().slice(0, IOU_HANDOFF_MESSAGE_MAX_LENGTH);
    await onComplete({
      saveLedger: addToLedger && !ledgerAlreadyAdded && canSaveToLedger,
      createIou: createIou && canCreateIou,
      iouMessage: trimmedMessage || undefined,
    });
  }

  const isInline = layout === 'inline';

  const panel = (
    <div
      className={[
        'invite-modal invite-modal--ledger invite-modal--table-panel bj-game-over',
        isInline ? 'bj-game-over--inline' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="dialog"
      aria-labelledby="bj-game-over-title"
      aria-modal={isInline ? undefined : 'true'}
      onClick={isInline ? undefined : (e) => e.stopPropagation()}
    >
      <header className="bj-game-over__header">
        <h2 id="bj-game-over-title" className="bj-game-over__title">
          {presentation.title}
        </h2>
        <button
          type="button"
          className="bj-game-over__close ds-btn ds-btn--icon"
          aria-label="Close without saving"
          disabled={busy}
          onClick={onDismiss}
        >
          ×
        </button>
      </header>

      <div className="bj-game-over__visual" aria-hidden="true">
        <span className="bj-game-over__visual-glyph">{presentation.visual.glyph}</span>
        <span className="bj-game-over__visual-label">{presentation.visual.label}</span>
      </div>

      <div className="bj-game-over__summary-block">
        <p className="bj-game-over__summary-line bj-game-over__summary-line--winner">
          {presentation.winnerLine}
        </p>
        <p className="bj-game-over__summary-line">{presentation.resultLine}</p>
        <p className="bj-game-over__summary-line bj-game-over__summary-line--meta">
          {presentation.roundsLine}
        </p>
        <p className="bj-game-over__summary-line bj-game-over__round-comment">
          {presentation.roundCommentLine}
        </p>
      </div>

      <blockquote className="bj-game-over__magic8">
        <span className="bj-game-over__magic8-label">Magic 8 Ball</span>
        <p className="bj-game-over__magic8-text">{presentation.magic8Line}</p>
      </blockquote>

      {iouFeedback ? (
        <p
          className={[
            'bj-game-over__feedback',
            `bj-game-over__feedback--${iouFeedback.tone}`,
          ].join(' ')}
          role="status"
        >
          {iouFeedback.message}
        </p>
      ) : null}
      {iouFeedback?.openUrl ? (
        <a
          className="ds-btn ds-btn--secondary bj-game-over__open-link"
          href={iouFeedback.openUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open in IOU Wallet
        </a>
      ) : null}

      <div className="bj-game-over__action-row">
        <label
          className={[
            'bj-game-over__toggle',
            ledgerToggleDisabled ? 'bj-game-over__toggle--disabled' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <input
            type="checkbox"
            checked={addToLedger && !ledgerAlreadyAdded}
            disabled={ledgerToggleDisabled}
            onChange={(e) => setAddToLedger(e.target.checked)}
          />
          <span>{ledgerAlreadyAdded ? 'Added to Ledger' : 'Add to Ledger'}</span>
        </label>
        {onOpenLedger ? (
          <button
            type="button"
            className="bj-game-over__inline-link"
            disabled={busy}
            onClick={onOpenLedger}
          >
            Open Ledger
          </button>
        ) : null}
      </div>

      <div className="bj-game-over__action-row">
        <label
          className={[
            'bj-game-over__toggle',
            iouToggleDisabled ? 'bj-game-over__toggle--disabled' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          title={iouToggleDisabled ? iouDisabledReason : undefined}
        >
          <input
            type="checkbox"
            checked={createIou && canCreateIou}
            disabled={iouToggleDisabled}
            onChange={(e) => {
              const next = e.target.checked;
              setCreateIou(next);
              if (!next) {
                setShowIouMessage(false);
              }
            }}
          />
          <span>Create IOU</span>
        </label>
        <button
          type="button"
          className="bj-game-over__inline-link"
          disabled={iouToggleDisabled || !createIou}
          onClick={() => setShowIouMessage((open) => !open)}
        >
          Add message
        </button>
      </div>

      {showIouMessage && createIou && canCreateIou ? (
        <label className="bj-game-over__iou-message">
          <span className="bj-game-over__section-label">IOU message</span>
          <textarea
            className="bj-game-over__iou-message-input"
            value={iouMessage}
            disabled={busy}
            rows={2}
            maxLength={IOU_HANDOFF_MESSAGE_MAX_LENGTH}
            placeholder="Optional note for the IOU handoff"
            onChange={(e) => setIouMessage(e.target.value.slice(0, IOU_HANDOFF_MESSAGE_MAX_LENGTH))}
          />
        </label>
      ) : null}

      {iouToggleDisabled && iouDisabledReason ? (
        <p className="bj-game-over__iou-hint">{iouDisabledReason}</p>
      ) : null}

      <div className="bj-game-over__actions">
        <button
          type="button"
          className="ds-btn ds-btn--primary"
          disabled={startNewGameDisabled}
          title={startNewGameDisabled ? newGameDisabledReason ?? undefined : undefined}
          onClick={() => void handleStartNewGame()}
        >
          {iouPending ? 'Creating IOU…' : 'Start New Game'}
        </button>
      </div>
    </div>
  );

  if (isInline) {
    return panel;
  }

  return (
    <div
      className="invite-modal-overlay bj-table-panel-overlay bj-game-over-overlay"
      role="presentation"
      onClick={busy ? undefined : onDismiss}
    >
      {panel}
    </div>
  );
}
