import { useState } from 'react';
import type { GameState } from '../types';
import {
  buildInviteMailto,
  buildJoinTableUrl,
  createTableInvite,
} from '../engine/table/invites';
import { canUserInvite } from '../engine/table/adminControls';
import { loadProfile } from '../storage/profileStorage';
import { isEmailInviteConfigured } from '../utils/tableHost';
import { createServerInvite, invitePersonToTable } from '../api/client';
import { isOnlineModeEnabled } from '../api/config';
import './InviteModal.css';

interface InviteModalProps {
  gameState: GameState;
  open: boolean;
  onClose: () => void;
  onInvite: (state: GameState) => void;
  onInviteSent?: (email: string) => void;
  onlineTableId?: string | null;
}

export function InviteModal({
  gameState,
  open,
  onClose,
  onInvite,
  onInviteSent,
  onlineTableId = null,
}: InviteModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [lastMagicLink, setLastMagicLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const profile = loadProfile();
  const controller = profile.name.trim() || gameState.tableMeta.controllerName;
  const canInvite = canUserInvite(gameState, controller);
  const emailInviteEnabled = isEmailInviteConfigured();
  const onlineInvite = Boolean(onlineTableId && isOnlineModeEnabled());

  if (!open) {
    return null;
  }

  function latestInvite() {
    return gameState.tableMeta.invites[gameState.tableMeta.invites.length - 1];
  }

  function inviteLinkFor(invite = latestInvite()): string | null {
    if (lastMagicLink) {
      return lastMagicLink;
    }
    if (!invite) {
      return null;
    }
    return buildJoinTableUrl(gameState, invite);
  }

  async function handleCreate() {
    setError(null);
    setSuccessMessage(null);
    setCopied(false);
    if (!canInvite) {
      setError('You do not have permission to invite.');
      return;
    }
    setBusy(true);
    setSuccessMessage(null);
    try {
      if (onlineInvite && onlineTableId) {
        const trimmedEmail = email.trim();
        const displayName = name.trim() || 'Guest';
        const result = trimmedEmail
          ? await invitePersonToTable(onlineTableId, trimmedEmail, displayName)
          : await createServerInvite(onlineTableId, trimmedEmail, displayName);
        setLastMagicLink(result.joinUrl);
        if (trimmedEmail) {
          if (result.emailSent) {
            setSuccessMessage(`Invite email sent to ${trimmedEmail}.`);
            onInviteSent?.(trimmedEmail);
            onClose();
            return;
          }
          setError('Invite was created but the email could not be sent.');
          return;
        }
      } else {
        const { state: next, invite } = createTableInvite(gameState, name, email, note);
        const link = buildJoinTableUrl(next, invite);
        setLastMagicLink(link);
        onInvite(next);
      }
      setName('');
      setEmail('');
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create invite');
    } finally {
      setBusy(false);
    }
  }

  function handleCopyLink() {
    const link = inviteLinkFor();
    if (!link) {
      return;
    }
    void navigator.clipboard?.writeText(link);
    setLastMagicLink(link);
    setCopied(true);
  }

  function handleMailto() {
    const invite = latestInvite();
    if (!invite || !invite.invitedEmail) {
      return;
    }
    window.location.href = buildInviteMailto(gameState, invite);
  }

  const displayLink = inviteLinkFor();
  const hasEmail = email.trim().length > 0;
  const primaryLabel = onlineInvite
    ? hasEmail
      ? 'Send invite'
      : 'Generate join link'
    : hasEmail && emailInviteEnabled
      ? 'Send invite'
      : 'Generate join link';

  return (
    <div className="invite-modal-overlay" role="dialog" aria-label="Invite to table">
      <div className="invite-modal">
        <h2 className="invite-modal__title">Invite to table</h2>
        <p className="invite-modal__sub">
          {onlineInvite
            ? 'Invite a friend by email, or generate a join link to share manually.'
            : 'Share this join link on the same device or LAN. Enable online mode for hosted tables.'}
        </p>

        {!canInvite && (
          <p className="invite-modal__error">Only the owner (or permitted guests) can invite.</p>
        )}

        <label className="invite-modal__field">
          <span>Name (optional)</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Friend's name"
            disabled={!canInvite || busy}
          />
        </label>

        <label className="invite-modal__field">
          <span>{emailInviteEnabled ? 'Email' : 'Email (optional)'}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@example.com"
            disabled={!canInvite || busy}
          />
        </label>

        {!onlineInvite && (
          <label className="invite-modal__field">
            <span>Note (optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Bring snacks…"
              rows={2}
              disabled={!canInvite || busy}
            />
          </label>
        )}

        {error && <p className="invite-modal__error">{error}</p>}
        {successMessage && <p className="invite-modal__msg">{successMessage}</p>}

        <div className="invite-modal__actions">
          <button type="button" onClick={() => void handleCreate()} disabled={!canInvite || busy}>
            {busy ? 'Sending…' : primaryLabel}
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </div>

        {displayLink && (!hasEmail || error) && (
          <div className="invite-modal__share">
            <p className="invite-modal__link-label">Join link</p>
            <code className="invite-modal__link-code">{displayLink}</code>
            <button type="button" className="secondary" onClick={handleCopyLink}>
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            {!onlineInvite && emailInviteEnabled && latestInvite()?.invitedEmail && (
              <button type="button" className="secondary" onClick={handleMailto}>
                Open mailto
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
