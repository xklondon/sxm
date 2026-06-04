export const TABLE_ACTIONS = [
  'createTable',
  'joinTable',
  'leaveTable',
  'assignBox',
  'placeBet',
  'retractChip',
  'clearBet',
  'shuffleToStart',
  'dealCards',
  'hit',
  'stand',
  'double',
  'split',
  'takeInsurance',
  'declineInsurance',
  'takeEvenMoney',
  'waitFor3to2',
  'nextRound',
  'addGameToPersonalLedger',
  'assignChips',
  'resetTable',
] as const;

export type TableActionType = (typeof TABLE_ACTIONS)[number];

export interface TableActionRequest {
  type: TableActionType;
  payload?: Record<string, unknown>;
  expectedVersion?: number;
}
