import { useState } from 'react';
import './GameOverActionOverlay.css';

export interface GameOverActionOverlayProps {
  open: boolean;
  summaryMessage: string;
  canSaveToLedger: boolean;
  ledgerAlreadyAdded: boolean;
  canCreateIou: boolean;
  iouDisabledReason?: string;
  pending?: boolean;
  onConfirm: (options: { saveLedger: boolean; createIou: boolean }) => void;
  onDismiss: () => void;
}

/** Small game-end sheet — ledger + optional IOU handoff; table shows summary text only. */
export function GameOverActionOverlay({
  open,
  summaryMessage,
  canSaveToLedger,
  ledgerAlreadyAdded,
  canCreateIou,
  iouDisabledReason,
  pending = false,
  onConfirm,
  onDismiss,
}: GameOverActionOverlayProps) {
  const [createIou, setCreateIou] = useState(false);

  if (!open) {
    return null;
  }

  const iouToggleDisabled = !canCreateIou || pending;
  const ledgerSaveDisabled = !canSaveToLedger || ledgerAlreadyAdded || pending;

  return (
    <div
      className="invite-modal-overlay bj-table-panel-overlay bj-game-over-overlay"
      role="presentation"
      onClick={onDismiss}
    >
      <div
        className="invite-modal invite-modal--ledger invite-modal--table-panel bj-game-over"
        role="dialog"
        aria-labelledby="bj-game-over-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="bj-game-over__header">
          <h2 id="bj-game-over-title" className="bj-game-over__title">
            Game Over
          </h2>
          <button
            type="button"
            className="bj-game-over__close ds-btn ds-btn--icon"
            aria-label="Close without saving"
            disabled={pending}
            onClick={onDismiss}
          >
            ×
          </button>
        </header>
        <p className="bj-game-over__summary">{summaryMessage}</p>
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
        <div className="bj-game-over__actions">
          <button
            type="button"
            className="ds-btn ds-btn--primary"
            disabled={ledgerSaveDisabled}
            onClick={() => onConfirm({ saveLedger: true, createIou: createIou && canCreateIou })}
          >
            {ledgerAlreadyAdded ? 'Added to Ledger' : 'Add to Ledger'}
          </button>
          <button
            type="button"
            className="ds-btn ds-btn--secondary"
            disabled={pending}
            onClick={() => onConfirm({ saveLedger: false, createIou: createIou && canCreateIou })}
          >
            Don&apos;t Add
          </button>
        </div>
      </div>
    </div>
  );
}
