import { createStandardDeck, getCardById } from '../../../engine/deck';
import { cardIdFor, type Rank, type Suit } from '../../../types/deck';
import type {
  PokerActionAvailability,
  PokerChatMessage,
  PokerTableViewModel,
} from './pokerTypes';

const MOCK_PLAYER_NAMES = [
  'Alex',
  'Jordan',
  'Sam',
  'Riley',
  'Casey',
  'Morgan',
] as const;

const mockDeck = createStandardDeck('mock');

function card(rank: Rank, suit: Suit) {
  const found = getCardById(mockDeck, cardIdFor(rank, suit));
  if (!found) {
    throw new Error(`Missing mock card ${cardIdFor(rank, suit)}`);
  }
  return found;
}

export const POKER_MOCK_TABLE: PokerTableViewModel = {
  tableName: "Texas Hold'em — Friends table",
  street: 'flop',
  pot: 185,
  sidePotCount: 1,
  currentBet: 20,
  smallBlind: 5,
  bigBlind: 10,
  communityCards: [
    card('A', 'spades'),
    card('9', 'diamonds'),
    card('4', 'hearts'),
  ],
  activePlayerId: 'player-2',
  viewerSeatId: 'player-0',
  actionLog: [
    'Alex posts small blind (5)',
    'Jordan posts big blind (10)',
    'Sam raises to 20',
    'Riley folds',
    'Casey calls 20',
    'Morgan folds',
    'Alex folds',
    'Jordan calls 10',
  ],
  seats: MOCK_PLAYER_NAMES.map((displayName, index) => {
    const playerId = `player-${index}`;
    const isViewer = index === 0;
    const isFolded = index === 3 || index === 5;
    const holeCards =
      isFolded && !isViewer
        ? null
        : {
            faceDown: !isViewer,
            cards: isViewer
              ? [card('K', 'hearts'), card('Q', 'hearts')]
              : [card('7', 'clubs'), card('2', 'diamonds')],
          };

    return {
      seatIndex: index,
      playerId,
      displayName,
      controllerName: index === 4 ? 'Bot Casey' : displayName,
      chipCount: 420 - index * 35,
      streetBet: isFolded ? 0 : index === 1 ? 20 : index === 2 ? 20 : index === 4 ? 20 : 0,
      isDealer: index === 5,
      isSmallBlind: index === 0,
      isBigBlind: index === 1,
      isActive: playerId === 'player-2',
      isFolded,
      isAllIn: false,
      isWinner: false,
      isViewer,
      actionStatus: isFolded ? 'folded' : playerId === 'player-2' ? 'active' : 'waiting',
      holeCards,
    };
  }),
};

export const POKER_MOCK_ACTIONS: PokerActionAvailability = {
  canCheck: false,
  canCall: true,
  canBet: false,
  canRaise: true,
  canFold: true,
  canAllIn: true,
  callAmount: 20,
  allInAmount: 350,
  minBet: 10,
  minRaise: 40,
};

export const POKER_MOCK_CHAT: PokerChatMessage[] = [
  {
    id: 'chat-1',
    author: 'Jordan',
    body: 'Nice flop for you?',
    timestamp: Date.now() - 120_000,
  },
  {
    id: 'chat-2',
    author: 'Sam',
    body: 'Let’s see a turn.',
    timestamp: Date.now() - 45_000,
  },
];
