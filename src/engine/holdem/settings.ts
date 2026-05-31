/** Texas Hold'em table rules — imported by engine, not hard-coded in UI. */

export type HoldemStartingDealerMode = 'setup-assigned' | 'rotate-each-hand';
export type HoldemShowdownMode = 'standard' | 'immediate-on-fold';

export interface HoldemSettings {
  smallBlind: number;
  bigBlind: number;
  minRaise: number;
  allowAllIn: boolean;
  allowSidePots: boolean;
  startingDealerMode: HoldemStartingDealerMode;
  showdownMode: HoldemShowdownMode;
  minPlayers: number;
  maxPlayers: number;
}

export const DEFAULT_HOLDEM_SETTINGS: HoldemSettings = {
  smallBlind: 5,
  bigBlind: 10,
  minRaise: 10,
  allowAllIn: false,
  allowSidePots: false,
  startingDealerMode: 'setup-assigned',
  showdownMode: 'immediate-on-fold',
  minPlayers: 2,
  maxPlayers: 9,
};

export function mergeHoldemSettings(partial?: Partial<HoldemSettings>): HoldemSettings {
  return { ...DEFAULT_HOLDEM_SETTINGS, ...partial };
}

export function holdemBlindsFromSettings(settings: HoldemSettings): {
  smallBlind: number;
  bigBlind: number;
} {
  return { smallBlind: settings.smallBlind, bigBlind: settings.bigBlind };
}
