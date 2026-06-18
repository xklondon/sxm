import type { BlackjackProtocolPhase } from '../engine/blackjack/protocol';

/** Desktop shell layout bands — drives data-bj-phase on .bj-casino (not inferred from DOM). */
export type BlackjackDesktopLayoutPhase = 'betting' | 'dealing' | 'playing' | 'resolved';

/**
 * Map engine protocol phase → stable desktop shell phase for shared Full Table + Card View slots.
 */
export function getBlackjackDesktopLayoutPhase(
  protocolPhase: BlackjackProtocolPhase,
  gameEnded: boolean,
): BlackjackDesktopLayoutPhase {
  if (gameEnded || protocolPhase === 'round-complete' || protocolPhase === 'banking') {
    return 'resolved';
  }
  if (protocolPhase === 'betting') {
    return 'betting';
  }
  if (protocolPhase === 'dealing' || protocolPhase === 'insurance') {
    return 'dealing';
  }
  return 'playing';
}
