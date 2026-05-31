/** Hand key helpers for split hands: `playerId:handIndex`. */

export function blackjackHandKey(playerId: string, handIndex = 0): string {
  return `${playerId}:${handIndex}`;
}

export function parseBlackjackHandKey(key: string): { playerId: string; handIndex: number } {
  const colon = key.lastIndexOf(':');
  if (colon === -1) {
    return { playerId: key, handIndex: 0 };
  }
  return {
    playerId: key.slice(0, colon),
    handIndex: Number.parseInt(key.slice(colon + 1), 10) || 0,
  };
}

export function listHandKeysForPlayer(
  playerHands: Record<string, unknown>,
  playerId: string,
): string[] {
  return Object.keys(playerHands)
    .filter((k) => parseBlackjackHandKey(k).playerId === playerId)
    .sort((a, b) => parseBlackjackHandKey(a).handIndex - parseBlackjackHandKey(b).handIndex);
}

export function countSplitsForPlayer(
  playerHands: Record<string, unknown>,
  playerId: string,
): number {
  return listHandKeysForPlayer(playerHands, playerId).length - 1;
}
