import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { createDefaultTableMeta } from '../types/table';
import {
  applyTableVisualPrefs,
  DEFAULT_TABLE_CLOTH_NAME,
  DEFAULT_TABLE_FELT_SKIN,
  feltSkinModifierClass,
  resolveTableClothName,
  resolveTableClothWager,
  resolveTableFeltSkin,
} from '../types/tableFeltSkin';
import {
  applySettingsToGameState,
  defaultPersistedSettings,
  mergeSettingsWithDefaults,
} from '../storage/settingsStorage';
import { deserializeGameState, serializeGameState as serializeGame } from '../storage/gameStorage';
import { createNewBlackjackTable } from '../engine/session';
import { BlackjackFlowSettingsMenu } from './BlackjackFlowSettings';
import { BlackjackFeltClothLayer } from './BlackjackFeltClothLayer';
import { TABLE_UX } from './tableUxContract';
import { addChipToBoxStake } from '../engine/blackjack';
import { tableAfterStartPlaying } from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';

const noop = () => {};

vi.mock('../storage/profileStorage', () => ({
  loadProfile: () => ({ name: 'Alice', email: 'alice@test.com' }),
}));

function readSrc(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

function playingState(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const boxId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)!.playerId!;
  return addChipToBoxStake(state, boxId, 10);
}

describe('table felt cloth layer', () => {
  it('defaults to classic casino cloth when unset', () => {
    const meta = createDefaultTableMeta();
    expect(meta.tableFeltSkin).toBeUndefined();
    expect(resolveTableFeltSkin(meta)).toBe('classic-casino');
    expect(resolveTableClothName(meta)).toBe(DEFAULT_TABLE_CLOTH_NAME);
    expect(resolveTableClothWager(meta)).toBe('');
    expect(DEFAULT_TABLE_FELT_SKIN).toBe('classic-casino');
  });

  it('respects explicit clean saved setting', () => {
    expect(resolveTableFeltSkin({ tableFeltSkin: 'clean' })).toBe('clean');
    expect(feltSkinModifierClass('clean')).toBe(TABLE_UX.feltSkinClean);
    const merged = mergeSettingsWithDefaults({ tableFeltSkin: 'clean' });
    expect(merged.tableFeltSkin).toBe('clean');
  });

  it('shows cloth settings fields in Table settings', () => {
    const html = renderToStaticMarkup(
      <BlackjackFlowSettingsMenu
        gameState={playingState()}
        onGameStateChange={noop}
        open
        onClose={noop}
      />,
    );
    expect(html).toContain('Table cloth / felt skin');
    expect(html).toContain('Table name (on cloth)');
    expect(html).toContain('Playing for (optional)');
    expect(html).toContain('Clean SXM');
    expect(html).toContain('Classic Casino');
  });

  it('persists cloth visuals in settings storage and table meta on boot', () => {
    const merged = mergeSettingsWithDefaults({
      tableFeltSkin: 'classic-casino',
      tableClothName: 'Friday Night Blackjack',
      tableClothWager: 'Dinner',
    });
    const boot = applySettingsToGameState(createNewBlackjackTable(), merged);
    expect(boot.tableMeta.tableFeltSkin).toBe('classic-casino');
    expect(boot.tableMeta.tableClothName).toBe('Friday Night Blackjack');
    expect(boot.tableMeta.tableClothWager).toBe('Dinner');
  });

  it('persists cloth fields through game serialization', () => {
    const state: GameState = {
      ...playingState(),
      tableMeta: {
        ...playingState().tableMeta,
        tableFeltSkin: 'classic-casino',
        tableClothName: 'My Table',
        tableClothWager: 'Bragging rights',
      },
    };
    const roundTrip = deserializeGameState(serializeGame(state));
    expect(roundTrip.tableMeta.tableFeltSkin).toBe('classic-casino');
    expect(roundTrip.tableMeta.tableClothName).toBe('My Table');
    expect(roundTrip.tableMeta.tableClothWager).toBe('Bragging rights');
  });

  it('hydrates missing cloth prefs from device settings on load', () => {
    const state: GameState = {
      ...playingState(),
      tableMeta: {
        ...playingState().tableMeta,
        tableFeltSkin: undefined,
        tableClothName: undefined,
        tableClothWager: undefined,
      },
    };
    const hydrated = applyTableVisualPrefs(state, {
      tableFeltSkin: 'classic-casino',
      tableClothName: 'Hydrated Name',
      tableClothWager: 'Coffee',
    });
    expect(hydrated.tableMeta.tableFeltSkin).toBe('classic-casino');
    expect(hydrated.tableMeta.tableClothName).toBe('Hydrated Name');
    expect(hydrated.tableMeta.tableClothWager).toBe('Coffee');
  });

  it('renders classic cloth layer inside layout shell behind zones', () => {
    const panelSrc = readSrc('src/components/BlackjackPanel.tsx');
    const shellSrc = readSrc('src/components/BlackjackTableLayoutShell.tsx');
    expect(panelSrc).toContain('feltClothLayer={');
    expect(panelSrc).toContain('<BlackjackFeltClothLayer');
    expect(shellSrc).toContain('{feltClothLayer}');
    expect(panelSrc).not.toContain('BlackjackFeltClothDecor');
  });

  it('renders SVG cloth layer with custom name and optional wager text', () => {
    const html = renderToStaticMarkup(
      <BlackjackFeltClothLayer tableName="Custom Table" wagerText="Dinner" />,
    );
    expect(html).toContain(TABLE_UX.feltClothLayer);
    expect(html).toContain('Custom Table');
    expect(html).toContain('Playing for Dinner');
    expect(html).not.toContain('Playing for: Dinner');
    expect(html).toContain('Standard protocol');
    expect(html).toContain('House Rules: Standard');
    expect(html).toContain('<svg');
  });

  it('omits wager line when wager text is empty', () => {
    const html = renderToStaticMarkup(
      <BlackjackFeltClothLayer tableName={DEFAULT_TABLE_CLOTH_NAME} wagerText="" />,
    );
    expect(html).not.toContain('Playing for');
    expect(html).toContain('Insurance pays 2:1');
  });

  it('keeps cloth layer non-interactive and behind gameplay zones', () => {
    const css = readSrc('src/styles/bj-felt-skins.css');
    expect(css).toMatch(/\.bj-felt-cloth-layer\s*\{[\s\S]*pointer-events:\s*none/);
    expect(css).toMatch(/\.bj-felt-cloth-layer\s*\{[\s\S]*z-index:\s*0/);
    expect(css).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--cards > :not\(\.bj-felt-cloth-layer\)\s*\{[\s\S]*z-index:\s*1/,
    );
  });

  it('does not render classic cloth layer for clean skin', () => {
    const panelSrc = readSrc('src/components/BlackjackPanel.tsx');
    expect(panelSrc).toMatch(
      /feltClothLayer=\{\s*resolveTableFeltSkin\(tableMeta\) === 'classic-casino' \?/,
    );
    expect(feltSkinModifierClass('clean')).toBe(TABLE_UX.feltSkinClean);
  });

  it('switching cloth settings does not reset chips, boxes, or blackjack state', () => {
    const before = playingState();
    const boxId = before.tableMeta.boxSlots.find((s) => s.slotNumber === 1)!.playerId!;
    const stakeBefore = before.tableMeta.boxStakes[boxId];
    const after: GameState = {
      ...before,
      tableMeta: {
        ...before.tableMeta,
        tableFeltSkin: 'classic-casino',
        tableClothName: 'New Name',
        tableClothWager: 'Fun',
      },
    };
    expect(after.tableMeta.boxStakes[boxId]).toEqual(stakeBefore);
    expect(after.tableMeta.boxSlots).toEqual(before.tableMeta.boxSlots);
    expect(after.blackjack).toEqual(before.blackjack);
    expect(after.selectedSeatId).toBe(before.selectedSeatId);
  });

  it('settings change handler persists cloth visuals without touching stakes', () => {
    const src = readSrc('src/components/BlackjackFlowSettings.tsx');
    expect(src).toContain('persistTableClothVisuals');
    expect(src).toContain('tableClothName:');
    expect(src).toContain('tableClothWager:');
    expect(src).not.toMatch(/tableClothName[\s\S]*boxStakes/);
  });

  it('felt row shows bank total and bank hand inside table shell', () => {
    const panelSrc = readSrc('src/components/BlackjackPanel.tsx');
    const infoSrc = readSrc('src/components/TableInfoBar.tsx');
    expect(panelSrc).toContain('tableBankInfo');
    expect(panelSrc).toMatch(/variant="felt"/);
    expect(infoSrc).toContain('bj-table-info-bar__bank-summary');
    expect(infoSrc).toContain('TABLE_UX.cardColumnValueAbove');
    expect(infoSrc).toContain('bj-table-info-bar--felt-row');
    expect(panelSrc).not.toContain('bj-casino__header-bank');
  });

  it('chip tray zone is bottom-aligned with boxes separation in shared shell CSS', () => {
    const sharedCss = readSrc('src/styles/bj-table-shared.css');
    expect(sharedCss).toContain('--bj-zone-boxes-tray-gap: 1.35rem');
    expect(sharedCss).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--bottom[\s\S]*justify-content:\s*flex-end/,
    );
    expect(sharedCss).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--bottom[\s\S]*margin-top:\s*var\(--bj-zone-boxes-tray-gap\)/,
    );
    const desktop = sharedCss.match(/@media \(min-width: 721px\)\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(desktop).toMatch(/\.bj-table-layout-shell \.bj-table-zone--boxes[\s\S]*margin-top:\s*0/);
  });

  it('Card View player boxes arc does not expand shell scroll', () => {
    const sharedCss = readSrc('src/styles/bj-table-shared.css');
    const boxesBlock =
      sharedCss.match(/\.bj-table-layout-shell \.bj-table-zone--boxes\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(boxesBlock).toMatch(/overflow-x:\s*hidden/);
    expect(boxesBlock).toMatch(/overflow-y:\s*visible/);
    expect(sharedCss).toMatch(
      /\.bj-table-layout-shell \.bj-table-zone--boxes \.bj-arc--player-boxes[\s\S]*overflow-y:\s*visible/,
    );
  });

  it('dealer and command zones use shell sizing without overlap selectors', () => {
    const sharedCss = readSrc('src/styles/bj-table-shared.css');
    expect(sharedCss).toMatch(/\.bj-table-layout-shell \.bj-table-zone--dealer[\s\S]*justify-content:\s*center/);
    expect(sharedCss).toMatch(/\.bj-table-layout-shell \.bj-table-zone--summary[\s\S]*justify-content:\s*flex-end/);
    expect(sharedCss).toMatch(/\.bj-table-layout-shell \.bj-table-zone--actions[\s\S]*overflow:\s*hidden/);
  });

  it('classic cloth SVG is centered in CardsArea with proportional sizing', () => {
    const css = readSrc('src/styles/bj-felt-skins.css');
    expect(css).toContain('--bj-cloth-svg-width');
    expect(css).toMatch(/\.bj-felt-cloth-layer__svg[\s\S]*width:\s*var\(--bj-cloth-svg-width\)/);
    expect(css).toMatch(/\.bj-felt-cloth-layer\s*\{[\s\S]*align-items:\s*center/);
    expect(css).not.toMatch(/top:\s*calc\(/);
    expect(css).toMatch(
      /\.bj-view-card-mobile \.bj-table-zone--cards \.bj-felt-cloth-layer[\s\S]*display:\s*flex/,
    );
    expect(css).toMatch(
      /\.bj-view-card-desktop \.bj-table-zone--cards \.bj-felt-cloth-layer[\s\S]*display:\s*none/,
    );
  });

  it('settings storage round-trips cloth visual prefs', () => {
    const parsed = mergeSettingsWithDefaults({
      ...defaultPersistedSettings(),
      tableFeltSkin: 'classic-casino',
      tableClothName: 'Stored Name',
      tableClothWager: 'Pizza',
    });
    expect(parsed.tableFeltSkin).toBe('classic-casino');
    expect(parsed.tableClothName).toBe('Stored Name');
    expect(parsed.tableClothWager).toBe('Pizza');
  });
});
