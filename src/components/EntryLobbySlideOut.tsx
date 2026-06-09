import type { ReactNode } from 'react';
import './EntryLobbySlideOut.css';

interface EntryLobbySlideOutProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** Reusable lobby drawer — right panel on desktop, bottom sheet on mobile. */
export function EntryLobbySlideOut({
  open,
  title,
  onClose,
  children,
  footer,
}: EntryLobbySlideOutProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="entry-lobby-slide-overlay" role="presentation" onClick={onClose}>
      <aside
        className="entry-lobby-slide-drawer"
        role="dialog"
        aria-labelledby="entry-lobby-slide-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="entry-lobby-slide-drawer__header">
          <h2 id="entry-lobby-slide-title" className="entry-lobby-slide-drawer__title">
            {title}
          </h2>
          <button
            type="button"
            className="entry-lobby-slide-drawer__close secondary"
            onClick={onClose}
            aria-label={`Close ${title}`}
          >
            ×
          </button>
        </div>
        <div className="entry-lobby-slide-drawer__body">{children}</div>
        {footer ? <div className="entry-lobby-slide-drawer__footer">{footer}</div> : null}
      </aside>
    </div>
  );
}
