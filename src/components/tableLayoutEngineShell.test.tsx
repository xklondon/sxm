// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { BlackjackTableLayoutShell } from './BlackjackTableLayoutShell';
import { LAYOUT_MODE_SPECS } from './tableLayoutEngine';

function renderShell(cardsAreaMode: 'table' | 'hero') {
  return render(
    <BlackjackTableLayoutShell
      tableBankInfo={<div data-testid="bankInfo">bank</div>}
      dealer={<div data-testid="dealer" className="bj-dealer-area">dealer</div>}
      command={<div data-testid="command">command</div>}
      actions={<div data-testid="actions">actions</div>}
      cardsArea={<div data-testid="cards">cards</div>}
      cardsAreaMode={cardsAreaMode}
      playerBoxes={<div data-testid="boxes">boxes</div>}
      chipTray={<div data-testid="tray">tray</div>}
    />,
  );
}

/** Returns the order in which the given selectors appear in the document. */
function domOrder(container: HTMLElement, selectors: string[]): string[] {
  const all = Array.from(container.querySelectorAll<HTMLElement>('*'));
  const seen: string[] = [];
  for (const el of all) {
    for (const sel of selectors) {
      if (el.matches(sel) && !seen.includes(sel)) {
        seen.push(sel);
      }
    }
  }
  return seen;
}

describe('BlackjackTableLayoutShell — zone smoke (structure parity)', () => {
  const ZONE_SELECTORS = [
    '.bj-table-zone--summary',
    '.bj-table-zone--cards',
    '.bj-table-zone--actions',
    '.bj-table-zone--boxes',
    '.bj-table-zone--bottom',
  ];

  it('renders command → cards → actions → boxes → tray in canonical order (table mode)', () => {
    const { container } = renderShell('table');
    expect(domOrder(container, ZONE_SELECTORS)).toEqual(ZONE_SELECTORS);
  });

  it('renders the same zone order in hero (Card View) mode', () => {
    const { container } = renderShell('hero');
    expect(domOrder(container, ZONE_SELECTORS)).toEqual(ZONE_SELECTORS);
  });

  it('cards content renders inside the cards zone (not boxes/tray)', () => {
    const { container } = renderShell('table');
    const cards = container.querySelector('[data-testid="cards"]');
    expect(cards?.closest('.bj-table-zone--cards')).not.toBeNull();
    expect(cards?.closest('.bj-table-zone--boxes')).toBeNull();
    expect(cards?.closest('.bj-table-zone--bottom')).toBeNull();
  });

  it('boxes content renders inside the boxes zone', () => {
    const { container } = renderShell('table');
    const boxes = container.querySelector('[data-testid="boxes"]');
    expect(boxes?.closest('.bj-table-zone--boxes')).not.toBeNull();
  });

  it('cards zone carries the table/hero mode class from the contract', () => {
    const tableRender = renderShell('table');
    expect(
      tableRender.container.querySelector('.bj-table-zone--cards.bj-cards-area--table'),
    ).not.toBeNull();
    expect(LAYOUT_MODE_SPECS.desktopFull.cardsAreaMode).toBe('table');

    const heroRender = renderShell('hero');
    expect(
      heroRender.container.querySelector('.bj-table-zone--cards.bj-cards-area--hero'),
    ).not.toBeNull();
    expect(LAYOUT_MODE_SPECS.desktopCard.cardsAreaMode).toBe('hero');
  });
});
