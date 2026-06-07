import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PANEL_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const CARD_LAYOUT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-card-layout.css'), 'utf8');
const CARD_VIEW_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.css'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const DEALER_SRC = readFileSync(join(process.cwd(), 'src/components/DealerBlock.tsx'), 'utf8');
const CARD_VIEW_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.tsx'), 'utf8');

describe('launch layout fixes — table vertical positioning', () => {
  it('desktop Full Table pushes play content toward bottom of felt', () => {
    expect(SHARED_CSS).toMatch(/\.bj-view-full-desktop \.bj-casino__felt[\s\S]*var\(--bj-full-desktop-tray-padding-bottom\)/);
    expect(SHARED_CSS).toMatch(/\.bj-view-full-desktop \.bj-casino__felt-main[\s\S]*justify-content:\s*stretch/);
    expect(SHARED_CSS).toMatch(/\.bj-view-full-desktop \.bj-table-zone--play[\s\S]*justify-content:\s*flex-end/);
  });

  it('desktop Card View shifts felt up and reserves chip tray space', () => {
    expect(SHARED_CSS).toMatch(/\.bj-view-card-desktop \.bj-casino__felt\.bj-casino__felt--card-view[\s\S]*padding-bottom:\s*0\.32rem/);
    expect(CARD_LAYOUT_CSS).toMatch(/\.bj-view-card-desktop \.bj-card-layout__tray[\s\S]*padding-bottom:\s*0\.38rem/);
    expect(CARD_LAYOUT_CSS).toMatch(/@media \(min-width: 721px\)[\s\S]*--bj-card-row-dealer:\s*7\.35rem/);
  });
});

describe('launch layout fixes — table nav in header row', () => {
  it('renders view switcher left and table nav right in header toolbar', () => {
    expect(PANEL_SRC).toContain('{renderTableNav()}');
    expect(PANEL_SRC).not.toContain('tableNav: renderTableNav');
    expect(PANEL_SRC).not.toContain('bj-casino__toolbar-spacer');
    expect(PANEL_CSS).toContain('.bj-casino__table-nav');
    expect(PANEL_CSS).not.toContain('.bj-casino__table-nav--dealer');
  });

  it('does not render table nav inside dealer block', () => {
    expect(DEALER_SRC).not.toContain('tableNav');
    expect(DEALER_SRC).not.toContain('dealer-block__top-row');
  });
});

describe('launch layout fixes — BUST / Next Round separation', () => {
  it('keeps BUST badge in hero meta below total, not above dealer action', () => {
    expect(CARD_VIEW_SRC).toContain('bj-phone-view__bust-label--meta');
    expect(CARD_VIEW_SRC).not.toMatch(/bj-phone-view__hand">\s*\{heroBusted &&/);
    expect(CARD_VIEW_CSS).toContain('.bj-phone-view__bust-label--meta');
    expect(CARD_VIEW_CSS).toMatch(/\.bj-phone-view__bust-label--meta[\s\S]*pointer-events:\s*none/);
  });

  it('keeps dealer primary action slot above command/status with z-index', () => {
    expect(DEALER_SRC).toContain('dealer-block__action-slot');
    expect(readFileSync(join(process.cwd(), 'src/components/DealerBlock.css'), 'utf8')).toMatch(
      /\.dealer-block__action-slot[\s\S]*z-index:\s*3/,
    );
  });
});

describe('launch layout fixes — hero top clipping guards', () => {
  it('hero zone aligns from top with reserved meta padding', () => {
    expect(CARD_LAYOUT_CSS).toMatch(/\.bj-card-layout__hero[\s\S]*justify-content:\s*flex-start/);
    expect(CARD_LAYOUT_CSS).toMatch(/\.bj-card-layout__hero[\s\S]*padding-top:\s*0\.28rem/);
    expect(CARD_LAYOUT_CSS).toContain('--bj-card-hero-meta-reserve');
  });

  it('does not use negative margin or translateY on hero card fan/wrap', () => {
    const heroBlock = CARD_LAYOUT_CSS.match(/\.bj-card-layout__hero[\s\S]*?\.bj-card-layout__actions/)?.[0] ?? '';
    expect(heroBlock).not.toMatch(/margin-top:\s*-/);
    expect(heroBlock).not.toMatch(/translateY\(-/);
  });
});
