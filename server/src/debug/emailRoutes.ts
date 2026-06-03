import { Router } from 'express';
import {
  clientEmailErrorMessage,
  formatSmtpError,
  getEmailConfigSnapshot,
  sanitizeEmail,
  sendMailWithLogging,
  shouldExposeEmailErrorDetail,
} from '../email/smtp.js';

function envBool(key: string): boolean {
  const v = process.env[key]?.trim().toLowerCase();
  return v === 'true' || v === '1';
}

export function createEmailDebugRouter(): Router {
  const router = Router();

  router.get('/email-config', (_req, res) => {
    res.json(getEmailConfigSnapshot());
  });

  router.post('/send-test-email', async (req, res) => {
    if (!envBool('DEBUG_EMAIL_TEST')) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (!email.includes('@')) {
      res.status(400).json({ error: 'Provide { "email": "you@example.com" }' });
      return;
    }

    const snap = getEmailConfigSnapshot();
    if (!snap.smtpConfigured) {
      res.status(503).json({
        ok: false,
        error: 'SMTP not configured',
        ...snap,
      });
      return;
    }

    try {
      const info = await sendMailWithLogging('debug/send-test-email', {
        from: snap.fromEmail,
        to: email,
        subject: 'SXMCARDS SMTP test (Railway/debug)',
        text: 'If you received this, production SMTP delivery is working.',
        html: '<p>If you received this, production SMTP delivery is working.</p>',
      });

      res.json({
        ok: true,
        to: sanitizeEmail(email),
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
      });
    } catch (err) {
      const body: Record<string, unknown> = {
        ok: false,
        error: clientEmailErrorMessage(err),
        to: sanitizeEmail(email),
      };
      if (shouldExposeEmailErrorDetail()) {
        body.detail = formatSmtpError(err);
      }
      res.status(500).json(body);
    }
  });

  return router;
}
