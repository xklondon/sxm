/** Shared CSS class contract for blackjack table UX unification. */
export const TABLE_UX = {
  surface: 'bj-table-surface',
  rail: 'bj-table-rail',
  /** Desktop Full Table + Card View share one rail-wrap shell for size/proportions. */
  desktopTableShell: 'bj-table-desktop-shell',
  /** Desktop row wrapper: table shell + optional right-docked side rail. */
  desktopStage: 'bj-casino__desktop-stage',
  columnSurface: 'bj-table-column-surface',
  seatShell: 'bj-seat-shell',
  betZone: 'bj-bet-zone',
  playerActions: 'bj-player-actions',
  sideRailShell: 'bj-side-rail-shell',
  sideRailPlacement: 'bj-casino__this-table',
  /** Desktop side rail docks to canvas right edge (flex column, not felt overlay). */
  sideRailDock: 'bj-casino__this-table--dock',
  felt: 'bj-casino__felt',
  phoneView: 'bj-phone-view',
  /** Page title — centered in toolbar, outside felt/rail border. */
  pageTitle: 'bj-casino__title',
  /** Card View action row without panel chrome (buttons only). */
  cardViewBareActions: 'bj-phone-view__action-bar--bare',
  /** Pointer/touch chip drop markers on player boxes. */
  chipDropSlot: 'data-chip-drop-slot',
  chipDropBox: 'data-chip-drop-box',
} as const;
