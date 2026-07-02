import { useEffect, useState, type ReactNode } from 'react';
import { DiscardNewTableSetupDialog } from './DiscardNewTableSetupDialog';
import { SxmModalShell } from './SxmModalShell';
import './NewTableOverlay.css';

export interface NewTableOverlayProps {
  open: boolean;
  title: string;
  ariaLabel: string;
  onClose: () => void;
  confirmDiscardWhenDirty?: boolean;
  children: ReactNode;
}

/** Open New Table — canonical SxmModalShell. */
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
      <SxmModalShell
        open={open}
        title={title}
        ariaLabel={ariaLabel}
        onClose={requestClose}
        titleId="new-table-overlay-title"
        className="new-table-overlay__panel sxm-modal-shell__panel--new-table"
      >
        {children}
      </SxmModalShell>
      <DiscardNewTableSetupDialog
        open={discardConfirmOpen}
        onConfirmDiscard={confirmDiscard}
        onCancel={() => setDiscardConfirmOpen(false)}
      />
    </>
  );
}
