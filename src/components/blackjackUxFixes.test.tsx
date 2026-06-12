import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import { blackjackHandKey } from '../engine/blackjack';
import {
  actingRound,
  boxPlayerId,
  findCardId,
  tableAfterStartPlaying,
  tableWithClaimedBox,
} from '../engine/blackjack/sanity/fixtures';
import { TableInfoBar } from './TableInfoBar';
import { BlackjackCardView } from './BlackjackCardView';
import {
  buildBlackjackCommandText,
  formatPlayerTurnCommand,
  formatPlayerTurnOptions,
} from './tableCommandDisplay';
import {
  BOX_BORDER_TURN,
  getBoxActivePulseClassName,
  getBoxBorderVisualClasses,
  resolveBoxBorderVisualState,
} from './cardViewBox';
import { CARD_VIEW_BUST_HOLD_MS } from './blackjackUxConstants';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const CARD_VIEW_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');
const CARD_VIEW_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.css'), 'utf8');
const CARD_LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const PLAYER_ROW_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-player-row-layout.css'), 'utf8');
const TABLE_INFO_SRC = readFileSync(join(process.cwd(), 'src/components/TableInfoBar.tsx'), 'utf8');
const COMMAND_SRC = readFileSync(join(process.cwd(), 'src/components/tableCommandDisplay.ts'), 'utf8');
const MASTER_SPEC = readFileSync(join(process.cwd(), 'docs/SXM_MASTER_SPEC.md'), 'utf8');
const CHANGE_LOG = readFileSync(join(process.cwd(), 'docs/CHANGE_LOG.md'), 'utf8');

describe('blackjack UX fixes — player box stability', () => {
  it('reserves fixed stake and composition space in slot row', () => {
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-table-slot-row\.bj-arc--player-boxes[\s\S]*\.bj-phone-view__mini-stake-slot[\s\S]*flex:\s*0 0 var\(--bj-full-table-stake-min-height/,
    );
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-phone-view__mini-hand-composition[\s\S]*min-height:\s*1\.05rem/,
    );
  });
});

describe('blackjack UX fixes — active turn highlight', () => {
  it('applies shared bj-box--turn class for active player turn', () => {
    let state = tableAfterStartPlaying(500);
    state = {
      ...state,
      blackjack: {
        ...state.blackjack!,
        status: 'player-turns',
        activeHandKey: `${boxPlayerId(state, 1)!}:0`,
        activePlayerId: boxPlayerId(state, 1)!,
      },
    };
    const box1 = boxPlayerId(state, 1)!;
    const resolved = resolveBoxBorderVisualState({
      state,
      boxPlayerId: box1,
      viewerPersonId: state.tableMeta.boxSlots[0]?.bankrollOwnerId,
      activeBoxId: box1,
      playerPhase: true,
    });
    expect(getBoxBorderVisualClasses(resolved)).toContain(BOX_BORDER_TURN);
    expect(getBoxActivePulseClassName(resolved)).toBe('');
    expect(PANEL_SRC).toContain('getBoxActivePulseClassName(borderState)');
    expect(PANEL_SRC).toContain('getBoxCardVisualClasses(borderState)');
  });
});

describe('blackjack UX fixes — Card View bust hold', () => {
  it('defines 3 second Card View hand hold and wires hero override', () => {
    expect(CARD_VIEW_BUST_HOLD_MS).toBe(3000);
    expect(PANEL_SRC).toContain('useCardViewBustHold');
    expect(PANEL_SRC).toContain('uiActiveBoxId');
    expect(PANEL_SRC).toContain('heroHandKeyOverride');
    expect(PANEL_SRC).toContain('handHoldActive');
  });
});

describe('blackjack UX fixes — Card View hero layout', () => {
  it('uses clamp-based hero card sizing tokens', () => {
    expect(CARD_LAYOUT_CSS).toMatch(/--bj-card-hero-card-width:\s*clamp\(/);
    expect(CARD_LAYOUT_CSS).toMatch(/--bj-card-hero-card-max-height:\s*clamp\(/);
  });

  it('renders hand total above hero cards', () => {
    expect(CARD_VIEW_SRC).toContain('bj-phone-view__hand-meta--above-cards');
    let state = tableWithClaimedBox(1);
    const box1 = boxPlayerId(state, 1)!;
    const k1 = blackjackHandKey(box1, 0);
    state = {
      ...state,
      blackjack: actingRound(state, box1, [findCardId(state.deck!, '10'), findCardId(state.deck!, '7')], 10),
    };
    state.blackjack!.activeHandKey = k1;
    const html = renderToStaticMarkup(
      <BlackjackCardView
        gameState={state}
        protocolPhase="player"
        activeBoxId={box1}
        showHoleHidden={false}
        bettingOpen={false}
        gameEnded={false}
        onStay={() => {}}
        onCard={() => {}}
        onBack={() => {}}
        cardRevealComplete
        activeHandRevealComplete
      />,
    );
    const aboveIdx = html.indexOf('bj-phone-view__hand-meta--above-cards');
    const cardsIdx = html.indexOf('bj-phone-view__cards-slot');
    expect(aboveIdx).toBeGreaterThan(-1);
    expect(cardsIdx).toBeGreaterThan(aboveIdx);
  });

  it('shows mobile side indicators beside hero (not hidden)', () => {
    expect(CARD_VIEW_CSS).not.toMatch(
      /\.bj-view-card-mobile \.bj-phone-view__side-action\s*\{[\s\S]*display:\s*none/,
    );
    expect(CARD_VIEW_SRC).toContain('bj-phone-view__side-action--stand');
    expect(CARD_VIEW_SRC).toContain('Hit me');
  });

  it('uses natural blackjack label animation only for clean blackjack status', () => {
    expect(CARD_VIEW_SRC).toContain("actionStatus === 'blackjack'");
    expect(CARD_VIEW_SRC).toContain('bj-phone-view__total--blackjack');
    expect(CARD_VIEW_CSS).toContain('bj-hero-blackjack-pulse');
  });
});

describe('blackjack UX fixes — dealer info layout', () => {
  it('shows bank chips in felt row and hand value under dealer cards', () => {
    expect(TABLE_INFO_SRC).toContain('bj-table-info-bar__bank-summary');
    expect(TABLE_INFO_SRC).toContain('bj-table-info-bar--dealer-hand');
    expect(TABLE_INFO_SRC).not.toMatch(
      /bj-table-info-bar--felt-row[\s\S]{0,400}Bank Hand:/,
    );
    expect(PANEL_SRC).toContain('variant="dealer"');

    const feltHtml = renderToStaticMarkup(
      <TableInfoBar gameState={tableAfterStartPlaying(500)} viewerPersonId={null} variant="felt" />,
    );
    expect(feltHtml).toMatch(/bj-table-info-bar__bank-(summary|chips)/);
    expect(feltHtml).not.toContain('Bank Hand:');

    const dealerHtml = renderToStaticMarkup(
      <TableInfoBar gameState={tableAfterStartPlaying(500)} viewerPersonId={null} variant="dealer" />,
    );
    expect(dealerHtml).toContain('bj-phone-view__box-value--card-column');
    expect(dealerHtml).not.toContain('Bank Total:');
    expect(dealerHtml).not.toContain('Bank:');
  });
});

describe('blackjack UX fixes — command text', () => {
  it('contains no sentimental phrases such as pickle', () => {
    expect(COMMAND_SRC).not.toContain('pickle');
    expect(COMMAND_SRC).not.toContain('Lovely');
    expect(COMMAND_SRC).not.toContain('Looking tasty');
  });

  it('uses strict player-turn format with options', () => {
    let state = tableWithClaimedBox(2);
    const box2 = boxPlayerId(state, 2)!;
    const k2 = blackjackHandKey(box2, 0);
    state = {
      ...state,
      blackjack: actingRound(state, box2, [findCardId(state.deck!, '6'), findCardId(state.deck!, '7')], 10),
    };
    state.blackjack!.activeHandKey = k2;
    const msg = formatPlayerTurnCommand(
      2,
      'Alice',
      { value: 13, isSoft: false, isBlackjack: false },
      {
        gameState: state,
        handKey: k2,
        allowSplit: true,
        allowDouble: true,
      },
    );
    expect(msg.commandMessage).toBe('Box 2, Alice, your turn.');
    expect(msg.commandLines.some((line) => /Bank has/.test(line))).toBe(true);
    expect(msg.commandLines.some((line) => /^Options:/.test(line))).toBe(true);
    expect(formatPlayerTurnOptions(true, true, true, false)).toBe(
      'Options: Hit, Stay, Double one card.',
    );
  });

  it('shows Blackjack only for clean natural blackjack status', () => {
    const natural = formatPlayerTurnCommand(1, 'Bob', {
      value: 21,
      isSoft: false,
      isBlackjack: true,
    }, { actionStatus: 'blackjack' });
    expect(natural.commandMessage).toBe('Box 1, Blackjack.');
    expect(natural.commandLines).toEqual([]);

    let state = tableWithClaimedBox(1);
    const box1 = boxPlayerId(state, 1)!;
    const k1 = blackjackHandKey(box1, 0);
    state = {
      ...state,
      blackjack: {
        ...actingRound(state, box1, [findCardId(state.deck!, '10'), findCardId(state.deck!, 'A')], 10),
        evenMoneyOfferHandKey: k1,
      },
    };
    const evenMoney = buildBlackjackCommandText({
      gameState: state,
      gameEnded: false,
      gameOverMessage: '',
      centerStatus: '',
      protocolPhase: 'player',
      roundSummaryLines: [],
      controllerName: 'Bob',
    });
    expect(evenMoney.commandMessage).toMatch(/even[- ]money/i);
    expect(evenMoney.commandMessage).not.toBe('Box 1, Blackjack.');
  });
});

describe('blackjack UX fixes — documentation', () => {
  it('documents layout rules in master spec and changelog', () => {
    expect(MASTER_SPEC).toContain('Card View layout');
    expect(MASTER_SPEC).toContain('Active turn highlight');
    expect(MASTER_SPEC).toContain('bust');
    expect(MASTER_SPEC).toContain('Bank Hand');
    expect(MASTER_SPEC).toContain('player box');
    expect(CHANGE_LOG).toContain('Blackjack UX');
  });
});
