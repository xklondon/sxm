import { useState } from 'react';
import {
  buildProfile,
  loadProfile,
  saveProfile,
  PLAY_FLOW_OPTIONS,
  type LocalProfile,
  type PlayFlowAutoStand,
} from '../storage/profileStorage';
import './LocalProfileSetup.css';

interface LocalProfileSetupProps {
  open: boolean;
  required?: boolean;
  onClose: () => void;
  onSaved?: (profile: LocalProfile) => void;
  /** When set, email is prefilled and read-only (online invite / auth session). */
  lockedEmail?: string | null;
  inviteTableName?: string | null;
}

export function LocalProfileSetup({
  open,
  required = false,
  onClose,
  onSaved,
  lockedEmail = null,
  inviteTableName = null,
}: LocalProfileSetupProps) {
  const existing = loadProfile();
  const [name, setName] = useState(existing.name);
  const [email, setEmail] = useState(lockedEmail ?? existing.email);
  const [playFlow, setPlayFlow] = useState<PlayFlowAutoStand>(existing.playFlow ?? 'manual');

  if (!open) {
    return null;
  }

  const emailLocked = Boolean(lockedEmail?.trim());

  function handleSave() {
    const profile = buildProfile(name, emailLocked ? lockedEmail! : email, playFlow);
    if (required && !profile.name.trim()) {
      return;
    }
    saveProfile(profile);
    onSaved?.(profile);
    onClose();
  }

  const preview = buildProfile(name, emailLocked ? lockedEmail! : email, playFlow);

  return (
    <div className="local-profile" role="dialog" aria-label="Local profile">
      <div className="local-profile__panel">
        <header className="local-profile__header">
          <h3>Your profile</h3>
          {!required && (
            <button type="button" className="local-profile__close" onClick={onClose} aria-label="Close">
              ×
            </button>
          )}
        </header>
        <p className="local-profile__note">
          {inviteTableName
            ? `Set your display name and play flow to join ${inviteTableName}.`
            : required
              ? emailLocked
                ? 'Choose a display name and play flow for this table.'
                : 'Enter your name and email to play at this table. Stored locally only.'
              : 'Local only — used for initials at the table.'}
        </p>
        <label className="local-profile__field">
          Display name
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </label>
        <label className="local-profile__field">
          Email
          <input
            type="email"
            value={emailLocked ? lockedEmail! : email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            readOnly={emailLocked}
            disabled={emailLocked}
            aria-readonly={emailLocked}
          />
        </label>
        <label className="local-profile__field">
          Play Flow
          <select value={playFlow} onChange={(e) => setPlayFlow(e.target.value as PlayFlowAutoStand)}>
            {PLAY_FLOW_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <p className="local-profile__initials">
          Initials: <strong>{preview.initials}</strong>
        </p>
        <button type="button" onClick={handleSave} disabled={required && !name.trim()}>
          Save profile
        </button>
      </div>
    </div>
  );
}
