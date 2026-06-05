/** Blackjack table rules — imported by engine, not hard-coded in UI. */
import { LAS_VEGAS_PROTOCOL, protocolToBlackjackSettings } from './protocols';
/** Defaults from active Las Vegas protocol — single source of truth. */
export const DEFAULT_BLACKJACK_SETTINGS = protocolToBlackjackSettings(LAS_VEGAS_PROTOCOL);
export function mergeBlackjackSettings(partial) {
    return { ...DEFAULT_BLACKJACK_SETTINGS, ...partial };
}
