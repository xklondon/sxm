import { defineBlackjackProtocol } from './defineProtocol';

/** Max splits per box per round — practical shoe safety cap. */
export const MAX_SPLITS_PER_BOX = 8;

/**
 * SXMCards house-rule preset inspired by Vegas-style play.
 * Not official universal Las Vegas casino rules.
 */
export const LAS_VEGAS_PROTOCOL = defineBlackjackProtocol({
  protocolId: 'las-vegas-house',
  displayName: 'Las Vegas Protocol — house rules',
  shortDescription: 'Default SXMCards house rules.',
  shoe: {
    deckCount: 6,
    minDecks: 1,
    maxDecks: 8,
    reshuffleWhenEmpty: true,
  },
  dealer: {
    standsOnSoft17: true,
    hitBelow: 17,
    standAtOrAbove: 17,
    peekOnAce: true,
    peekOnTen: false,
    description: 'Dealer hits until hard 17+, stands on soft 17 (S17). Peeks on Ace up-card when insurance offered.',
  },
  dealerDrawRule: 'Stand on soft 17; peek on Ace when insurance is offered.',
  payouts: {
    blackjackMultiplier: 1.5,
    blackjackLabel: '3:2',
    winPays: '1:1 — stake returned plus equal winnings',
    pushPays: 'Original stake returned',
    bustLoses: 'Stake lost immediately when hand exceeds 21',
  },
  double: {
    allowed: true,
    firstTwoCardsOnly: true,
    oneCardOnly: true,
    allowedAfterSplit: true,
    allowedHardTotals: [9, 10, 11],
    description: 'Double: 9, 10, or 11 only; first two cards',
  },
  split: {
    allowed: true,
    sameRankOnly: true,
    maxSplitsPerRound: MAX_SPLITS_PER_BOX,
    resplitAces: true,
    hitSplitAces: true,
    doubleAfterSplit: true,
    description: 'Split matching ranks; repeat splits up to shoe safety cap; double after split allowed.',
  },
  insurance: {
    offered: true,
    maxHalfOfMainBet: true,
    payoutRatio: 2,
    payoutLabel: '2:1',
    description:
      'When dealer shows Ace, optional side bet up to half main wager; pays 2:1 if dealer has natural blackjack.',
  },
  surrender: {
    allowed: false,
    lateSurrender: false,
    earlySurrender: false,
    description: 'Surrender not offered in this variant.',
  },
  resolution: {
    compareAfterDealerCompletes: true,
    naturalBeatsNonNatural: true,
    splitHandsResolvedIndependently: true,
    description: 'Each hand settles vs dealer after dealer finishes; naturals beat 21 in multiple cards.',
  },
  dealingRules: {
    showDealerHoleCardDuringPlay: true,
    holeCardDealtLast: false,
    description: 'American-style hole card; dealer peeks on Ace when insurance is offered.',
  },
  phaseActions: {
    byPhase: {
      betting: [],
      dealing: [],
      insurance: ['insurance'],
      player: ['hit', 'stand', 'double', 'split'],
      bank: [],
      banking: [],
      'round-complete': [],
    },
  },
  supportedActions: ['hit', 'stand', 'double', 'split', 'insurance'],
  aidProfile: {
    id: 'vegas-house',
    label: 'Las Vegas house rules',
    description: 'Full basic strategy with insurance decline unless count-rich.',
    insuranceBias: 'decline',
  },
  defaultMinBet: 5,
  defaultMaxBet: 500,
  extensions: {
    wildCards: { enabled: false, description: 'Standard 52-card ranks only.' },
    sideBets: [],
    alteredPayouts: {},
  },
  displayRules: [
    { id: 'shoe', label: 'Shoe', value: '6 decks (configurable 1–8)' },
    { id: 'dealer-s17', label: 'Dealer', value: 'Stands on soft 17' },
    { id: 'bj-pay', label: 'Blackjack', value: 'Pays 3:2 on natural 21' },
    { id: 'double', label: 'Double', value: '9, 10, or 11 only; first two cards' },
    { id: 'split', label: 'Split', value: 'Same rank; repeat splits; double after split' },
    { id: 'insurance', label: 'Insurance', value: 'Optional 2:1 when dealer shows Ace' },
    { id: 'surrender', label: 'Surrender', value: 'Not offered' },
  ],
});

/** Default active preset — Las Vegas house rules. */
export const ACTIVE_BLACKJACK_PROTOCOL = LAS_VEGAS_PROTOCOL;
