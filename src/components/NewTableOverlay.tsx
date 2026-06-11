import type { ReactNode } from 'react';
import './NewTableOverlay.css';

export interface NewTableOverlayProps {
  open: boolean;
  title: string;
  ariaLabel: string;
  onClose: () => void;
  children: ReactNode;
}

/** Shared New Table shell — fixed over page/table; desktop centered, mobile bottom sheet. */
export function NewTableOverlay({
  open,
  title,
  ariaLabel,
  onClose,
  children,
}: NewTableOverlayProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="new-table-overlay" role="presentation" onClick={onClose}>
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
            onClick={onClose}
            aria-label={`Close ${title}`}
          >
            ×
          </button>
        </header>
        <div className="new-table-overlay__body">{children}</div>
      </aside>
    </div>
  );
}
