import type { GameState } from '../types';
import type { ScoreLedgerEntry } from '../types/scoreLedger';
import { loadScoreLedgerEntries } from '../storage/scoreLedgerStorage';
import { LedgerPanel } from './LedgerPanel';
import './InviteModal.css';

interface PlayLedgerModalProps {
  gameState: GameState;
  open: boolean;
  onClose: () => void;
}

export function PlayLedgerModal({ gameState, open, onClose }: PlayLedgerModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="invite-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="invite-modal invite-modal--ledger"
        role="dialog"
        aria-labelledby="play-ledger-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="invite-modal__header">
          <h2 id="play-ledger-title" className="invite-modal__title">Play Ledger</h2>
          <button type="button" className="invite-modal__close secondary" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="invite-modal__sub">
          Chip and table action history for this game — bets, wins, losses, and adjustments.
        </p>
        <LedgerPanel gameState={gameState} variant="play" />
      </div>
    </div>
  );
}

interface ScoreLedgerModalProps {
  open: boolean;
  onClose: () => void;
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

export function ScoreLedgerModal({ open, onClose }: ScoreLedgerModalProps) {
  const entries = open ? loadScoreLedgerEntries() : [];

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
