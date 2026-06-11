import type { GameState } from '../types';
import { getVisibleDealerCardIds } from '../engine/blackjack/protocolState';
import { cardsFromIds, getBlackjackHandValue } from '../engine/blackjack/hand';
import { buildTableBankRow } from '../engine/session/tablePeople';
import { getAvailableChipsForBankrollOwner } from '../engine/session/bankroll';
import { formatBankHolderLabel, isChallengeTable } from '../engine/scoreLedger/challengeBankDisplay';

export interface TableInfoDisplay {
  bankValue: number | null;
  bankChips: number | null;
  playerAvailable: number | null;
  /** Challenge mode: seated player acting as bank. */
  bankHolderLabel: string | null;
}

function getBankDisplayValue(state: GameState): number | null {
  const round = state.blackjack;
  const deck = state.deck;
  if (!round || !deck) {
    return null;
  }

  let cardIds = getVisibleDealerCardIds(state);
  const holeHidden =
    round.dealerHoleHidden &&
    round.status !== 'resolved' &&
    round.status !== 'bank-turn' &&
    round.status !== 'banking';
  if (holeHidden && cardIds.length > 1) {
    cardIds = cardIds.slice(0, 1);
  }
  if (cardIds.length === 0) {
    return null;
  }

  const { value } = getBlackjackHandValue(cardsFromIds(deck, cardIds));
  return value;
}

/** Shared bank/player balance projection for felt info elements. */
export function buildTableInfoDisplay(
  state: GameState,
  viewerPersonId: string | null,
): TableInfoDisplay {
  const bankRow = buildTableBankRow(state);
  const bankId = state.session.bankPlayerId;
  const bankHolderLabel =
    bankId && isChallengeTable(state) ? formatBankHolderLabel(state, bankId) : null;
  const playerAvailable =
    viewerPersonId !== null
      ? getAvailableChipsForBankrollOwner(state, viewerPersonId)
      : null;

  return {
    bankValue: getBankDisplayValue(state),
    bankChips: bankRow !== null ? bankRow.available : null,
    playerAvailable,
    bankHolderLabel,
  };
}
