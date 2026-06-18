import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTableInfoDisplay } from '../../components/tableInfoDisplay';
import { buildTablePeopleRows } from '../session/tablePeople';
import {
  canActCurrentHand,
  resolveViewerActionPermission,
} from '../session/boxDecisionOwnership';
import {
  getTotalCommittedExposureForPerson,
  getOpenStakeExposureForPerson,
} from '../session/playerCommittedExposure';
import { getAvailableChipsForBankrollOwner } from '../session/bankroll';
import { addChipToBoxStake } from '../blackjack/stakes';
import {
  syncPlayerOrderAndAssignments,
} from '../session/playerAssignment';
import { addPlayer, mergeSessionUpdate } from '../session/session';
import { allocateChipsToBankrollOwner } from '../session/allocation';
import {
  actingRound,
  boxPlayerId,
  findCardId,
  tableAfterStartPlaying,
} from '../blackjack/sanity/fixtures';
import { buildBlackjackCommandText } from '../../components/tableCommandDisplay';
import { canShowPlayerDecisionControls } from '../../components/blackjackViewPhase';
import { cardColumnHandValueClassName, boxStakeLabelClassName } from '../../components/boxHandValueDisplay';

function twoPlayerTable() {
  let state = tableAfterStartPlaying(500);
  const p1 = state.tableMeta.ownerPersonId!;
  const guestSpl = addPlayer(state.session, state.players, state.ledger, {
    displayName: 'K',
    controllerName: 'K',
    role: 'person',
    startingChips: 0,
  });
  state = mergeSessionUpdate(state, guestSpl);
  const p2 = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;
  state = allocateChipsToBankrollOwner(state, {
    bankrollOwnerId: p2,
    amount: 500,
    reason: 'initial-player',
    source: 'setup',
  });
  state = {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      playerOrder: [p1, p2],
    },
  };
  state = syncPlayerOrderAndAssignments(state);
  return { state, p1, p2 };
}

describe('playerCommittedExposure', () => {
  it('sums two 250 open stakes for the staker across native and co-boxes', () => {
    let { state, p1, p2 } = twoPlayerTable();
    const box1 = boxPlayerId(state, 1)!;
    const box2 = boxPlayerId(state, 2)!;
    state = addChipToBoxStake(state, box1, 50, p2);
    state = addChipToBoxStake(state, box1, 50, p2);
    state = addChipToBoxStake(state, box1, 50, p2);
    state = addChipToBoxStake(state, box1, 50, p2);
    state = addChipToBoxStake(state, box1, 50, p2);
    state = addChipToBoxStake(state, box2, 50, p2);
    state = addChipToBoxStake(state, box2, 50, p2);
    state = addChipToBoxStake(state, box2, 50, p2);
    state = addChipToBoxStake(state, box2, 50, p2);
    state = addChipToBoxStake(state, box2, 50, p2);

    expect(getOpenStakeExposureForPerson(state, p2)).toBe(500);
    expect(getTotalCommittedExposureForPerson(state, p2)).toBe(500);
    expect(getAvailableChipsForBankrollOwner(state, p2)).toBe(0);
    expect(getOpenStakeExposureForPerson(state, p1)).toBe(0);

    const tray = buildTableInfoDisplay(state, p2);
    const row = buildTablePeopleRows(state).find((r) => r.personId === p2)!;
    expect(tray.playerAvailable).toBe(0);
    expect(row.available).toBe(0);
    expect(row.betting).toBe(500);
  });

  it('does not attribute co-box stake to native box owner bankroll', () => {
    let { state, p1, p2 } = twoPlayerTable();
    const box1 = boxPlayerId(state, 1)!;
    state = addChipToBoxStake(state, box1, 50, p2);
    state = addChipToBoxStake(state, box1, 50, p2);
    state = addChipToBoxStake(state, box1, 50, p2);
    state = addChipToBoxStake(state, box1, 50, p2);
    state = addChipToBoxStake(state, box1, 50, p2);

    expect(getTotalCommittedExposureForPerson(state, p2)).toBe(250);
    expect(getTotalCommittedExposureForPerson(state, p1)).toBe(0);
    expect(getAvailableChipsForBankrollOwner(state, p2)).toBe(250);
  });
});

describe('player turn controls and command copy', () => {
  it('enables Hit/Stay for active box caller only', () => {
    let { state, p1, p2 } = twoPlayerTable();
    const box2 = boxPlayerId(state, 2)!;
    state = {
      ...state,
      blackjack: actingRound(
        state,
        box2,
        [findCardId(state.deck!, '3'), findCardId(state.deck!, '2')],
        250,
      ),
    };
    state.blackjack!.activeHandKey = `${box2}:0`;
    state.blackjack!.activePlayerId = box2;

    expect(canActCurrentHand(state, p2)).toBe(true);
    expect(canActCurrentHand(state, p1)).toBe(false);
    expect(resolveViewerActionPermission(state, p1).waitMessage).toMatch(
      /waiting for K/i,
    );
  });

  it('shows decision controls once active hand reveal completes during natural deal', () => {
    let { state } = twoPlayerTable();
    const box2 = boxPlayerId(state, 2)!;
    const deck = state.deck!;
    state = {
      ...state,
      blackjackFlowSettings: { ...state.blackjackFlowSettings, initialDealMode: 'natural' },
      blackjack: {
        ...actingRound(
          state,
          box2,
          [findCardId(deck, '9'), findCardId(deck, '2')],
          250,
        ),
        dealerCardIds: [findCardId(deck, '10'), findCardId(deck, '7')],
      },
    };
    state.blackjack!.activeHandKey = `${box2}:0`;

    expect(
      canShowPlayerDecisionControls(state, 'dealing', {
        cardRevealComplete: false,
        activeHandRevealComplete: true,
      }),
    ).toBe(true);
  });

  it('uses Box N — your turn for caller and waiting copy for others', () => {
    let { state, p1, p2 } = twoPlayerTable();
    const box2 = boxPlayerId(state, 2)!;
    state = {
      ...state,
      blackjack: actingRound(
        state,
        box2,
        [findCardId(state.deck!, '9'), findCardId(state.deck!, '2')],
        250,
      ),
    };
    state.blackjack!.activeHandKey = `${box2}:0`;

    const callerCmd = buildBlackjackCommandText({
      gameState: state,
      gameEnded: false,
      gameOverMessage: '',
      centerStatus: '',
      protocolPhase: 'player',
      roundSummaryLines: [],
      controllerName: 'Owner',
      viewerPersonId: p2,
    });
    const guestCmd = buildBlackjackCommandText({
      gameState: state,
      gameEnded: false,
      gameOverMessage: '',
      centerStatus: '',
      protocolPhase: 'player',
      roundSummaryLines: [],
      controllerName: 'Owner',
      viewerPersonId: p1,
    });
    expect(callerCmd.commandMessage).toBe('Box 2 — K — your turn.');
    expect(guestCmd.commandMessage).toBe('Box 2 — waiting for K to call.');
  });
});

describe('card column active value highlight', () => {
  it('applies circular active-turn class without box emphasis', () => {
    const active = cardColumnHandValueClassName(true, false, true);
    expect(active).toContain('bj-phone-view__box-value--active-turn');
    expect(active).not.toContain('bj-player-hand-value--emphasis');
    expect(active).not.toContain('bj-phone-view__box-value--above');
  });

  it('does not apply hand-total emphasis to stake label above box', () => {
    const stake = boxStakeLabelClassName(true, false, null);
    expect(stake).not.toContain('bj-player-hand-value--emphasis');
  });
});

describe('card row slot alignment source', () => {
  it('maps card columns from visible displaySlots in slot order', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(src).toMatch(
      /displaySlots\.map\(\(slot\)[\s\S]*renderArcCardColumn\(slot\.playerId, slot\.slotNumber\)/,
    );
    expect(src).toMatch(
      /displaySlots\.map\(\(slot\)[\s\S]*renderArcSlot\(slot\.slotNumber\)/,
    );
  });
});
