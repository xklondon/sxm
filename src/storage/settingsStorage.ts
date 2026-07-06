import type { GameState } from '../types';

import {

  DEFAULT_BLACKJACK_SETTINGS,

  mergeBlackjackSettings,

} from '../engine/blackjack/settings';

import {

  DEFAULT_BLACKJACK_FLOW_SETTINGS,

  normalizeFlowSettings,

  type BlackjackFlowSettings,

} from '../engine/blackjack/flowSettings';

import type { BlackjackSettings } from '../engine/blackjack/settings';

import { DEFAULT_HOLDEM_SETTINGS } from '../engine/holdem/settings';

import type { HoldemSettings } from '../engine/holdem/settings';

import { DEFAULT_BLACKJACK_PROTOCOL_ID } from '../engine/blackjack/protocols';

import { DEFAULT_DESIGN_TEMPLATE_ID } from '../design/templates';

import type { BlackjackTableThemeOverrides } from '../design/blackjackTableTheme';

import { validateBlackjackTableThemeOverrides } from '../design/blackjackTableTheme';

import { DEFAULT_TABLE_ADMIN_SETTINGS } from '../types/admin';

import type { TableAdminSettings } from '../types/admin';

import type { TableFeltSkin } from '../types/tableFeltSkin';

import { DEFAULT_TABLE_CLOTH_NAME, DEFAULT_TABLE_FELT_SKIN, DEFAULT_TABLE_TRAY_LABEL } from '../types/tableFeltSkin';

import { log } from '../utils/logger';



const STORAGE_KEY = 'sxmcards:settings:v1';

function mergeAdminSettings(partial?: Partial<TableAdminSettings>): TableAdminSettings {
  return { ...DEFAULT_TABLE_ADMIN_SETTINGS, ...partial };
}



export interface PersistedSettings {

  blackjackSettings: BlackjackSettings;

  blackjackFlowSettings: BlackjackFlowSettings;

  holdemSettings: HoldemSettings;

  blackjackProtocolId?: string;

  designTemplateId?: string;

  blackjackTableTheme?: BlackjackTableThemeOverrides | null;

  tableAdminSettings?: TableAdminSettings;

  /** Device-local table cloth / felt skin preference. */
  tableFeltSkin?: TableFeltSkin;

  /** Printed name on classic casino cloth. */
  tableClothName?: string;

  /** Optional social wager label on classic cloth. */
  tableClothWager?: string;

  /** Mobile chip tray footer label. */
  tableTrayLabel?: string;

}



export function defaultPersistedSettings(): PersistedSettings {

  return {

    blackjackSettings: { ...DEFAULT_BLACKJACK_SETTINGS },

    blackjackFlowSettings: { ...DEFAULT_BLACKJACK_FLOW_SETTINGS },

    holdemSettings: { ...DEFAULT_HOLDEM_SETTINGS },

    blackjackProtocolId: DEFAULT_BLACKJACK_PROTOCOL_ID,

    designTemplateId: DEFAULT_DESIGN_TEMPLATE_ID,

    blackjackTableTheme: null,

    tableAdminSettings: { ...DEFAULT_TABLE_ADMIN_SETTINGS },

    tableFeltSkin: DEFAULT_TABLE_FELT_SKIN,

    tableClothName: DEFAULT_TABLE_CLOTH_NAME,

    tableClothWager: '',

    tableTrayLabel: DEFAULT_TABLE_TRAY_LABEL,

  };

}



export function mergeSettingsWithDefaults(partial?: Partial<PersistedSettings>): PersistedSettings {

  const defaults = defaultPersistedSettings();

  return {

    blackjackSettings: mergeBlackjackSettings(partial?.blackjackSettings),

    blackjackFlowSettings: normalizeFlowSettings({

      ...defaults.blackjackFlowSettings,

      ...partial?.blackjackFlowSettings,

      dealSpeedPreset:

        partial?.blackjackFlowSettings?.dealSpeedPreset ?? defaults.blackjackFlowSettings.dealSpeedPreset,

      customDealDelayMs:

        partial?.blackjackFlowSettings?.customDealDelayMs ?? defaults.blackjackFlowSettings.customDealDelayMs,

      randomDealTiming:

        partial?.blackjackFlowSettings?.randomDealTiming ?? defaults.blackjackFlowSettings.randomDealTiming,

      randomDealMinMs:

        partial?.blackjackFlowSettings?.randomDealMinMs ?? defaults.blackjackFlowSettings.randomDealMinMs,

      randomDealMaxMs:

        partial?.blackjackFlowSettings?.randomDealMaxMs ?? defaults.blackjackFlowSettings.randomDealMaxMs,

      cardTimerPreset: 0,

      countdownSeconds: 0,

    }),

    holdemSettings: { ...defaults.holdemSettings, ...partial?.holdemSettings },

    blackjackProtocolId: partial?.blackjackProtocolId ?? defaults.blackjackProtocolId,

    designTemplateId: partial?.designTemplateId ?? defaults.designTemplateId,

    blackjackTableTheme:
      partial?.blackjackTableTheme === undefined
        ? defaults.blackjackTableTheme
        : validateBlackjackTableThemeOverrides(partial.blackjackTableTheme),

    tableAdminSettings: mergeAdminSettings(partial?.tableAdminSettings),

    tableFeltSkin: partial?.tableFeltSkin ?? defaults.tableFeltSkin,

    tableClothName: partial?.tableClothName ?? defaults.tableClothName,

    tableClothWager: partial?.tableClothWager ?? defaults.tableClothWager,

    tableTrayLabel: partial?.tableTrayLabel ?? defaults.tableTrayLabel,
  };
}



export function loadSettings(): PersistedSettings {

  if (typeof localStorage === 'undefined') {

    return defaultPersistedSettings();

  }

  try {

    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {

      return defaultPersistedSettings();

    }

    const parsed = JSON.parse(raw) as Partial<PersistedSettings>;

    return mergeSettingsWithDefaults(parsed);

  } catch (err) {

    log.warn('Failed to load settings', { err });

    return defaultPersistedSettings();

  }

}



export function saveSettings(settings: PersistedSettings): void {

  try {

    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

    log.info('Settings saved');

  } catch (err) {

    log.warn('Failed to save settings', { err });

  }

}



export function resetSettings(): PersistedSettings {

  const defaults = defaultPersistedSettings();

  saveSettings(defaults);

  return defaults;

}



export function settingsFromGameState(state: GameState): PersistedSettings {

  return {

    blackjackSettings: state.blackjackSettings,

    blackjackFlowSettings: state.blackjackFlowSettings,

    holdemSettings: state.holdemSettings,

    blackjackProtocolId: state.blackjackProtocolId,

    designTemplateId: state.designTemplateId,

    blackjackTableTheme: state.blackjackTableTheme ?? null,

    tableAdminSettings: state.tableAdminSettings,

    tableFeltSkin: state.tableMeta.tableFeltSkin ?? DEFAULT_TABLE_FELT_SKIN,

    tableClothName: state.tableMeta.tableClothName ?? DEFAULT_TABLE_CLOTH_NAME,

    tableClothWager: state.tableMeta.tableClothWager ?? '',

    tableTrayLabel: state.tableMeta.tableTrayLabel ?? DEFAULT_TABLE_TRAY_LABEL,

  };

}



export function applySettingsToGameState(state: GameState, settings: PersistedSettings): GameState {

  const merged = mergeSettingsWithDefaults(settings);

  return {

    ...state,

    blackjackSettings: mergeBlackjackSettings(merged.blackjackSettings),

    blackjackFlowSettings: merged.blackjackFlowSettings,

    holdemSettings: { ...merged.holdemSettings },

    blackjackProtocolId: merged.blackjackProtocolId ?? DEFAULT_BLACKJACK_PROTOCOL_ID,

    designTemplateId: merged.designTemplateId ?? DEFAULT_DESIGN_TEMPLATE_ID,

    blackjackTableTheme: merged.blackjackTableTheme ?? null,

    tableAdminSettings: mergeAdminSettings(merged.tableAdminSettings),

    tableMeta: {
      ...state.tableMeta,
      tableFeltSkin: merged.tableFeltSkin ?? DEFAULT_TABLE_FELT_SKIN,
      tableClothName: merged.tableClothName ?? DEFAULT_TABLE_CLOTH_NAME,
      tableClothWager: merged.tableClothWager ?? '',
      tableTrayLabel: merged.tableTrayLabel ?? DEFAULT_TABLE_TRAY_LABEL,
    },
  };
}


