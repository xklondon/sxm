import { Router } from 'express';
import type { PeopleService } from './service.js';
import type { AuthService } from '../auth/service.js';
import type { PersonRole } from '../store/types.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { respondPeopleAuthError } from './httpErrors.js';
import { clientEmailErrorMessage } from '../email/smtp.js';

export function createPeopleRouter(people: PeopleService, auth: AuthService): Router {
  const router = Router();

  router.get('/', requireAuth, async (req: AuthedRequest, res) => {
    try {
      await people.assertPeopleAdmin(req.auth!.userId, req.auth!.email, 'GET /api/people');
      res.json({ people: await people.listPeople() });
    } catch (err) {
      if (respondPeopleAuthError(res, err)) {
        return;
      }
      res.status(403).json({ error: err instanceof Error ? err.message : 'Forbidden' });
    }
  });

  router.post('/', requireAuth, async (req: AuthedRequest, res) => {
    try {
      await people.assertPeopleAdmin(req.auth!.userId, req.auth!.email, 'POST /api/people');
      const person = await people.addPerson({
        email: String(req.body?.email ?? ''),
        displayName: req.body?.displayName ? String(req.body.displayName) : undefined,
        role: req.body?.role as PersonRole | undefined,
        invitedByEmail: req.auth!.email,
      });
      let devLink: string | undefined;
      try {
        const invite = await auth.requestMagicLink(person.email);
        devLink = invite.devLink;
      } catch (err) {
        res.status(502).json({
          error: `Person added, but the invite email could not be sent: ${clientEmailErrorMessage(err)}`,
          code: 'invite_email_failed',
          person,
        });
        return;
      }
      res.status(201).json({ person, devLink });
    } catch (err) {
      if (respondPeopleAuthError(res, err)) {
        return;
      }
      res.status(400).json({ error: err instanceof Error ? err.message : 'Create failed' });
    }
  });

  router.patch('/:personId', requireAuth, async (req: AuthedRequest, res) => {
    try {
      await people.assertPeopleAdmin(req.auth!.userId, req.auth!.email, 'PATCH /api/people/:id');
      const patches: Partial<import('../store/types.js').PersonRecord> = {};
      if (req.body?.displayName !== undefined) patches.displayName = String(req.body.displayName);
      if (req.body?.role !== undefined) patches.role = req.body.role;
      if (req.body?.status !== undefined) patches.status = req.body.status;
      if (req.body?.canOwnTables !== undefined) patches.canOwnTables = Boolean(req.body.canOwnTables);
      if (req.body?.canPlay !== undefined) patches.canPlay = Boolean(req.body.canPlay);
      if (req.body?.canInvite !== undefined) patches.canInvite = Boolean(req.body.canInvite);
      if (req.body?.canLogin !== undefined) patches.canLogin = Boolean(req.body.canLogin);
      const person = await people.updatePerson(req.params.personId!, patches, req.auth!.email);
      res.json({ person });
    } catch (err) {
      if (respondPeopleAuthError(res, err)) {
        return;
      }
      const status = err instanceof Error && err.message.includes('Root') ? 403 : 400;
      res.status(status).json({ error: err instanceof Error ? err.message : 'Update failed' });
    }
  });

  router.post('/:personId/send-invite', requireAuth, async (req: AuthedRequest, res) => {
    try {
      await people.assertPeopleAdmin(req.auth!.userId, req.auth!.email, 'POST /api/people/:id/send-invite');
      const target = (await people.listPeople()).find((p) => p.id === req.params.personId);
      if (!target) {
        res.status(404).json({ error: 'Person not found' });
        return;
      }
      const result = await auth.requestMagicLink(target.email);
      res.json(result);
    } catch (err) {
      if (respondPeopleAuthError(res, err)) {
        return;
      }
      res.status(502).json({
        error: clientEmailErrorMessage(err),
        code: 'invite_email_failed',
      });
    }
  });

  return router;
}
