import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('header and table nav layout', () => {
  it('collapses top app nav under one menu button', () => {
    const src = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');
    expect(src).toContain('personal-nav--menu-only');
    expect(src).toContain('aria-label="App menu"');
    expect(src).toContain('Score Ledger');
    expect(src).toContain('Profile');
    expect(src).toContain('Start New Table');
    expect(src).toContain('Sign out');
  });

  it('renders table nav in dealer area', () => {
    const panel = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    const dealer = readFileSync(join(process.cwd(), 'src/components/DealerBlock.tsx'), 'utf8');
    expect(panel).toContain('bj-casino__table-nav--dealer');
    expect(panel).toContain('tableNav: renderTableNav');
    expect(dealer).toContain('dealer-block__top-row');
  });

  it('centers bank chips under BLACKJACK title', () => {
    const panel = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    const css = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
    expect(panel).toContain('bj-casino__header-bank');
    expect(panel).toMatch(/variant="header"/);
    expect(css).toContain('.bj-casino__header-bank');
  });
});
