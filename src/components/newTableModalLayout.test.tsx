import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import { NewTableOverlay } from './NewTableOverlay';
import { TableStakePanel } from './TableStakePanel';
import { createNewBlackjackTable } from '../engine/session';

const OVERLAY_CSS = readFileSync(join(process.cwd(), 'src/components/NewTableOverlay.css'), 'utf8');
const PANEL_CSS = readFileSync(join(process.cwd(), 'src/components/TableStakePanel.css'), 'utf8');
const MOBILE_MODALS_CSS = readFileSync(join(process.cwd(), 'src/styles/mobile-modals.css'), 'utf8');
const PLAYER_ROW_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-player-row-layout.css'), 'utf8');
const TARGETED_CSS = readFileSync(join(process.cwd(), 'src/styles/bj-blackjack-targeted-fixes.css'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/TableStakePanel.tsx'), 'utf8');

const noop = () => undefined;

describe('New Table modal layout', () => {
  it('panel uses hidden overflow; body scrolls vertically only', () => {
    expect(OVERLAY_CSS).toMatch(/\.new-table-overlay__panel[\s\S]*overflow:\s*hidden/);
    expect(OVERLAY_CSS).toMatch(/\.new-table-overlay__body[\s\S]*overflow-x:\s*hidden/);
    expect(OVERLAY_CSS).toMatch(/\.new-table-overlay__body[\s\S]*overflow-y:\s*auto/);
    expect(OVERLAY_CSS).not.toMatch(/\.new-table-overlay__panel[\s\S]*overflow-x:\s*auto/);
  });

  it('keeps header fixed and close button in header', () => {
    expect(OVERLAY_CSS).toMatch(/\.new-table-overlay__header[\s\S]*flex:\s*0\s*0\s*auto/);
    const html = renderToStaticMarkup(
      createElement(
        NewTableOverlay,
        { open: true, title: 'New Table', ariaLabel: 'New table setup', onClose: noop },
        createElement('p', null, 'Setup body'),
      ),
    );
    expect(html).toContain('new-table-overlay__header');
    expect(html).toContain('new-table-overlay__close');
    expect(html).toContain('aria-label="Close New Table"');
  });

  it('embedded stake panel pins nav footer sticky with full-width fields', () => {
    expect(PANEL_CSS).toMatch(
      /\.new-table-overlay__body \.table-stake-panel--embedded \.table-stake-panel__nav[\s\S]*position:\s*sticky/,
    );
    expect(PANEL_CSS).toMatch(
      /\.new-table-overlay__body \.table-stake-panel--embedded \.table-stake-panel__input[\s\S]*width:\s*100%/,
    );
    expect(PANEL_CSS).toMatch(
      /\.new-table-overlay__body \.table-stake-panel--embedded \.table-stake-panel__grid[\s\S]*flex-direction:\s*column/,
    );
    expect(PANEL_SRC).toContain('table-stake-panel__nav');
    expect(PANEL_SRC).toContain('Start Table');

    const html = renderToStaticMarkup(
      createElement(
        NewTableOverlay,
        { open: true, title: 'New Table', ariaLabel: 'New table setup', onClose: noop },
        createElement(TableStakePanel, {
          gameState: createNewBlackjackTable(),
          mode: 'new',
          embeddedInOverlay: true,
          onConfirm: noop,
        }),
      ),
    );
    expect(html).toContain('table-stake-panel--embedded');
    expect(html).toContain('>Cards<');
  });

  it('mobile modal rule keeps new-table panel non-scrollable', () => {
    const panelBlock =
      MOBILE_MODALS_CSS.match(
        /\.new-table-overlay__panel,[\s\S]*?overscroll-behavior:\s*contain;/,
      )?.[0] ?? '';
    expect(panelBlock).toContain('overflow: hidden');
    expect(panelBlock).not.toContain('overflow-y: auto');
  });

  it('caps modal width and respects safe-area on mobile', () => {
    expect(OVERLAY_CSS).toMatch(/width:\s*min\(100%,\s*24rem\)/);
    expect(OVERLAY_CSS).toMatch(/env\(safe-area-inset-bottom/);
    expect(OVERLAY_CSS).toMatch(/max-height:\s*min\(90dvh,\s*calc\(100dvh - 1\.25rem\)\)/);
  });
});

describe('desktop player boxes zone scroll guard', () => {
  it('contains boxes row inside shell zone for desktop full and card views', () => {
    expect(TARGETED_CSS).toMatch(
      /\.bj-view-full-desktop \.bj-table-layout-shell > \.bj-table-zone--boxes[\s\S]*overflow:\s*hidden/,
    );
    expect(TARGETED_CSS).toMatch(
      /\.bj-view-card-desktop \.bj-table-layout-shell > \.bj-table-zone--boxes[\s\S]*overflow:\s*hidden/,
    );
    expect(TARGETED_CSS).toMatch(
      /\.bj-view-card-desktop\.bj-casino \.bj-casino__felt[\s\S]*overflow-y:\s*hidden/,
    );
  });

  it('scales box tiles within boxes zone only on desktop', () => {
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-table-layout-shell > \.bj-table-zone--boxes[\s\S]*--bj-desktop-box-value-scale:\s*1\.55/,
    );
    expect(PLAYER_ROW_CSS).toMatch(
      /\.bj-table-layout-shell > \.bj-table-zone--boxes[\s\S]*overflow:\s*hidden/,
    );
  });
});
