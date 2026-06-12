import type { GameState } from './types';

export type TableLeaveScreen = 'lobby' | 'start' | 'setup' | 'table' | 'people';

/** True when leaving the table could discard unsaved local progress. */
export function shouldConfirmLeaveActiveTable(
  screen: TableLeaveScreen,
  gameState: GameState | null,
): boolean {
  return screen === 'table' && gameState !== null;
}
