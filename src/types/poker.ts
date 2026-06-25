/** Shared poker table configuration — neutral types (no UI imports). */

export type PokerProtocol = 'texas-holdem';

export type PokerTableMode = 'practice' | 'challenge';

export type PokerChallengeStatus = 'active' | 'ended';

export type PokerChallengeEndReason = 'last-player-standing' | 'chip-leader';

export type PokerChallengeParticipantRecord = {
  seatId: string;
  playerId: string;
  displayName: string;
  email?: string;
};

export type PokerTableConfig = {
  game: 'poker';
  protocol: PokerProtocol;
  mode: PokerTableMode;
  wagerLabel?: string;
  totalChallengeValue?: number;
  currency?: string;
  startingStack: number;
  smallBlind: number;
  bigBlind: number;
  dealerSeatId?: string;
  handNumber: number;
  /** Guard duplicate IOU submission for this challenge end. */
  iouSubmittedAt?: string | null;
  challengeStatus?: PokerChallengeStatus;
  challengeWinnerSeatId?: string;
  challengeWinnerPlayerId?: string;
  challengeEndReason?: PokerChallengeEndReason;
  challengeEndedAt?: string;
  challengeParticipantSeatIds?: string[];
  challengeParticipantPlayerIds?: string[];
  challengeParticipants?: PokerChallengeParticipantRecord[];
};

export function createDefaultPokerTableConfig(
  partial?: Partial<PokerTableConfig>,
): PokerTableConfig {
  const mode = partial?.mode ?? 'practice';
  return {
    game: 'poker',
    protocol: 'texas-holdem',
    mode,
    startingStack: 500,
    smallBlind: 5,
    bigBlind: 10,
    handNumber: 0,
    iouSubmittedAt: null,
    challengeStatus: mode === 'challenge' ? 'active' : undefined,
    ...partial,
  };
}

export function validatePokerBlinds(smallBlind: number, bigBlind: number): string | null {
  if (!Number.isFinite(smallBlind) || smallBlind <= 0) {
    return 'Small blind must be a positive number.';
  }
  if (!Number.isFinite(bigBlind) || bigBlind <= 0) {
    return 'Big blind must be a positive number.';
  }
  if (bigBlind <= smallBlind) {
    return 'Big blind must be greater than the small blind.';
  }
  return null;
}
