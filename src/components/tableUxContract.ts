/** Shared CSS class contract for blackjack table UX unification. */
export const TABLE_UX = {
  surface: 'bj-table-surface',
  rail: 'bj-table-rail',
  /** Desktop Full Table + Card View share one rail-wrap shell for size/proportions. */
  desktopTableShell: 'bj-table-desktop-shell',
  columnSurface: 'bj-table-column-surface',
  seatShell: 'bj-seat-shell',
  betZone: 'bj-bet-zone',
  playerActions: 'bj-player-actions',
  sideRailShell: 'bj-side-rail-shell',
  sideRailPlacement: 'bj-casino__this-table',
  felt: 'bj-casino__felt',
  phoneView: 'bj-phone-view',
  /** Page title — centered in toolbar, outside felt/rail border. */
  pageTitle: 'bj-casino__title',
  /** Card View action row without panel chrome (buttons only). */
  cardViewBareActions: 'bj-phone-view__action-bar--bare',
} as const;
