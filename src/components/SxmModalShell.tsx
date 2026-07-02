import type { ReactNode } from 'react';
import './SxmModalShell.css';

export interface SxmModalShellProps {
  open: boolean;
  title: string;
  ariaLabel: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  titleId?: string;
}

/** Canonical modal shell — fixed header, single scroll body, sticky footer. */
export function SxmModalShell({
  open,
  title,
  ariaLabel,
  onClose,
  children,
  footer,
  className = '',
  titleId = 'sxm-modal-title',
}: SxmModalShellProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="sxm-modal-shell__backdrop" role="presentation" onClick={onClose}>
      <aside
        className={['sxm-modal-shell__panel', className].filter(Boolean).join(' ')}
        role="dialog"
        aria-label={ariaLabel}
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sxm-modal-shell__header">
          <h2 id={titleId} className="sxm-modal-shell__title">
            {title}
          </h2>
          <button
            type="button"
            className="sxm-modal-shell__close secondary"
            onClick={onClose}
            aria-label={`Close ${title}`}
          >
            ×
          </button>
        </header>
        <div className="sxm-modal-shell__body">{children}</div>
        {footer ? <footer className="sxm-modal-shell__footer">{footer}</footer> : null}
      </aside>
    </div>
  );
}
