import type { GameState } from '../../../types';
import { getCardById } from '../../../engine/deck';
import { deriveAllBalancesFromLedger } from '../../../engine/ledger';
import { computeHoldemPot } from '../../../types/holdem';
import {
  canBetHoldem,
  canCallHoldem,
  canCheckHoldem,
  canFoldHoldem,
  canRaiseHoldem,
  canAllInHoldem,
  allInAmountForPlayer,
} from '../../../engine/holdem/validation';
import {
  getHoldemActingSeatId,
  getHoldemBigBlindSeatId,
  getHoldemDealerSeatId,
  getHoldemSmallBlindSeatId,
  isHoldemHandInProgress,
} from '../../../engine/holdem/holdemSelectors';
import type {
  PokerActionAvailability,
  PokerHoleCards,
  PokerSeatViewModel,
  PokerStreet,
  PokerTableViewModel,
} from './pokerTypes';

function mapStreet(status: string | undefined, bettingStreet: string | null): PokerStreet {
  if (!status || status === 'blinds') {
    return 'setup';
  }
  if (status === 'preflop' || status === 'flop' || status === 'turn' || status === 'river') {
    return status;
  }
  if (status === 'showdown') {
    return 'showdown';
  }
  if (status === 'resolved') {
    return 'resolved';
  }
  return bettingStreet && ['preflop', 'flop', 'turn', 'river'].includes(bettingStreet)
    ? (bettingStreet as PokerStreet)
    : 'setup';
}

function buildSeatsFromState(
  state: GameState,
  viewerSeatId: string | null,
): PokerSeatViewModel[] {
  const { session, players, holdem, ledger } = state;
  const balances = deriveAllBalancesFromLedger(session, ledger);
  const dealerId = getHoldemDealerSeatId(state);
  const smallBlindId = getHoldemSmallBlindSeatId(state);
  const bigBlindId = getHoldemBigBlindSeatId(state);
  const actingId = getHoldemActingSeatId(state);
  const winnerIds = new Set(holdem?.winners ?? []);

  return session.playerIds.map((playerId, seatIndex) => {
    const player = players[playerId];
    const ps = holdem?.playerStates[playerId];
    const isViewer = viewerSeatId === playerId;
    const isFolded = ps?.actionStatus === 'folded';
    const isAllIn = ps?.actionStatus === 'all-in';
    const holeCardIds = ps?.holeCardIds ?? [];
    let holeCards: PokerHoleCards | null = null;

    if (holeCardIds.length > 0) {
      const showFaceUp =
        isViewer ||
        holdem?.status === 'showdown' ||
        holdem?.status === 'resolved';
      holeCards = {
        faceDown: !showFaceUp,
        cards: holeCardIds
          .map((id) => (state.deck ? getCardById(state.deck, id) : null))
          .filter((card): card is NonNullable<typeof card> => Boolean(card)),
      };
    }

    return {
      seatIndex,
      playerId,
      displayName: player?.displayName ?? 'Player',
      controllerName: player?.controllerName,
      chipCount: balances[playerId] ?? 0,
      streetBet: ps?.playerBetsThisStreet ?? 0,
      isDealer: dealerId === playerId,
      isSmallBlind: smallBlindId === playerId,
      isBigBlind: bigBlindId === playerId,
      isActive: actingId === playerId,
      isFolded,
      isAllIn,
      isWinner: winnerIds.has(playerId),
      isViewer,
      actionStatus: ps?.actionStatus ?? 'waiting',
      holeCards,
    };
  });
}

export function mapPokerActionAvailability(state: GameState): PokerActionAvailability {
  const round = state.holdem;
  const activeId = round?.activePlayerId;
  const config = state.tableMeta.pokerConfig;
  const minBet = config?.bigBlind ?? state.holdemSettings.bigBlind;
  const minRaise = round?.lastRaiseSize ?? minBet;

  if (!round || !activeId) {
    return {
      canCheck: false,
      canCall: false,
      canBet: false,
      canRaise: false,
      canFold: false,
      canAllIn: false,
      callAmount: 0,
      allInAmount: 0,
      minBet,
      minRaise,
    };
  }

  const callAmount = Math.max(0, round.currentBet - (round.playerStates[activeId]?.playerBetsThisStreet ?? 0));
  const allInAmount = allInAmountForPlayer(state.ledger, activeId);
  const canAllIn = canAllInHoldem(state.ledger, round, activeId);

  return {
    canCheck: canCheckHoldem(round, activeId),
    canCall: canCallHoldem(state.ledger, round, activeId),
    canBet: canBetHoldem(state.ledger, round, activeId, minBet),
    canRaise: canRaiseHoldem(state.ledger, round, activeId, minRaise),
    canFold: canFoldHoldem(round, activeId),
    canAllIn,
    callAmount,
    allInAmount,
    allInDisabledReason: canAllIn ? undefined : 'No chips to go all-in',
    minBet,
    minRaise,
  };
}

export function mapPokerTableViewModel(
  state: GameState,
  viewerSeatId: string | null = null,
): PokerTableViewModel {
  const config = state.tableMeta.pokerConfig;
  const holdem = state.holdem;
  const tableName =
    state.tableMeta.tableClothName?.trim() ||
    (config?.mode === 'practice' ? "Texas Hold'em — Practice" : "Texas Hold'em — Challenge");

  const resolvedViewer =
    viewerSeatId ??
    state.tableMeta.ownerPersonId ??
    state.session.playerIds[0] ??
    null;

  if (!config && !holdem) {
    const seats = buildSeatsFromState(state, resolvedViewer);
    return {
      tableName,
      street: 'setup',
      pot: 0,
      sidePotCount: 0,
      currentBet: 0,
      smallBlind: state.holdemSettings.smallBlind,
      bigBlind: state.holdemSettings.bigBlind,
      communityCards: [],
      seats: seats.map((seat) => ({
        ...seat,
        isViewer: seat.playerId === resolvedViewer,
      })),
      activePlayerId: null,
      actionLog: [],
      viewerSeatId: resolvedViewer,
    };
  }

  const communityCards =
    holdem && state.deck
      ? holdem.communityCardIds
          .map((id) => getCardById(state.deck!, id))
          .filter((card): card is NonNullable<typeof card> => Boolean(card))
      : [];

  const seats = buildSeatsFromState(state, viewerSeatId);

  return {
    tableName,
    street: mapStreet(holdem?.status, holdem?.bettingStreet ?? null),
    pot: holdem ? computeHoldemPot(holdem) : 0,
    sidePotCount: holdem?.sidePots?.length ?? 0,
    currentBet: holdem?.currentBet ?? 0,
    smallBlind: config?.smallBlind ?? state.holdemSettings.smallBlind,
    bigBlind: config?.bigBlind ?? state.holdemSettings.bigBlind,
    communityCards,
    seats: seats.map((seat) => ({
      ...seat,
      isViewer: seat.playerId === resolvedViewer,
    })),
    activePlayerId: getHoldemActingSeatId(state),
    actionLog: holdem?.actionLog ?? [],
    resultSummary: holdem?.resultSummary || undefined,
    winningHandLabel: holdem?.winningHandLabel,
    payoutSummary: holdem?.payoutSummary,
    winningSeatIds: holdem?.winners,
    viewerSeatId: resolvedViewer,
  };
}

export function isPokerHandInProgress(state: GameState): boolean {
  return isHoldemHandInProgress(state);
}
