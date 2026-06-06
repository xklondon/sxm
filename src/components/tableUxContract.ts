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
  /** Bank value + bank chip balance near dealer zone. */
  tableInfoBar: 'bj-table-info-bar',
  /** Canonical felt zones — stable shell structure across phases. */
  tableZoneDealer: 'bj-table-zone--dealer',
  tableZoneSummary: 'bj-table-zone--summary',
  tableZoneHero: 'bj-table-zone--hero',
  tableZoneActions: 'bj-table-zone--actions',
  tableZonePlay: 'bj-table-zone--play',
  tableZoneBoxes: 'bj-table-zone--boxes',
  tableZoneBottom: 'bj-table-zone--bottom',
  /** Full Table visible card fan (shared projection with Card View). */
  arcCards: 'bj-arc__cards',
  cardsFan: 'bj-cards-fan',
  /** Reserved tray slot when betting controls are hidden. */
  trayReserved: 'bj-casino__tray--reserved',
  actionsPlaceholder: 'bj-table-zone__actions-placeholder',
  summaryPlaceholder: 'bj-table-zone__summary-placeholder',
  /** Bank info grouped under dealer cards (not outer header). */
  dealerBankInfo: 'bj-table-info-bar--dealer',
  /** Card View — bank value/chips under page title, outside felt. */
  headerBankInfo: 'bj-table-info-bar--header',
  /** Table shell header — toolbar + centered bank info (inside rail-wrap). */
  tableHeader: 'bj-casino__table-header',
  /** Full Table arc seat layout: value → cards → chips. */
  fullArcBox: 'bj-phone-view__mini-hand--full-arc',
  /** Card View fixed grid layout — see bj-card-layout.css. */
  cardLayout: 'bj-card-layout',
  cardLayoutDealer: 'bj-card-layout__dealer',
  cardLayoutSummary: 'bj-card-layout__summary',
  cardLayoutHero: 'bj-card-layout__hero',
  cardLayoutActions: 'bj-card-layout__actions',
  cardLayoutBoxes: 'bj-card-layout__boxes',
  cardLayoutTray: 'bj-card-layout__tray',
  cardLayoutSummaryPlaceholder: 'bj-card-layout__summary-placeholder',
  cardLayoutActionsPlaceholder: 'bj-card-layout__actions-placeholder',
  cardLayoutTrayPlaceholder: 'bj-card-layout__tray-placeholder',
  /** Card View compact bottom boxes — smaller than Full Table arc seats. */
  cardViewCompactBox: 'bj-phone-view__mini-hand--card-compact',
  /** Card View box column: value above, tile, stake below. */
  cardViewBoxColumn: 'bj-phone-view__mini-hand-column',
  cardViewBoxStake: 'bj-phone-view__box-stake',
  cardViewBoxStakeLabel: 'bj-phone-view__box-stake-label',
  cardViewBoxValueAbove: 'bj-phone-view__box-value--above',
  /** Compact hero total badge in Card View grid. */
  cardViewTotalCompact: 'bj-phone-view__total--compact',
  /** Compact secondary action buttons in Card View. */
  cardViewActionCompact: 'bj-phone-view__action-bar-extra--compact',
  /** Dealer primary action always mounted in action slot. */
  dealerActionReserved: 'dealer-block__action--reserved',
  cardViewBoxesSlot: 'bj-phone-view__slot--boxes',
  /** @deprecated Use cardLayoutBoxes — kept for migration reads only. */
  cardViewBoxesDock: 'bj-phone-view__boxes-dock',
  /** @deprecated Use cardLayout — kept for migration reads only. */
  cardViewPhased: 'bj-phone-view--phased',
  stakeSlotReserved: 'bj-phone-view__mini-stake-slot--reserved',
} as const;
