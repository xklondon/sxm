import { useState } from 'react';
import type { GameState } from '../types';
import type { LedgerEntry } from '../types/ledger';
import { blackjackHandKey } from '../engine/blackjack';
import { boxLabelForPlayer } from '../engine/session';
import './LedgerPanel.css';
import './InviteModal.css';

interface LedgerPanelProps {
  gameState: GameState;
  onRecordOutcome?: () => void;
  variant?: 'play' | 'default';
  title?: string;
}

function friendlyAction(entryType: LedgerEntry['entryType'], description: string): string {
  const map: Partial<Record<LedgerEntry['entryType'], string>> = {
    'buy-in': 'Buy-in',
    'bet-placed': 'Bet placed',
    'bet-increased': 'Double / raise',
    'call-placed': 'Call',
    'blind-posted': 'Blind',
    'fold-recorded': 'Fold',
    'pot-paid': 'Pot won',
    'win-paid': 'Win paid',
    'push-refund': 'Push refund',
    'loss-collected': 'Loss',
    'bank-transfer': 'Bank',
    'manual-adjustment': 'Adjustment',
    'table-outcome-recorded': 'Table outcome',
  };
  return map[entryType] ?? description.split('—')[0]?.trim() ?? entryType.replace(/-/g, ' ');
}

function formatAmount(amount: number): string {
  if (amount === 0) {
    return '—';
  }
  const sign = amount > 0 ? '+' : '';
  return `${sign}${amount}`;
}

function entryPersonLabel(state: GameState, entry: LedgerEntry): string {
  const person = state.players[entry.playerId];
  return person?.controllerName || person?.displayName || entry.playerId.slice(0, 6);
}

function entryBoxLabel(state: GameState, entry: LedgerEntry): string {
  if (entry.boxSlotNumber) {
    return `Box ${entry.boxSlotNumber}`;
  }
  if (entry.boxPlayerId) {
    return boxLabelForPlayer(state, entry.boxPlayerId);
  }
  return '—';
}

export function LedgerPanel({ gameState, onRecordOutcome, variant = 'default', title }: LedgerPanelProps) {
  const { ledger, players, tableMeta, blackjack: round } = gameState;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const entries = [...ledger.entries].reverse();

  const occupiedSlots = tableMeta.boxSlots
    .filter((s) => s.playerId)
    .sort((a, b) => a.slotNumber - b.slotNumber);

  const panelTitle =
    title ?? (variant === 'play' ? 'Play Ledger' : 'Table Ledger');

  return (
    <section className={`ledger-panel${variant === 'play' ? ' ledger-panel--modal' : ''}`} aria-label={panelTitle}>
      {variant === 'default' && <h2 className="ledger-panel__title">{panelTitle}</h2>}

      {tableMeta.owner && (
        <p className="table-owner">
          Owner: {tableMeta.owner.ownerName}
        </p>
      )}

      {tableMeta.agreement && (
        <p className="ledger-panel__stake">
          Wager: <strong>{tableMeta.agreement.stakeDescription}</strong>
        </p>
      )}

      {occupiedSlots.length > 0 && (
        <div className="ledger-panel__boxes">
          <h3 className="ledger-panel__boxes-title">Boxes</h3>
          <ul className="ledger-panel__box-list">
            {occupiedSlots.map((slot) => {
              const pid = slot.playerId!;
              const owner = players[pid]?.controllerName ?? '—';
              const bet =
                round?.playerHands[blackjackHandKey(pid, 0)]?.currentBet ?? 0;
              const result = round?.resultMessages[blackjackHandKey(pid, 0)];
              const passive =
                slot.passiveNames.length > 0
                  ? ` + ${slot.passiveNames.join(', ')} passive`
                  : '';
              return (
                <li key={slot.slotNumber} className="ledger-panel__box-row">
                  <span className="ledger-panel__box-name">
                    {boxLabelForPlayer(gameState, pid)} — {owner}
                    {passive}
                  </span>
                  <span className="ledger-panel__box-bet">
                    {bet > 0 ? `bet ${bet}` : '—'}
                    {result ? ` · ${result.split('—')[0]?.trim() ?? result}` : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {tableMeta.invites.length > 0 && (
        <div className="invite-list">
          <h3 className="invite-list__title">Invited</h3>
          <ul className="ledger-panel__box-list">
            {tableMeta.invites.map((inv) => (
              <li key={inv.inviteId} className="invite-list__item">
                {inv.invitedName} · {inv.invitedEmail}
                <span className="invite-list__status"> ({inv.inviteStatus})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tableMeta.outcome && (
        <div className="ledger-panel__outcome">
          <p className="ledger-panel__outcome-title">Agreed outcome</p>
          <p className="ledger-panel__outcome-body">
            {tableMeta.outcome.winnerId && players[tableMeta.outcome.winnerId]?.displayName} ·{' '}
            {tableMeta.outcome.stakeDescription}
          </p>
          <p className="ledger-panel__outcome-note">{tableMeta.outcome.note}</p>
        </div>
      )}

      {entries.length === 0 ? (
        <p className="ledger-panel__empty">No entries yet.</p>
      ) : (
        <div className="ledger-panel__scroll">
          <table className="ledger-panel__table">
            <thead>
              <tr>
                <th>Rnd</th>
                <th>Person</th>
                <th>Box</th>
                <th>Action</th>
                <th>Amt</th>
                <th>Bal</th>
                {showAdvanced && <th>Time</th>}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.roundNumber || '—'}</td>
                  <td>{entryPersonLabel(gameState, entry)}</td>
                  <td>{entryBoxLabel(gameState, entry)}</td>
                  <td title={entry.description}>{friendlyAction(entry.entryType, entry.description)}</td>
                  <td className={entry.amount >= 0 ? 'ledger-panel__positive' : 'ledger-panel__negative'}>
                    {formatAmount(entry.amount)}
                  </td>
                  <td>{entry.balanceAfter}</td>
                  {showAdvanced && (
                    <td>{new Date(entry.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button type="button" className="ledger-panel__toggle secondary" onClick={() => setShowAdvanced((v) => !v)}>
        {showAdvanced ? 'Hide details' : 'Advanced details'}
      </button>

      <p className="ledger-panel__close-note">
        Personal ledger carry-over — coming later
      </p>

      {tableMeta.status === 'open' && onRecordOutcome && (
        <button type="button" className="ledger-panel__outcome-btn secondary" onClick={onRecordOutcome}>
          Record agreed outcome
        </button>
      )}
    </section>
  );
}
