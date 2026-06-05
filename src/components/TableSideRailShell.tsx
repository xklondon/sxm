import type { ReactNode } from 'react';

export interface TableSideRailShellProps {
  title: string;
  onClose?: () => void;
  children: ReactNode;
}

/** Shared frame for This Table and Table Details side-rail panels. */
export function TableSideRailShell({ title, onClose, children }: TableSideRailShellProps) {
  return (
    <div className="bj-side-rail-shell">
      <header className="bj-side-rail-shell__header">
        <h3 className="bj-side-rail-shell__title">{title}</h3>
        {onClose ? (
          <button
            type="button"
            className="bj-side-rail-shell__close ds-btn ds-btn--icon"
            onClick={onClose}
            aria-label={`Close ${title}`}
          >
            ×
          </button>
        ) : null}
      </header>
      <div className="bj-side-rail-shell__body">{children}</div>
    </div>
  );
}
