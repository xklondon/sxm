import { Router } from 'express';
import nodemailer from 'nodemailer';
import { config, getCorsOrigins, getEffectivePublicOrigin, isSmtpConfigured } from '../config.js';

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

    if (!isSmtpConfigured()) {
      res.status(400).json({
        ok: false,
        error: 'SMTP not configured (need SMTP_HOST and EMAIL_FROM)',
        smtpConfigured: false,
      });
      return;
    }

    try {
      const transport = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: config.smtp.user
          ? { user: config.smtp.user, pass: config.smtp.pass }
          : undefined,
      });

      await transport.verify();
      const info = await transport.sendMail({
        from: config.smtp.from,
        to,
        subject: 'SXMCARDS SMTP test',
        text: 'If you received this, SMTP is working for local dev.',
      });

      res.json({
        ok: true,
        smtpConfigured: true,
        messageId: info.messageId,
        to: redact(to),
        from: config.smtp.from,
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        smtpConfigured: true,
        error: err instanceof Error ? err.message : 'SMTP test failed',
      });
    }
  });

  return router;
}
