/**
 * Stable named layout areas for Blackjack table views (Stitch Master contract).
 * Use data-sxm-section + class for tests and future layout tooling.
 */
export const SXM_LAYOUT = {
  layoutRoot: 'sxm-layout-root',
  appHeader: 'sxm-app-header',
  viewSwitcher: 'sxm-view-switcher',
  gameTitle: 'sxm-game-title',
  userMenu: 'sxm-user-menu',
  balanceDisplay: 'sxm-balance-display',
  tableShell: 'sxm-table-shell',
  dealerZone: 'sxm-dealer-zone',
  bankSummary: 'sxm-bank-summary',
  statusZone: 'sxm-status-zone',
  heroZone: 'sxm-hero-zone',
  heroCards: 'sxm-hero-cards',
  handTotal: 'sxm-hand-total',
  actionZone: 'sxm-action-zone',
  primaryActions: 'sxm-primary-actions',
  secondaryActions: 'sxm-secondary-actions',
  playerBoxesZone: 'sxm-player-boxes-zone',
  playerBox: 'sxm-player-box',
  playerBoxValue: 'sxm-player-box-value',
  playerBoxCards: 'sxm-player-box-cards',
  playerBoxBet: 'sxm-player-box-bet',
  chipTray: 'sxm-chip-tray',
  playerBalance: 'sxm-player-balance',
  rightSidePanel: 'sxm-right-side-panel',
  tableInfoPanel: 'sxm-table-info-panel',
  playersPanel: 'sxm-players-panel',
  ledgerPanel: 'sxm-ledger-panel',
  settingsPanel: 'sxm-settings-panel',
} as const;

export type SxmLayoutSection = (typeof SXM_LAYOUT)[keyof typeof SXM_LAYOUT];

/** Sections required in every blackjack view mode markup snapshot. */
export const SXM_CORE_SECTIONS: readonly SxmLayoutSection[] = [
  SXM_LAYOUT.layoutRoot,
  SXM_LAYOUT.appHeader,
  SXM_LAYOUT.viewSwitcher,
  SXM_LAYOUT.balanceDisplay,
  SXM_LAYOUT.tableShell,
  SXM_LAYOUT.dealerZone,
  SXM_LAYOUT.statusZone,
  SXM_LAYOUT.heroZone,
  SXM_LAYOUT.actionZone,
  SXM_LAYOUT.primaryActions,
  SXM_LAYOUT.secondaryActions,
  SXM_LAYOUT.playerBoxesZone,
  SXM_LAYOUT.chipTray,
  SXM_LAYOUT.playerBalance,
] as const;

/** Sections required in card-view modes. */
export const SXM_CARD_VIEW_SECTIONS: readonly SxmLayoutSection[] = [
  ...SXM_CORE_SECTIONS,
  SXM_LAYOUT.heroCards,
  SXM_LAYOUT.handTotal,
  SXM_LAYOUT.playerBox,
] as const;

/** Sections required in full-table modes (hero zone is a reserved slot). */
export const SXM_FULL_TABLE_SECTIONS: readonly SxmLayoutSection[] = [
  ...SXM_CORE_SECTIONS,
  SXM_LAYOUT.bankSummary,
  SXM_LAYOUT.userMenu,
  SXM_LAYOUT.rightSidePanel,
  SXM_LAYOUT.tableInfoPanel,
  SXM_LAYOUT.playersPanel,
  SXM_LAYOUT.playerBox,
] as const;

export function sxmSectionProps(
  section: SxmLayoutSection,
  ...extraClasses: (string | false | null | undefined)[]
): {
  className: string;
  'data-sxm-section': SxmLayoutSection;
} {
  const className = [section, ...extraClasses].filter(Boolean).join(' ');
  return { className, 'data-sxm-section': section };
}
