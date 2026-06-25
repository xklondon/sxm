import type { GameSession } from '../../types/session';
import type { Player } from '../../types/player';
import type { Ledger } from '../../types/ledger';
import type { Deck } from '../../types/deck';
import type {
  CreateHoldemRoundOptions,
  HoldemRound,
  BettingStreet,
} from '../../types/holdem';
import {
  createEmptyHoldemRound,
  nextBettingStreet,
} from '../../types/holdem';
import { drawCards } from '../deck/deck';
import {
  appendActionLog,
  assertMinHoldemPlayers,
  getActivePlayers,
  getBettingEligiblePlayers,
  getBigBlindSeat,
  getFirstPostflopActor,
  getFirstPreflopActor,
  getHoldemPlayerOrder,
  getSmallBlindSeat,
  initHoldemPlayerStates,
  resetStreetBets,
  rotateDealerButton,
  syncHoldemPot,
} from './helpers';
import {
  postBlind,
  type HoldemActionContext,
} from './betting';
import {
  evaluateShowdownHands,
  executeHoldemPayout,
} from './showdownPayout';

export interface HoldemEngineUpdate {
  session: GameSession;
  players: Record<string, Player>;
  ledger: Ledger;
  deck: Deck;
  round: HoldemRound;
}

function actionCtx(
  session: GameSession,
  ledger: Ledger,
  round: HoldemRound,
  playerId: string,
): HoldemActionContext {
  return { session, ledger, round, playerId };
}

function syncPlayersFromRound(
  players: Record<string, Player>,
  round: HoldemRound,
): Record<string, Player> {
  const next = { ...players };
  for (const [id, ps] of Object.entries(round.playerStates)) {
    if (next[id]) {
      next[id] = {
        ...next[id],
        currentBet: ps.playerBetsThisStreet,
        cardIds: ps.holeCardIds,
        status: ps.actionStatus === 'folded'
          ? 'folded'
          : ps.actionStatus === 'all-in'
            ? 'all-in'
            : 'active',
      };
    }
  }
  return next;
}

export function createHoldemRound(
  session: GameSession,
  players: Record<string, Player>,
  ledger: Ledger,
  deck: Deck | null,
  options?: CreateHoldemRoundOptions,
): HoldemEngineUpdate {
  assertMinHoldemPlayers(session);
  if (!session.dealerButtonPlayerId) {
    throw new Error('Dealer button must be assigned');
  }
  if (!deck) {
    throw new Error('Deck must be shuffled before starting Hold\'em');
  }

  const dealerId = session.dealerButtonPlayerId;
  const sbId = getSmallBlindSeat(session, dealerId);
  const bbId = getBigBlindSeat(session, dealerId);

  const round = syncHoldemPot({
    ...createEmptyHoldemRound(dealerId, sbId, bbId, options),
    playerStates: initHoldemPlayerStates(session),
    status: 'setup',
  });

  return {
    session,
    players: syncPlayersFromRound(players, round),
    ledger,
    deck,
    round,
  };
}

export function postBlinds(
  session: GameSession,
  players: Record<string, Player>,
  ledger: Ledger,
  deck: Deck,
  round: HoldemRound,
): HoldemEngineUpdate {
  if (round.status !== 'setup') {
    throw new Error('Can only post blinds during setup');
  }

  let nextSession = session;
  let nextLedger = ledger;
  let nextRound: HoldemRound = { ...round, status: 'blinds' };

  const sb = postBlind(
    actionCtx(nextSession, nextLedger, nextRound, round.smallBlindPlayerId),
    'small',
    round.smallBlind,
  );
  nextSession = sb.session;
  nextLedger = sb.ledger;
  nextRound = sb.round;

  const bb = postBlind(
    actionCtx(nextSession, nextLedger, nextRound, round.bigBlindPlayerId),
    'big',
    round.bigBlind,
  );
  nextSession = bb.session;
  nextLedger = bb.ledger;
  nextRound = syncHoldemPot({
    ...bb.round,
    status: 'blinds',
    bettingStreet: 'preflop',
    currentBet: round.bigBlind,
  });

  return {
    session: nextSession,
    players: syncPlayersFromRound(players, nextRound),
    ledger: nextLedger,
    deck,
    round: nextRound,
  };
}

function dealToAll(
  session: GameSession,
  players: Record<string, Player>,
  ledger: Ledger,
  deck: Deck,
  round: HoldemRound,
  countPerPlayer: number,
): HoldemEngineUpdate {
  let nextDeck = deck;
  let nextRound = round;

  for (let c = 0; c < countPerPlayer; c += 1) {
    for (const playerId of getHoldemPlayerOrder(session)) {
      const ps = nextRound.playerStates[playerId];
      if (!ps || ps.actionStatus === 'folded') {
        continue;
      }
      const draw = drawCards(nextDeck, 1);
      nextDeck = draw.deck;
      if (draw.cards.length === 0) {
        throw new Error('Not enough cards in deck');
      }
      nextRound = {
        ...nextRound,
        playerStates: {
          ...nextRound.playerStates,
          [playerId]: {
            ...ps,
            holeCardIds: [...ps.holeCardIds, draw.cards[0].id],
          },
        },
      };
    }
  }

  return {
    session,
    players: syncPlayersFromRound(players, nextRound),
    ledger,
    deck: nextDeck,
    round: nextRound,
  };
}

export function dealHoleCards(
  session: GameSession,
  players: Record<string, Player>,
  ledger: Ledger,
  deck: Deck,
  round: HoldemRound,
): HoldemEngineUpdate {
  if (round.status !== 'blinds' && round.status !== 'setup') {
    throw new Error('Deal hole cards after blinds are posted');
  }

  const needed = session.playerIds.length * 2;
  if (deck.drawOrder.length < needed) {
    throw new Error(`Deck needs at least ${needed} cards`);
  }

  let result = dealToAll(session, players, ledger, deck, round, 2);
  const firstActor = getFirstPreflopActor(
    session,
    round.bigBlindPlayerId,
    round.dealerButtonPlayerId,
  );

  result = {
    ...result,
    ledger,
    round: syncHoldemPot({
      ...result.round,
      status: 'preflop',
      bettingStreet: 'preflop',
      activePlayerId: firstActor,
    }),
  };

  return result;
}

function dealCommunity(
  session: GameSession,
  players: Record<string, Player>,
  ledger: Ledger,
  deck: Deck,
  round: HoldemRound,
  count: number,
  status: HoldemRound['status'],
  street: BettingStreet,
): HoldemEngineUpdate {
  if (deck.drawOrder.length < count) {
    throw new Error(`Deck needs at least ${count} cards for ${street}`);
  }

  const draw = drawCards(deck, count);
  let nextRound = resetStreetBets({
    ...round,
    status,
    bettingStreet: street,
    communityCardIds: [...round.communityCardIds, ...draw.cards.map((c) => c.id)],
    activePlayerId: getFirstPostflopActor(session, round.dealerButtonPlayerId, round),
  });

  nextRound = appendActionLog(nextRound, `${street} dealt`);

  return {
    session,
    players: syncPlayersFromRound(players, nextRound),
    ledger,
    deck: draw.deck,
    round: syncHoldemPot(nextRound),
  };
}

export function dealFlop(
  session: GameSession,
  players: Record<string, Player>,
  ledger: Ledger,
  deck: Deck,
  round: HoldemRound,
): HoldemEngineUpdate {
  return dealCommunity(session, players, ledger, deck, round, 3, 'flop', 'flop');
}

export function dealTurn(
  session: GameSession,
  players: Record<string, Player>,
  ledger: Ledger,
  deck: Deck,
  round: HoldemRound,
): HoldemEngineUpdate {
  return dealCommunity(session, players, ledger, deck, round, 1, 'turn', 'turn');
}

export function dealRiver(
  session: GameSession,
  players: Record<string, Player>,
  ledger: Ledger,
  deck: Deck,
  round: HoldemRound,
): HoldemEngineUpdate {
  return dealCommunity(session, players, ledger, deck, round, 1, 'river', 'river');
}

function streetBettingComplete(_session: GameSession, round: HoldemRound): boolean {
  const active = getActivePlayers(round);
  if (active.length <= 1) {
    return true;
  }

  const bettingEligible = getBettingEligiblePlayers(round);
  if (bettingEligible.length === 0) {
    return true;
  }

  return bettingEligible.every((id) => {
    const ps = round.playerStates[id];
    return (
      ps.hasActedThisStreet &&
      ps.playerBetsThisStreet === round.currentBet
    );
  });
}

function findNextActor(
  session: GameSession,
  round: HoldemRound,
  afterPlayerId: string,
): string | null {
  const order = getHoldemPlayerOrder(session);
  const start = order.indexOf(afterPlayerId);
  for (let i = 1; i <= order.length; i += 1) {
    const id = order[(start + i) % order.length];
    const ps = round.playerStates[id];
    if (
      ps &&
      ps.actionStatus !== 'folded' &&
      ps.actionStatus !== 'all-in' &&
      (!ps.hasActedThisStreet || ps.playerBetsThisStreet < round.currentBet)
    ) {
      return id;
    }
  }
  return null;
}

export function setNextActor(
  session: GameSession,
  round: HoldemRound,
  afterPlayerId: string,
): HoldemRound {
  const nextId = findNextActor(session, round, afterPlayerId);
  return { ...round, activePlayerId: nextId };
}

export function awardPotToSingleWinner(
  session: GameSession,
  players: Record<string, Player>,
  ledger: Ledger,
  deck: Deck,
  round: HoldemRound,
  winnerId: string,
  reason: string,
): HoldemEngineUpdate {
  const payout = executeHoldemPayout(session, players, ledger, round, [winnerId], {
    reason,
  });

  return {
    session: payout.session,
    players,
    ledger: payout.ledger,
    deck,
    round: payout.round,
  };
}

export function resolveHoldemShowdown(
  session: GameSession,
  players: Record<string, Player>,
  ledger: Ledger,
  deck: Deck,
  round: HoldemRound,
): HoldemEngineUpdate {
  if (round.status !== 'showdown' && round.status !== 'river') {
    throw new Error('Showdown not ready');
  }
  if (round.communityCardIds.length < 5) {
    throw new Error('Showdown requires 5 community cards');
  }

  const active = getActivePlayers(round);
  if (active.length === 0) {
    throw new Error('No active players at showdown');
  }

  const rankedHands = evaluateShowdownHands(round, deck);
  const payout = executeHoldemPayout(session, players, ledger, round, active, {
    reason: 'showdown',
    rankedHands,
  });

  return {
    session: payout.session,
    players,
    ledger: payout.ledger,
    deck,
    round: payout.round,
  };
}

export function advanceHoldemStreet(
  session: GameSession,
  players: Record<string, Player>,
  deck: Deck,
  ledger: Ledger,
  round: HoldemRound,
): HoldemEngineUpdate {
  const active = getActivePlayers(round);
  if (active.length === 1) {
    return awardPotToSingleWinner(
      session,
      players,
      ledger,
      deck,
      round,
      active[0],
      'all others folded',
    );
  }

  if (!streetBettingComplete(session, round)) {
    throw new Error('Betting street is not complete');
  }

  const next = nextBettingStreet(round.bettingStreet);

  if (next === 'showdown') {
    if (round.communityCardIds.length < 5) {
      throw new Error('Cannot showdown before river is dealt');
    }
    return resolveHoldemShowdown(session, players, ledger, deck, {
      ...round,
      status: 'showdown',
    });
  }

  if (next === 'preflop') {
    return dealHoleCards(session, players, ledger, deck, round);
  }
  if (next === 'flop') {
    return dealFlop(session, players, ledger, deck, round);
  }
  if (next === 'turn') {
    return dealTurn(session, players, ledger, deck, round);
  }
  if (next === 'river') {
    return dealRiver(session, players, ledger, deck, round);
  }

  throw new Error('Unable to advance street');
}

/** Auto-deal remaining streets when all active players are all-in or betting is closed. */
function runOutLockedStreets(
  session: GameSession,
  players: Record<string, Player>,
  deck: Deck,
  ledger: Ledger,
  round: HoldemRound,
): HoldemEngineUpdate {
  let update: HoldemEngineUpdate = { session, players, ledger, deck, round };
  let guard = 0;

  while (
    ['preflop', 'flop', 'turn', 'river'].includes(update.round.status) &&
    getActivePlayers(update.round).length > 1 &&
    streetBettingComplete(session, update.round) &&
    guard < 5
  ) {
    guard += 1;
    update = advanceHoldemStreet(
      update.session,
      update.players,
      update.deck,
      update.ledger,
      update.round,
    );
  }

  return update;
}

export function afterHoldemAction(
  session: GameSession,
  players: Record<string, Player>,
  deck: Deck,
  ledger: Ledger,
  round: HoldemRound,
  actingPlayerId: string,
): HoldemEngineUpdate {
  let nextRound = round;

  const active = getActivePlayers(nextRound);
  if (active.length === 1) {
    return awardPotToSingleWinner(
      session,
      players,
      ledger,
      deck,
      nextRound,
      active[0],
      'all others folded',
    );
  }

  if (streetBettingComplete(session, nextRound)) {
    return runOutLockedStreets(
      session,
      players,
      deck,
      ledger,
      nextRound,
    );
  }

  nextRound = setNextActor(session, nextRound, actingPlayerId);

  const afterActor = {
    session,
    players: syncPlayersFromRound(players, nextRound),
    ledger,
    deck,
    round: syncHoldemPot(nextRound),
  };

  if (
    streetBettingComplete(session, afterActor.round) &&
    getActivePlayers(afterActor.round).length > 1
  ) {
    return runOutLockedStreets(
      afterActor.session,
      afterActor.players,
      afterActor.deck,
      afterActor.ledger,
      afterActor.round,
    );
  }

  return afterActor;
}

export function resetHoldemRound(
  session: GameSession,
  players: Record<string, Player>,
  ledger: Ledger,
  deck: Deck | null,
  previousRound?: HoldemRound,
): HoldemEngineUpdate {
  if (!deck) {
    throw new Error('Deck required for new Hold\'em round');
  }

  const newDealer = rotateDealerButton(session);
  const sbId = getSmallBlindSeat(session, newDealer);
  const bbId = getBigBlindSeat(session, newDealer);

  const round = syncHoldemPot({
    ...createEmptyHoldemRound(newDealer, sbId, bbId, {
      smallBlind: previousRound?.smallBlind ?? 5,
      bigBlind: previousRound?.bigBlind ?? 10,
    }),
    playerStates: initHoldemPlayerStates(session),
    status: 'setup',
  });

  return {
    session: {
      ...session,
      currentRound: session.currentRound + 1,
      status: 'active',
      dealerButtonPlayerId: newDealer,
    },
    players: syncPlayersFromRound(resetPlayerHands(players), round),
    ledger,
    deck,
    round,
  };
}

function resetPlayerHands(players: Record<string, Player>): Record<string, Player> {
  const next: Record<string, Player> = {};
  for (const [id, p] of Object.entries(players)) {
    next[id] = { ...p, cardIds: [], currentBet: 0, status: 'active' };
  }
  return next;
}

export function startHoldemHand(
  session: GameSession,
  players: Record<string, Player>,
  ledger: Ledger,
  deck: Deck,
  round: HoldemRound,
): HoldemEngineUpdate {
  const blinds = postBlinds(session, players, ledger, deck, round);
  return dealHoleCards(
    blinds.session,
    blinds.players,
    blinds.ledger,
    deck,
    blinds.round,
  );
}
