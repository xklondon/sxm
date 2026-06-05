import { Router } from 'express';
import type { TableService } from './service.js';
import type { TableActionType } from './actions.js';
import { requireAuth, readSessionToken, setSessionCookie, clearSessionCookie, type AuthedRequest } from '../auth/middleware.js';
import { verifySessionToken } from '../auth/tokens.js';
import { resolveRequestOrigin } from '../auth/cookies.js';
import { clientEmailErrorMessage } from '../email/smtp.js';
import type { Server as SocketServer } from 'socket.io';
import { respondPeopleAuthError } from '../people/httpErrors.js';

export function createTableRouter(tables: TableService, io: SocketServer): Router {
  const router = Router();

  router.get('/invites/preview', async (req, res) => {
    try {
      const preview = await tables.previewInviteByToken(String(req.query.token ?? ''));
      res.json({ preview });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid invite' });
    }
  });

  router.get('/invites/accept', async (req, res) => {
    const token = String(req.query.token ?? '');
    const origin = resolveRequestOrigin(req);
    try {
      const preview = await tables.previewInviteByToken(token);
      const raw = readSessionToken(req);
      const session = raw ? verifySessionToken(raw) : null;
      let sessionUserId: string | undefined;

      if (session) {
        const sessionEmail = session.email.trim().toLowerCase();
        const inviteEmail = preview.invitedEmail.trim().toLowerCase();
        if (sessionEmail !== inviteEmail) {
          clearSessionCookie(res);
        } else {
          sessionUserId = session.userId;
        }
      }

      const result = await tables.acceptInviteByToken(token, sessionUserId);
      setSessionCookie(res, result.sessionToken, { req });
      const spectator = result.spectator ? '&spectator=1' : '';
      res.redirect(`${origin}/?table=${encodeURIComponent(result.tableId)}${spectator}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invite accept failed';
      const tableId = await tables.lookupInviteTableId(token);
      const query = tableId
        ? `?table=${encodeURIComponent(tableId)}&inviteError=${encodeURIComponent(message)}`
        : `?inviteError=${encodeURIComponent(message)}`;
      res.redirect(`${origin}/${query}`);
    }
  });

  router.post('/', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const displayName = String(req.body?.displayName ?? req.auth!.email.split('@')[0]);
      const tableName = req.body?.name ? String(req.body.name) : undefined;
      const table = await tables.createTable(
        req.auth!.userId,
        displayName,
        tableName,
        req.auth!.email,
      );
      res.status(201).json({
        tableId: table.id,
        version: table.version,
        state: table.state,
      });
    } catch (err) {
      if (respondPeopleAuthError(res, err)) {
        return;
      }
      res.status(400).json({ error: err instanceof Error ? err.message : 'Create failed' });
    }
  });

  router.get('/:tableId', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const table = await tables.getTableForUser(
        req.params.tableId!,
        req.auth!.userId,
        req.auth!.email,
      );
      res.json({ tableId: table.id, version: table.version, state: table.state });
    } catch (err) {
      if (respondPeopleAuthError(res, err)) {
        return;
      }
      res.status(404).json({ error: err instanceof Error ? err.message : 'Not found' });
    }
  });

  router.post('/:tableId/invites', requireAuth, async (req: AuthedRequest, res) => {
    const invitedEmail = String(req.body?.email ?? '').trim();
    // eslint-disable-next-line no-console
    console.log(
      `[SXM][tables] POST /invites tableId=${req.params.tableId} target=${invitedEmail || '(link-only)'}`,
    );
    try {
      const result = await tables.createInvite({
        tableId: req.params.tableId!,
        userId: req.auth!.userId,
        invitedEmail,
        invitedName: String(req.body?.name ?? ''),
        sessionEmail: req.auth!.email,
      });
      res.status(201).json(result);
    } catch (err) {
      if (respondPeopleAuthError(res, err)) {
        return;
      }
      const message = clientEmailErrorMessage(err);
      const status = /email|smtp|configured|send|resend|sandbox|domain/i.test(message) ? 502 : 400;
      res.status(status).json({ error: message });
    }
  });

  router.post('/:tableId/invite-person', requireAuth, async (req: AuthedRequest, res) => {
    const email = String(req.body?.email ?? '').trim();
    // eslint-disable-next-line no-console
    console.log(
      `[SXM][tables] POST /invite-person tableId=${req.params.tableId} target=${email}`,
    );
    try {
      const result = await tables.invitePersonByEmail({
        tableId: req.params.tableId!,
        userId: req.auth!.userId,
        email,
        displayName: String(req.body?.displayName ?? req.body?.name ?? ''),
        role: req.body?.role,
        sessionEmail: req.auth!.email,
      });
      res.status(201).json(result);
    } catch (err) {
      if (respondPeopleAuthError(res, err)) {
        return;
      }
      const message = clientEmailErrorMessage(err);
      const status = /email|smtp|configured|send|resend|sandbox|domain/i.test(message) ? 502 : 400;
      res.status(status).json({ error: message });
    }
  });

  router.post('/join', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const table = await tables.joinTable({
        userId: req.auth!.userId,
        displayName: String(req.body?.displayName ?? req.auth!.email.split('@')[0]),
        tableId: String(req.body?.tableId ?? ''),
        inviteId: String(req.body?.inviteId ?? ''),
        token: String(req.body?.token ?? ''),
        sessionEmail: req.auth!.email,
      });
      res.json({ tableId: table.id, version: table.version, state: table.state });
    } catch (err) {
      if (respondPeopleAuthError(res, err)) {
        return;
      }
      res.status(400).json({ error: err instanceof Error ? err.message : 'Join failed' });
    }
  });

  router.post('/:tableId/actions', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const type = String(req.body?.type ?? '') as TableActionType;
      const payload = (req.body?.payload ?? {}) as Record<string, unknown>;
      const expectedVersion =
        req.body?.expectedVersion !== undefined ? Number(req.body.expectedVersion) : undefined;
      const result = await tables.applyAction(
        req.params.tableId!,
        req.auth!.userId,
        type,
        payload,
        expectedVersion,
        req.auth!.email,
      );
      io.to(`table:${req.params.tableId}`).emit('table:update', {
        tableId: req.params.tableId,
        version: result.version,
        state: result.state,
      });
      res.json(result);
    } catch (err) {
      if (respondPeopleAuthError(res, err)) {
        return;
      }
      const message = err instanceof Error ? err.message : 'Action failed';
      const status = message.includes('Stale') ? 409 : 400;
      res.status(status).json({ error: message });
    }
  });

  return router;
}
