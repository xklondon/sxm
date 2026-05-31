export type PlayerType = 'real' | 'virtual';

export type PlayerRole = 'person' | 'box' | 'bank';

export type VirtualPlayerStyle = 'conservative' | 'normal' | 'aggressive' | 'random';

export type PlayerStatus =
  | 'active'
  | 'folded'
  | 'busted'
  | 'stood'
  | 'all-in'
  | 'out';

export interface Player {
  id: string;
  displayName: string;
  /** Who controls this seat at the table (defaults to displayName). */
  controllerName: string;
  /** person = bankroll owner; box = playing position; bank = house bankroll. */
  role?: PlayerRole;
  /** For box positions — ledger bankroll participant id. */
  bankrollOwnerId?: string;
  playerType: PlayerType;
  virtualStyle?: VirtualPlayerStyle;
  startingBalance: number;
  currentBet: number;
  cardIds: string[];
  status: PlayerStatus;
}

export function createPlayer(
  id: string,
  displayName: string,
  playerType: PlayerType,
  startingBalance: number,
  virtualStyle?: VirtualPlayerStyle,
  controllerName?: string,
  role: PlayerRole = 'person',
  bankrollOwnerId?: string,
): Player {
  const trimmed = displayName.trim();
  return {
    id,
    displayName: trimmed,
    controllerName: (controllerName?.trim() || trimmed),
    role,
    bankrollOwnerId,
    playerType,
    virtualStyle: playerType === 'virtual' ? (virtualStyle ?? 'normal') : undefined,
    startingBalance,
    currentBet: 0,
    cardIds: [],
    status: 'active',
  };
}
