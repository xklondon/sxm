import './LeaveTableConfirmDialog.css';

interface DiscardNewTableSetupDialogProps {
  open: boolean;
  onConfirmDiscard: () => void;
  onCancel: () => void;
}

/** Confirms discarding in-progress New Table setup. */
export function DiscardNewTableSetupDialog({
  open,
  onConfirmDiscard,
  onCancel,
}: DiscardNewTableSetupDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="leave-table-dialog-overlay" role="presentation" onClick={onCancel}>
      <div
        className="leave-table-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="discard-new-table-setup-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="discard-new-table-setup-title" className="leave-table-dialog__title">
          Discard new table setup?
        </h2>
        <div className="leave-table-dialog__actions">
          <button type="button" className="ds-btn ds-btn--primary" onClick={onConfirmDiscard}>
            Discard
          </button>
          <button type="button" className="ds-btn ds-btn--secondary" onClick={onCancel}>
            Keep editing
          </button>
        </div>
      </div>
    </div>
  );
}
