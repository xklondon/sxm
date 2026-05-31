/** Shared DOM anchors — Full Table and Card View use the same slots. */
export const BLACKJACK_TABLE_LAYOUT = {
  feltMain: 'bj-casino__felt-main',
  dealerBlock: 'dealer-block',
  dealerActions: 'dealer-block__actions',
  accountsPanel: 'bj-accounts-panel',
  chipTrayWrap: 'bj-casino__tray-wrap',
  centerStatus: 'bj-center-status',
} as const;

export type BlackjackTableLayoutSlot = keyof typeof BLACKJACK_TABLE_LAYOUT;
