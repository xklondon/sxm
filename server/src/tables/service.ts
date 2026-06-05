import { randomUUID } from 'node:crypto';
import type { Store, TableInviteRecord, TableRecord } from '../store/types.js';
import { config, getEffectivePublicOrigin } from '../config.js';
import { createInviteToken, createSessionToken } from '../auth/tokens.js';
import { sendTableInviteEmail } from '../email/mailer.js';
import { applyTableAction, createHostedTableState } from './applyAction.js';
import { assertActionAuthorized } from './authority.js';
import type { TableActionType } from './actions.js';
import type { GameState } from '../../../src/types/index.js';
import { finalizeInviteJoinAtTable } from './inviteJoin.js';
import { getAssignedSlotForPerson } from '../../../src/engine/session/playerAssignment.js';
import { log } from '../../../src/utils/logger.js';
import { ensureTableOwnerPersonBankroll } from '../../../src/engine/session/ownerBankroll.js';
import { setTableOwner } from '../../../src/engine/session/invites.js';
import { assignBankBot } from '../../../src/engine/session/boxOps.js';
import { addSeatAtTable } from '../../../src/engine/session/table.js';
import {
  getStartingChipsBank,
  getStartingChipsEachSeat,
} from '../../../src/engine/session/tokens.js';

import type { PeopleService } from '../people/service.js';

export class TableService {
  constructor(
    private readonly store: Store,
    private readonly people: PeopleService,
  ) {}

  async createTable(
    userId: string,
    displayName: string,
    tableName?: string,
    sessionEmail?: string,
  ): Promise<TableRecord> {
    const user = await this.people.resolveSessionUser(userId, sessionEmail, 'POST /api/tables');
    await this.people.assertCanOwnTables(user.id, sessionEmail, 'POST /api/tables');
    let state = createHostedTableState(displayName);
    state = setTableOwner(state, displayName, '');
    state = ensureTableOwnerPersonBankroll(state);
    const bankChips = getStartingChipsBank(state);
    const seatChips = getStartingChipsEachSeat(state);
    state = assignBankBot(state, bankChips > 0 ? bankChips : seatChips);

    const personId = state.tableMeta.ownerPersonId!;
    const id = state.session.id;
    const now = new Date().toISOString();
    const record: TableRecord = {
      id,
      hostUserId: user.id,
      name: tableName?.trim() || 'SXMCARDS Table',
      state,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.store.createTable(record);
    this.store.addMember({
      tableId: id,
      userId: user.id,
      personId,
      role: 'host',
      joinedAt: now,
    });
    return record;
  }

  async getTableForUser(
    tableId: string,
    userId: string,
    sessionEmail?: string,
  ): Promise<TableRecord> {
    const resolvedUserId = sessionEmail
      ? (await this.people.resolveSessionUser(userId, sessionEmail, 'GET /api/tables/:id')).id
      : userId;
    const table = this.store.getTable(tableId);
    if (!table) {
      throw new Error('Table not found');
    }
    const member = this.store.getMember(tableId, resolvedUserId);
    if (!member) {
      throw new Error('Not a member of this table');
    }
    return table;
  }

  async joinTable(params: {
    userId: string;
    displayName: string;
    tableId: string;
    inviteId: string;
    token: string;
    sessionEmail?: string;
  }): Promise<TableRecord> {
    const invite = await this.store.getInvite(params.tableId, params.inviteId);
    if (!invite || invite.token !== params.token) {
      throw new Error('Invalid invite');
    }
    return (
      await this.joinWithInvite({
        userId: params.userId,
        displayName: params.displayName,
        invite,
        sessionEmail: params.sessionEmail,
      })
    ).table;
  }

  async previewInviteByToken(token: string): Promise<{
    invitedEmail: string;
    invitedName: string;
    tableId: string;
    tableName: string;
  }> {
    const invite = await this.requireValidInvite(token);
    const table = this.store.getTable(invite.tableId);
    if (!table) {
      throw new Error('Table not found');
    }
    return {
      invitedEmail: invite.invitedEmail,
      invitedName: invite.invitedName,
      tableId: invite.tableId,
      tableName: table.name,
    };
  }

  async lookupInviteTableId(token: string): Promise<string | undefined> {
    return (await this.store.getInviteByToken(token))?.tableId;
  }

  async acceptInviteByToken(
    token: string,
    sessionUserId?: string,
  ): Promise<{
    tableId: string;
    sessionToken: string;
    boxAssigned: boolean;
    spectator: boolean;
  }> {
    const invite = await this.requireValidInvite(token);
    const normalizedEmail = invite.invitedEmail.trim().toLowerCase();

    let userId = sessionUserId;
    if (userId) {
      try {
        const user = await this.people.resolveSessionUser(
          userId,
          normalizedEmail,
          'GET /api/tables/invites/accept',
        );
        userId = user.email === normalizedEmail ? user.id : undefined;
      } catch {
        userId = undefined;
      }
    }
    if (!userId) {
      const inviter = await this.store.getUserById(invite.inviterUserId);
      await this.people.ensureInvitedPersonForTable({
        email: normalizedEmail,
        displayName: invite.invitedName,
        inviterEmail: inviter?.email ?? 'host',
        role: 'player',
      });
      const user =
        (await this.store.getUserByEmail(normalizedEmail)) ??
        (await this.store.createUser(normalizedEmail, invite.invitedName));
      userId = user.id;
      await this.people.ensurePersonOnLogin(normalizedEmail, userId);
    }

    const joined = await this.joinWithInvite({
      userId,
      displayName: invite.invitedName || normalizedEmail.split('@')[0]!,
      invite,
      sessionEmail: normalizedEmail,
    });

    const sessionToken = createSessionToken({ userId, email: normalizedEmail });
    return {
      tableId: invite.tableId,
      sessionToken,
      boxAssigned: joined.boxAssigned,
      spectator: joined.spectator,
    };
  }

  private async requireValidInvite(token: string): Promise<TableInviteRecord> {
    const invite = await this.store.getInviteByToken(token);
    if (!invite) {
      throw new Error('Invalid invite link');
    }
    if (invite.status !== 'pending') {
      throw new Error('Invite already used or revoked');
    }
    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      throw new Error('Invite expired');
    }
    return invite;
  }

  private async joinWithInvite(params: {
    userId: string;
    displayName: string;
    invite: TableInviteRecord;
    sessionEmail?: string;
  }): Promise<{ table: TableRecord; boxAssigned: boolean; spectator: boolean }> {
    const table = this.store.getTable(params.invite.tableId);
    if (!table) {
      throw new Error('Table not found');
    }

    const user = await this.people.resolveSessionUser(
      params.userId,
      params.sessionEmail,
      'POST /api/tables/join',
    );
    await this.people.assertCanJoinTable(
      user.id,
      params.invite,
      params.sessionEmail,
      'POST /api/tables/join',
    );

    let state = table.state;
    let personId = this.store.getMember(params.invite.tableId, user.id)?.personId;
    let boxAssigned = false;
    let spectator = false;

    if (!personId) {
      state = addSeatAtTable(state, {
        displayName: params.displayName,
        controllerName: params.displayName,
        role: 'person',
        startingChips: 0,
      });
      personId = state.session.playerIds[state.session.playerIds.length - 1]!;
      this.store.addMember({
        tableId: params.invite.tableId,
        userId: user.id,
        personId,
        role: 'player',
        joinedAt: new Date().toISOString(),
      });
    }

    const joined = finalizeInviteJoinAtTable(state, personId, params.displayName);
    state = joined.state;
    boxAssigned = joined.boxAssigned;
    spectator = joined.spectator;

    log.info('inviteJoinComplete', {
      tableId: params.invite.tableId,
      userId: user.id,
      personId,
      boxAssigned,
      spectator,
      assignedSlot: getAssignedSlotForPerson(state, personId),
      tableNotice: state.tableMeta.tableNotice?.message ?? null,
    });

    this.store.updateTable(params.invite.tableId, state, table.version + 1);
    await this.store.updateInviteStatus(params.invite.tableId, params.invite.id, 'accepted');

    return {
      table: this.store.getTable(params.invite.tableId)!,
      boxAssigned,
      spectator,
    };
  }

  async createInvite(params: {
    tableId: string;
    userId: string;
    invitedEmail: string;
    invitedName: string;
    sessionEmail?: string;
  }): Promise<{ inviteId: string; joinUrl: string; emailSent: boolean }> {
    const host = await this.people.resolveSessionUser(
      params.userId,
      params.sessionEmail,
      'POST /api/tables/:id/invites',
    );
    await this.people.assertCanInvite(host.id, params.sessionEmail, 'POST /api/tables/:id/invites');
    const table = await this.getTableForUser(params.tableId, host.id, params.sessionEmail);
    if (table.hostUserId !== host.id) {
      const member = this.store.getMember(params.tableId, host.id);
      if (member?.role !== 'host') {
        throw new Error('Only host can invite');
      }
    }
    const invitedEmail = params.invitedEmail.trim().toLowerCase();
    const inviteId = randomUUID();
    const token = createInviteToken();
    const now = new Date().toISOString();
    await this.store.createInvite({
      id: inviteId,
      tableId: params.tableId,
      token,
      invitedEmail,
      invitedName: params.invitedName.trim(),
      inviterUserId: host.id,
      status: 'pending',
      createdAt: now,
      expiresAt: new Date(Date.now() + config.inviteTtlMs).toISOString(),
    });
    const joinUrl = `${getEffectivePublicOrigin().replace(/\/$/, '')}/api/tables/invites/accept?token=${encodeURIComponent(token)}`;
    const inviter = host;
    let emailSent = false;
    if (invitedEmail) {
      const existingPerson = await this.store.getPersonByEmail(invitedEmail);
      // eslint-disable-next-line no-console
      console.log(
        `[SXM][tables] createInvite target=${invitedEmail} registered=${Boolean(existingPerson)} status=${existingPerson?.status ?? 'none'}`,
      );
      await sendTableInviteEmail({
        to: invitedEmail,
        inviterName: inviter?.displayName ?? 'A friend',
        tableName: table.name,
        joinUrl,
      });
      emailSent = true;
    }
    return { inviteId, joinUrl, emailSent };
  }

  async invitePersonByEmail(params: {
    tableId: string;
    userId: string;
    email: string;
    displayName: string;
    role?: import('../store/types.js').PersonRole;
    sessionEmail?: string;
  }): Promise<{ inviteId: string; joinUrl: string; personId: string; emailSent: boolean }> {
    const inviter = await this.people.resolveSessionUser(
      params.userId,
      params.sessionEmail,
      'POST /api/tables/:id/invite-person',
    );
    await this.people.assertCanInvite(
      inviter.id,
      params.sessionEmail,
      'POST /api/tables/:id/invite-person',
    );
    const normalizedEmail = params.email.trim().toLowerCase();
    const person = await this.people.ensureInvitedPersonForTable({
      email: normalizedEmail,
      displayName: params.displayName,
      inviterEmail: inviter.email,
      role: params.role,
    });
    const { inviteId, joinUrl, emailSent } = await this.createInvite({
      tableId: params.tableId,
      userId: inviter.id,
      invitedEmail: normalizedEmail,
      invitedName: params.displayName,
      sessionEmail: params.sessionEmail,
    });
    return { inviteId, joinUrl, personId: person.id, emailSent };
  }

  async applyAction(
    tableId: string,
    userId: string,
    action: TableActionType,
    payload: Record<string, unknown>,
    expectedVersion?: number,
    sessionEmail?: string,
  ): Promise<{ state: GameState; version: number }> {
    const resolvedUserId = sessionEmail
      ? (await this.people.resolveSessionUser(userId, sessionEmail, 'POST /api/tables/:id/actions'))
          .id
      : userId;
    const table = await this.getTableForUser(tableId, userId, sessionEmail);
    if (expectedVersion !== undefined && expectedVersion !== table.version) {
      throw new Error('Stale table version');
    }
    const member = this.store.getMember(tableId, resolvedUserId)!;
    assertActionAuthorized(table.state, {
      tableId,
      userId,
      personId: member.personId,
      action,
      payload,
    });
    const nextState = applyTableAction(table.state, action, payload, member.personId);
    const version = table.version + 1;
    this.store.updateTable(tableId, nextState, version);
    return { state: nextState, version };
  }
}
