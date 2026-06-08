import type { GameState } from './index';
import type { TableMeta } from './table';

/** Visual-only blackjack table cloth / felt artwork. */
export type TableFeltSkin = 'clean' | 'classic-casino';

export const DEFAULT_TABLE_FELT_SKIN: TableFeltSkin = 'clean';
export const DEFAULT_TABLE_CLOTH_NAME = "Slinki's Black Jack";

export const TABLE_FELT_SKIN_OPTIONS: ReadonlyArray<{
  value: TableFeltSkin;
  label: string;
}> = [
  { value: 'clean', label: 'Clean SXM' },
  { value: 'classic-casino', label: 'Classic Casino' },
];

export interface TableVisualPrefsSettings {
  tableFeltSkin?: TableFeltSkin;
  tableClothName?: string;
  tableClothWager?: string;
}

export function isTableFeltSkin(value: unknown): value is TableFeltSkin {
  return value === 'clean' || value === 'classic-casino';
}

export function resolveTableFeltSkin(meta: Pick<TableMeta, 'tableFeltSkin'>): TableFeltSkin {
  return meta.tableFeltSkin === 'classic-casino' ? 'classic-casino' : 'clean';
}

export function resolveTableFeltSkinPref(
  meta: Pick<TableMeta, 'tableFeltSkin'>,
  settingsSkin?: TableFeltSkin,
): TableFeltSkin {
  if (isTableFeltSkin(meta.tableFeltSkin)) {
    return meta.tableFeltSkin;
  }
  if (isTableFeltSkin(settingsSkin)) {
    return settingsSkin;
  }
  return DEFAULT_TABLE_FELT_SKIN;
}

export function resolveTableClothName(meta: Pick<TableMeta, 'tableClothName'>): string {
  const trimmed = meta.tableClothName?.trim();
  return trimmed || DEFAULT_TABLE_CLOTH_NAME;
}

export function resolveTableClothWager(meta: Pick<TableMeta, 'tableClothWager'>): string {
  return meta.tableClothWager?.trim() ?? '';
}

export function feltSkinModifierClass(skin: TableFeltSkin): string {
  return skin === 'classic-casino' ? 'bj-felt-skin--classic-casino' : 'bj-felt-skin--clean';
}

/** Merge device/table visual prefs into hydrated game state (online reconnect safe). */
export function applyTableVisualPrefs(
  state: GameState,
  settings?: TableVisualPrefsSettings,
): GameState {
  const tableFeltSkin = resolveTableFeltSkinPref(state.tableMeta, settings?.tableFeltSkin);
  const tableClothName = state.tableMeta.tableClothName?.trim()
    ? state.tableMeta.tableClothName.trim()
    : settings?.tableClothName?.trim() || DEFAULT_TABLE_CLOTH_NAME;
  const tableClothWager =
    state.tableMeta.tableClothWager !== undefined
      ? state.tableMeta.tableClothWager
      : settings?.tableClothWager ?? '';

  if (
    state.tableMeta.tableFeltSkin === tableFeltSkin &&
    state.tableMeta.tableClothName === tableClothName &&
    state.tableMeta.tableClothWager === tableClothWager
  ) {
    return state;
  }

  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      tableFeltSkin,
      tableClothName,
      tableClothWager,
    },
  };
}

export function visualPrefsFromSettings(settings: TableVisualPrefsSettings): TableVisualPrefsSettings {
  return {
    tableFeltSkin: settings.tableFeltSkin,
    tableClothName: settings.tableClothName,
    tableClothWager: settings.tableClothWager,
  };
}
