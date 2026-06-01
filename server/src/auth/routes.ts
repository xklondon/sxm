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

import type { PeopleService } from '../people/service.js';

export function createAuthRouter(auth: AuthService, people: PeopleService): Router {
  const router = Router();

  router.post('/request-magic-link', async (req, res) => {
    try {
      const email = String(req.body?.email ?? '');
      const rememberMe = req.body?.rememberMe !== false;
      const result = await auth.requestMagicLink(email, rememberMe);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Request failed' });
    }
  });

  router.get('/verify', (req, res) => {
    const origin = resolveRequestOrigin(req);
    try {
      const token = String(req.query.token ?? '');
      const persistent = parseRememberQuery(req.query.remember);
      const sessionToken = auth.verifyMagicLink(token, { persistent });
      setSessionCookie(res, sessionToken, { persistent, req });
      res.redirect(`${origin}/?login=ok`);
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
