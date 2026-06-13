import type { GameState } from '../types';
import { getVisibleDealerCardIds } from '../engine/blackjack/protocolState';
import { cardsFromIds, getBlackjackHandValue } from '../engine/blackjack/hand';
import { buildTableBankRow } from '../engine/session/tablePeople';
import { resolveViewerTrayAvailable } from './blackjackAccountingDisplay';
import { formatBankHolderLabel, isChallengeTable } from '../engine/scoreLedger/challengeBankDisplay';
import { clampAvailableForDisplay } from './displayBalance';

export interface TableInfoDisplay {
  bankValue: number | null;
  bankChips: number | null;
  playerAvailable: number | null;
  /** Challenge mode: seated player acting as bank. */
  bankHolderLabel: string | null;
}

function getBankDisplayValue(
  state: GameState,
  displayState: GameState = state,
): number | null {
  const round = displayState.blackjack;
  const deck = displayState.deck ?? state.deck;
  if (!round || !deck) {
    return null;
  }

  let cardIds = getVisibleDealerCardIds(displayState);
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
  displayState: GameState = state,
): TableInfoDisplay {
  const bankRow = buildTableBankRow(state);
  const bankId = state.session.bankPlayerId;
  const bankHolderLabel =
    bankId && isChallengeTable(state) ? formatBankHolderLabel(state, bankId) : null;
  const playerAvailable = resolveViewerTrayAvailable(state, viewerPersonId);

  return {
    bankValue: getBankDisplayValue(state, displayState),
    bankChips: bankRow !== null ? clampAvailableForDisplay(bankRow.available) : null,
    playerAvailable,
    bankHolderLabel,
  };
}
