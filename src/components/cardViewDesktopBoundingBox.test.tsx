// @vitest-environment happy-dom
/**
 * Desktop Card View layout — rendered band order and horizontal spread.
 * CSS is loaded so happy-dom applies stylesheet rules (layout metrics are approximate;
 * run `npm run test:card-desktop-layout:browser` for Playwright geometry + screenshot).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { cleanup, render } from '@testing-library/react';
import { readBlackjackLayoutCss } from '../test/readBlackjackLayoutCss';
import { BlackjackPanel } from './BlackjackPanel';
import { playingCardDesktopState } from '../test/cardDesktopLayoutState';
import { DEFAULT_VISIBLE_TABLE_BOXES } from './tableBoxLayout';
import { isMobileLayoutViewport, MOBILE_LAYOUT_MEDIA } from '../styles/mobileLayoutContract';
import {
  assertNoPairwiseOverlap,
  assertVerticalStack,
  measureElement,
} from './layoutMeasure';

const {
  shared,
  shell,
  playerRow,
  cardLayout,
  fullTableCardArea,
  cardDesktopHero,
  cardDesktop,
} = readBlackjackLayoutCss();

const CSS_BUNDLE = [
  readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8'),
  shared,
  playerRow,
  cardLayout,
  fullTableCardArea,
  shell,
  readFileSync(join(process.cwd(), 'src/styles/bj-felt-skins.css'), 'utf8'),
  cardDesktopHero,
  cardDesktop,
  readFileSync(join(process.cwd(), 'src/styles/design-system.css'), 'utf8'),
  readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8'),
  readFileSync(join(process.cwd(), 'src/components/BlackjackCardView.css'), 'utf8'),
  readFileSync(join(process.cwd(), 'src/components/ChipStack.css'), 'utf8'),
  readFileSync(join(process.cwd(), 'src/components/DealerBlock.css'), 'utf8'),
  readFileSync(join(process.cwd(), 'src/components/PlayingCard.css'), 'utf8'),
].join('\n');

let simulatedWidth = 1280;
let simulatedHeight = 800;

function matchMediaQuery(query: string): boolean {
  if (query === MOBILE_LAYOUT_MEDIA) {
    return isMobileLayoutViewport(simulatedWidth, simulatedHeight, { coarsePointer: true });
  }
  const minWidth = /min-width:\s*(\d+)/.exec(query);
  if (minWidth) {
    return simulatedWidth >= Number(minWidth[1]);
  }
  const maxWidth = /max-width:\s*(\d+)/.exec(query);
  if (maxWidth) {
    return simulatedWidth <= Number(maxWidth[1]);
  }
  return false;
}

vi.mock('../storage/profileStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../storage/profileStorage')>();
  return {
    ...actual,
    loadProfile: () => ({ name: 'xk', email: 'xk@example.com' }),
  };
});

beforeAll(() => {
  const style = document.createElement('style');
  style.setAttribute('data-test', 'card-desktop-layout-bundle');
  style.textContent = CSS_BUNDLE;
  document.head.appendChild(style);

  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matchMediaQuery(query),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
});

afterEach(() => {
  cleanup();
});

function requireBand(root: ParentNode, band: string): Element {
  const el = root.querySelector(`[data-layout-band="${band}"]`);
  if (!el) throw new Error(`Missing layout band: ${band}`);
  return el;
}

describe('Desktop Card View bounding bands (1280×800)', () => {
  it('orders hero cards → actions → player boxes → tray top-to-bottom without overlap', () => {
    simulatedWidth = 1280;
    simulatedHeight = 800;
    const { container } = render(
      createElement(BlackjackPanel, {
        gameState: playingCardDesktopState(),
        onGameStateChange: () => undefined,
      }),
    );

    const root = container.querySelector('.bj-view-card-desktop');
    expect(root).toBeTruthy();
    expect(root!.querySelector('[data-layout-band="hero-value"]')).toBeNull();

    const heroCards = measureElement(requireBand(root!, 'hero-cards'));
    const actionRow = measureElement(requireBand(root!, 'action-row'));
    const playerBoxes = measureElement(requireBand(root!, 'player-boxes'));
    const trayRow = measureElement(requireBand(root!, 'tray-row'));

    assertVerticalStack([heroCards, actionRow, playerBoxes, trayRow], {
      label: 'Desktop Card View bands',
      tolerancePx: 2,
    });
    assertNoPairwiseOverlap([heroCards, actionRow, playerBoxes], {
      label: 'Desktop Card View hero/actions/boxes',
      tolerancePx: 2,
    });
  });

  it('centers action row and spreads player boxes to at least 75% of felt width', () => {
    simulatedWidth = 1280;
    simulatedHeight = 800;
    const { container } = render(
      createElement(BlackjackPanel, {
        gameState: playingCardDesktopState(),
        onGameStateChange: () => undefined,
      }),
    );
    const root = container.querySelector('.bj-view-card-desktop')!;
    const felt = root.querySelector('.bj-casino__felt') ?? root;
    const feltRect = measureElement(felt);
    const actionRow = measureElement(requireBand(root, 'action-row'));
    const playerBoxes = measureElement(requireBand(root, 'player-boxes'));

    if (feltRect.width > 0) {
      const feltCenter = feltRect.left + feltRect.width / 2;
      const actionCenter = actionRow.left + actionRow.width / 2;
      expect(Math.abs(actionCenter - feltCenter)).toBeLessThan(feltRect.width * 0.08);
      expect(playerBoxes.width).toBeGreaterThanOrEqual(feltRect.width * 0.75);
    }

    const slotRow = root.querySelector('.bj-table-slot-row.bj-arc--player-boxes');
    expect(slotRow).toBeTruthy();
    expect(slotRow!.className).toContain(`bj-arc--visible-${DEFAULT_VISIBLE_TABLE_BOXES}`);
    expect(slotRow!.querySelectorAll('.bj-arc__slot').length).toBe(DEFAULT_VISIBLE_TABLE_BOXES);
  });
});
