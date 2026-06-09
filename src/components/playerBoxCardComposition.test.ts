import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatShortCardLabel } from './cardDisplay';
import type { Card } from '../types/deck';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');

describe('player box visible card composition', () => {
  it('formats compact rank+suit labels for box tiles', () => {
    const tenSpades: Card = { id: '10S', rank: '10', suit: 'spades' };
    const sixHearts: Card = { id: '6H', rank: '6', suit: 'hearts' };
    expect(formatShortCardLabel(tenSpades)).toBe('10♠');
    expect(formatShortCardLabel(sixHearts)).toBe('6♥');
  });

  it('renders composition from visible hand card ids only', () => {
    expect(PANEL_SRC).toMatch(
      /const visibleCardIds = primaryHandKey[\s\S]*getVisibleHandCardIds\(visualRound, primaryHandKey\)[\s\S]*bj-phone-view__mini-hand-composition/,
    );
    expect(PANEL_SRC).toContain('formatShortCardLabel(card)');
    expect(PANEL_SRC).not.toMatch(/dealerCardIds[\s\S]{0,400}mini-hand-composition/);
  });

  it('styles composition text in player boxes without absolute positioning', () => {
    expect(SHARED_CSS).toMatch(/\.bj-phone-view__mini-hand-composition[\s\S]*text-align:\s*center/);
    expect(SHARED_CSS).toMatch(/\.bj-phone-view__mini-hand-composition-card--red/);
    expect(SHARED_CSS).not.toMatch(/\.bj-phone-view__mini-hand-composition[\s\S]*position:\s*absolute/);
  });
});
