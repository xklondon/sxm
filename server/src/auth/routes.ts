import { Router } from 'express';
import type { AuthService } from '../auth/service.js';
import {
  clearSessionCookie,
  requireAuth,
  setSessionCookie,
  type AuthedRequest,
} from '../auth/middleware.js';
import { getEffectivePublicOrigin } from '../config.js';

import type { PeopleService } from '../people/service.js';

export function createAuthRouter(auth: AuthService, people: PeopleService): Router {
  const router = Router();

  router.post('/request-magic-link', async (req, res) => {
    try {
      const email = String(req.body?.email ?? '');
      const result = await auth.requestMagicLink(email);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Request failed' });
    }
  });

  router.get('/verify', (req, res) => {
    try {
      const token = String(req.query.token ?? '');
      const sessionToken = auth.verifyMagicLink(token);
      setSessionCookie(res, sessionToken);
      res.redirect(`${getEffectivePublicOrigin().replace(/\/$/, '')}/?login=ok`);
    } catch (err) {
      res.redirect(
        `${getEffectivePublicOrigin().replace(/\/$/, '')}/login?error=${encodeURIComponent(err instanceof Error ? err.message : 'verify failed')}`,
      );
    }
  });

  router.get('/me', requireAuth, (req: AuthedRequest, res) => {
    try {
      const user = people.getAuthProfile(req.auth!.userId);
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
