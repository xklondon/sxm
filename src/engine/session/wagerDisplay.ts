import type { GameState } from '../../types';

/** Honor-system wager label from table agreement (e.g. "$5", "dinner") — not chip count. */
export function getTableWagerDisplay(state: GameState): string {
  const stake = state.tableMeta.agreement?.stakeDescription?.trim();
  return stake && stake.length > 0 ? stake : 'Friendly game';
}
