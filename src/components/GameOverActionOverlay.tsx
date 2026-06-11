import { useState } from 'react';
import './GameOverActionOverlay.css';

export type GameOverIouFeedback = {
  tone: 'success' | 'info' | 'error';
  message: string;
  openUrl?: string;
};

export interface GameOverActionOverlayProps {
  open: boolean;
  /** Mobile: centered overlay. Desktop: inline in This Table side panel. */
  layout?: 'overlay' | 'inline';
  summaryMessage: string;
  canSaveToLedger: boolean;
  ledgerAlreadyAdded: boolean;
  canCreateIou: boolean;
  iouDisabledReason?: string;
  iouPending?: boolean;
  iouFeedback?: GameOverIouFeedback | null;
  pending?: boolean;
  onConfirm: (options: { saveLedger: boolean; createIou: boolean }) => void;
  onDismiss: () => void;
}

/** Small game-end sheet — ledger + optional IOU handoff; table shows summary text only. */
export function GameOverActionOverlay({
  open,
  layout = 'overlay',
  summaryMessage,
  canSaveToLedger,
  ledgerAlreadyAdded,
  canCreateIou,
  iouDisabledReason,
  iouPending = false,
  iouFeedback = null,
  pending = false,
  onConfirm,
  onDismiss,
}: GameOverActionOverlayProps) {
  const [createIou, setCreateIou] = useState(false);
  const [step, setStep] = useState<'actions' | 'iou-confirm'>('actions');
  const [pendingLedgerChoice, setPendingLedgerChoice] = useState<{
    saveLedger: boolean;
  } | null>(null);

  if (!open) {
    return null;
  }

  const busy = pending || iouPending;
  const iouToggleDisabled = !canCreateIou || busy;
  const ledgerSaveDisabled = !canSaveToLedger || ledgerAlreadyAdded || busy;

  function resetIouStep() {
    setStep('actions');
    setPendingLedgerChoice(null);
  }

  function handlePrimaryAction(saveLedger: boolean) {
    if (createIou && canCreateIou) {
      setPendingLedgerChoice({ saveLedger });
      setStep('iou-confirm');
      return;
    }
    onConfirm({ saveLedger, createIou: false });
  }

  function handleIouConfirmYes() {
    if (!pendingLedgerChoice) {
      return;
    }
    onConfirm({ saveLedger: pendingLedgerChoice.saveLedger, createIou: true });
    resetIouStep();
  }

  const isInline = layout === 'inline';
  const title = isInline ? 'Game Summary' : 'Game Over';

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
            {title}
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

        {step === 'iou-confirm' ? (
          <>
            <p className="bj-game-over__summary">
              Create IOU in IOU Wallet for this wager?
            </p>
            <p className="bj-game-over__iou-hint">
              The counterparty can accept or decline it later in IOU Wallet.
            </p>
            <div className="bj-game-over__actions">
              <button
                type="button"
                className="ds-btn ds-btn--primary"
                disabled={busy}
                onClick={handleIouConfirmYes}
              >
                {iouPending ? 'Creating IOU…' : 'Create IOU'}
              </button>
              <button
                type="button"
                className="ds-btn ds-btn--secondary"
                disabled={busy}
                onClick={resetIouStep}
              >
                Back
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="bj-game-over__summary">{summaryMessage}</p>
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
            <div className="bj-game-over__actions">
              <button
                type="button"
                className="ds-btn ds-btn--primary"
                disabled={ledgerSaveDisabled}
                onClick={() => handlePrimaryAction(true)}
              >
                {ledgerAlreadyAdded ? 'Added to Ledger' : 'Add to Ledger'}
              </button>
              <button
                type="button"
                className="ds-btn ds-btn--secondary"
                disabled={busy}
                onClick={() => handlePrimaryAction(false)}
              >
                Don&apos;t Add
              </button>
            </div>
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
            {iouToggleDisabled && iouDisabledReason ? (
              <p className="bj-game-over__iou-hint">{iouDisabledReason}</p>
            ) : null}
          </>
        )}
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
