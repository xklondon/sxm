import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import type { BlackjackRound, GameState } from '../types';
import { BlackjackPanel } from './BlackjackPanel';
import { InsuranceDecisionOverlay } from './InsuranceDecisionOverlay';
import {
  affirmChipTargetAfterPlacement,
  createEmptyLocalChipTarget,
  getCurrentChipTargetForBetting,
  reconcileLocalChipTarget,
  resolveTrayTargetFromLocalSelection,
  selectLocalChipTarget,
} from './localChipTargetSelection';
import { resolvePlaceBetPayloadTarget } from './blackjackBoxPlacementContract';
import { placeBetPayloadFromTarget } from '../engine/blackjack/chipPlacement';
import { addChipToBoxStake, getStakeForBox } from '../engine/blackjack/stakes';
import { claimBoxSlot } from '../engine/session';
import { resolveControllerPersonId } from '../engine/session';
import {
  actingRound,
  boxPlayerId,
  findCardId,
  tableAfterStartPlaying,
  tableWithClaimedBox,
} from '../engine/blackjack/sanity/fixtures';
import { confirmBoxStake } from '../engine/blackjack';
import {
  createMobileLayoutMatchMedia,
  type SimulatedViewport,
} from '../test/mobileLayoutMatchMedia';

const noop = () => {};
const CHIP_CSS = readFileSync(join(process.cwd(), 'src/components/ChipStack.css'), 'utf8');

let simulatedViewport: SimulatedViewport = { width: 390, height: 844 };
const globalRef = globalThis as unknown as { window?: unknown };
const hadWindow = 'window' in globalRef;

beforeAll(() => {
  globalRef.window = {
    matchMedia: createMobileLayoutMatchMedia(() => simulatedViewport),
  };
});

afterAll(() => {
  if (!hadWindow) {
    delete globalRef.window;
  }
});

function insuranceState(): GameState {
  let state = tableWithClaimedBox(1);
  const boxId = boxPlayerId(state, 1)!;
  const personId = state.tableMeta.ownerPersonId!;
  state = addChipToBoxStake(state, boxId, 50, personId);
  state = confirmBoxStake(state, boxId);
  const aceId = findCardId(state.deck!, 'A');
  const holeId = findCardId(state.deck!, '9');
  const round: BlackjackRound = {
    ...actingRound(
      state,
      boxId,
      [findCardId(state.deck!, '10'), findCardId(state.deck!, '9')],
      50,
    ),
    status: 'player-turns',
    insuranceOfferPending: true,
    dealerCardIds: [aceId, holeId],
    dealerHoleHidden: true,
    activeHandKey: null,
    activePlayerId: null,
  };
  return { ...state, blackjack: round, tableViewMode: 'full' };
}

describe('insurance overlay under command area', () => {
  it('renders compact overlay with both actions and 2:1 hint', () => {
    const overlayHtml = renderToStaticMarkup(
      <InsuranceDecisionOverlay
        boxLabel="Box 1"
        maxBet={25}
        canAfford
        onInsurance={noop}
        onDecline={noop}
      />,
    );
    expect(overlayHtml).toContain('bj-insurance-overlay');
    expect(overlayHtml).toContain('pays 2:1');
    expect(overlayHtml).toContain('Insurance 25');
    expect(overlayHtml).toMatch(/Don(&#x27;|&apos;)t Insure/);
  });

  it('mobile insurance phase expands command shell and keeps overlay visible', () => {
    const css = readFileSync(join(process.cwd(), 'src/components/InsuranceDecisionOverlay.css'), 'utf8');
    expect(css).toMatch(
      /\.bj-view-full-mobile\[data-phase='insurance'\][\s\S]*overflow:\s*visible/,
    );
    expect(css).toMatch(
      /\.bj-view-card-mobile\[data-phase='insurance'\][\s\S]*\.bj-insurance-overlay[\s\S]*z-index:\s*14/,
    );
  });

  it('Ace up-card panel renders insurance overlay in canonical action layer', () => {
    simulatedViewport = { width: 390, height: 844 };
    const html = renderToStaticMarkup(
      <BlackjackPanel gameState={insuranceState()} onGameStateChange={noop} />,
    );
    expect(html).toContain('bj-table-action-overlays');
    expect(html).toContain('bj-insurance-overlay');
    expect(html).toContain('pays 2:1');
    expect(html).toContain('Insurance 25');
    expect(html).toMatch(/Don(&#x27;|&apos;)t Insure/);
  });
});

describe('tray group center alignment', () => {
  it('centers balance and chip plaques as a group on mobile', () => {
    expect(CHIP_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-value-chips__row--main[\s\S]*?justify-content:\s*center/,
    );
    expect(CHIP_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-value-chips__stash[\s\S]*?justify-content:\s*center/,
    );
    expect(CHIP_CSS).toMatch(
      /\.bj-view-card-mobile \.bj-value-chips \.chip-tray__chips[\s\S]*?justify-content:\s*center/,
    );
  });
});

describe('fast chip taps on boxes 2–4', () => {
  for (const slotNumber of [2, 3, 4] as const) {
    it(`triple tap on Box ${slotNumber} keeps slot anchor and increases stake`, () => {
      let state = tableAfterStartPlaying(500);
      state = claimBoxSlot(state, 1);
      const personId = resolveControllerPersonId(state, 'Alice')!;
      let local = selectLocalChipTarget(createEmptyLocalChipTarget(), slotNumber);

      let optimistic = claimBoxSlot(state, slotNumber);
      const serverBoxId = boxPlayerId(optimistic, slotNumber)!;
      optimistic = addChipToBoxStake(optimistic, serverBoxId, 5, personId);
      local = affirmChipTargetAfterPlacement(local, optimistic, slotNumber, true);

      for (let tap = 0; tap < 3; tap += 1) {
        expect(resolveTrayTargetFromLocalSelection(local, optimistic, true, personId)).toEqual({
          kind: 'box',
          boxId: serverBoxId,
        });

        const payloadTarget = resolvePlaceBetPayloadTarget(
          optimistic,
          slotNumber,
          true,
          tap > 0,
        );
        expect(placeBetPayloadFromTarget(payloadTarget, 5)).toEqual(
          tap > 0 ? { slotNumber, amount: 5 } : { boxId: serverBoxId, amount: 5 },
        );

        optimistic = addChipToBoxStake(optimistic, serverBoxId, 5, personId);
        local = affirmChipTargetAfterPlacement(local, optimistic, slotNumber, true);
      }

      expect(getStakeForBox(optimistic, serverBoxId)).toBe(20);
    });
  }

  it('Box 1 keeps box id reference behavior', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const personId = resolveControllerPersonId(state, 'Alice')!;
    const box1 = boxPlayerId(state, 1)!;
    let local = selectLocalChipTarget(createEmptyLocalChipTarget(), 1);

    for (let tap = 0; tap < 2; tap += 1) {
      state = addChipToBoxStake(state, box1, 10, personId);
      local = affirmChipTargetAfterPlacement(local, state, 1, true);
      const payload = resolvePlaceBetPayloadTarget(state, 1, true, false);
      expect(placeBetPayloadFromTarget(payload, 10)).toEqual({ boxId: box1, amount: 10 });
    }
  });

  it('stale optimistic boxId resolves via slotNumber at payload time', () => {
    let state = tableAfterStartPlaying(500);
    const staleBoxId = 'client-stale-box-2';
    const personId = state.tableMeta.ownerPersonId!;
    state = {
      ...state,
      players: {
        ...state.players,
        [staleBoxId]: {
          id: staleBoxId,
          displayName: 'Box 2',
          controllerName: 'Alice',
          role: 'box' as const,
          bankrollOwnerId: personId,
          playerType: 'real' as const,
          startingBalance: 0,
          currentBet: 0,
          cardIds: [],
          status: 'active' as const,
        },
      },
      session: {
        ...state.session,
        boxSlotNumbers: { ...state.session.boxSlotNumbers, [staleBoxId]: 2 },
      },
    };

    const payloadTarget = resolvePlaceBetPayloadTarget(state, 2, true, false);
    expect(payloadTarget).toEqual({ kind: 'slot', slotNumber: 2 });
  });

  it('error path does not clear valid slot target', () => {
    let state = tableAfterStartPlaying(500);
    const staleBoxId = 'client-stale-box-3';
    const personId = state.tableMeta.ownerPersonId!;
    state = {
      ...state,
      players: {
        ...state.players,
        [staleBoxId]: {
          id: staleBoxId,
          displayName: 'Box 3',
          controllerName: 'Alice',
          role: 'box' as const,
          bankrollOwnerId: personId,
          playerType: 'real' as const,
          startingBalance: 0,
          currentBet: 0,
          cardIds: [],
          status: 'active' as const,
        },
      },
      session: {
        ...state.session,
        boxSlotNumbers: { ...state.session.boxSlotNumbers, [staleBoxId]: 3 },
      },
    };

    let local = selectLocalChipTarget(createEmptyLocalChipTarget(), 3);
    local = reconcileLocalChipTarget(local, state, true);

    const betting = getCurrentChipTargetForBetting({
      ref: local,
      state: local,
      gameState: state,
      online: true,
      viewerPersonId: personId,
      visibleBoxCount: 4,
    });
    expect(betting.ok).toBe(true);
    if (betting.ok) {
      expect(betting.slotNumber).toBe(3);
    }
  });
});
