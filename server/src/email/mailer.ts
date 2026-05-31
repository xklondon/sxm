import nodemailer from 'nodemailer';
import { config, isSmtpConfigured } from '../config.js';

export async function sendMagicLinkEmail(to: string, verifyUrl: string): Promise<void> {
  if (!isSmtpConfigured()) {
    return;
  }

  const transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user
      ? { user: config.smtp.user, pass: config.smtp.pass }
      : undefined,
  });

  await transport.sendMail({
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

  const transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user
      ? { user: config.smtp.user, pass: config.smtp.pass }
      : undefined,
  });

  await transport.sendMail({
    from: config.smtp.from,
    to: params.to,
    subject: 'You have been invited to an SXM Casino table',
    text: `${params.inviterName} invited you to ${params.tableName}.\n\nClick this link to join the table:\n${params.joinUrl}\n`,
    html: `<p><strong>${params.inviterName}</strong> invited you to <strong>${params.tableName}</strong>.</p><p>Click this link to join the table.</p><p><a href="${params.joinUrl}">Join table</a></p>`,
  });
}
