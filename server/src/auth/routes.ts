import { Router } from 'express';
import type { Server as SocketServer } from 'socket.io';
import type { AuthService } from './service.js';
import type { TableService } from '../tables/service.js';
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
import { respondPeopleAuthError } from '../people/httpErrors.js';
import { resolveAuthForRequest } from './sessionResolve.js';
import { verifySessionToken } from './tokens.js';
import {
  clearPendingInviteCookie,
  readPendingInviteToken,
  safeReturnTo,
} from './pendingInviteCookie.js';
import {
  completeInviteAcceptRedirect,
  redirectInviteError,
} from '../tables/inviteAcceptHttp.js';

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

export function createAuthRouter(
  auth: AuthService,
  people: PeopleService,
  tables: TableService,
  io: SocketServer,
): Router {
  const router = Router();

  router.post('/request-magic-link', async (req, res) => {
    const email = String(req.body?.email ?? '');
    const rememberMe = req.body?.rememberMe !== false;
    const returnTo = safeReturnTo(resolveRequestOrigin(req), req.body?.returnTo);
    // eslint-disable-next-line no-console
    console.log(
      `[SXM][auth] POST /api/auth/request-magic-link recipient=${sanitizeEmail(email)} rememberMe=${rememberMe}`,
    );
    try {
      const result = await auth.requestMagicLink(email, rememberMe, returnTo ?? undefined);
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

  router.get('/verify', async (req, res) => {
    const origin = resolveRequestOrigin(req);
    try {
      const token = String(req.query.token ?? '');
      const persistent = parseRememberQuery(req.query.remember);
      const sessionToken = await auth.verifyMagicLink(token, { persistent });
      setSessionCookie(res, sessionToken, { persistent, req });

      const pendingInvite = readPendingInviteToken(req);
      if (pendingInvite) {
        const payload = verifySessionToken(sessionToken);
        if (!payload) {
          clearPendingInviteCookie(res);
          res.redirect(`${origin}/login?error=${encodeURIComponent('Invalid session after sign-in')}`);
          return;
        }
        try {
          await completeInviteAcceptRedirect(
            res,
            req,
            tables,
            io,
            pendingInvite,
            payload.userId,
            'GET /api/auth/verify (pending invite)',
          );
          logAuthVerifyDiagnostics(req, {
            redirectUrl: `${origin}/?table=… (pending invite)`,
            cookieName: config.sessionCookieName,
            secure: shouldSecureSessionCookie(req),
            maxAgePresent: persistent || !config.isProduction,
            persistent,
            rememberQuery: req.query.remember,
          });
          return;
        } catch (inviteErr) {
          const message = inviteErr instanceof Error ? inviteErr.message : 'Invite accept failed';
          const tableId = await tables.lookupInviteTableId(pendingInvite);
          redirectInviteError(res, origin, message, tableId, { clearPending: true });
          return;
        }
      }

      const wantsNewTable = req.query.newTable === '1';
      const returnTo = safeReturnTo(origin, req.query.returnTo);
      const redirectUrl = wantsNewTable
        ? `${origin}/?newTable=1`
        : returnTo
          ? `${origin}${returnTo.startsWith('/') ? returnTo : `/${returnTo}`}`
          : `${origin}/`;
      logAuthVerifyDiagnostics(req, {
        redirectUrl,
        cookieName: config.sessionCookieName,
        secure: shouldSecureSessionCookie(req),
        maxAgePresent: persistent || !config.isProduction,
        persistent,
        rememberQuery: req.query.remember,
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
        rememberQuery: req.query.remember,
      });
      res.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
    }
  });

  router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const authPayload = await resolveAuthForRequest(people, req.auth!, res, req, 'GET /api/auth/me');
      if (!authPayload) {
        return;
      }
      const user = await people.getAuthProfile(authPayload.userId, authPayload.email);
      refreshSessionCookie(res, { ...authPayload, userId: user.userId }, req);
      res.json({ user });
    } catch (err) {
      if (respondPeopleAuthError(res, err)) {
        return;
      }
      const message = err instanceof Error ? err.message : 'Not found';
      res.status(500).json({ error: message });
    }
  });

  router.post('/logout', (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  return router;
}
