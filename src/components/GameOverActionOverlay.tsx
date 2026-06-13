import { useState } from 'react';
import type { GameOverPresentationModel } from './gameOverPresentation';
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
  onComplete: (options: GameOverCompleteOptions) => void | Promise<void>;
  onDismiss: () => void;
}

/** Game-end sheet — summary, ledger choice, optional IOU, New Game. */
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
  onComplete,
  onDismiss,
}: GameOverActionOverlayProps) {
  const [ledgerChoice, setLedgerChoice] = useState<'add' | 'skip'>('skip');
  const [createIou, setCreateIou] = useState(false);
  const [iouMessage, setIouMessage] = useState('');

  if (!open) {
    return null;
  }

  const busy = pending || iouPending;
  const iouToggleDisabled = !canCreateIou || busy;
  const ledgerAddDisabled = !canSaveToLedger || ledgerAlreadyAdded || busy;
  const newGameDisabled = !canStartNewGame || busy;

  async function handleNewGame() {
    if (newGameDisabled) {
      return;
    }
    const saveLedger = ledgerChoice === 'add' && !ledgerAlreadyAdded && canSaveToLedger;
    const trimmedMessage = iouMessage.trim();
    await onComplete({
      saveLedger,
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

      <fieldset className="bj-game-over__ledger-choice" disabled={busy}>
        <legend className="bj-game-over__section-label">Personal ledger</legend>
        <label className="bj-game-over__ledger-option">
          <input
            type="radio"
            name="bj-game-over-ledger"
            checked={ledgerChoice === 'add'}
            disabled={ledgerAddDisabled}
            onChange={() => setLedgerChoice('add')}
          />
          <span>{ledgerAlreadyAdded ? 'Added to Ledger' : 'Add to Ledger'}</span>
        </label>
        <label className="bj-game-over__ledger-option">
          <input
            type="radio"
            name="bj-game-over-ledger"
            checked={ledgerChoice === 'skip'}
            disabled={busy}
            onChange={() => setLedgerChoice('skip')}
          />
          <span>Don&apos;t Add</span>
        </label>
      </fieldset>

      <div className="bj-game-over__iou-row">
        <label
          className={[
            'bj-game-over__iou-toggle',
            iouToggleDisabled ? 'bj-game-over__iou-toggle--disabled' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          title={iouToggleDisabled ? iouDisabledReason : undefined}
        >
          <input
            type="checkbox"
            checked={createIou && canCreateIou}
            disabled={iouToggleDisabled}
            onChange={(e) => setCreateIou(e.target.checked)}
          />
          <span>Create IOU</span>
        </label>
      </div>

      <label className="bj-game-over__iou-message">
        <span className="bj-game-over__section-label">Add message to IOU</span>
        <textarea
          className="bj-game-over__iou-message-input"
          value={iouMessage}
          disabled={iouToggleDisabled || !createIou}
          rows={2}
          placeholder="Optional note for the IOU handoff"
          onChange={(e) => setIouMessage(e.target.value)}
        />
      </label>

      {iouToggleDisabled && iouDisabledReason ? (
        <p className="bj-game-over__iou-hint">{iouDisabledReason}</p>
      ) : null}

      <div className="bj-game-over__actions">
        <button
          type="button"
          className="ds-btn ds-btn--primary"
          disabled={newGameDisabled}
          title={newGameDisabled ? newGameDisabledReason ?? undefined : undefined}
          onClick={() => void handleNewGame()}
        >
          {iouPending ? 'Creating IOU…' : 'New Game'}
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
