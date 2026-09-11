import { sanitizeEmail } from '../email/smtp.js';

export type InviteAuthStage =
  | 'invite-open'
  | 'auth-required'
  | 'magic-request'
  | 'auth-complete'
  | 'invite-resume'
  | 'join-success'
  | 'redirect-table';

function maskId(id: string | null | undefined): string {
  if (!id) {
    return '';
  }
  return id.length <= 8 ? id : `${id.slice(0, 8)}…`;
}

export function logInviteAuth(input: {
  stage: InviteAuthStage;
  inviteId?: string | null;
  tableId?: string | null;
  sessionEmail?: string | null;
  inviteEmail?: string | null;
  callbackTarget?: string | null;
  reason?: string | null;
}): void {
  const parts = [
    `[SXM][invite-auth] stage=${input.stage}`,
    input.inviteId ? `inviteId=${maskId(input.inviteId)}` : null,
    input.tableId ? `tableId=${maskId(input.tableId)}` : null,
    input.sessionEmail ? `sessionEmail=${sanitizeEmail(input.sessionEmail)}` : null,
    input.inviteEmail ? `inviteEmail=${sanitizeEmail(input.inviteEmail)}` : null,
    input.callbackTarget ? `callbackTarget=${input.callbackTarget}` : null,
    input.reason ? `reason=${input.reason}` : null,
  ].filter(Boolean);
  // eslint-disable-next-line no-console
  console.info(parts.join(' '));
}
