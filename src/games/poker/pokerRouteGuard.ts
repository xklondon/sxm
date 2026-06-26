import type { GameState } from '../../types';
import { isHoldemTable } from '../../engine/session';

const POKER_ROUTE_TAG = '[SXM Poker route]';

/** Dev-only guard: holdem tables must render PokerPanel (never HoldemPanel / BlackjackPanel). */
export function assertHoldemUsesPokerPanel(state: GameState): void {
  if (!import.meta.env.DEV || !isHoldemTable(state)) {
    return;
  }
  if (state.session.gameType !== 'texas-holdem') {
    console.warn(
      `${POKER_ROUTE_TAG} holdem identity with session.gameType=${state.session.gameType} — expected texas-holdem`,
    );
  }
}

export function logHoldemPokerPanelMounted(state: GameState): void {
  if (!import.meta.env.DEV || !isHoldemTable(state)) {
    return;
  }
  console.info(`${POKER_ROUTE_TAG} PokerPanel mounted for holdem table ${state.session.id}`);
}
