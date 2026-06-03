import { config } from '../config.js';
import { isSmtpConfigured } from '../config.js';
import { sanitizeEmail, sendMailWithLogging } from './smtp.js';

export async function sendMagicLinkEmail(to: string, verifyUrl: string): Promise<void> {
  if (!isSmtpConfigured()) {
    // eslint-disable-next-line no-console
    console.warn(
      `[SXM][email] sendMagicLinkEmail skipped: SMTP not configured (recipient=${sanitizeEmail(to)})`,
    );
    return;
  }

  await sendMailWithLogging('magic-link', {
    from: config.smtp.from,
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
}): Promise<void> {
  if (!isSmtpConfigured()) {
    return;
  }

  await sendMailWithLogging('table-invite', {
    from: config.smtp.from,
    to: params.to,
    subject: 'You have been invited to an SXM Casino table',
    text: `${params.inviterName} invited you to ${params.tableName}.\n\nClick this link to join the table:\n${params.joinUrl}\n`,
    html: `<p><strong>${params.inviterName}</strong> invited you to <strong>${params.tableName}</strong>.</p><p>Click this link to join the table.</p><p><a href="${params.joinUrl}">Join table</a></p>`,
  });
}
