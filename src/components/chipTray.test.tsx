import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChipTray } from './ChipStack';

describe('ChipTray', () => {
  it('renders only denominations valid for minimum bet', () => {
    const html = renderToStaticMarkup(
      <ChipTray minimumBet={5} onChipClick={() => {}} disabled={false} />,
    );
    expect(html).toContain('aria-label="Add 50 to bet"');
    expect(html).toContain('aria-label="Add 20 to bet"');
    expect(html).toContain('aria-label="Add 10 to bet"');
    expect(html).toContain('aria-label="Add 5 to bet"');
    expect(html).not.toContain('aria-label="Add 2 to bet"');
    expect(html).not.toContain('aria-label="Add 1 to bet"');
  });

  it('uses the same filter helper as chipUtils', () => {
    const html = renderToStaticMarkup(
      <ChipTray minimumBet={10} onChipClick={() => {}} />,
    );
    expect(html).toContain('aria-label="Add 50 to bet"');
    expect(html).toContain('aria-label="Add 20 to bet"');
    expect(html).toContain('aria-label="Add 10 to bet"');
    expect(html).not.toContain('aria-label="Add 5 to bet"');
    expect(html).not.toContain('aria-label="Add 2 to bet"');
    expect(html).not.toContain('aria-label="Add 1 to bet"');
  });
});
