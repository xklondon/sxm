/** Online hit/stand/double/split — server resolves handKey from authoritative state. */
export const ONLINE_PLAYER_TURN_ACTIONS = ['hit', 'stand', 'double', 'split'];
export function isOnlinePlayerTurnAction(action) {
    return ONLINE_PLAYER_TURN_ACTIONS.includes(action);
}
/** Payload for player-turn actions — omit handKey online to avoid stale-turn drift. */
export function playerTurnActionPayload(isOnline, handKey) {
    if (isOnline) {
        return {};
    }
    return { handKey };
}
