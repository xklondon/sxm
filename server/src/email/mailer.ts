import { config, getEmailFrom, isEmailConfigured } from '../config.js';
import { sanitizeEmail, sendMailWithLogging } from './smtp.js';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendMagicLinkEmail(to: string, verifyUrl: string): Promise<void> {
  if (!isEmailConfigured()) {
    // eslint-disable-next-line no-console
    console.warn(
      `[SXM][email] sendMagicLinkEmail skipped: email not configured (recipient=${sanitizeEmail(to)})`,
    );
    return;
  }
  if (!config.isProduction) {
    // eslint-disable-next-line no-console
    console.warn(
      `[SXM][email] sendMagicLinkEmail skipped in dev (recipient=${sanitizeEmail(to)}) — use logged devLink`,
    );
    return;
  }

  await sendMailWithLogging('magic-link', {
    from: getEmailFrom(),
    to,
    subject: 'Sign in to SXMCARDS',
    text: `Click to sign in (expires in 15 minutes):\n\n${verifyUrl}\n`,
    html: `<p>Click to sign in (expires in 15 minutes):</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });
}

export async function sendTableInviteEmail(params: {
  to: string;
  inviterName: string;
  tableName: string;
  joinUrl: string;
  inviteMessage?: string;
}): Promise<{ messageId?: string }> {
  const recipient = sanitizeEmail(params.to);
  // eslint-disable-next-line no-console
  console.log(
    `[SXM][email] table-invite send target=${recipient} inviter=${params.inviterName.trim() || '(unknown)'}`,
  );

  if (!isEmailConfigured()) {
    const message = 'Email server is not configured — cannot send table invite';
    // eslint-disable-next-line no-console
    console.error(`[SXM][email] table-invite rejected: ${message} target=${recipient}`);
    throw new Error(message);
  }

  const inviteMessage = params.inviteMessage?.trim();
  const hostMessageText = inviteMessage ? `\n\nMessage from host:\n${inviteMessage}\n` : '';
  const hostMessageHtml = inviteMessage
    ? `<p><strong>Message from host:</strong><br>${escapeHtml(inviteMessage).replace(/\n/g, '<br>')}</p>`
    : '';

  const info = await sendMailWithLogging('table-invite', {
    from: getEmailFrom(),
    to: params.to,
    subject: 'You have been invited to an SXM Casino table',
    text: `${params.inviterName} invited you to ${params.tableName}.\n\nClick this link to join the table:\n${params.joinUrl}\n${hostMessageText}`,
    html: `<p><strong>${escapeHtml(params.inviterName)}</strong> invited you to <strong>${escapeHtml(params.tableName)}</strong>.</p><p>Click this link to join the table.</p><p><a href="${params.joinUrl}">Join table</a></p>${hostMessageHtml}`,
  });

  const messageId =
    typeof info === 'object' && info && 'messageId' in info
      ? String((info as { messageId?: string }).messageId ?? '')
      : undefined;
  // eslint-disable-next-line no-console
  console.log(
    `[SXM][email] table-invite accepted target=${recipient} messageId=${messageId || '(none)'}`,
  );
  return { messageId };
}
