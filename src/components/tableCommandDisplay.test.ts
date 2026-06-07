import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createNewBlackjackTable } from '../engine/session';
import {
  buildBlackjackCommandText,
  buildTableCommandDisplay,
  formatCallerLegalLine,
  formatLegalActionHint,
  formatPlayerTurnCommand,
} from './tableCommandDisplay';
import { tableWithClaimedBox, actingRound, boxPlayerId, findCardId } from '../engine/blackjack/sanity/fixtures';
import { blackjackHandKey } from '../engine/blackjack';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const CARD_VIEW_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');
const DEALER_BLOCK_SRC = readFileSync(join(process.cwd(), 'src/components/DealerBlock.tsx'), 'utf8');

describe('buildBlackjackCommandText', () => {
  it('exports canonical builder alias used by both views', () => {
    expect(buildTableCommandDisplay).toBe(buildBlackjackCommandText);
    expect(PANEL_SRC).toContain('buildBlackjackCommandText');
    expect(PANEL_SRC).toContain('tableCommand.commandMessage');
    expect(PANEL_SRC).toContain('DealerCommandArea');
    expect(PANEL_SRC).toMatch(/dealerCommand=\{\s*<DealerCommandArea[\s\S]*tableCommand\.commandMessage/);
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

  it('returns round summary lines when awaiting next round', () => {
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
    expect(result.commandMessage).toBeNull();
    expect(result.commandLines).toEqual(['Box 1 wins +10', 'Box 2 loses -10']);
  });

  it('formats player turn with box, caller name, and hand value', () => {
    let state = tableWithClaimedBox(2);
    const box2 = boxPlayerId(state, 2)!;
    const k2 = blackjackHandKey(box2, 0);
    state = {
      ...state,
      blackjack: actingRound(state, box2, [findCardId(state.deck!, '6'), findCardId(state.deck!, '7')], 10),
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
    expect(result.commandMessage).toBe(
      formatPlayerTurnCommand(2, 'Alice', { value: 13, isSoft: false, isBlackjack: false }),
    );
    expect(result.commandMessage).toMatch(/Box 2: Alice, you have 13\./);
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

  it('uses caller-prefixed legal action hints', () => {
    expect(formatLegalActionHint(false, true)).toBe('You can double — one card only.');
    expect(formatLegalActionHint(true, true)).toBe(
      'You can split or double — double gets one card only.',
    );
    expect(formatLegalActionHint(true, false)).toBe('You can split.');
    expect(formatLegalActionHint(false, false)).toBeNull();
    expect(formatCallerLegalLine(1, 'Alice', false, true)).toBe(
      'Box 1: Alice — You can double — one card only.',
    );
  });

  it('includes soft totals in player-turn copy', () => {
    expect(
      formatPlayerTurnCommand(3, 'Kji', { value: 17, isSoft: true, isBlackjack: false }),
    ).toBe('Box 3: Kji, you have soft 17. Your call.');
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
    expect(CARD_VIEW_SRC).toContain('dealerCommand');
    expect(CARD_VIEW_SRC).toContain('TABLE_UX.cardLayoutCommand');
    expect(CARD_VIEW_SRC).not.toContain('buildTableCommandDisplay');
    expect(CARD_VIEW_SRC).not.toContain('buildBlackjackCommandText');
  });

  it('AID and Magic 8 do not route through command builder', () => {
    expect(PANEL_SRC).toContain('commentaryText: tableAidTip');
    expect(PANEL_SRC).toContain('Magic8TableAnswer');
    expect(PANEL_SRC).not.toMatch(/commandMessage:\s*tableAidTip/);
    expect(PANEL_SRC).not.toMatch(/commandMessage:\s*magic8Answer/);
    expect(CARD_VIEW_SRC).toContain('aidTip');
    expect(CARD_VIEW_SRC).not.toMatch(/commandMessage:\s*aidTip/);
    expect(CARD_VIEW_SRC).not.toMatch(/dealerCommand=\{[\s\S]*aidTip/);
  });
});
