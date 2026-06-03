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
