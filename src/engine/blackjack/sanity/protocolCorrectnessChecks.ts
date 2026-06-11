import { getAvailableChipsForBankrollOwner } from '../../session/bankroll';
import {
  addChipToBoxStake,
  clearBoxStake,
  confirmBoxStake,
  getStakeForBox,
  removeLastChipFromBoxStake,
} from '../stakes';
import { syncCallersForDeal } from '../../session/playerAssignment';
import { canDoubleBlackjackForState } from '../validation';
import { hitBlackjackOnState, processPlayFlowAutoStands } from '../gameState';
import {
  buildActiveRulesHandContext,
  canDoubleUnderProtocol,
  canSplitUnderProtocol,
  isBetValidUnderProtocol,
  shouldOfferEvenMoney,
  shouldPayNaturalImmediately,
} from '../protocols/activeRules';
import { LAS_VEGAS_PROTOCOL, EUROPEAN_SHOE_PROTOCOL } from '../protocols';
import { BUST_MESSAGE } from '../bustSettlement';
import { shouldSkipBankDraw } from '../roundFlow';
import { getPlayFlowForPerson } from '../playFlow';
import { setBlackjackProtocolOnState } from '../protocolState';
import { blackjackHandKey } from '../handKeys';
import { confirmTableAgreement } from '../../session/table';
import { getTableWagerDisplay } from '../../session/wagerDisplay';
import { applySkipBankIfNeeded } from '../roundFlow';
import { allInsuranceResolved } from '../insurance';
import { buildGameOverSummary, addGameToPersonalLedger } from '../../scoreLedger/scoreLedger';
import { loadScoreLedgerEntries, saveScoreLedgerEntries } from '../../../storage/scoreLedgerStorage';
import { createBlackjackPlayerHand } from '../../../types/blackjack';
import { claimBoxSlot } from '../../session/boxOps';
import { resolveTableInviteOrigin } from '../../../utils/tableHost';
import { check, type SanitySuiteResult } from './types';
import { actingRound, boxPlayerId, findCardId, tableWithClaimedBox } from './fixtures';
import type { BlackjackRound } from '../../../types/blackjack';

export function runProtocolCorrectnessSanityChecks(): SanitySuiteResult {
  const results = [];

  results.push(
    check(
      'activeRules validates min bet multiples',
      !isBetValidUnderProtocol(LAS_VEGAS_PROTOCOL, 7, 5).valid &&
        isBetValidUnderProtocol(LAS_VEGAS_PROTOCOL, 10, 5).valid,
    ),
  );

  let state = tableWithClaimedBox(1);
  const boxId = boxPlayerId(state, 1)!;
  const personId = state.tableMeta.ownerPersonId!;
  results.push(
    check('default play flow is auto-18', getPlayFlowForPerson(state, personId) === 'auto-18'),
  );

  const availableBefore = getAvailableChipsForBankrollOwner(state, personId);
  state = addChipToBoxStake(state, boxId, 50, personId);
  state = removeLastChipFromBoxStake(state, boxId);
  results.push(
    check(
      'bet retraction restores available',
      getAvailableChipsForBankrollOwner(state, personId) === availableBefore,
    ),
  );

  state = tableWithClaimedBox(1);
  const box2 = boxPlayerId(state, 1)!;
  const person2 = state.tableMeta.ownerPersonId!;
  state = addChipToBoxStake(state, box2, 10, person2);
  state = addChipToBoxStake(state, box2, 5, person2);
  state = removeLastChipFromBoxStake(state, box2);
  results.push(check('remove last chip leaves 10 stake', getStakeForBox(state, box2) === 10));
  state = clearBoxStake(state, box2);
  results.push(check('clear stake removes bet', getStakeForBox(state, box2) === 0));

  state = tableWithClaimedBox(1);
  const hardBox = boxPlayerId(state, 1)!;
  const deck = state.deck!;
  const five = findCardId(deck, '5');
  const six = findCardId(deck, '6');
  state = {
    ...state,
    blackjack: actingRound(state, hardBox, [five, six], 25),
  };
  results.push(
    check('hard 11 double via activeRules state', canDoubleBlackjackForState(state, `${hardBox}:0`)),
  );

  const jack1 = findCardId(deck, 'J', 'spades');
  const jack2 = deck.cards.find((c) => c.rank === 'J' && c.id !== jack1)!.id;
  const splitRound = actingRound(state, hardBox, [jack1, jack2], 25);
  const splitHand = splitRound.playerHands[`${hardBox}:0`]!;
  const splitOwnerId = state.tableMeta.ownerPersonId!;
  const splitCtx = buildActiveRulesHandContext(
    LAS_VEGAS_PROTOCOL,
    state.ledger,
    splitRound,
    `${hardBox}:0`,
    deck,
    splitOwnerId,
    getAvailableChipsForBankrollOwner(state, splitOwnerId),
  );
  results.push(
    check(
      'J/J split allowed under Las Vegas protocol',
      splitCtx !== null && canSplitUnderProtocol(LAS_VEGAS_PROTOCOL, splitHand, { ...splitCtx, deck }),
    ),
  );

  state = setBlackjackProtocolOnState(state, EUROPEAN_SHOE_PROTOCOL.id, 'Alice');
  state = {
    ...state,
    blackjack: actingRound(state, hardBox, [five, six], 25),
  };
  results.push(
    check(
      'hard 11 double under European protocol',
      canDoubleBlackjackForState(state, `${hardBox}:0`),
    ),
  );

  state = tableWithClaimedBox(1);
  const bustBox = boxPlayerId(state, 1)!;
  const ten = findCardId(deck, '10');
  const nine = findCardId(deck, '9');
  const handKey = blackjackHandKey(bustBox, 0);
  state = {
    ...state,
    blackjack: actingRound(state, bustBox, [ten, nine], 40),
  };
  const bustState = hitBlackjackOnState(state, handKey);
  const bustHand = bustState.blackjack?.playerHands[handKey];
  results.push(
    check(
      'bust keeps cards visible after hit',
      bustHand?.actionStatus === 'busted' && (bustHand?.cardIds.length ?? 0) >= 3,
    ),
  );
  results.push(check('bust message set', bustState.blackjack?.resultMessages[handKey] === BUST_MESSAGE));

  state = tableWithClaimedBox(1);
  const b1 = boxPlayerId(state, 1)!;
  const fiveCard = findCardId(deck, '5');
  const bustRound = {
    ...actingRound(state, b1, [ten, nine, fiveCard], 30),
    playerHands: {
      [blackjackHandKey(b1, 0)]: {
        ...actingRound(state, b1, [ten, nine, fiveCard], 30).playerHands[blackjackHandKey(b1, 0)]!,
        actionStatus: 'busted' as const,
        bustSettled: true,
        cardIds: [],
      },
    },
    activeHandKey: null,
    status: 'player-turns' as const,
  };
  results.push(check('all bust skips bank draw', shouldSkipBankDraw(state.session, bustRound)));

  const ace = findCardId(deck, 'A');
  const king = findCardId(deck, 'K');
  results.push(
    check(
      'natural vs 6 pays immediately',
      shouldPayNaturalImmediately(
        LAS_VEGAS_PROTOCOL,
        [deck.cards.find((c) => c.id === ace)!, deck.cards.find((c) => c.id === king)!],
        '6',
      ),
    ),
  );
  results.push(
    check(
      'natural vs Ace offers even money path',
      shouldOfferEvenMoney(
        LAS_VEGAS_PROTOCOL,
        [deck.cards.find((c) => c.id === ace)!, deck.cards.find((c) => c.id === king)!],
        'A',
      ),
    ),
  );

  state = tableWithClaimedBox(1);
  const autoBox = boxPlayerId(state, 1)!;
  const eight = findCardId(deck, '8');
  state = {
    ...state,
    blackjack: actingRound(state, autoBox, [ten, eight], 25),
  };
  const autoResult = processPlayFlowAutoStands(state);
  results.push(
    check(
      'auto-stand 18+ stands hand',
      autoResult.blackjack?.playerHands[blackjackHandKey(autoBox, 0)]?.actionStatus === 'stood',
    ),
  );

  const hardRound = actingRound(state, autoBox, [five, six], 25);
  const hardHand = hardRound.playerHands[blackjackHandKey(autoBox, 0)]!;
  const autoOwnerId = state.tableMeta.ownerPersonId!;
  const doubleCtx = buildActiveRulesHandContext(
    LAS_VEGAS_PROTOCOL,
    state.ledger,
    hardRound,
    blackjackHandKey(autoBox, 0),
    deck,
    autoOwnerId,
    getAvailableChipsForBankrollOwner(state, autoOwnerId),
  );
  results.push(
    check(
      'double rule source is activeRules adapter',
      doubleCtx !== null &&
        canDoubleUnderProtocol(LAS_VEGAS_PROTOCOL, hardHand, doubleCtx),
    ),
  );

  let wagerState = confirmTableAgreement(tableWithClaimedBox(1), '$5', 500, 500);
  results.push(check('$5 select play displays $5', getTableWagerDisplay(wagerState) === '$5'));
  wagerState = confirmTableAgreement(tableWithClaimedBox(1), '$50', 500, 500);
  results.push(check('$50 select play displays $50', getTableWagerDisplay(wagerState) === '$50'));
  wagerState = confirmTableAgreement(tableWithClaimedBox(1), '$500', 500, 500);
  results.push(
    check(
      '$500 wager label separate from chip count',
      getTableWagerDisplay(wagerState) === '$500' && wagerState.tableMeta.agreement?.defaultChips === 500,
    ),
  );

  let insState = tableWithClaimedBox(1);
  insState = claimBoxSlot(insState, 2);
  const insB1 = boxPlayerId(insState, 1)!;
  const insB2 = boxPlayerId(insState, 2)!;
  const insPersonId = insState.tableMeta.ownerPersonId!;
  insState = addChipToBoxStake(insState, insB1, 50, insPersonId);
  insState = addChipToBoxStake(insState, insB2, 50, insPersonId);
  insState = confirmBoxStake(insState, insB1);
  insState = confirmBoxStake(insState, insB2);
  insState = syncCallersForDeal(insState, [insB1, insB2]);
  const aceId = findCardId(insState.deck!, 'A');
  const insRound: BlackjackRound = {
    ...actingRound(insState, insB1, [findCardId(insState.deck!, '10'), findCardId(insState.deck!, '9')], 50),
    status: 'player-turns',
    insuranceOfferPending: true,
    dealerCardIds: [aceId],
    dealerHoleHidden: true,
    activeHandKey: null,
    playerHands: {
      [blackjackHandKey(insB1, 0)]: {
        ...createBlackjackPlayerHand(insB1, 0),
        cardIds: [findCardId(insState.deck!, '10'), findCardId(insState.deck!, '9')],
        currentBet: 50,
        actionStatus: 'acting',
      },
      [blackjackHandKey(insB2, 0)]: {
        ...createBlackjackPlayerHand(insB2, 0),
        cardIds: [findCardId(insState.deck!, '8'), findCardId(insState.deck!, '7')],
        currentBet: 25,
        actionStatus: 'acting',
      },
    },
    insuranceDeclined: { [insB1]: true },
    insuranceBets: {},
  };
  results.push(
    check(
      'dealer ace waits for all insurance decisions',
      !allInsuranceResolved(insState, insRound, LAS_VEGAS_PROTOCOL),
    ),
  );
  results.push(
    check(
      'insurance pending blocks bank draw advance',
      applySkipBankIfNeeded(insState.session, insRound).status === 'player-turns' &&
        applySkipBankIfNeeded(insState.session, insRound).insuranceOfferPending === true,
    ),
  );
  const insResolvedRound = {
    ...insRound,
    insuranceDeclined: { [insB1]: true, [insB2]: true },
  };
  results.push(
    check(
      'all active boxes insurance resolved',
      allInsuranceResolved(insState, insResolvedRound, LAS_VEGAS_PROTOCOL),
    ),
  );

  if (typeof globalThis.localStorage === 'undefined') {
    const bag: Record<string, string> = {};
    (globalThis as { localStorage: Storage }).localStorage = {
      getItem: (key: string) => bag[key] ?? null,
      setItem: (key: string, value: string) => {
        bag[key] = value;
      },
      removeItem: (key: string) => {
        delete bag[key];
      },
      clear: () => {
        for (const key of Object.keys(bag)) {
          delete bag[key];
        }
      },
      key: (index: number) => Object.keys(bag)[index] ?? null,
      length: 0,
    } as Storage;
  }
  saveScoreLedgerEntries([]);
  const endBase = confirmTableAgreement(tableWithClaimedBox(1), '$5', 500, 500);
  const endBankId = endBase.session.bankPlayerId!;
  // Human-vs-human game so the personal (score) ledger applies.
  const endState = {
    ...endBase,
    players: {
      ...endBase.players,
      [endBankId]: { ...endBase.players[endBankId]!, playerType: 'real' as const },
    },
    tableMeta: {
      ...endBase.tableMeta,
      gameStatus: 'ended' as const,
      winnerId: endBankId,
      endedAt: new Date().toISOString(),
    },
  };
  const summary = buildGameOverSummary(endState);
  results.push(
    check(
      'game over summary uses $5 wager',
      summary.entry?.wagerDescription.includes('$5') ?? false,
    ),
  );
  addGameToPersonalLedger(endState);
  results.push(
    check(
      'completed game addable to personal ledger',
      loadScoreLedgerEntries().some((e) => e.tableId === endState.session.id && e.status === 'open'),
    ),
  );

  // Pure resolver — never mutate import.meta.env (a read-only constant in prod;
  // assigning to it compiles to `undefined = …` and crashes strict engines).
  results.push(
    check(
      'invite origin uses LAN host not localhost',
      resolveTableInviteOrigin('192.168.0.56:5137', null) === 'http://192.168.0.56:5137',
    ),
  );

  return { passed: results.every((r) => r.passed), results };
}
