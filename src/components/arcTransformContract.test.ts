import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PANEL_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');

function ruleBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`${escaped}\\s*\\{[\\s\\S]*?\\}`, 'm'))?.[0] ?? '';
}

describe('arc transform CSS contract', () => {
  it('does not define unscoped transform on .bj-arc__slot', () => {
    const slotBlock = ruleBlock(PANEL_CSS, '.bj-arc__slot');
    expect(slotBlock).toBeTruthy();
    expect(slotBlock).not.toMatch(/transform:\s*rotate/);
    expect(slotBlock).not.toMatch(/transform:\s*[^;]*scale\(/);
  });

  it('does not define unscoped transform on .bj-arc__open', () => {
    const openBlock = ruleBlock(PANEL_CSS, '.bj-arc__open');
    expect(openBlock).toBeTruthy();
    expect(openBlock).not.toMatch(/transform:\s*rotate/);
  });

  it('scopes card-column rotation to .bj-arc--cards .bj-arc__slot', () => {
    expect(PANEL_CSS).toMatch(
      /\.bj-arc--cards \.bj-arc__slot[\s\S]*transform:\s*rotate\(var\(--arc-rot/,
    );
    expect(PANEL_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-arc--cards \.bj-arc__slot[\s\S]*transform:\s*rotate\(var\(--arc-rot/,
    );
  });

  it('does not apply margin-top:auto to all .bj-view-card-mobile .bj-arc selectors', () => {
    expect(SHARED_CSS).not.toMatch(
      /\.bj-view-card-mobile \.bj-arc\s*\{[\s\S]*margin-top:\s*auto/,
    );
    expect(SHARED_CSS).toMatch(/\.bj-view-full-desktop \.bj-arc--cards[\s\S]*margin-top:\s*auto/);
    expect(SHARED_CSS).toMatch(/\.bj-view-full-desktop \.bj-arc--player-boxes[\s\S]*margin-top:\s*0/);
  });

  it('keeps player-box arcs flat in desktop and mobile view roots', () => {
    const css = `${PANEL_CSS}\n${SHARED_CSS}`;
    const playerBoxSlotRules =
      css.match(/\.bj-arc--player-boxes \.bj-arc__slot[^{]*\{[^}]*\}/g) ?? [];
    const playerBoxOpenRules =
      css.match(/\.bj-arc--player-boxes \.bj-arc__open[^{]*\{[^}]*\}/g) ?? [];
    expect(playerBoxSlotRules.length).toBeGreaterThan(0);
    for (const rule of playerBoxSlotRules) {
      expect(rule).not.toMatch(/transform:\s*rotate/);
    }
    for (const rule of playerBoxOpenRules) {
      expect(rule).not.toMatch(/transform:\s*rotate/);
    }
  });
});
