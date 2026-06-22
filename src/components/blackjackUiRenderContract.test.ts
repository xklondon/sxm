import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { blackjackHandKey } from '../engine/blackjack';
import {
  actingRound,
  boxPlayerId,
  findCardId,
  tableWithClaimedBox,
} from '../engine/blackjack/sanity/fixtures';
import { applyCardVisibility, emptyCardVisibility } from './blackjackDealingContract';
import {
  CANONICAL_COMMAND_STATUS_CLASS,
  CANONICAL_COMMAND_WRAPPER_CLASS,
  canShowEvenMoneyDecisionUi,
  createUiRevealContext,
  gateCommandMessageForReveal,
  resolveGatedCardAreaOutcomeMarker,
  resolveUiProtocolPhase,
} from './blackjackUiRenderContract';
import { buildBlackjackCommandText } from './tableCommandDisplay';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const CARD_VIEW_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');
const HERO_SRC = readFileSync(join(process.cwd(), 'src/components/CardViewDesktopHeroArea.tsx'), 'utf8');
const COMMAND_BOX_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCommandBox.tsx'), 'utf8');
const DEALER_BLOCK_SRC = readFileSync(join(process.cwd(), 'src/components/DealerBlock.tsx'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const SHELL_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-blackjack-table-shell.css'), 'utf8');
const CARD_AREA_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-full-table-card-area.css'), 'utf8');

function blackjackHandWithOneCardVisible() {
  let state = tableWithClaimedBox(1);
  const box1 = boxPlayerId(state, 1)!;
  const handKey = blackjackHandKey(box1, 0);
  const ace = findCardId(state.deck!, 'A');
  const king = findCardId(state.deck!, 'K');
  state = {
    ...state,
    blackjack: {
      ...actingRound(state, box1, [ace, king], 10),
      dealerCardIds: [findCardId(state.deck!, '10'), ''],
      dealerHoleHidden: true,
      evenMoneyOfferHandKey: handKey,
    },
  };
  const authHand = state.blackjack!.playerHands[handKey]!;
  authHand.actionStatus = 'blackjack';

  const visibility = emptyCardVisibility();
  visibility.hands[handKey] = 1;
  const displayState = applyCardVisibility(state, visibility);
  return { state, displayState, handKey, box1 };
}

describe('blackjackUiRenderContract — reveal gating', () => {
  it('does not show blackjack badge until both player cards are visibly revealed', () => {
    const { state, displayState, handKey } = blackjackHandWithOneCardVisible();
    const ctx = createUiRevealContext(state, displayState, false);

    expect(
      resolveGatedCardAreaOutcomeMarker(ctx, {
        showResults: false,
        outcome: undefined,
        actionStatus: 'blackjack',
        handKey,
        handTotal: 21,
      }),
    ).toBeNull();

    const fullDisplay = applyCardVisibility(state, {
      dealer: 1,
      hands: { [handKey]: 2 },
    });
    const revealedCtx = createUiRevealContext(state, fullDisplay, false);
    expect(
      resolveGatedCardAreaOutcomeMarker(revealedCtx, {
        showResults: false,
        outcome: undefined,
        actionStatus: 'blackjack',
        handKey,
        handTotal: 21,
      }),
    ).toBe('blackjack');
  });

  it('gates even-money command text until the offer hand is visibly revealed', () => {
    const { state, displayState, handKey } = blackjackHandWithOneCardVisible();
    const ctx = createUiRevealContext(state, displayState, false);

    expect(canShowEvenMoneyDecisionUi(ctx)).toBe(false);
    expect(
      gateCommandMessageForReveal(
        ctx,
        'Dealer may have blackjack — take even money (1:1)?',
        'dealing',
      ),
    ).toBe('Dealing…');

    const fullDisplay = applyCardVisibility(state, {
      dealer: 1,
      hands: { [handKey]: 2 },
    });
    const revealedCtx = createUiRevealContext(state, fullDisplay, true);
    expect(canShowEvenMoneyDecisionUi(revealedCtx)).toBe(true);
    expect(
      gateCommandMessageForReveal(
        revealedCtx,
        'Dealer may have blackjack — take even money (1:1)?',
        'player',
      ),
    ).toContain('even money');
  });

  it('defers UI protocol phase from even-money until reveal catches up', () => {
    const { state, displayState, handKey } = blackjackHandWithOneCardVisible();
    const ctx = createUiRevealContext(state, displayState, false);
    expect(resolveUiProtocolPhase(ctx)).toBe('dealing');

    const fullDisplay = applyCardVisibility(state, {
      dealer: 1,
      hands: { [handKey]: 2 },
    });
    const revealedCtx = createUiRevealContext(state, fullDisplay, true);
    expect(resolveUiProtocolPhase(revealedCtx)).not.toBe('dealing');
  });

  it('buildBlackjackCommandText returns Dealing… for premature blackjack/even-money', () => {
    const { state, displayState } = blackjackHandWithOneCardVisible();
    const cmd = buildBlackjackCommandText({
      gameState: state,
      displayState,
      cardRevealComplete: false,
      gameEnded: false,
      gameOverMessage: '',
      centerStatus: 'Blackjack.',
      protocolPhase: 'dealing',
      roundSummaryLines: [],
      controllerName: 'Host',
    });
    expect(cmd.commandMessage).toBe('Dealing…');
    expect(cmd.commandMessage).not.toMatch(/even money|1:1/i);
    expect(cmd.commandMessage).not.toMatch(/Blackjack/i);
  });
});

describe('blackjackUiRenderContract — canonical command path', () => {
  it('uses one BlackjackCommandBox route with canonical wrapper + yellow status class', () => {
    expect(COMMAND_BOX_SRC).toContain('TABLE_UX.cardLayoutCommand');
    expect(CANONICAL_COMMAND_WRAPPER_CLASS).toBe('bj-card-layout__command');
    expect(DEALER_BLOCK_SRC).toContain('CANONICAL_COMMAND_STATUS_CLASS');
    expect((PANEL_SRC.match(/<BlackjackCommandBox/g) ?? []).length).toBe(1);
    expect(PANEL_SRC).toContain('omitCommand');
    expect(CARD_VIEW_SRC).not.toContain('BlackjackCommandBox');
    expect(CARD_VIEW_SRC).not.toContain('buildBlackjackCommandText');
  });

  it('styles canonical command text as yellow/gold in the command zone', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--summary \.dealer-block__status\s*\{[\s\S]*?color:\s*var\(--ds-color-gold/,
    );
  });
});

describe('blackjackUiRenderContract — views use gated outcome markers', () => {
  it('Full Table, Card View, and desktop hero use resolveGatedCardAreaOutcomeMarker', () => {
    expect(PANEL_SRC).toContain('resolveGatedCardAreaOutcomeMarker');
    expect(PANEL_SRC).toContain('createUiRevealContext');
    expect(PANEL_SRC).toContain('canShowEvenMoneyDecisionUi');
    expect(PANEL_SRC).toContain('canShowInsuranceDecisionUi');
    expect(CARD_VIEW_SRC).toContain('resolveGatedCardAreaOutcomeMarker');
    expect(HERO_SRC).toContain('resolveGatedCardAreaOutcomeMarker');
    expect(PANEL_SRC).not.toMatch(
      /renderArcCardColumn[\s\S]{0,400}resolveCardAreaOutcomeMarker\(/,
    );
  });
});

describe('blackjackUiRenderContract — layout overlap guards', () => {
  it('desktop Full Table cards zone clips stacks (no bleed into command zone)', () => {
    const rule =
      SHELL_CSS.match(
        /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table\s*\{[^}]*\}/,
      )?.[0] ?? '';
    expect(rule).toContain('overflow: hidden');
    expect(rule).toContain('justify-content: flex-end');
  });

  it('mobile Full Table cards zone clips stacks and does not margin-push arc into boxes', () => {
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell > \.bj-table-zone--cards\.bj-cards-area--table[\s\S]*?overflow:\s*hidden/,
    );
    const mobileArcRule =
      CARD_AREA_CSS.match(
        /@media[\s\S]*?\.bj-view-full-mobile[\s\S]*?\.bj-table-slot-row\.bj-arc--cards\s*\{[^}]*\}/,
      )?.[0] ?? '';
    expect(mobileArcRule).toContain('margin-top: 0');
    expect(CARD_AREA_CSS).toMatch(
      /\.bj-view-full-mobile[\s\S]*?\.bj-arc__play-zone[\s\S]*?justify-content:\s*flex-end/,
    );
  });

  it('does not move boxes/tray with margin-top:auto or transforms', () => {
    const PLAYER_ROW_CSS = readFileSync(
      join(process.cwd(), 'src/styles/bj-player-row-layout.css'),
      'utf8',
    );
    expect(PLAYER_ROW_CSS).not.toMatch(
      /\.bj-table-zone--(?:boxes|bottom)[\s\S]{0,200}margin-top:\s*auto/,
    );
    expect(PLAYER_ROW_CSS).not.toMatch(
      /\.bj-table-zone--(?:boxes|bottom)[\s\S]{0,200}transform:/,
    );
  });
});
