import { Router } from 'express';
import { getEmailProvider } from '../config.js';
import {
  formatSmtpError,
  getEmailConfigSnapshot,
  getEmailProviderDiagnostics,
  is465SslFallbackMode,
  isSmtpTimeoutError,
  sanitizeEmail,
  sendDebugTestEmail,
  smtpFailureResponse,
  SmtpOperationTimeoutError,
  shouldExposeEmailErrorDetail,
  type SmtpStage,
} from '../email/smtp.js';

function envBool(key: string): boolean {
  const v = process.env[key]?.trim().toLowerCase();
  return v === 'true' || v === '1';
}

function failureStatus(err: unknown): number {
  if (isSmtpTimeoutError(err)) {
    return 502;
  }
  const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
  if (/ECONN|ETIMEDOUT|ENOTFOUND|EAUTH|ESOCKET/i.test(code)) {
    return 502;
  }
  return 500;
}

function inferFailedStage(err: unknown): SmtpStage {
  if (err instanceof SmtpOperationTimeoutError) {
    return err.stage;
  }
  return 'sendMail';
}

export function createEmailDebugRouter(): Router {
  const router = Router();

  router.get('/email-config', (_req, res) => {
    res.json(getEmailConfigSnapshot());
  });

  router.get('/email-provider', (_req, res) => {
    res.json(getEmailProviderDiagnostics());
  });

  router.post('/send-test-email', async (req, res) => {
    if (!envBool('DEBUG_EMAIL_TEST')) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (!email.includes('@')) {
      res.status(400).json({ ok: false, error: 'Provide { "email": "you@example.com" }' });
      return;
    }

    const snap = getEmailConfigSnapshot();
    if (!snap.emailConfigured) {
      res.status(503).json({
        ok: false,
        error: 'Email not configured',
        ...snap,
      });
      return;
    }

    const use465 = req.body?.use465 === true;
    const fallback465 = req.body?.fallback465 === true;
    if (getEmailProvider() === 'smtp' && use465 && !is465SslFallbackMode()) {
      res.status(400).json({
        ok: false,
        error: 'use465 requires SMTP_PORT=465 and SMTP_SECURE=true in environment',
        ssl465FallbackAvailable: false,
      });
      return;
    }

    try {
      const info = await sendDebugTestEmail(
        {
          from: snap.fromEmail,
          to: email,
          subject: 'SXMCARDS email test (Railway/debug)',
          text: 'If you received this, production email delivery is working.',
          html: '<p>If you received this, production email delivery is working.</p>',
        },
        { use465, fallback465 },
      );

      res.json({
        ok: true,
        to: sanitizeEmail(email),
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        ssl465FallbackAvailable: is465SslFallbackMode(),
      });
    } catch (err) {
      const stage = inferFailedStage(err);
      const status = failureStatus(err);
      const body: Record<string, unknown> = {
        ...smtpFailureResponse(err, stage),
        to: sanitizeEmail(email),
        ssl465FallbackAvailable: is465SslFallbackMode(),
      };
      if (shouldExposeEmailErrorDetail()) {
        body.detail = formatSmtpError(err);
      }
      res.status(status).json(body);
    }
  });

  return router;
}
