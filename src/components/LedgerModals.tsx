import type { ReactNode } from 'react';
import type { GameState } from '../types';
import type { ScoreLedgerEntry } from '../types/scoreLedger';
import { loadScoreLedgerDisplayEntries } from '../storage/scoreLedgerStorage';
import { LedgerPanel } from './LedgerPanel';
import './InviteModal.css';

interface PlayLedgerPanelProps {
  gameState: GameState;
}

export function PlayLedgerPanel({ gameState }: PlayLedgerPanelProps) {
  return (
    <div className="bj-table-slide-panel__content">
      <h3 className="bj-table-slide-panel__title">Play Ledger</h3>
      <p className="bj-table-slide-panel__sub">
        Chip and table action history for this game — bets, wins, losses, and adjustments.
      </p>
      <LedgerPanel gameState={gameState} variant="play" />
    </div>
  );
}

interface ThisTableSlidePanelProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Right-side slide drawer for bank/players — keeps the felt dealer zone centred. */
export function ThisTableSlidePanel({ open, onClose, children }: ThisTableSlidePanelProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="bj-table-slide-overlay" role="presentation" onClick={onClose}>
      <aside
        className="bj-table-slide-drawer"
        role="dialog"
        aria-labelledby="this-table-slide-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bj-table-slide-drawer__header">
          <h2 id="this-table-slide-title" className="bj-table-slide-drawer__title">
            This Table
          </h2>
          <button
            type="button"
            className="bj-table-slide-drawer__close secondary"
            onClick={onClose}
            aria-label="Close This Table panel"
          >
            ×
          </button>
        </div>
        <div className="bj-table-slide-drawer__body">{children}</div>
      </aside>
    </div>
  );
}

interface TableDetailsSlidePanelProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Slide-out for wager/shoe/protocol — separate from This Table bank/players nav. */
export function TableDetailsSlidePanel({ open, onClose, children }: TableDetailsSlidePanelProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="bj-table-slide-overlay bj-table-slide-overlay--details"
      role="presentation"
      onClick={onClose}
    >
      <aside
        className="bj-table-slide-drawer bj-table-slide-drawer--details"
        role="dialog"
        aria-labelledby="table-details-slide-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bj-table-slide-drawer__header">
          <h2 id="table-details-slide-title" className="bj-table-slide-drawer__title">
            Table details
          </h2>
          <button
            type="button"
            className="bj-table-slide-drawer__close secondary"
            onClick={onClose}
            aria-label="Close table details"
          >
            ×
          </button>
        </div>
        <div className="bj-table-slide-drawer__body">{children}</div>
      </aside>
    </div>
  );
}

interface TablePanelOverlayProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

export function TablePanelOverlay({
  open,
  title,
  subtitle,
  onClose,
  children,
  wide = true,
}: TablePanelOverlayProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="invite-modal-overlay bj-table-panel-overlay" role="presentation" onClick={onClose}>
      <div
        className={`invite-modal invite-modal--ledger${wide ? ' invite-modal--table-panel' : ''}`}
        role="dialog"
        aria-labelledby="table-panel-overlay-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="invite-modal__header">
          <h2 id="table-panel-overlay-title" className="invite-modal__title">
            {title}
          </h2>
          <button type="button" className="invite-modal__close secondary" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {subtitle && <p className="invite-modal__sub">{subtitle}</p>}
        <div className="bj-table-panel-overlay__body">{children}</div>
        <button type="button" className="secondary bj-table-panel-overlay__close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

interface PlayLedgerModalProps {
  open: boolean;
  onClose: () => void;
  gameState: GameState;
}

export function PlayLedgerModal({ open, onClose, gameState }: PlayLedgerModalProps) {
  return (
    <TablePanelOverlay
      open={open}
      title="Play Ledger"
      subtitle="Chip and table action history for this game — bets, wins, losses, and adjustments."
      onClose={onClose}
    >
      <LedgerPanel gameState={gameState} variant="play" />
    </TablePanelOverlay>
  );
}

interface ScoreLedgerModalProps {
  open: boolean;
  onClose: () => void;
  activeTableId?: string | null;
  gameStatus?: GameState['tableMeta']['gameStatus'];
}

function statusLabel(status: ScoreLedgerEntry['status']): string {
  switch (status) {
    case 'open':
      return 'Open';
    case 'settled':
      return 'Settled';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

export function ScoreLedgerModal({ open, onClose, activeTableId, gameStatus }: ScoreLedgerModalProps) {
  const entries = open
    ? loadScoreLedgerDisplayEntries({ activeTableId, gameStatus })
    : [];

  if (!open) {
    return null;
  }

  return (
    <div className="invite-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="invite-modal invite-modal--ledger"
        role="dialog"
        aria-labelledby="score-ledger-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="invite-modal__header">
          <h2 id="score-ledger-title" className="invite-modal__title">Score Ledger</h2>
          <button type="button" className="invite-modal__close secondary" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="invite-modal__sub">
          Wager-level outcomes — who owes whom between friends. Not every hand or chip action.
        </p>
        {entries.length === 0 ? (
          <p className="invite-modal__placeholder">No score entries yet — recorded when a table game ends.</p>
        ) : (
          <ul className="score-ledger-list">
            {entries.map((entry) => (
              <li key={entry.id} className="score-ledger-list__item">
                <p className="score-ledger-list__owed">{entry.owedDescription}</p>
                <p className="score-ledger-list__meta">
                  {entry.winnerName} won · {statusLabel(entry.status)} · {new Date(entry.createdAt).toLocaleString()}
                </p>
                <p className="score-ledger-list__wager">Played for: {entry.wagerDescription}</p>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="secondary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
