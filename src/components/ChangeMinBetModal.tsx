import { useEffect, useState } from 'react';
import type { GameState } from '../types';
import {
  canChangeMinimumBet,
  getTableMinimumBet,
  setTableMinimumBet,
} from '../engine/blackjack';
import { isTableOwner } from '../engine/session';
import { loadProfile } from '../storage/profileStorage';
import './InviteModal.css';

interface ChangeMinBetModalProps {
  gameState: GameState;
  open: boolean;
  onClose: () => void;
  onSave: (state: GameState) => void;
}

export function ChangeMinBetModal({ gameState, open, onClose, onSave }: ChangeMinBetModalProps) {
  const profile = loadProfile();
  const controller = profile.name.trim() || gameState.tableMeta.controllerName;
  const ownerOk = isTableOwner(gameState, controller);
  const currentMin = getTableMinimumBet(gameState);
  const canEdit = ownerOk && canChangeMinimumBet(gameState);

  const [amount, setAmount] = useState(String(currentMin));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount(String(currentMin));
      setError(null);
    }
  }, [open, currentMin]);

  if (!open) {
    return null;
  }

  function handleSave() {
    setError(null);
    const value = Number.parseInt(amount, 10);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a positive whole number.');
      return;
    }
    if (value !== Math.floor(value)) {
      setError('Minimum bet must be a whole number.');
      return;
    }
    try {
      onSave(setTableMinimumBet(gameState, value));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update minimum bet');
    }
  }

  return (
    <div className="invite-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="invite-modal"
        role="dialog"
        aria-labelledby="change-min-bet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="invite-modal__header">
          <h2 id="change-min-bet-title" className="invite-modal__title">Change minimum bet</h2>
          <button type="button" className="invite-modal__close secondary" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="invite-modal__sub">
          Applies to the next deal eligibility. Can only be changed during the betting phase.
        </p>

        {!ownerOk && (
          <p className="invite-modal__error">
            Only the table owner ({gameState.tableMeta.owner?.ownerName ?? 'unset'}) can change minimum bet.
          </p>
        )}

        {!canChangeMinimumBet(gameState) && ownerOk && (
          <p className="invite-modal__error">
            Minimum bet cannot be changed after dealing has started.
          </p>
        )}

        <label className="invite-modal__field">
          New minimum bet
          <input
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!canEdit}
          />
        </label>

        {error && <p className="invite-modal__error">{error}</p>}

        <div className="invite-modal__actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="button" onClick={handleSave} disabled={!canEdit}>Save</button>
        </div>
      </div>
    </div>
  );
}
