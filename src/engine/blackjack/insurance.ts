import type { Deck } from '../../types/deck';
import type { Ledger } from '../../types/ledger';
import type { GameSession } from '../../types/session';
import type { Player } from '../../types/player';
import type { BlackjackRound } from '../../types/blackjack';
import type { BlackjackProtocol } from './protocols/types';
import { getCardById } from '../deck/deck';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import type { BlackjackSettings } from './settings';
import { insuranceBetMax, insuranceWinPayout } from './rules';
import { getBlackjackHandValue, cardsFromIds } from './hand';
import { handKeysWithConfirmedBets, syncPlayerBetsFromRound } from './helpers';
import { parseBlackjackHandKey } from './handKeys';
import { findNextActingHand } from './virtual';
import { syncActivePlayerId } from './helpers';
import { resolveBankrollOwnerId, type BankrollContext } from '../session/bankroll';
import { appendBoxLedgerEntry } from '../session/boxLedger';
import { appendBankLedgerEntry } from './bankLedger';
import {
  allInsuranceDecisionsResolved,
  getInsuranceEligiblePlayerIds,
  isHandEligibleForInsuranceOffer,
  shouldOfferInsuranceUnderProtocol,
} from './protocols/activeRules';
import { getBlackjackProtocolOrDefault } from './protocols';

export function dealerShowsAce(deck: Deck, round: BlackjackRound): boolean {
  const upId = round.dealerCardIds[0];
  if (!upId) {
    return false;
  }
  const card = getCardById(deck, upId);
  return card?.rank === 'A';
}

export function shouldOfferInsurance(
  round: BlackjackRound,
  deck: Deck,
  settings: BlackjackSettings,
  protocol?: BlackjackProtocol,
): boolean {
  if (protocol) {
    return shouldOfferInsuranceUnderProtocol(protocol, dealerShowsAce(deck, round));
  }
  return Boolean(settings.allowInsurance && dealerShowsAce(deck, round));
}

export function activateInsuranceOfferIfNeeded(
  round: BlackjackRound,
  deck: Deck,
  settings: BlackjackSettings,
): BlackjackRound {
  if (!shouldOfferInsurance(round, deck, settings)) {
    return { ...round, insuranceOfferPending: false };
  }
  return {
    ...round,
    insuranceOfferPending: true,
    insuranceBets: { ...(round.insuranceBets ?? {}) },
    insuranceDeclined: { ...(round.insuranceDeclined ?? {}) },
  };
}

export function allInsuranceResolved(
  session: GameSession,
  round: BlackjackRound,
  protocol?: BlackjackProtocol,
): boolean {
  return allInsuranceDecisionsResolved(
    session,
    round,
    protocol ?? getBlackjackProtocolOrDefault(),
  );
}

export { getInsuranceEligiblePlayerIds, isHandEligibleForInsuranceOffer };

export function takeInsuranceBet(
  session: GameSession,
  players: Record<string, Player>,
  ledger: Ledger,
  round: BlackjackRound,
  playerId: string,
  bankrollCtx: BankrollContext,
  protocol?: BlackjackProtocol,
): {
  session: GameSession;
  players: Record<string, Player>;
  ledger: Ledger;
  round: BlackjackRound;
} {
  if (!round.insuranceOfferPending) {
    throw new Error('Insurance is not offered');
  }
  const handKey = handKeysWithConfirmedBets(session, round).find(
    (hk) => parseBlackjackHandKey(hk).playerId === playerId,
  );
  const hand = handKey ? round.playerHands[handKey] : undefined;
  if (!hand || !isHandEligibleForInsuranceOffer(protocol ?? getBlackjackProtocolOrDefault(), hand)) {
    throw new Error('No active hand for insurance');
  }

  const maxBet = insuranceBetMax(hand.currentBet);
  if (maxBet <= 0) {
    throw new Error('Bet too small for insurance');
  }
  const bankrollOwnerId = resolveBankrollOwnerId(bankrollCtx, playerId);
  const balance = derivePlayerBalanceFromLedger(bankrollOwnerId, ledger);
  if (balance < maxBet) {
    throw new Error('Not enough chips for insurance');
  }

  const betResult = appendBoxLedgerEntry(
    session,
    ledger,
    bankrollCtx,
    playerId,
    'bet-placed',
    -maxBet,
    `Insurance: ${maxBet} chips (2:1 if dealer blackjack)`,
  );

  const nextRound: BlackjackRound = {
    ...round,
    insuranceBets: {
      ...(round.insuranceBets ?? {}),
      [playerId]: maxBet,
    },
    insuranceDeclined: {
      ...(round.insuranceDeclined ?? {}),
      [playerId]: false,
    },
  };

  return {
    session: betResult.session,
    players,
    ledger: betResult.ledger,
    round: nextRound,
  };
}

export function declineInsurance(
  round: BlackjackRound,
  playerId: string,
): BlackjackRound {
  return {
    ...round,
    insuranceDeclined: {
      ...(round.insuranceDeclined ?? {}),
      [playerId]: true,
    },
  };
}

export function closeInsuranceOffer(
  session: GameSession,
  players: Record<string, Player>,
  round: BlackjackRound,
): {
  session: GameSession;
  players: Record<string, Player>;
  round: BlackjackRound;
} {
  const firstActingHand = findNextActingHand(session, round);
  const nextRound = syncActivePlayerId({
    ...round,
    insuranceOfferPending: false,
    activeHandKey: firstActingHand,
    status: firstActingHand ? 'player-turns' : 'bank-turn',
    dealerHoleHidden: firstActingHand !== null,
  });
  return {
    session,
    players: syncPlayerBetsFromRound(players, nextRound),
    round: nextRound,
  };
}

/** Pay or lose insurance bets when dealer blackjack is known. */
export function settleInsuranceBets(
  session: GameSession,
  players: Record<string, Player>,
  ledger: Ledger,
  deck: Deck,
  round: BlackjackRound,
  bankrollCtx: BankrollContext,
): {
  session: GameSession;
  players: Record<string, Player>;
  ledger: Ledger;
} {
  const dealerCards = cardsFromIds(deck, round.dealerCardIds.filter(Boolean));
  const dealerBj = getBlackjackHandValue(dealerCards).isBlackjack;
  let nextSession = session;
  let nextLedger = ledger;
  const bankId = session.bankPlayerId;

  for (const [playerId, insBet] of Object.entries(round.insuranceBets ?? {})) {
    if (insBet <= 0) {
      continue;
    }
    if (dealerBj) {
      const payout = insuranceWinPayout(insBet);
      const result = appendBoxLedgerEntry(
        nextSession,
        nextLedger,
        bankrollCtx,
        playerId,
        'win-paid',
        payout,
        `Insurance wins 2:1 (+${payout} chips)`,
        session.currentRound,
      );
      nextSession = result.session;
      nextLedger = result.ledger;
      if (bankId) {
        const winnings = payout - insBet;
        const bankResult = appendBankLedgerEntry(
          nextSession,
          nextLedger,
          bankId,
          -winnings,
          `Insurance payout ${winnings} chips`,
          session.currentRound,
        );
        nextSession = bankResult.session;
        nextLedger = bankResult.ledger;
      }
    } else if (bankId) {
      const bankResult = appendBankLedgerEntry(
        nextSession,
        nextLedger,
        bankId,
        insBet,
        `Insurance lost — house collected ${insBet} chips`,
        session.currentRound,
      );
      nextSession = bankResult.session;
      nextLedger = bankResult.ledger;
    }
  }

  return { session: nextSession, players, ledger: nextLedger };
}
