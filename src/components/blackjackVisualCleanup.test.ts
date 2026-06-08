import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FELT_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-felt-skins.css'), 'utf8');
const SHARED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-table-shared.css'), 'utf8');
const MAGIC8_CSS = readFileSync(join(process.cwd(), 'src/components/magic8/Magic8Ball.css'), 'utf8');
const PANEL_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');

describe('blackjack visual cleanup — cloth, player boxes, Magic 8', () => {
  it('uses larger responsive classic cloth title tokens', () => {
    expect(FELT_CSS).toContain('--bj-cloth-title-font-size: 56px');
    expect(FELT_CSS).toContain('--bj-cloth-title-font-size-mobile: 42px');
    expect(FELT_CSS).toMatch(
      /\.bj-felt-cloth-layer__title[\s\S]*font-size:\s*var\(--bj-cloth-title-font-size\)/,
    );
    expect(FELT_CSS).toMatch(
      /@media \(max-width: 720px\)[\s\S]*\.bj-felt-cloth-layer__title[\s\S]*var\(--bj-cloth-title-font-size-mobile\)/,
    );
    expect(FELT_CSS).toMatch(
      /\.bj-felt-cloth-layer__insurance[\s\S]*font-size:\s*var\(--bj-cloth-insurance-font-size\)/,
    );
    expect(FELT_CSS).toMatch(
      /\.bj-felt-cloth-layer__dealer-rule[\s\S]*font-size:\s*var\(--bj-cloth-dealer-rule-font-size\)/,
    );
  });

  it('keeps cloth layer non-interactive and behind gameplay', () => {
    expect(FELT_CSS).toMatch(/\.bj-felt-cloth-layer\s*\{[\s\S]*pointer-events:\s*none/);
    expect(FELT_CSS).toMatch(/\.bj-felt-cloth-layer\s*\{[\s\S]*z-index:\s*0/);
  });

  it('neutralizes player box slot wrapper chrome', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-arc__slot--owned[\s\S]*border:\s*none[\s\S]*box-shadow:\s*none/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-arc__slot--empty[\s\S]*border:\s*none/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-bet-zone[\s\S]*border:\s*none[\s\S]*background:\s*transparent/,
    );
  });

  it('uses one visible frame on player box mini-hand tiles', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-phone-view__mini-hand--full-arc[\s\S]*box-shadow:\s*none/,
    );
  });

  it('keeps selected pulse visual-only without layout displacement', () => {
    expect(SHARED_CSS).toMatch(/@keyframes bj-bet-pulse[\s\S]*inset 0 0 0 2px/);
    expect(SHARED_CSS).not.toMatch(/@keyframes bj-bet-pulse[\s\S]*0 0 0 6px/);
    expect(SHARED_CSS).toMatch(/\.bj-phone-view__bet-chip--pulse[\s\S]*transform:\s*none/);
    expect(SHARED_CSS).toMatch(/\.bj-phone-view__bet-chip--pulse[\s\S]*margin:\s*0/);
    expect(SHARED_CSS).toMatch(/@keyframes bj-turn-pulse[\s\S]*inset 0 0 0/);
    expect(SHARED_CSS).toMatch(/\.bj-phone-view__mini-hand\.bj-box--turn[\s\S]*filter:\s*none/);
    expect(SHARED_CSS).toMatch(/\.bj-phone-view__mini-hand\.bj-box--turn[\s\S]*transform:\s*none/);
  });

  it('uses consistent ownership border width on mini-hand', () => {
    expect(SHARED_CSS).toMatch(/\.bj-phone-view__mini-hand\.bj-box--native-assigned[\s\S]*border:\s*1\.5px solid/);
    expect(SHARED_CSS).toMatch(/\.bj-phone-view__mini-hand\.bj-box--co-box[\s\S]*border:\s*1\.5px solid/);
  });

  it('routes mobile Magic 8 response away from dealer centerline', () => {
    expect(MAGIC8_CSS).toMatch(
      /@media \(max-width: 720px\)[\s\S]*\.magic8-table-zone[\s\S]*flex-direction:\s*column/,
    );
    expect(MAGIC8_CSS).toMatch(
      /@media \(max-width: 720px\)[\s\S]*\.magic8-table-zone[\s\S]*max-width:\s*min\(36vw,\s*8\.75rem\)/,
    );
    expect(MAGIC8_CSS).toMatch(/\.magic8-table-zone[\s\S]*z-index:\s*2/);
    expect(SHARED_CSS).toMatch(/\.bj-table-layout-shell \.bj-table-zone--dealer[\s\S]*z-index:\s*5/);
    expect(PANEL_CSS).toMatch(/\.bj-casino__felt > \.magic8-table-zone[\s\S]*pointer-events:\s*none/);
  });

  it('keeps Magic 8 response separate from command box styling', () => {
    expect(MAGIC8_CSS).toContain('.magic8-table-answer');
    expect(SHARED_CSS).toMatch(/\.bj-table-layout-shell \.bj-table-zone--summary \.dealer-block__status/);
    expect(PANEL_CSS).not.toMatch(/magic8-table-answer/);
  });
});
