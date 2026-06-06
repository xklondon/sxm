/** Whitelisted visual tokens for admin Blackjack table theme overrides. */

export type ThemeRadiusToken = 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type ThemeFontToken = 'hanken' | 'manrope' | 'system';
export type ThemeMonoFontToken = 'jetbrains' | 'mono-system';

export interface BlackjackTableThemeOverrides {
  feltColor?: string;
  feltGradientHighlight?: string;
  borderColor?: string;
  accentColor?: string;
  textColor?: string;
  mutedTextColor?: string;
  buttonRadius?: ThemeRadiusToken;
  surfaceRadius?: ThemeRadiusToken;
  fontFamily?: ThemeFontToken;
  monoFontFamily?: ThemeMonoFontToken;
  panelBackground?: string;
  boxBackground?: string;
  boxBorder?: string;
  activeGlowColor?: string;
}

export const DEFAULT_BLACKJACK_TABLE_THEME: Required<BlackjackTableThemeOverrides> = {
  feltColor: '#0a3d2a',
  feltGradientHighlight: '#145a40',
  borderColor: 'rgb(212 175 55 / 0.35)',
  accentColor: '#e9c349',
  textColor: '#e5e2e1',
  mutedTextColor: '#94a3b8',
  buttonRadius: 'full',
  surfaceRadius: 'md',
  fontFamily: 'manrope',
  monoFontFamily: 'jetbrains',
  panelBackground: 'rgb(19 19 19 / 0.92)',
  boxBackground: 'rgb(0 0 0 / 0.18)',
  boxBorder: 'rgb(212 175 55 / 0.45)',
  activeGlowColor: 'rgb(212 175 55 / 0.55)',
};

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB_COLOR = /^rgba?\([\d\s.,%/]+\)$/i;

const RADIUS_MAP: Record<ThemeRadiusToken, string> = {
  sm: '0.125rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  full: '9999px',
};

const FONT_MAP: Record<ThemeFontToken, string> = {
  hanken: "'Hanken Grotesk', system-ui, sans-serif",
  manrope: "'Manrope', 'Hanken Grotesk', system-ui, sans-serif",
  system: "system-ui, -apple-system, 'Segoe UI', sans-serif",
};

const MONO_MAP: Record<ThemeMonoFontToken, string> = {
  jetbrains: "'JetBrains Mono', ui-monospace, monospace",
  'mono-system': "ui-monospace, 'Cascadia Code', 'Consolas', monospace",
};

export const BLACKJACK_THEME_CSS_VARS = [
  '--sxm-theme-felt',
  '--sxm-theme-felt-highlight',
  '--sxm-theme-border',
  '--sxm-theme-accent',
  '--sxm-theme-text',
  '--sxm-theme-text-muted',
  '--sxm-theme-button-radius',
  '--sxm-theme-surface-radius',
  '--sxm-theme-panel-bg',
  '--sxm-theme-box-bg',
  '--sxm-theme-box-border',
  '--sxm-theme-active-glow',
  '--ds-color-felt',
  '--ds-color-felt-mid',
  '--ds-color-gold',
  '--ds-color-gold-glow',
  '--ds-color-text',
  '--ds-color-text-muted',
  '--ds-color-border',
  '--ds-font-body',
  '--ds-font-mono',
  '--ds-radius-md',
  '--ds-radius-full',
] as const;

function isSafeColor(value: string): boolean {
  return HEX_COLOR.test(value.trim()) || RGB_COLOR.test(value.trim());
}

export function validateBlackjackTableThemeOverrides(
  input: unknown,
): BlackjackTableThemeOverrides | null {
  if (input === null || input === undefined) {
    return null;
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }
  const raw = input as Record<string, unknown>;
  const out: BlackjackTableThemeOverrides = {};

  const colorKeys = [
    'feltColor',
    'feltGradientHighlight',
    'borderColor',
    'accentColor',
    'textColor',
    'mutedTextColor',
    'panelBackground',
    'boxBackground',
    'boxBorder',
    'activeGlowColor',
  ] as const;

  for (const key of colorKeys) {
    const v = raw[key];
    if (v === undefined) continue;
    if (typeof v !== 'string' || !isSafeColor(v)) return null;
    out[key] = v;
  }

  if (raw.buttonRadius !== undefined) {
    if (!['sm', 'md', 'lg', 'xl', 'full'].includes(String(raw.buttonRadius))) return null;
    out.buttonRadius = raw.buttonRadius as ThemeRadiusToken;
  }
  if (raw.surfaceRadius !== undefined) {
    if (!['sm', 'md', 'lg', 'xl', 'full'].includes(String(raw.surfaceRadius))) return null;
    out.surfaceRadius = raw.surfaceRadius as ThemeRadiusToken;
  }
  if (raw.fontFamily !== undefined) {
    if (!['hanken', 'manrope', 'system'].includes(String(raw.fontFamily))) return null;
    out.fontFamily = raw.fontFamily as ThemeFontToken;
  }
  if (raw.monoFontFamily !== undefined) {
    if (!['jetbrains', 'mono-system'].includes(String(raw.monoFontFamily))) return null;
    out.monoFontFamily = raw.monoFontFamily as ThemeMonoFontToken;
  }

  return out;
}

export function mergeBlackjackTableTheme(
  overrides: BlackjackTableThemeOverrides | null | undefined,
): Required<BlackjackTableThemeOverrides> {
  return { ...DEFAULT_BLACKJACK_TABLE_THEME, ...overrides };
}

export function themeToCssVariables(
  theme: Required<BlackjackTableThemeOverrides>,
): Record<string, string> {
  return {
    '--sxm-theme-felt': theme.feltColor,
    '--sxm-theme-felt-highlight': theme.feltGradientHighlight,
    '--sxm-theme-border': theme.borderColor,
    '--sxm-theme-accent': theme.accentColor,
    '--sxm-theme-text': theme.textColor,
    '--sxm-theme-text-muted': theme.mutedTextColor,
    '--sxm-theme-button-radius': RADIUS_MAP[theme.buttonRadius],
    '--sxm-theme-surface-radius': RADIUS_MAP[theme.surfaceRadius],
    '--sxm-theme-panel-bg': theme.panelBackground,
    '--sxm-theme-box-bg': theme.boxBackground,
    '--sxm-theme-box-border': theme.boxBorder,
    '--sxm-theme-active-glow': theme.activeGlowColor,
    '--ds-color-felt': theme.feltColor,
    '--ds-color-felt-mid': theme.feltGradientHighlight,
    '--ds-color-gold': theme.accentColor,
    '--ds-color-gold-glow': theme.activeGlowColor,
    '--ds-color-text': theme.textColor,
    '--ds-color-text-muted': theme.mutedTextColor,
    '--ds-color-border': theme.borderColor,
    '--ds-font-body': FONT_MAP[theme.fontFamily],
    '--ds-font-mono': MONO_MAP[theme.monoFontFamily],
    '--ds-radius-md': RADIUS_MAP[theme.surfaceRadius],
    '--ds-radius-full': RADIUS_MAP[theme.buttonRadius],
  };
}

export function applyBlackjackTableTheme(
  overrides: BlackjackTableThemeOverrides | null | undefined,
  target?: HTMLElement | null,
): void {
  const root = target ?? (typeof document !== 'undefined' ? document.documentElement : null);
  if (!root) {
    return;
  }
  if (!overrides || Object.keys(overrides).length === 0) {
    for (const key of BLACKJACK_THEME_CSS_VARS) {
      root.style.removeProperty(key);
    }
    return;
  }
  const vars = themeToCssVariables(mergeBlackjackTableTheme(overrides));
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}
