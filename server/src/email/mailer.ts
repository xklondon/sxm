import { config, getEmailFrom, isEmailConfigured } from '../config.js';
import { sanitizeEmail, sendMailWithLogging } from './smtp.js';

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

  const info = await sendMailWithLogging('table-invite', {
    from: getEmailFrom(),
    to: params.to,
    subject: 'You have been invited to an SXM Casino table',
    text: `${params.inviterName} invited you to ${params.tableName}.\n\nClick this link to join the table:\n${params.joinUrl}\n`,
    html: `<p><strong>${params.inviterName}</strong> invited you to <strong>${params.tableName}</strong>.</p><p>Click this link to join the table.</p><p><a href="${params.joinUrl}">Join table</a></p>`,
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
