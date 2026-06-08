import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildBlackjackCommandText,
  formatPlayerTurnCommand,
} from './tableCommandDisplay';
import {
  actingRound,
  boxPlayerId,
  findCardId,
  tableWithClaimedBox,
} from '../engine/blackjack/sanity/fixtures';
import { addPlayer, mergeSessionUpdate } from '../engine/session';
import { allocateChipsToBankrollOwner } from '../engine/session/allocation';
import { claimBoxSlot } from '../engine/session/boxOps';
describe('multiplayer turn-owner visibility (UI)', () => {
  it('non-caller sees waiting message in command area', () => {
    let state = tableWithClaimedBox(1);
    const ownerId = state.tableMeta.ownerPersonId!;
    const guestSpl = addPlayer(state.session, state.players, state.ledger, {
      displayName: 'Bob',
      controllerName: 'Bob',
      role: 'person',
      startingChips: 500,
    });
    state = mergeSessionUpdate(state, guestSpl);
    const bobId = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;
    state = allocateChipsToBankrollOwner(state, {
      bankrollOwnerId: bobId,
      amount: 500,
      reason: 'initial-player',
      source: 'setup',
    });
    state = claimBoxSlot(state, 2);
    const box2 = boxPlayerId(state, 2)!;
    state = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        boxSlots: state.tableMeta.boxSlots.map((s) =>
          s.slotNumber === 2
            ? { ...s, nativeAssignedPersonId: bobId, bankrollOwnerId: bobId }
            : s,
        ),
      },
    };
    state = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        playerOrder: [ownerId, bobId],
        assignedBoxByPersonId: { [ownerId]: 1, [bobId]: 2 },
      },
      blackjack: actingRound(
        state,
        box2,
        [findCardId(state.deck!, '6'), findCardId(state.deck!, '7')],
        10,
      ),
    };
    state.blackjack!.activeHandKey = `${box2}:0`;
    state.blackjack!.activePlayerId = box2;

    const result = buildBlackjackCommandText({
      gameState: state,
      gameEnded: false,
      gameOverMessage: '',
      centerStatus: '',
      protocolPhase: 'player',
      roundSummaryLines: [],
      controllerName: 'Alice',
      viewerPersonId: ownerId,
    });
    expect(result.commandMessage).toBe('Box 2 — waiting for Bob to call.');
  });

  it('caller sees turn message with their display name', () => {
    let state = tableWithClaimedBox(1);
    const ownerId = state.tableMeta.ownerPersonId!;
    const guestSpl = addPlayer(state.session, state.players, state.ledger, {
      displayName: 'Bob',
      controllerName: 'Bob',
      role: 'person',
      startingChips: 500,
    });
    state = mergeSessionUpdate(state, guestSpl);
    const bobId = guestSpl.session.playerIds[guestSpl.session.playerIds.length - 1]!;
    state = claimBoxSlot(state, 2);
    const box2 = boxPlayerId(state, 2)!;
    state = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        boxSlots: state.tableMeta.boxSlots.map((s) =>
          s.slotNumber === 2
            ? { ...s, nativeAssignedPersonId: bobId, bankrollOwnerId: bobId }
            : s,
        ),
      },
    };
    state = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        playerOrder: [ownerId, bobId],
        assignedBoxByPersonId: { [ownerId]: 1, [bobId]: 2 },
      },
      blackjack: actingRound(
        state,
        box2,
        [findCardId(state.deck!, '6'), findCardId(state.deck!, '7')],
        10,
      ),
    };
    state.blackjack!.activeHandKey = `${box2}:0`;

    const result = buildBlackjackCommandText({
      gameState: state,
      gameEnded: false,
      gameOverMessage: '',
      centerStatus: '',
      protocolPhase: 'player',
      roundSummaryLines: [],
      controllerName: 'Wrong',
      viewerPersonId: bobId,
    });
    expect(result.commandMessage).toBe(
      formatPlayerTurnCommand(2, 'Bob', { value: 13, isSoft: false, isBlackjack: false }),
    );
  });

  it('Card View uses viewer person id not profile name for controls', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');
    expect(src).toContain('resolveViewerPersonIdForTable');
    expect(src).toContain('viewerPersonId');
    expect(src).not.toMatch(/resolveControllerPersonId\(logicalGameState/);
  });

  it('mobile action bar has compact playing layout styles', () => {
    const sharedCss = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
    expect(sharedCss).toMatch(/\.bj-table-layout-shell \.bj-table-zone--actions \.bj-table-actions[\s\S]*gap:/);
    expect(sharedCss).toMatch(
      /\.bj-phone-view__mini-hand-card-stack[\s\S]*position:\s*relative/,
    );
  });
});
