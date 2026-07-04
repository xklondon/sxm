import { describe, expect, it } from 'vitest';
import { readBlackjackLayoutCss } from '../test/readBlackjackLayoutCss';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatBoxCardRanksLabel } from './cardDisplay';
import type { Card } from '../types/deck';

const { shared: SHARED_CSS, shell: SHELL_CSS, shellContract: SHELL_CONTRACT_CSS } = readBlackjackLayoutCss();
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');

describe('player box visible card composition', () => {
  it('formats rank-only labels for box tiles', () => {
    const tenSpades: Card = { id: '10S', rank: '10', suit: 'spades' };
    const sixHearts: Card = { id: '6H', rank: '6', suit: 'hearts' };
    expect(formatBoxCardRanksLabel([tenSpades, sixHearts])).toBe('10, 6');
  });

  it('renders composition from visible hand card ids only', () => {
    expect(PANEL_SRC).toMatch(
      /const visibleCardIds = displayHandKey[\s\S]*getVisibleHandCardIds\(visualRound, displayHandKey\)[\s\S]*bj-phone-view__mini-hand-composition/,
    );
    expect(PANEL_SRC).toContain('formatBoxCardRanksLabel');
    expect(PANEL_SRC).not.toMatch(/dealerCardIds[\s\S]{0,400}mini-hand-composition/);
  });

  it('styles composition text in player boxes without absolute positioning', () => {
    expect(SHARED_CSS).toMatch(/\.bj-phone-view__mini-hand-composition[\s\S]*text-align:\s*center/);
    expect(SHARED_CSS).toMatch(/\.bj-arc--player-boxes \.bj-phone-view__mini-hand-name/);
    expect(SHARED_CSS).not.toMatch(
      /\.bj-phone-view__mini-hand-composition\s*\{[^}]*position:\s*absolute/,
    );
  });
});
