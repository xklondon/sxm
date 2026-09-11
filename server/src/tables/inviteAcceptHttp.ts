import type { Request, Response } from 'express';
import type { Server as SocketServer } from 'socket.io';
import {
  buildClearSessionCookieHeader,
  buildSessionCookieHeader,
  resolveRequestOrigin,
} from '../auth/cookies.js';
import {
  buildClearPendingInviteCookieHeader,
  buildInviteLoginRedirect,
  buildInviteResumePath,
  buildPendingInviteCookieHeader,
} from '../auth/pendingInviteCookie.js';
import { logInviteAuth } from '../auth/inviteAuthLog.js';
import type { TableService } from './service.js';
import { broadcastTableUpdate } from './broadcast.js';

export function redirectInviteError(
  res: Response,
  origin: string,
  message: string,
  tableId: string | null,
  options?: { clearPending?: boolean },
): void {
  const cookies: string[] = [];
  if (options?.clearPending) {
    cookies.push(buildClearPendingInviteCookieHeader());
  }
  if (cookies.length > 0) {
    res.setHeader('Set-Cookie', cookies);
  }
  const query = tableId
    ? `?table=${encodeURIComponent(tableId)}&inviteError=${encodeURIComponent(message)}`
    : `?inviteError=${encodeURIComponent(message)}`;
  res.redirect(`${origin}/${query}`);
}

export async function completeInviteAcceptRedirect(
  res: Response,
  req: Request,
  tables: TableService,
  io: SocketServer,
  token: string,
  sessionUserId: string,
  route: string,
  options?: { clearedSession?: boolean },
): Promise<void> {
  const origin = resolveRequestOrigin(req);
  const result = await tables.acceptInviteByToken(token, sessionUserId, {
    clearedSession: options?.clearedSession,
    route,
  });
  const joinedTable = tables.getTableRecord(result.tableId);
  if (joinedTable) {
    broadcastTableUpdate(io, joinedTable.id, joinedTable.version, joinedTable.state, (userId) =>
      tables.getMemberPersonId(joinedTable.id, userId),
    );
  }
  res.setHeader('Set-Cookie', [
    buildClearPendingInviteCookieHeader(),
    buildSessionCookieHeader(result.sessionToken, { req }),
  ]);
  const spectator = result.spectator ? '&spectator=1' : '';
  const redirectTarget = `${origin}/?table=${encodeURIComponent(result.tableId)}${spectator}`;
  logInviteAuth({
    stage: 'join-success',
    tableId: result.tableId,
    callbackTarget: redirectTarget,
  });
  logInviteAuth({
    stage: 'redirect-table',
    tableId: result.tableId,
    callbackTarget: `/?table=${encodeURIComponent(result.tableId)}`,
  });
  res.redirect(redirectTarget);
}

export function redirectUnauthenticatedInviteAccept(
  res: Response,
  req: Request,
  token: string,
  preview: { invitedEmail: string; tableName?: string | null },
  options?: { clearSession?: boolean },
): void {
  const cookies = [buildPendingInviteCookieHeader(token, req)];
  if (options?.clearSession) {
    cookies.unshift(buildClearSessionCookieHeader());
  }
  res.setHeader('Set-Cookie', cookies);
  const origin = resolveRequestOrigin(req);
  const loginUrl = buildInviteLoginRedirect(origin, preview, token);
  logInviteAuth({
    stage: 'auth-required',
    inviteEmail: preview.invitedEmail,
    callbackTarget: buildInviteResumePath(token),
    reason: options?.clearSession ? 'session-email-mismatch' : 'unauthenticated',
  });
  res.redirect(loginUrl);
}
