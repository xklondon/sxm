import './LeaveTableConfirmDialog.css';

interface LeaveTableConfirmDialogProps {
  open: boolean;
  onSaveAndLeave: () => void;
  onLeaveWithoutSaving: () => void;
  onCancel: () => void;
}

/** Confirms whether to persist the current table before exiting to lobby/start. */
export function LeaveTableConfirmDialog({
  open,
  onSaveAndLeave,
  onLeaveWithoutSaving,
  onCancel,
}: LeaveTableConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="leave-table-dialog-overlay"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="leave-table-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-table-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="leave-table-dialog-title" className="leave-table-dialog__title">
          Save this table before leaving?
        </h2>
        <div className="leave-table-dialog__actions">
          <button type="button" className="ds-btn ds-btn--primary" onClick={onSaveAndLeave}>
            Save and leave
          </button>
          <button type="button" className="ds-btn ds-btn--secondary" onClick={onLeaveWithoutSaving}>
            Leave without saving
          </button>
          <button type="button" className="ds-btn ds-btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
