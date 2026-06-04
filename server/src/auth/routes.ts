import { Router } from 'express';
import type { AuthService } from '../auth/service.js';
import {
  clearSessionCookie,
  requireAuth,
  refreshSessionCookie,
  setSessionCookie,
  type AuthedRequest,
} from '../auth/middleware.js';
import {
  logAuthVerifyDiagnostics,
  parseRememberQuery,
  resolveRequestOrigin,
  shouldSecureSessionCookie,
} from '../auth/cookies.js';
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
      const wantsNewTable = req.query.newTable === '1';
      const redirectUrl = wantsNewTable ? `${origin}/?newTable=1` : `${origin}/`;
      logAuthVerifyDiagnostics(req, {
        redirectUrl,
        cookieName: config.sessionCookieName,
        secure: shouldSecureSessionCookie(req),
        maxAgePresent: persistent || !config.isProduction,
        persistent,
      });
      res.redirect(redirectUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'verify failed';
      logAuthVerifyDiagnostics(req, {
        redirectUrl: `${origin}/login?error=…`,
        cookieName: config.sessionCookieName,
        secure: shouldSecureSessionCookie(req),
        maxAgePresent: false,
        persistent: parseRememberQuery(req.query.remember),
      });
      res.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
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
