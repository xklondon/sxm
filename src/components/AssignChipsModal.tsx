import { useEffect, useState } from 'react';
import type { GameState } from '../types';
import {
  ALL_BOXES_RECIPIENT,
  assignChips,
  getStartingChipsEachSeat,
  listPersonBankrollOwnerIds,
  type ChipAssignReason,
} from '../engine/session';
import { canUserAssignChips } from '../engine/table/adminControls';
import { deriveAllBalancesFromLedger } from '../engine/ledger';
import { loadProfile } from '../storage/profileStorage';
import { isOnlineModeEnabled } from '../api/config';
import './InviteModal.css';

interface AssignChipsModalProps {
  gameState: GameState;
  open: boolean;
  onClose: () => void;
  onAssign: (state: GameState) => void;
  onAssignOnline?: (params: {
    recipientId: string;
    amount: number;
    reason: ChipAssignReason;
  }) => Promise<unknown>;
}

const REASON_OPTIONS: { value: ChipAssignReason; label: string }[] = [
  { value: 'starting-allocation', label: 'Starting allocation' },
  { value: 'top-up', label: 'Top-up' },
  { value: 'adjustment', label: 'Adjustment' },
];

export function AssignChipsModal({
  gameState,
  open,
  onClose,
  onAssign,
  onAssignOnline,
}: AssignChipsModalProps) {
  const { session, players } = gameState;
  const profile = loadProfile();
  const controller = profile.name.trim() || gameState.tableMeta.controllerName;
  const ownerOk = canUserAssignChips(gameState, controller);
  const defaultAmount = getStartingChipsEachSeat(gameState);

  const balances = deriveAllBalancesFromLedger(session, gameState.ledger);
  const bankId = session.bankPlayerId;

  const [recipientId, setRecipientId] = useState(bankId ?? session.playerIds[0] ?? '');
  const [amount, setAmount] = useState(String(defaultAmount));
  const [reason, setReason] = useState<ChipAssignReason>('top-up');
  const [error, setError] = useState<string | null>(null);

  const personIds = listPersonBankrollOwnerIds(gameState);

  useEffect(() => {
    if (open) {
      setAmount(String(defaultAmount));
      setRecipientId(bankId ?? personIds[0] ?? '');
      setReason('top-up');
      setError(null);
    }
  }, [open, defaultAmount, bankId, personIds]);

  if (!open) {
    return null;
  }

  function handleAssign() {
    setError(null);
    const chips = Number.parseInt(amount, 10);
    if (!recipientId) {
      setError('Select a recipient.');
      return;
    }
    if (!Number.isFinite(chips) || chips <= 0) {
      setError('Enter a positive chip amount.');
      return;
    }
    try {
      if (onAssignOnline && isOnlineModeEnabled()) {
        void onAssignOnline({ recipientId, amount: chips, reason })
          .then(() => onClose())
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : 'Could not assign chips');
          });
        return;
      }
      onAssign(assignChips(gameState, recipientId, chips, reason));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign chips');
    }
  }

  return (
    <div className="invite-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="invite-modal"
        role="dialog"
        aria-labelledby="assign-chips-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="invite-modal__header">
          <h2 id="assign-chips-title" className="invite-modal__title">Assign chips</h2>
          <button type="button" className="invite-modal__close secondary" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="invite-modal__sub">
          Local honor-system chip assignment — every entry is recorded in the Play Ledger. No real-money processing.
        </p>

        {!ownerOk && (
          <p className="invite-modal__error">
            Only the table owner ({gameState.tableMeta.owner?.ownerName ?? 'unset'}) can assign chips.
          </p>
        )}

        <label className="invite-modal__field">
          Recipient
          <select
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
            disabled={!ownerOk}
          >
            {bankId && (
              <option value={bankId}>
                Bank — {players[bankId]?.displayName ?? 'Bank'} ({balances[bankId] ?? 0}c)
              </option>
            )}
            {personIds.map((id) => (
              <option key={id} value={id}>
                {players[id]?.controllerName ?? players[id]?.displayName ?? id.slice(0, 6)}
                {' '}({balances[id] ?? 0}c)
              </option>
            ))}
            <option value={ALL_BOXES_RECIPIENT}>All persons</option>
          </select>
        </label>

        <label className="invite-modal__field">
          Chips to assign
          <input
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!ownerOk}
          />
        </label>

        <label className="invite-modal__field">
          Reason
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as ChipAssignReason)}
            disabled={!ownerOk}
          >
            {REASON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        {error && <p className="invite-modal__error">{error}</p>}

        <div className="invite-modal__actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="button" onClick={handleAssign} disabled={!ownerOk}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use AssignChipsModal */
export const AssignTokensModal = AssignChipsModal;
