/** Table admin permissions — stored locally per table session. */
export interface TableAdminSettings {
  allowInvitedPlayersToInvite: boolean;
  allowInvitedPlayersToStartTables: boolean;
  ownerOnlyCanAssignChips: boolean;
  ownerOnlyCanChangeProtocol: boolean;
  ownerOnlyCanChangeDesign: boolean;
}

export const DEFAULT_TABLE_ADMIN_SETTINGS: TableAdminSettings = {
  allowInvitedPlayersToInvite: false,
  allowInvitedPlayersToStartTables: false,
  ownerOnlyCanAssignChips: true,
  ownerOnlyCanChangeProtocol: true,
  ownerOnlyCanChangeDesign: true,
};
