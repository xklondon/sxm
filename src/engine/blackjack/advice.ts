import type { Ledger } from '../../types/ledger';
import type { BlackjackFlowSettings } from './flowSettings';
import {
  reasonAidAdvice,
  formatAidStructuredAdvice,
  type AidStructuredAdvice,
} from './aid';
import { getBlackjackProtocolForState } from './protocolState';

export interface AidAdviceResult {
  text: string;
  costNote?: string;
  structured?: AidStructuredAdvice;
}

export type { AidStructuredAdvice } from './aid';

/** Structured AID output — protocol + intel + strategy lookup. */
export function getStructuredAidAdvice(
  round: import('../../types/blackjack').BlackjackRound,
  handKey: string,
  deck: import('../../types/deck').Deck,
  flowSettings: BlackjackFlowSettings,
  gameState?: import('../../types').GameState,
  ledger?: Ledger,
): AidStructuredAdvice | null {
  const protocol = gameState
    ? getBlackjackProtocolForState(gameState)
    : undefined;
  return reasonAidAdvice({
    round,
    handKey,
    deck,
    flowSettings,
    ledger,
    protocol,
    gameState,
  });
}

/** Local deterministic AID — thin wrapper over reasoner for UI compatibility. */
export function getAidAdvice(
  round: import('../../types/blackjack').BlackjackRound,
  handKey: string,
  deck: import('../../types/deck').Deck,
  flowSettings: BlackjackFlowSettings,
  gameState?: import('../../types').GameState,
  ledger?: Ledger,
): AidAdviceResult | null {
  const protocol = gameState
    ? getBlackjackProtocolForState(gameState)
    : undefined;
  const structured = reasonAidAdvice({
    round,
    handKey,
    deck,
    flowSettings,
    ledger,
    protocol,
    gameState,
  });

  if (!structured) {
    return null;
  }

  const result: AidAdviceResult = {
    text: formatAidStructuredAdvice(structured),
    structured,
  };

  if (flowSettings.adviceCostMode === 'bank-offer') {
    result.costNote = 'bank-offer';
  }

  return result;
}
