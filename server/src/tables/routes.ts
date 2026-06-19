import { Router } from 'express';
import type { TableService } from './service.js';
import type { TableActionType } from './actions.js';
import { requireAuth, readSessionToken, setSessionCookie, clearSessionCookie, type AuthedRequest } from '../auth/middleware.js';
import { verifySessionToken } from '../auth/tokens.js';
import { resolveRequestOrigin } from '../auth/cookies.js';
import { clientEmailErrorMessage } from '../email/smtp.js';
import type { Server as SocketServer } from 'socket.io';
import { respondPeopleAuthError } from '../people/httpErrors.js';
import { TableForbiddenError, TableMembershipError, TableNotFoundError } from './errors.js';
import { addTableChatMessage, listTableChatMessages } from './tableChatStore.js';

function respondTableServiceError(res: import('express').Response, err: unknown): boolean {
  if (err instanceof TableNotFoundError) {
    res.status(404).json({ error: err.message, code: 'TABLE_NOT_FOUND' });
    return true;
  }
  if (err instanceof TableMembershipError) {
    res.status(403).json({ error: err.message, code: 'TABLE_NOT_MEMBER' });
    return true;
  }
  if (err instanceof TableForbiddenError) {
    res.status(403).json({ error: err.message, code: 'TABLE_FORBIDDEN' });
    return true;
  }
  return false;
}

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

  router.get('/mine', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const accessible = await tables.listAccessibleTables(req.auth!.userId, req.auth!.email);
      res.json({ tables: accessible });
    } catch (err) {
      if (respondPeopleAuthError(res, err)) {
        return;
      }
      res.status(400).json({ error: err instanceof Error ? err.message : 'List failed' });
    }
  });

  router.get('/active', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const active = await tables.listActiveTables(req.auth!.userId, req.auth!.email);
      res.json({ tables: active });
    } catch (err) {
      if (respondPeopleAuthError(res, err)) {
        return;
      }
      res.status(400).json({ error: err instanceof Error ? err.message : 'List failed' });
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
      const memberPersonId = table.state.tableMeta.ownerPersonId!;
      res.status(201).json({
        tableId: table.id,
        version: table.version,
        state: table.state,
        memberPersonId,
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
      const tableId = req.params.tableId!;
      const table = await tables.getTableForUser(tableId, req.auth!.userId, req.auth!.email);
      const memberPersonId = await tables.getMemberPersonIdForSession(
        tableId,
        req.auth!.userId,
        req.auth!.email,
        'GET /api/tables/:id',
      );
      res.json({ tableId: table.id, version: table.version, state: table.state, memberPersonId });
    } catch (err) {
      if (respondPeopleAuthError(res, err)) {
        return;
      }
      if (respondTableServiceError(res, err)) {
        return;
      }
      res.status(404).json({ error: err instanceof Error ? err.message : 'Not found' });
    }
  });

  router.get('/:tableId/messages', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const tableId = req.params.tableId!;
      await tables.getTableForUser(tableId, req.auth!.userId, req.auth!.email);
      res.json({ ok: true, messages: listTableChatMessages(tableId) });
    } catch (err) {
      if (respondPeopleAuthError(res, err)) {
        return;
      }
      if (respondTableServiceError(res, err)) {
        return;
      }
      res.status(404).json({ error: err instanceof Error ? err.message : 'Not found' });
    }
  });

  router.post('/:tableId/messages', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const tableId = req.params.tableId!;
      await tables.getTableForUser(tableId, req.auth!.userId, req.auth!.email);
      const message = addTableChatMessage({
        tableId,
        senderEmail: req.auth!.email,
        senderName: String(req.body?.senderName ?? '').trim() || undefined,
        body: String(req.body?.body ?? ''),
      });
      res.status(201).json({ ok: true, message });
    } catch (err) {
      if (respondPeopleAuthError(res, err)) {
        return;
      }
      if (respondTableServiceError(res, err)) {
        return;
      }
      const message = err instanceof Error ? err.message : 'Could not send message';
      const status = /empty|exceed/i.test(message) ? 400 : 404;
      res.status(status).json({ error: message });
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
        inviteMessage:
          typeof req.body?.inviteMessage === 'string' ? req.body.inviteMessage : undefined,
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
      const joined = await tables.joinTable({
        userId: req.auth!.userId,
        displayName: String(req.body?.displayName ?? req.auth!.email.split('@')[0]),
        tableId: String(req.body?.tableId ?? ''),
        inviteId: String(req.body?.inviteId ?? ''),
        token: String(req.body?.token ?? ''),
        sessionEmail: req.auth!.email,
      });
      res.json({
        tableId: joined.table.id,
        version: joined.table.version,
        state: joined.table.state,
        memberPersonId: joined.memberPersonId,
      });
    } catch (err) {
      if (respondPeopleAuthError(res, err)) {
        return;
      }
      res.status(400).json({ error: err instanceof Error ? err.message : 'Join failed' });
    }
  });

  router.post('/:tableId/request-access', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const result = await tables.requestTableAccess({
        tableId: req.params.tableId!,
        userId: req.auth!.userId,
        displayName: String(req.body?.displayName ?? req.auth!.email.split('@')[0]),
        sessionEmail: req.auth!.email,
      });
      res.status(201).json(result);
    } catch (err) {
      if (respondPeopleAuthError(res, err)) {
        return;
      }
      res.status(400).json({ error: err instanceof Error ? err.message : 'Request failed' });
    }
  });

  router.post('/:tableId/requests/:requestId/approve', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const result = await tables.approveJoinRequest({
        tableId: req.params.tableId!,
        requestId: req.params.requestId!,
        userId: req.auth!.userId,
        sessionEmail: req.auth!.email,
      });
      res.json(result);
    } catch (err) {
      if (respondPeopleAuthError(res, err)) {
        return;
      }
      res.status(400).json({ error: err instanceof Error ? err.message : 'Approve failed' });
    }
  });

  router.post('/:tableId/requests/:requestId/deny', requireAuth, async (req: AuthedRequest, res) => {
    try {
      await tables.denyJoinRequest({
        tableId: req.params.tableId!,
        requestId: req.params.requestId!,
        userId: req.auth!.userId,
        sessionEmail: req.auth!.email,
      });
      res.json({ ok: true });
    } catch (err) {
      if (respondPeopleAuthError(res, err)) {
        return;
      }
      res.status(400).json({ error: err instanceof Error ? err.message : 'Deny failed' });
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
      if (respondTableServiceError(res, err)) {
        return;
      }
      const message = err instanceof Error ? err.message : 'Action failed';
      const status = message.includes('Stale') ? 409 : 400;
      res.status(status).json({ error: message });
    }
  });

  return router;
}
