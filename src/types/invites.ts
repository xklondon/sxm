/** Invite status for table magic-link flow (local scaffold — no backend email yet). */
export type InviteStatus = 'pending' | 'accepted' | 'revoked';

export interface TableInviteRecord {
  inviteId: string;
  tableId: string;
  invitedEmail: string;
  invitedName: string;
  invitedBy: string;
  inviteStatus: InviteStatus;
  canInviteOthers: boolean;
  createdAt: string;
  acceptedAt?: string;
  /** Opaque token for magic-link validation (local only). */
  token: string;
  note?: string;
}

export interface JoinTableParams {
  tableId: string;
  inviteId: string;
  token: string;
}
