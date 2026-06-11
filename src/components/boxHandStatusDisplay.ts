import type { BlackjackOutcome, BlackjackRound } from '../types/blackjack';
import { isRoundCompletePhase } from './blackjackViewPhase';
import type { BlackjackProtocolPhase } from '../engine/blackjack/protocol';

export type BoxHandResultStatus = 'win' | 'bust' | 'push';

/** Map settled round outcome to compact box status marker. */
export function mapOutcomeToHandResultStatus(
  outcome: BlackjackOutcome | undefined,
): BoxHandResultStatus | null {
  if (!outcome) {
    return null;
  }
  switch (outcome) {
    case 'win':
    case 'blackjack-win':
      return 'win';
    case 'loss':
      return 'bust';
    case 'push':
    case 'blackjack-push':
      return 'push';
    default:
      return null;
  }
}

export function shouldShowBoxHandResultMarkers(options: {
  awaitingNextRound: boolean;
  protocolPhase: BlackjackProtocolPhase;
  round: BlackjackRound | null | undefined;
}): boolean {
  const { awaitingNextRound, protocolPhase, round } = options;
  return Boolean(
    awaitingNextRound || round?.isSettled || isRoundCompletePhase(protocolPhase),
  );
}

export function resolveBoxHandResultStatus(
  round: BlackjackRound | null | undefined,
  handKey: string | undefined,
  showResults: boolean,
): BoxHandResultStatus | null {
  if (!showResults || !round || !handKey) {
    return null;
  }
  const hand = round.playerHands[handKey];
  if (!hand || hand.currentBet <= 0) {
    return null;
  }
  return mapOutcomeToHandResultStatus(round.outcomes[handKey]);
}

/** Compact player-box result text — same slot as live-play BUST label. */
export function handResultStatusText(status: BoxHandResultStatus): string {
  switch (status) {
    case 'win':
      return 'WIN';
    case 'bust':
      return 'BUST';
    case 'push':
      return 'EVEN';
  }
}
