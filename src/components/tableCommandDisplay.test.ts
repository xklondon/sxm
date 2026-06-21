import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createNewBlackjackTable } from '../engine/session';
import {
  buildBlackjackCommandText,
  buildTableCommandDisplay,
  formatPlayerTurnCommand,
  formatPlayerTurnOptions,
} from './tableCommandDisplay';
import { tableWithClaimedBox, actingRound, boxPlayerId, findCardId } from '../engine/blackjack/sanity/fixtures';
import { blackjackHandKey } from '../engine/blackjack';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const CARD_VIEW_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');
const COMMAND_BOX_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCommandBox.tsx'), 'utf8');
const DEALER_BLOCK_SRC = readFileSync(join(process.cwd(), 'src/components/DealerBlock.tsx'), 'utf8');

describe('buildBlackjackCommandText', () => {
  it('exports canonical builder alias used by both views', () => {
    expect(buildTableCommandDisplay).toBe(buildBlackjackCommandText);
    expect(PANEL_SRC).toContain('buildBlackjackCommandText');
    expect(PANEL_SRC).toContain('tableCommand.commandMessage');
    expect(PANEL_SRC).toContain('BlackjackCommandBox');
    expect(PANEL_SRC).toMatch(/command=\{\s*<BlackjackCommandBox[\s\S]*tableCommand\.commandMessage/);
    expect(PANEL_SRC).not.toMatch(/commandMessage:\s*tableAidTip/);
    expect(PANEL_SRC).not.toMatch(/commandMessage:\s*magic8Answer/);
  });

  it('returns betting instruction during open betting', () => {
    const state = createNewBlackjackTable();
    const result = buildBlackjackCommandText({
      gameState: state,
      gameEnded: false,
      gameOverMessage: '',
      centerStatus: 'Place your bets, then Shuffle to start.',
      protocolPhase: 'betting',
      roundSummaryLines: [],
      controllerName: 'Host',
    });
    expect(result.commandMessage).toContain('Place your bets');
  });

  it('returns short command when awaiting next round', () => {
    const state = createNewBlackjackTable();
    const result = buildBlackjackCommandText({
      gameState: state,
      gameEnded: false,
      gameOverMessage: '',
      centerStatus: 'ignored',
      protocolPhase: 'round-complete',
      roundSummaryLines: ['Box 1 wins +10', 'Box 2 loses -10'],
      controllerName: 'Host',
    });
    expect(result.commandMessage).toBe('Round finished. Summary ready.');
    expect(result.commandLines).toEqual([]);
  });

  it('formats player turn with box, caller name, and hand value', () => {
    let state = tableWithClaimedBox(2);
    const box2 = boxPlayerId(state, 2)!;
    const k2 = blackjackHandKey(box2, 0);
    state = {
      ...state,
      blackjack: {
        ...actingRound(state, box2, [findCardId(state.deck!, '6'), findCardId(state.deck!, '7')], 10),
        dealerCardIds: [findCardId(state.deck!, '10'), ''],
        dealerHoleHidden: true,
      },
    };
    state.blackjack!.activeHandKey = k2;
    state.blackjack!.activePlayerId = box2;
    const result = buildBlackjackCommandText({
      gameState: state,
      gameEnded: false,
      gameOverMessage: '',
      centerStatus: 'ignored',
      protocolPhase: 'player',
      roundSummaryLines: [],
      controllerName: 'Alice',
    });
    expect(result.commandMessage).toContain('Box 2 — Alice — your turn.');
    expect(result.commandMessage).toMatch(/Bank has/);
    expect(result.commandLines).toEqual([]);
    expect(result.commandMessage).not.toMatch(/^(Option|Options):/m);
  });

  it('shows join notice during betting when tableNotice is set', () => {
    const state = createNewBlackjackTable();
    const withNotice = {
      ...state,
      tableMeta: {
        ...state.tableMeta,
        tableNotice: {
          message: 'Kay joined the table on Box 3.',
          personId: 'p1',
          slotNumber: 3,
          at: new Date().toISOString(),
        },
      },
    };
    const result = buildBlackjackCommandText({
      gameState: withNotice,
      gameEnded: false,
      gameOverMessage: '',
      centerStatus: 'Place your bets',
      protocolPhase: 'betting',
      roundSummaryLines: [],
      controllerName: 'Host',
    });
    expect(result.commandMessage).toBe('Kay joined the table on Box 3.');
  });

  it('builds options line for special actions only (never Hit/Stay)', () => {
    expect(formatPlayerTurnOptions(true, true, true, true)).toBe(
      'Double available.\nSplit available.',
    );
    expect(formatPlayerTurnOptions(false, true, true, false)).toBe('Double available.');
    expect(formatPlayerTurnOptions(true, true, false, false)).toBe('');
  });

  it('includes soft totals in bank-against line', () => {
    let state = tableWithClaimedBox(3);
    const box3 = boxPlayerId(state, 3)!;
    const handKey = `${box3}:0`;
    state = {
      ...state,
      blackjack: {
        ...actingRound(state, box3, [findCardId(state.deck!, '6'), findCardId(state.deck!, 'A')], 10),
        dealerCardIds: [findCardId(state.deck!, '10'), ''],
        dealerHoleHidden: true,
      },
    };
    const result = formatPlayerTurnCommand(3, 'Kji', {
      value: 17,
      isSoft: true,
      isBlackjack: false,
    }, {
      gameState: state,
      displayState: state,
      handKey,
      allowSplit: false,
      allowDouble: false,
    });
    expect(result.commandMessage).toContain('Box 3 — Kji — your turn.');
    expect(result.commandMessage).toMatch(/against your soft 17/);
    expect(result.commandLines).toEqual([]);
  });

  it('omits bank-against line when no dealer cards are visible', () => {
    const state = createNewBlackjackTable();
    const result = formatPlayerTurnCommand(
      1,
      'Host',
      { value: 12, isSoft: false, isBlackjack: false },
      { gameState: state, displayState: state },
    );
    expect(result.commandLines.some((line) => /Bank has/.test(line))).toBe(false);
    expect(result.commandMessage).not.toMatch(/Bank has/);
  });
});

describe('command text routing separation', () => {
  it('Full Table renders command below dealer via DealerCommandArea', () => {
    expect(DEALER_BLOCK_SRC).toContain('DealerCommandArea');
    expect(DEALER_BLOCK_SRC).toMatch(/dealer-block__command/);
    expect(DEALER_BLOCK_SRC).toMatch(/dealer-block__cards-slot[\s\S]*DealerCommandArea/);
  });

  it('Card View command row uses DealerCommandArea from Panel canonical source', () => {
    expect(PANEL_SRC).toContain('omitCommand');
    expect(PANEL_SRC).toMatch(/tableCommand\.commandMessage[\s\S]*tableCommand\.commandLines/);
    expect(CARD_VIEW_SRC).not.toContain('BlackjackCommandBox');
    expect(COMMAND_BOX_SRC).toContain('TABLE_UX.cardLayoutCommand');
    expect(COMMAND_BOX_SRC).toContain('DealerCommandArea');
    expect(CARD_VIEW_SRC).not.toContain('buildTableCommandDisplay');
    expect(CARD_VIEW_SRC).not.toContain('buildBlackjackCommandText');
    expect(PANEL_SRC).toMatch(/command=\{\s*<BlackjackCommandBox/);
  });

  it('AID and Magic 8 do not route through command builder', () => {
    expect(PANEL_SRC).toContain('commentaryText: tableAidTip');
    expect(PANEL_SRC).toContain('magic8Answer');
    expect(PANEL_SRC).toContain('controlOnly');
    expect(PANEL_SRC).not.toMatch(/commandMessage:\s*tableAidTip/);
    expect(PANEL_SRC).not.toMatch(/commandMessage:\s*magic8Answer/);
    expect(CARD_VIEW_SRC).not.toContain('buildBlackjackCommandText');
    expect(CARD_VIEW_SRC).not.toMatch(/commandMessage:\s*aidTip/);
    expect(CARD_VIEW_SRC).not.toMatch(/BlackjackCommandBox/);
  });

  it('does not duplicate wait text in actions zone when command already shows it', () => {
    expect(PANEL_SRC).toMatch(/buildBlackjackCommandText/);
    expect(PANEL_SRC).toMatch(/command=\{\s*<BlackjackCommandBox/);
    expect(PANEL_SRC).not.toMatch(/waitMessage=\{waitMessage\}/);
    expect(PANEL_SRC).not.toMatch(/BlackjackActionPanel[\s\S]*waitMessage/);
    expect(PANEL_SRC).toMatch(/!actionPermission\.canAct[\s\S]*return null/);
  });
});
