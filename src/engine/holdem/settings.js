/** Texas Hold'em table rules — imported by engine, not hard-coded in UI. */
export const DEFAULT_HOLDEM_SETTINGS = {
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
export function mergeHoldemSettings(partial) {
    return { ...DEFAULT_HOLDEM_SETTINGS, ...partial };
}
export function holdemBlindsFromSettings(settings) {
    return { smallBlind: settings.smallBlind, bigBlind: settings.bigBlind };
}
