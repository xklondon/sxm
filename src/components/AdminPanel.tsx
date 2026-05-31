import type { GameState } from '../types';
import { updateTableAdminSettings } from '../engine/table/adminControls';
import { isTableOwner } from '../engine/session';
import { loadProfile } from '../storage/profileStorage';
import { saveSettings, settingsFromGameState } from '../storage/settingsStorage';
import './AdminPanel.css';

interface AdminPanelProps {
  gameState: GameState;
  open: boolean;
  onClose: () => void;
  onUpdate: (state: GameState) => void;
}

export function AdminPanel({ gameState, open, onClose, onUpdate }: AdminPanelProps) {
  const profile = loadProfile();
  const controller = profile.name.trim() || gameState.tableMeta.controllerName;
  const owner = isTableOwner(gameState, controller);
  const admin = gameState.tableAdminSettings;

  if (!open) {
    return null;
  }

  if (!owner) {
    return (
      <div className="admin-panel-overlay" role="dialog" aria-label="Table controls">
        <div className="admin-panel">
          <h2>Table controls</h2>
          <p>Only the table owner can change admin settings.</p>
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  function patch(partial: Parameters<typeof updateTableAdminSettings>[1]) {
    const next = updateTableAdminSettings(gameState, partial);
    onUpdate(next);
    saveSettings(settingsFromGameState(next));
  }

  return (
    <div className="admin-panel-overlay" role="dialog" aria-label="Table controls">
      <div className="admin-panel">
        <header className="admin-panel__header">
          <h2>Admin / Table Controls</h2>
          <button type="button" className="admin-panel__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <p className="admin-panel__sub">Local permission toggles — enforced in UI only.</p>

        <label className="admin-panel__row">
          <span>Invited players can invite others</span>
          <input
            type="checkbox"
            checked={admin.allowInvitedPlayersToInvite}
            onChange={(e) => patch({ allowInvitedPlayersToInvite: e.target.checked })}
          />
        </label>

        <label className="admin-panel__row">
          <span>Invited players can start tables</span>
          <input
            type="checkbox"
            checked={admin.allowInvitedPlayersToStartTables}
            onChange={(e) => patch({ allowInvitedPlayersToStartTables: e.target.checked })}
          />
        </label>

        <label className="admin-panel__row">
          <span>Owner only — assign chips</span>
          <input
            type="checkbox"
            checked={admin.ownerOnlyCanAssignChips}
            onChange={(e) => patch({ ownerOnlyCanAssignChips: e.target.checked })}
          />
        </label>

        <label className="admin-panel__row">
          <span>Owner only — change protocol</span>
          <input
            type="checkbox"
            checked={admin.ownerOnlyCanChangeProtocol}
            onChange={(e) => patch({ ownerOnlyCanChangeProtocol: e.target.checked })}
          />
        </label>

        <label className="admin-panel__row">
          <span>Owner only — change design</span>
          <input
            type="checkbox"
            checked={admin.ownerOnlyCanChangeDesign}
            onChange={(e) => patch({ ownerOnlyCanChangeDesign: e.target.checked })}
          />
        </label>

        {gameState.tableMeta.protocolLocked && (
          <p className="admin-panel__note">Protocol is locked for this round.</p>
        )}
      </div>
    </div>
  );
}
