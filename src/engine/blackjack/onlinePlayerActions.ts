/** Online hit/stand/double/split — server resolves handKey from authoritative state. */
export const ONLINE_PLAYER_TURN_ACTIONS = ['hit', 'stand', 'double', 'split'] as const;

export type OnlinePlayerTurnAction = (typeof ONLINE_PLAYER_TURN_ACTIONS)[number];

export function isOnlinePlayerTurnAction(action: string): action is OnlinePlayerTurnAction {
  return (ONLINE_PLAYER_TURN_ACTIONS as readonly string[]).includes(action);
}

/** Payload for player-turn actions — omit handKey online to avoid stale-turn drift. */
export function playerTurnActionPayload(
  isOnline: boolean,
  handKey: string,
): Record<string, unknown> {
  if (isOnline) {
    return {};
  }
  return { handKey };
}
