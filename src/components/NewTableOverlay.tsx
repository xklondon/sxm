import { useEffect, useState, type ReactNode } from 'react';
import { DiscardNewTableSetupDialog } from './DiscardNewTableSetupDialog';
import './NewTableOverlay.css';

export interface NewTableOverlayProps {
  open: boolean;
  title: string;
  ariaLabel: string;
  onClose: () => void;
  /** When true, backdrop/X close asks before discarding in-progress setup. */
  confirmDiscardWhenDirty?: boolean;
  children: ReactNode;
}

/** Shared New Table shell — fixed over page/table; desktop centered, mobile bottom sheet. */
export function NewTableOverlay({
  open,
  title,
  ariaLabel,
  onClose,
  confirmDiscardWhenDirty = false,
  children,
}: NewTableOverlayProps) {
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setDiscardConfirmOpen(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  function requestClose() {
    if (confirmDiscardWhenDirty) {
      setDiscardConfirmOpen(true);
      return;
    }
    onClose();
  }

  function confirmDiscard() {
    setDiscardConfirmOpen(false);
    onClose();
  }

  return (
    <>
      <div className="new-table-overlay" role="presentation" onClick={requestClose}>
        <aside
          className="new-table-overlay__panel"
          role="dialog"
          aria-label={ariaLabel}
          aria-labelledby="new-table-overlay-title"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="new-table-overlay__header">
            <h2 id="new-table-overlay-title" className="new-table-overlay__title">
              {title}
            </h2>
            <button
              type="button"
              className="new-table-overlay__close secondary"
              onClick={requestClose}
              aria-label={`Close ${title}`}
            >
              ×
            </button>
          </header>
          <div className="new-table-overlay__body">{children}</div>
        </aside>
      </div>
      <DiscardNewTableSetupDialog
        open={discardConfirmOpen}
        onConfirmDiscard={confirmDiscard}
        onCancel={() => setDiscardConfirmOpen(false)}
      />
    </>
  );
}
