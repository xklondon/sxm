import { createIouHandoff } from '../../../api/iouHandoff';
import type { GameState } from '../../../types';
import type { GameOverIouFeedback } from '../../../components/GameOverActionOverlay';
import {
  buildPokerIouHandoffRequests,
  hasPokerIouBeenSubmitted,
  markPokerIouSubmitted,
  validatePokerChallengeSettlement,
} from '../state/pokerChallengeSettlement';

export async function sendPokerChallengeIous(
  state: GameState,
  winnerId: string | null,
  setFeedback: (feedback: GameOverIouFeedback | null) => void,
): Promise<boolean> {
  const config = state.tableMeta.pokerConfig;
  if (!config || config.mode !== 'challenge') {
    return true;
  }
  if (!winnerId) {
    setFeedback({
      tone: 'error',
      message: 'No authoritative challenge winner — cannot send IOUs.',
    });
    return false;
  }

  if (config.iouSubmittedAt) {
    setFeedback({ tone: 'info', message: 'IOUs for this challenge were already submitted.' });
    return true;
  }

  const validation = validatePokerChallengeSettlement(state, winnerId);
  if (!validation.ok) {
    setFeedback({ tone: 'error', message: validation.error });
    return false;
  }

  if (!validation.settlement.canSendIous) {
    setFeedback({
      tone: 'error',
      message: validation.settlement.blockingReason ?? 'Cannot send IOUs for this challenge.',
    });
    return false;
  }

  const requests = buildPokerIouHandoffRequests(state, winnerId);
  if (requests.length === 0) {
    setFeedback({
      tone: 'error',
      message: 'Missing debtor or creditor email for this challenge.',
    });
    return false;
  }

  const expectedIouCount = validation.settlement.losers.length;
  if (requests.length !== expectedIouCount) {
    setFeedback({
      tone: 'error',
      message: 'IOU validation failed — not all losers can be settled.',
    });
    return false;
  }

  const handNumber = config.handNumber;
  let anyFailed = false;

  for (const request of requests) {
    if (hasPokerIouBeenSubmitted(request.tableId, handNumber, request.debtorEmail)) {
      continue;
    }
    const result = await createIouHandoff(request);
    if (!result.ok) {
      anyFailed = true;
      setFeedback({ tone: 'error', message: result.error });
      return false;
    }
    if (result.iouId) {
      markPokerIouSubmitted(request.tableId, handNumber, request.debtorEmail, result.iouId);
    }
  }

  if (anyFailed) {
    return false;
  }

  setFeedback({
    tone: 'success',
    message: `Created ${requests.length} IOU${requests.length === 1 ? '' : 's'} for losing players.`,
  });
  return true;
}
