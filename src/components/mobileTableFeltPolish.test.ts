import { describe, expect, it } from 'vitest';
import { readBlackjackLayoutCss } from '../test/readBlackjackLayoutCss';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MOBILE_LAYOUT_MEDIA } from '../styles/mobileLayoutContract';
import {
  DEFAULT_TABLE_FELT_SKIN,
  resolveTableFeltSkin,
} from '../types/tableFeltSkin';
import { createDefaultTableMeta } from '../types/table';

const { shared: SHARED_CSS, shell: SHELL_CSS, shellContract: SHELL_CONTRACT_CSS } = readBlackjackLayoutCss();
const PANEL_CSS = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.css'), 'utf8');

describe('mobile table felt polish — Full Table + Card View parity', () => {
  it('uses identical mobile felt/table height tokens for both views', () => {
    expect(SHARED_CSS).toContain(MOBILE_LAYOUT_MEDIA);
    expect(SHARED_CSS).toContain('--bj-mobile-felt-fill-grow: 1 1 auto');
    expect(SHARED_CSS).toMatch(
      /--bj-mobile-table-canvas-height:\s*min\([\s\S]*- 0\.5rem\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-casino__felt,\s*\n\s*\.bj-view-card-mobile \.bj-casino__felt[\s\S]*flex:\s*var\(--bj-mobile-felt-fill-grow\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-casino__felt-main,\s*\n\s*\.bj-view-card-mobile \.bj-casino__felt-main[\s\S]*height:\s*var\(--bj-mobile-layout-shell-height\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-mobile-table-shell,\s*\n\s*\.bj-view-card-mobile \.bj-mobile-table-shell[\s\S]*flex:\s*var\(--bj-mobile-felt-fill-grow\)/,
    );
  });

  it('extends mobile portrait felt to fill the canvas in both views', () => {
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile\.bj-casino,\s*\n\s*\.bj-view-card-mobile\.bj-casino[\s\S]*flex:\s*var\(--bj-mobile-felt-fill-grow\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-casino__rail,\s*\n\s*\.bj-view-card-mobile \.bj-casino__rail[\s\S]*flex:\s*1 1 auto/,
    );
    expect(PANEL_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-casino__felt,\s*\n\s*\.bj-view-card-mobile \.bj-casino__felt[\s\S]*min-height:\s*var\(--bj-mobile-felt-min-height/,
    );
    expect(PANEL_CSS).not.toMatch(/\.bj-casino__felt[\s\S]*min-height:\s*24rem/);
  });

  it('extends mobile landscape felt to fill the canvas in both views', () => {
    expect(SHARED_CSS).toMatch(
      /@media \(orientation: landscape\)[\s\S]*\.bj-view-full-mobile \.bj-casino__felt-main,\s*\n\s*\.bj-view-card-mobile \.bj-casino__felt-main[\s\S]*flex:\s*1 1 auto/,
    );
    expect(SHARED_CSS).toMatch(
      /@media \(orientation: landscape\)[\s\S]*\.bj-view-full-mobile \.bj-casino__rail-wrap,\s*\n\s*\.bj-view-card-mobile \.bj-casino__rail-wrap[\s\S]*flex:\s*1 1 auto/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-casino__tray-wrap,\s*\n\s*\.bj-view-card-mobile \.bj-casino__tray-wrap[\s\S]*flex-shrink:\s*0/,
    );
  });

  it('adds mobile dealer-to-command gap and centers command on table axis', () => {
    expect(SHARED_CSS).toContain('--bj-mobile-zone-command-top-gap: 0.48rem');
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell \.bj-table-zone--summary,\s*\n\s*\.bj-view-card-mobile \.bj-table-layout-shell \.bj-table-zone--summary[\s\S]*padding-top:\s*var\(--bj-mobile-zone-command-top-gap\)/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-view-full-mobile \.bj-table-layout-shell \.bj-table-zone--summary \.bj-card-layout__command,\s*\n\s*\.bj-view-card-mobile \.bj-table-layout-shell \.bj-table-zone--summary \.bj-card-layout__command[\s\S]*margin-inline:\s*auto/,
    );
    expect(SHARED_CSS).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--summary \.dealer-block__status\s*\{[\s\S]*?white-space:\s*normal[\s\S]*?\}/,
    );
  });

  it('does not keep Card View-only felt height overrides', () => {
    expect(PANEL_CSS).not.toMatch(/\.bj-view-card-mobile \.bj-casino__felt--card-view,\s*\n\s*\.bj-view-card-mobile \.bj-casino__felt-main/);
  });
});

describe('default classic casino felt skin', () => {
  it('defaults to classic-casino when unset', () => {
    expect(DEFAULT_TABLE_FELT_SKIN).toBe('classic-casino');
    expect(resolveTableFeltSkin(createDefaultTableMeta())).toBe('classic-casino');
    expect(resolveTableFeltSkin({})).toBe('classic-casino');
  });

  it('respects explicit clean skin', () => {
    expect(resolveTableFeltSkin({ tableFeltSkin: 'clean' })).toBe('clean');
  });
});
