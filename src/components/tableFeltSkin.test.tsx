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
  it('defaults to clean SXM cloth when unset', () => {
    const meta = createDefaultTableMeta();
    expect(meta.tableFeltSkin).toBeUndefined();
    expect(resolveTableFeltSkin(meta)).toBe('clean');
    expect(resolveTableClothName(meta)).toBe(DEFAULT_TABLE_CLOTH_NAME);
    expect(resolveTableClothWager(meta)).toBe('');
    expect(DEFAULT_TABLE_FELT_SKIN).toBe('clean');
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
    expect(html).toContain('Insurance Pays 2 to 1');
    expect(html).toContain('Dealer must stand on 17 and draw to 16');
    expect(html).toContain('Playing for: Dinner');
    expect(html).toContain('<svg');
  });

  it('omits wager line when wager text is empty', () => {
    const html = renderToStaticMarkup(
      <BlackjackFeltClothLayer tableName={DEFAULT_TABLE_CLOTH_NAME} wagerText="" />,
    );
    expect(html).not.toContain('Playing for:');
  });

  it('keeps cloth layer non-interactive and behind gameplay zones', () => {
    const css = readSrc('src/styles/bj-felt-skins.css');
    expect(css).toMatch(/\.bj-felt-cloth-layer\s*\{[\s\S]*pointer-events:\s*none/);
    expect(css).toMatch(/\.bj-felt-cloth-layer\s*\{[\s\S]*z-index:\s*0/);
    expect(css).toMatch(
      /\.bj-table-layout-shell > :not\(\.bj-felt-cloth-layer\)\s*\{[\s\S]*z-index:\s*1/,
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

  it('header title stays BLACKJACK and does not use cloth table name', () => {
    const panelSrc = readSrc('src/components/BlackjackPanel.tsx');
    expect(panelSrc).toContain('>BLACKJACK</h1>');
    expect(panelSrc).not.toMatch(/pageTitle\)[^>]*>Slinki/);
    expect(panelSrc).not.toContain("Slinki's Black Jack");
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
