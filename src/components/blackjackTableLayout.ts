import { TABLE_UX } from './tableUxContract';

/** Shared DOM anchors — Full Table and Card View use the same slots. */
export const BLACKJACK_TABLE_LAYOUT = {
  feltMain: 'bj-casino__felt-main',
  dealerBlock: 'dealer-block',
  dealerActions: 'dealer-block__actions',
  accountsPanel: 'bj-accounts-panel',
  chipTrayWrap: 'bj-casino__tray-wrap',
  dealerCommand: 'dealer-block__command',
  /** Canonical table surface / seat / side-rail class contract (see tableUxContract.ts). */
  ...TABLE_UX,
} as const;

export type BlackjackTableLayoutSlot = keyof typeof BLACKJACK_TABLE_LAYOUT;
