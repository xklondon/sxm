import { Router } from 'express';
import {
  config,
  getCorsOrigins,
  getEffectivePublicOrigin,
  isEmailConfigured,
  isSmtpConfigured,
} from '../config.js';
import { sendDebugTestEmail, smtpFailureResponse } from '../email/smtp.js';

function redact(value: string): string {
  if (!value) return '(empty)';
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}…${value.slice(-2)}`;
}

export function createDevRouter(): Router {
  const router = Router();

  router.get('/config', (_req, res) => {
    res.json({
      nodeEnv: config.nodeEnv,
      port: config.port,
      publicOrigin: config.publicOrigin,
      effectivePublicOrigin: getEffectivePublicOrigin(),
      devPublicOriginAuto: config.devPublicOriginAuto,
      corsOrigins: getCorsOrigins(),
      smtpConfigured: isSmtpConfigured(),
      smtp: {
        host: config.smtp.host || '(empty)',
        port: config.smtp.port,
        user: config.smtp.user ? redact(config.smtp.user) : '(empty)',
        from: config.smtp.from || '(empty)',
      },
      magicLinkTtlMs: config.magicLinkTtlMs,
      sessionCookieName: config.sessionCookieName,
    });
  });

  router.post('/test-email', async (req, res) => {
    if (config.isProduction) {
      res.status(404).json({ error: 'Not available in production' });
      return;
    }

    const to = String(req.body?.to ?? config.smtp.user ?? '').trim();
    if (!to) {
      res.status(400).json({ error: 'Provide { "to": "email@example.com" } or set SMTP_USER' });
      return;
    }

    if (!isEmailConfigured()) {
      res.status(400).json({
        ok: false,
        error: 'Email not configured (need SMTP_HOST + EMAIL_FROM, or Resend vars)',
        smtpConfigured: false,
      });
      return;
    }

    try {
      // Same provider-aware send path (timeouts, Resend/SMTP selection,
      // logging) as POST /api/debug/send-test-email — no second transport.
      const info = await sendDebugTestEmail({
        from: config.smtp.from,
        to,
        subject: 'SXMCARDS SMTP test',
        text: 'If you received this, email sending is working for local dev.',
      });

      res.json({
        ok: true,
        smtpConfigured: isSmtpConfigured(),
        messageId: info.messageId,
        to: redact(to),
        from: config.smtp.from,
      });
    } catch (err) {
      res.status(500).json({
        ...smtpFailureResponse(err, 'sendMail'),
        smtpConfigured: isSmtpConfigured(),
      });
    }
  });

  return router;
}
