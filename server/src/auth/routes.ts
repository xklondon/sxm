import { Router } from 'express';
import type { AuthService } from '../auth/service.js';
import {
  clearSessionCookie,
  requireAuth,
  refreshSessionCookie,
  setSessionCookie,
  type AuthedRequest,
} from '../auth/middleware.js';
import { parseRememberQuery, resolveRequestOrigin } from '../auth/cookies.js';
import {
  clientEmailErrorMessage,
  formatSmtpError,
  sanitizeEmail,
  shouldExposeEmailErrorDetail,
} from '../email/smtp.js';
import { config } from '../config.js';

import type { PeopleService } from '../people/service.js';

function magicLinkErrorStatus(message: string): number {
  if (/not configured/i.test(message)) {
    return 503;
  }
  if (/not authorised/i.test(message)) {
    return 400;
  }
  if (
    /SMTP|sendMail|timed out|ECONN|ETIMEDOUT|ENOTFOUND|certificate|EAUTH|535|BadCredentials|authentication failed/i.test(
      message,
    )
  ) {
    return 502;
  }
  return 400;
}

export function createAuthRouter(auth: AuthService, people: PeopleService): Router {
  const router = Router();

  router.post('/request-magic-link', async (req, res) => {
    const email = String(req.body?.email ?? '');
    const rememberMe = req.body?.rememberMe !== false;
    // eslint-disable-next-line no-console
    console.log(
      `[SXM][auth] POST /api/auth/request-magic-link recipient=${sanitizeEmail(email)} rememberMe=${rememberMe}`,
    );
    try {
      const result = await auth.requestMagicLink(email, rememberMe);
      // eslint-disable-next-line no-console
      console.log(
        `[SXM][auth] magic-link request ok recipient=${sanitizeEmail(email)} emailed=${config.isProduction || Boolean(result.devLink)}`,
      );
      res.json(result);
    } catch (err) {
      const message = clientEmailErrorMessage(err);
      const status = magicLinkErrorStatus(message);
      // eslint-disable-next-line no-console
      console.error(
        `[SXM][auth] magic-link request failed recipient=${sanitizeEmail(email)} status=${status}`,
        formatSmtpError(err),
      );
      const body: Record<string, unknown> = {
        error:
          config.isProduction && status >= 500
            ? 'Could not send sign-in email. Check server logs.'
            : message,
      };
      if (shouldExposeEmailErrorDetail()) {
        body.detail = formatSmtpError(err);
      }
      res.status(status).json(body);
    }
  });

  router.get('/verify', (req, res) => {
    const origin = resolveRequestOrigin(req);
    try {
      const token = String(req.query.token ?? '');
      const persistent = parseRememberQuery(req.query.remember);
      const sessionToken = auth.verifyMagicLink(token, { persistent });
      setSessionCookie(res, sessionToken, { persistent, req });
      res.redirect(`${origin}/?newTable=1`);
    } catch (err) {
      res.redirect(
        `${origin}/login?error=${encodeURIComponent(err instanceof Error ? err.message : 'verify failed')}`,
      );
    }
  });

  router.get('/me', requireAuth, (req: AuthedRequest, res) => {
    try {
      const user = people.getAuthProfile(req.auth!.userId);
      refreshSessionCookie(res, req.auth!, req);
      res.json({ user });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : 'Not found' });
    }
  });

  router.post('/logout', (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  return router;
}
