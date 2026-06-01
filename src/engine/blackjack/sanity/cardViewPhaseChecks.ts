import type { GameState } from '../../../types';
import { confirmTableAgreement } from '../../session/table';
import { getTableWagerDisplay } from '../../session/wagerDisplay';
import {
  addChipToBoxStake,
  getStakeForBox,
  removeLastChipFromBoxStake,
} from '../stakes';
import { getAvailableChipsForBankrollOwner } from '../../session/bankroll';
import { applySkipBankIfNeeded } from '../roundFlow';
import { allInsuranceResolved } from '../insurance';
import { LAS_VEGAS_PROTOCOL } from '../protocols';
import { addGameToPersonalLedger } from '../../scoreLedger/scoreLedger';
import { loadScoreLedgerEntries, saveScoreLedgerEntries } from '../../../storage/scoreLedgerStorage';
import { createBlackjackPlayerHand } from '../../../types/blackjack';
import { claimBoxSlot } from '../../session/boxOps';
import { canDoubleBlackjackForState } from '../validation';
import {
  actionButtonsUseTappableClass,
  getCardViewHeroBoxId,
  getCardViewHeroHandKey,
  getPendingInsurancePlayerIds,
  heroActionsRenderBeforeCards,
  isBettingPhase,
  isCardViewMiniBox,
  isInsurancePhase,
  isPlayerTurnPhase,
  miniBoxesRenderAfterHeroCards,
  showBettingFooter,
  showBettingMainStage,
  showDealerHeader,
  showEvenMoneyControls,
  showInsuranceControls,
  showPlayerActionControls,
  showStitchedActionControls,
  showStitchedPlayerCards,
  sideControlsUseSideButtonClass,
} from '../../../components/blackjackViewPhase';
import { BLACKJACK_TABLE_LAYOUT } from '../../../components/blackjackTableLayout';
import { check, type SanitySuiteResult } from './types';
import { actingRound, boxPlayerId, findCardId, tableWithClaimedBox } from './fixtures';
import { blackjackHandKey } from '../handKeys';
import type { BlackjackRound } from '../../../types/blackjack';

export function runCardViewPhaseChecks(): SanitySuiteResult {
  const results = [];

  let state = confirmTableAgreement(tableWithClaimedBox(1), '$5', 500, 500);
  results.push(check('card view wager is stakeDescription $5', getTableWagerDisplay(state) === '$5'));

  results.push(check('betting footer only in betting phase', showBettingFooter('betting', false)));
  results.push(check('betting main stage in betting phase', showBettingMainStage('betting', false)));
  results.push(check('no player cards in betting phase', !showStitchedPlayerCards('betting', false, 2)));
  results.push(check('stitched cards when hand dealt in player phase', showStitchedPlayerCards('player', false, 2)));
  results.push(check('dealer header hidden in betting', !showDealerHeader('betting', false)));
  results.push(check('dealer header visible in player phase', showDealerHeader('player', false)));
  results.push(check('no stitched actions in betting', !showStitchedActionControls('betting', null)));
  results.push(check('no betting footer during player turn', !showBettingFooter('player', false)));
  results.push(check('no betting footer when game ended', !showBettingFooter('betting', true)));

  const personId = state.tableMeta.ownerPersonId!;
  const boxId = boxPlayerId(state, 1)!;
  const availableBefore = getAvailableChipsForBankrollOwner(state, personId);
  state = addChipToBoxStake(state, boxId, 10, personId);
  state = addChipToBoxStake(state, boxId, 5, personId);
  state = removeLastChipFromBoxStake(state, boxId);
  results.push(
    check(
      'card view top-chip retraction restores available',
      getStakeForBox(state, boxId) === 10 &&
        getAvailableChipsForBankrollOwner(state, personId) === availableBefore - 10,
    ),
  );

  const playerRound = actingRound(state, boxId, [findCardId(state.deck!, '10'), findCardId(state.deck!, '9')], 25);
  results.push(
    check(
      'player action controls in player phase',
      showPlayerActionControls('player', playerRound),
    ),
  );
  results.push(
    check(
      'no player controls during insurance phase',
      !showPlayerActionControls('insurance', { ...playerRound, insuranceOfferPending: true }),
    ),
  );

  const evenMoneyRound = { ...playerRound, evenMoneyOfferHandKey: `${boxId}:0`, activeHandKey: `${boxId}:0` };
  results.push(
    check('even-money controls replace player actions', showEvenMoneyControls('player', evenMoneyRound)),
  );
  results.push(
    check(
      'even-money hides hit/stand controls',
      showEvenMoneyControls('player', evenMoneyRound) &&
        !showPlayerActionControls('player', evenMoneyRound),
    ),
  );

  let insState = tableWithClaimedBox(1);
  insState = claimBoxSlot(insState, 2);
  const insB1 = boxPlayerId(insState, 1)!;
  const insB2 = boxPlayerId(insState, 2)!;
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

  results.push(check('insurance phase selector', isInsurancePhase('insurance')));
  results.push(
    check('insurance controls visible in insurance phase', showInsuranceControls('insurance', insRound)),
  );
  results.push(
    check(
      'dealer ace waits for all insurance before bank',
      !allInsuranceResolved(insState.session, insRound, LAS_VEGAS_PROTOCOL) &&
        applySkipBankIfNeeded(insState.session, insRound).status === 'player-turns',
    ),
  );
  results.push(
    check(
      'pending insurance lists unresolved eligible boxes',
      getPendingInsurancePlayerIds(insState, insRound).includes(insB2),
    ),
  );

  state = confirmTableAgreement(tableWithClaimedBox(1), '$5', 500, 500);
  state = {
    ...state,
    blackjack: actingRound(state, boxPlayerId(state, 1)!, [findCardId(state.deck!, '5'), findCardId(state.deck!, '6')], 25),
  };
  results.push(
    check(
      'card view double respects activeRules',
      canDoubleBlackjackForState(state, `${boxPlayerId(state, 1)!}:0`),
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
  const endState: GameState = {
    ...endBase,
    players: {
      ...endBase.players,
      [endBankId]: { ...endBase.players[endBankId]!, playerType: 'real' },
    },
    tableMeta: {
      ...endBase.tableMeta,
      gameStatus: 'ended',
      winnerId: endBankId,
      endedAt: new Date().toISOString(),
    },
  };
  addGameToPersonalLedger(endState);
  results.push(
    check(
      'ended game personal ledger add',
      loadScoreLedgerEntries().some((e) => e.tableId === endState.session.id),
    ),
  );

  results.push(check('betting phase flag', isBettingPhase('betting')));
  results.push(check('player phase flag', isPlayerTurnPhase('player')));

  const box1 = boxPlayerId(state, 1)!;
  let twoBoxState = claimBoxSlot(tableWithClaimedBox(1), 2);
  const box2 = boxPlayerId(twoBoxState, 2)!;
  twoBoxState = { ...twoBoxState, selectedSeatId: box1 };
  results.push(
    check(
      'betting hero is selected seat',
      getCardViewHeroBoxId('betting', null, box1, box2) === box1,
    ),
  );
  results.push(
    check(
      'player hero follows active turn box',
      getCardViewHeroBoxId('player', box2, box1, box1) === box2,
    ),
  );
  results.push(
    check(
      'turn advance switches hero box',
      getCardViewHeroBoxId('player', box1, box1, box1) === box1 &&
        getCardViewHeroBoxId('player', box2, box1, box1) === box2,
    ),
  );
  results.push(
    check(
      'hero hand key tracks active hand on turn box',
      getCardViewHeroHandKey(
        'player',
        { ...actingRound(twoBoxState, box2, [findCardId(twoBoxState.deck!, '10'), findCardId(twoBoxState.deck!, '9')], 25), activeHandKey: `${box2}:0` },
        box2,
      ) === `${box2}:0`,
    ),
  );
  results.push(
    check(
      'non-current box is mini representation',
      isCardViewMiniBox(box1, box2) && !isCardViewMiniBox(box2, box2),
    ),
  );
  results.push(
    check(
      'shared dealer actions layout anchor',
      BLACKJACK_TABLE_LAYOUT.dealerActions === 'dealer-block__actions',
    ),
  );
  results.push(
    check(
      'shared accounts panel layout anchor',
      BLACKJACK_TABLE_LAYOUT.accountsPanel === 'bj-accounts-panel',
    ),
  );
  results.push(
    check(
      'shared chip tray layout anchor',
      BLACKJACK_TABLE_LAYOUT.chipTrayWrap === 'bj-casino__tray-wrap',
    ),
  );

  results.push(
    check(
      'playing phase total/actions render before hero cards',
      heroActionsRenderBeforeCards(),
    ),
  );
  results.push(
    check(
      'playing phase mini boxes render after hero cards',
      miniBoxesRenderAfterHeroCards(),
    ),
  );
  results.push(check('hit/stand use side button class', sideControlsUseSideButtonClass()));
  results.push(check('2x/split/AID use tappable action class', actionButtonsUseTappableClass()));

  return { passed: results.every((r) => r.passed), results };
}
