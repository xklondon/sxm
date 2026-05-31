import { Router } from 'express';
import type { PeopleService } from './service.js';
import type { AuthService } from '../auth/service.js';
import type { PersonRole } from '../store/types.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';

export function createPeopleRouter(people: PeopleService, auth: AuthService): Router {
  const router = Router();

  router.get('/', requireAuth, (req: AuthedRequest, res) => {
    try {
      people.assertPeopleAdmin(req.auth!.userId);
      res.json({ people: people.listPeople() });
    } catch (err) {
      res.status(403).json({ error: err instanceof Error ? err.message : 'Forbidden' });
    }
  });

  router.post('/', requireAuth, (req: AuthedRequest, res) => {
    try {
      people.assertPeopleAdmin(req.auth!.userId);
      const person = people.addPerson({
        email: String(req.body?.email ?? ''),
        displayName: req.body?.displayName ? String(req.body.displayName) : undefined,
        role: req.body?.role as PersonRole | undefined,
        invitedByEmail: req.auth!.email,
      });
      res.status(201).json({ person });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Create failed' });
    }
  });

  router.patch('/:personId', requireAuth, (req: AuthedRequest, res) => {
    try {
      people.assertPeopleAdmin(req.auth!.userId);
      const patches: Partial<import('../store/types.js').PersonRecord> = {};
      if (req.body?.displayName !== undefined) patches.displayName = String(req.body.displayName);
      if (req.body?.role !== undefined) patches.role = req.body.role;
      if (req.body?.status !== undefined) patches.status = req.body.status;
      if (req.body?.canOwnTables !== undefined) patches.canOwnTables = Boolean(req.body.canOwnTables);
      if (req.body?.canPlay !== undefined) patches.canPlay = Boolean(req.body.canPlay);
      if (req.body?.canInvite !== undefined) patches.canInvite = Boolean(req.body.canInvite);
      if (req.body?.canLogin !== undefined) patches.canLogin = Boolean(req.body.canLogin);
      const person = people.updatePerson(req.params.personId!, patches, req.auth!.email);
      res.json({ person });
    } catch (err) {
      const status = err instanceof Error && err.message.includes('Root') ? 403 : 400;
      res.status(status).json({ error: err instanceof Error ? err.message : 'Update failed' });
    }
  });

  router.post('/:personId/send-invite', requireAuth, async (req: AuthedRequest, res) => {
    try {
      people.assertPeopleAdmin(req.auth!.userId);
      const target = people.listPeople().find((p) => p.id === req.params.personId);
      if (!target) {
        res.status(404).json({ error: 'Person not found' });
        return;
      }
      const result = await auth.requestMagicLink(target.email);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Send failed' });
    }
  });

  return router;
}
