import type { BlackjackRound } from '../types/blackjack';
import { netChipsForOutcome } from '../engine/blackjack/roundSummaryOverlay';

/** Bet chips shown on player box during betting or active round play. */
export function resolveBoxBetAmountDuringPlay(
  inBetting: boolean,
  openStake: number,
  currentBet: number | undefined,
): number {
  if (inBetting) {
    return openStake;
  }
  return currentBet ?? 0;
}

/** True when the box had an active wager and cards (or a settled outcome) this round. */
export function boxHadActiveHandInRound(
  round: BlackjackRound,
  handKeys: string[],
): boolean {
  for (const handKey of handKeys) {
    const hand = round.playerHands[handKey];
    if (!hand || hand.currentBet <= 0) {
      continue;
    }
    const hasCards = hand.cardIds.some(Boolean);
    const hasOutcome = Boolean(round.outcomes?.[handKey]);
    if (hasCards || hasOutcome) {
      return true;
    }
  }
  return false;
}

/** Sum net chip delta for all hands on one box after settlement. */
export function resolveBoxNetChipsForHands(
  round: BlackjackRound,
  handKeys: string[],
  blackjackPayout: number,
): number {
  let net = 0;
  for (const handKey of handKeys) {
    const hand = round.playerHands[handKey];
    if (!hand || hand.currentBet <= 0) {
      continue;
    }
    const outcome = round.outcomes[handKey];
    if (!outcome) {
      continue;
    }
    net += netChipsForOutcome(outcome, hand.currentBet, blackjackPayout);
  }
  return net;
}

/** End-of-round box label — positive wins, negative losses, push as EVEN. */
export function formatBoxNetResultLabel(net: number): string {
  if (net === 0) {
    return 'EVEN';
  }
  if (net > 0) {
    return `+${net}`;
  }
  return String(net);
}

export type BoxNetResultTone = 'win' | 'loss' | 'even';

export function boxNetResultTone(net: number): BoxNetResultTone {
  if (net > 0) {
    return 'win';
  }
  if (net < 0) {
    return 'loss';
  }
  return 'even';
}
