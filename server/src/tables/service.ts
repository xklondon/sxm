import { randomUUID } from 'node:crypto';
import type { Store, TableInviteRecord, TableRecord } from '../store/types.js';
import { config, getEffectivePublicOrigin } from '../config.js';
import { createInviteToken, createSessionToken } from '../auth/tokens.js';
import { sendTableInviteEmail } from '../email/mailer.js';
import { applyTableAction, createHostedTableState } from './applyAction.js';
import { assertActionAuthorized } from './authority.js';
import type { TableActionType } from './actions.js';
import type { GameState } from '../../../src/types/index.js';
import { assignFirstFreeBox } from './inviteJoin.js';
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

  createTable(userId: string, displayName: string, tableName?: string): TableRecord {
    this.people.assertCanOwnTables(userId);
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
      hostUserId: userId,
      name: tableName?.trim() || 'SXMCARDS Table',
      state,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.store.createTable(record);
    this.store.addMember({
      tableId: id,
      userId,
      personId,
      role: 'host',
      joinedAt: now,
    });
    return record;
  }

  getTableForUser(tableId: string, userId: string): TableRecord {
    const table = this.store.getTable(tableId);
    if (!table) {
      throw new Error('Table not found');
    }
    const member = this.store.getMember(tableId, userId);
    if (!member) {
      throw new Error('Not a member of this table');
    }
    return table;
  }

  joinTable(params: {
    userId: string;
    displayName: string;
    tableId: string;
    inviteId: string;
    token: string;
  }): TableRecord {
    const invite = this.store.getInvite(params.tableId, params.inviteId);
    if (!invite || invite.token !== params.token) {
      throw new Error('Invalid invite');
    }
    return this.joinWithInvite({
      userId: params.userId,
      displayName: params.displayName,
      invite,
    }).table;
  }

  previewInviteByToken(token: string): {
    invitedEmail: string;
    invitedName: string;
    tableId: string;
    tableName: string;
  } {
    const invite = this.requireValidInvite(token);
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

  lookupInviteTableId(token: string): string | undefined {
    return this.store.getInviteByToken(token)?.tableId;
  }

  acceptInviteByToken(
    token: string,
    sessionUserId?: string,
  ): {
    tableId: string;
    sessionToken: string;
    boxAssigned: boolean;
    spectator: boolean;
  } {
    const invite = this.requireValidInvite(token);
    const normalizedEmail = invite.invitedEmail.trim().toLowerCase();

    let userId = sessionUserId;
    if (userId) {
      const user = this.store.getUserById(userId);
      if (!user || user.email !== normalizedEmail) {
        userId = undefined;
      }
    }
    if (!userId) {
      const inviter = this.store.getUserById(invite.inviterUserId);
      this.people.ensureInvitedPersonForTable({
        email: normalizedEmail,
        displayName: invite.invitedName,
        inviterEmail: inviter?.email ?? 'host',
        role: 'player',
      });
      const user =
        this.store.getUserByEmail(normalizedEmail) ??
        this.store.createUser(normalizedEmail, invite.invitedName);
      userId = user.id;
      this.people.ensurePersonOnLogin(normalizedEmail, userId);
    }

    const joined = this.joinWithInvite({
      userId,
      displayName: invite.invitedName || normalizedEmail.split('@')[0]!,
      invite,
    });

    const sessionToken = createSessionToken({ userId, email: normalizedEmail });
    return {
      tableId: invite.tableId,
      sessionToken,
      boxAssigned: joined.boxAssigned,
      spectator: joined.spectator,
    };
  }

  private requireValidInvite(token: string): TableInviteRecord {
    const invite = this.store.getInviteByToken(token);
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

  private joinWithInvite(params: {
    userId: string;
    displayName: string;
    invite: TableInviteRecord;
  }): { table: TableRecord; boxAssigned: boolean; spectator: boolean } {
    const table = this.store.getTable(params.invite.tableId);
    if (!table) {
      throw new Error('Table not found');
    }

    this.people.assertCanJoinTable(params.userId, params.invite);

    let state = table.state;
    let personId = this.store.getMember(params.invite.tableId, params.userId)?.personId;
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
        userId: params.userId,
        personId,
        role: 'player',
        joinedAt: new Date().toISOString(),
      });
    }

    const boxResult = assignFirstFreeBox(state, personId);
    state = boxResult.state;
    boxAssigned = boxResult.boxAssigned;
    spectator = boxResult.spectator;

    log.info('inviteJoinComplete', {
      tableId: params.invite.tableId,
      userId: params.userId,
      personId,
      boxAssigned,
      spectator,
      assignedSlot: getAssignedSlotForPerson(state, personId),
    });

    this.store.updateTable(params.invite.tableId, state, table.version + 1);
    this.store.updateInviteStatus(params.invite.tableId, params.invite.id, 'accepted');

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
  }): Promise<{ inviteId: string; joinUrl: string; emailSent: boolean }> {
    this.people.assertCanInvite(params.userId);
    const table = this.getTableForUser(params.tableId, params.userId);
    if (table.hostUserId !== params.userId) {
      const member = this.store.getMember(params.tableId, params.userId);
      if (member?.role !== 'host') {
        throw new Error('Only host can invite');
      }
    }
    const invitedEmail = params.invitedEmail.trim().toLowerCase();
    const inviteId = randomUUID();
    const token = createInviteToken();
    const now = new Date().toISOString();
    this.store.createInvite({
      id: inviteId,
      tableId: params.tableId,
      token,
      invitedEmail,
      invitedName: params.invitedName.trim(),
      inviterUserId: params.userId,
      status: 'pending',
      createdAt: now,
      expiresAt: new Date(Date.now() + config.inviteTtlMs).toISOString(),
    });
    const joinUrl = `${getEffectivePublicOrigin().replace(/\/$/, '')}/api/tables/invites/accept?token=${encodeURIComponent(token)}`;
    const inviter = this.store.getUserById(params.userId);
    let emailSent = false;
    if (invitedEmail) {
      const existingPerson = this.store.getPersonByEmail(invitedEmail);
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
  }): Promise<{ inviteId: string; joinUrl: string; personId: string; emailSent: boolean }> {
    const inviter = this.store.getUserById(params.userId);
    const normalizedEmail = params.email.trim().toLowerCase();
    const person = this.people.ensureInvitedPersonForTable({
      email: normalizedEmail,
      displayName: params.displayName,
      inviterEmail: inviter?.email ?? 'admin',
      role: params.role,
    });
    const { inviteId, joinUrl, emailSent } = await this.createInvite({
      tableId: params.tableId,
      userId: params.userId,
      invitedEmail: normalizedEmail,
      invitedName: params.displayName,
    });
    return { inviteId, joinUrl, personId: person.id, emailSent };
  }

  applyAction(
    tableId: string,
    userId: string,
    action: TableActionType,
    payload: Record<string, unknown>,
    expectedVersion?: number,
  ): { state: GameState; version: number } {
    const table = this.getTableForUser(tableId, userId);
    if (expectedVersion !== undefined && expectedVersion !== table.version) {
      throw new Error('Stale table version');
    }
    const member = this.store.getMember(tableId, userId)!;
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
