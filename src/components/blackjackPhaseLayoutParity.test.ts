import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SHELL_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-blackjack-table-shell.css'), 'utf8');
const HERO_AREA_CSS = readFileSync(
  join(process.cwd(), 'src/styles/bj-card-desktop-hero-area.css'),
  'utf8',
);

/** Play-phase shell tokens are canonical — betting must not override geometry. */
describe('blackjack phase layout parity (desktop shell)', () => {
  it('does not define betting-only shell zone geometry overrides', () => {
    expect(SHELL_CSS).not.toMatch(
      /\[data-bj-phase='betting'\][\s\S]*--bj-desktop-zone-actions-height:\s*1\.55rem/,
    );
    expect(SHELL_CSS).not.toMatch(
      /\[data-bj-phase='betting'\][\s\S]*--bj-desktop-dealer-command-gap:\s*3\.875rem/,
    );
    expect(SHELL_CSS).not.toMatch(
      /\[data-bj-phase='resolved'\][\s\S]*--bj-desktop-zone-actions-height:\s*1\.55rem/,
    );
  });

  it('uses play-phase command and actions band tokens as shared desktop defaults', () => {
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-desktop,\s*\n\s*\.bj-view-card-desktop \{[\s\S]*--bj-desktop-zone-command-height:\s*4\.35rem/,
    );
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-desktop,\s*\n\s*\.bj-view-card-desktop \{[\s\S]*--bj-desktop-dealer-command-gap:\s*0\.4125rem/,
    );
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-desktop,\s*\n\s*\.bj-view-card-desktop \{[\s\S]*--bj-desktop-zone-actions-height:\s*2\.5rem/,
    );
  });

  it('does not use data-bj-phase for Card View hero-area shell geometry', () => {
    expect(HERO_AREA_CSS).not.toMatch(/\[data-bj-phase=/);
  });

  it('applies command pill layout to all phases (not playing-only)', () => {
    expect(SHELL_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--summary \.bj-card-layout__command[\s\S]*min-height:\s*2\.75rem/,
    );
    expect(SHELL_CSS).not.toMatch(
      /\[data-bj-phase='playing'\][\s\S]*\.bj-table-layout-shell > \.bj-table-zone--summary \.bj-card-layout__command/,
    );
  });

  it('reserves actions slot with bj-action-row band when idle', () => {
    const panelSrc = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
    expect(panelSrc).toContain('bj-action-row--slot-reserved');
    expect(panelSrc).toContain('data-layout-band="action-row"');
    expect(SHELL_CSS).toMatch(/\.bj-action-row--slot-reserved/);
  });
});
