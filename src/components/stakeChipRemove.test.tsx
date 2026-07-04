import { describe, expect, it } from 'vitest';
import { readBlackjackLayoutCss } from '../test/readBlackjackLayoutCss';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import { StakeChips } from './ChipStack';

const { shared: SHARED_CSS, shell: SHELL_CSS, shellContract: SHELL_CONTRACT_CSS } = readBlackjackLayoutCss();
const CHIP_CSS = readFileSync(join(process.cwd(), 'src/components/ChipStack.css'), 'utf8');

describe('stake chip remove control', () => {
  it('renders remove button below chip pile', () => {
    const html = renderToStaticMarkup(
      <StakeChips chips={[10, 5]} variant="bet" removable onRemoveTopChip={() => {}} />,
    );
    expect(html).toContain('stake-chips__pile');
    expect(html).toContain('stake-chips__remove');
    expect(html.indexOf('stake-chips__pile')).toBeLessThan(html.indexOf('stake-chips__remove'));
    expect(html).toContain('stake-chips--removable');
  });

  it('keeps remove control inside visible stake slot without top clipping', () => {
    expect(CHIP_CSS).toMatch(/\.stake-chips__remove[\s\S]*position:\s*relative/);
    expect(CHIP_CSS).not.toMatch(/\.stake-chips__remove[\s\S]*top:\s*-0\.35rem/);
    expect(SHARED_CSS).toMatch(/\.bj-arc--player-boxes \.bj-phone-view__mini-stake-slot[\s\S]*overflow:\s*visible/);
    expect(SHARED_CSS).toMatch(/\.stake-chips__remove[\s\S]*pointer-events:\s*auto|\.stake-chips__remove,\s*\n[\s\S]*pointer-events:\s*auto/);
  });

  it('reserves stable removable stack height', () => {
    expect(CHIP_CSS).toMatch(/\.stake-chips--bet\.stake-chips--removable[\s\S]*min-height:\s*2\.55rem/);
    expect(SHARED_CSS).toContain('--bj-full-table-stake-min-height: 1.55rem');
  });

  it('scales chip pile only so remove stays tappable', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-phone-view__mini-stake-slot \.stake-chips__pile[\s\S]*transform:\s*scale\(0\.48\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-arc--player-boxes \.bj-phone-view__mini-stake-slot \.stake-chips--bet[\s\S]*transform:\s*none/,
    );
  });
});
