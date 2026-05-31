import type { DesignTemplate } from './types';

/** Mobile-first Stitch direction — brighter felt, tighter spacing. */
export const STITCH_MOBILE_TEMPLATE: DesignTemplate = {
  templateId: 'stitch-mobile',
  displayName: 'Stitch Mobile',
  description: 'Bright felt, compact controls, touch-friendly density.',
  colorTokens: {
    '--ds-color-primary': '#0d9488',
    '--ds-color-primary-light': '#14b8a6',
    '--ds-color-primary-dark': '#0f766e',
    '--ds-color-gold': '#fcd34d',
    '--ds-color-felt': '#115e59',
    '--ds-color-felt-mid': '#0f766e',
    '--ds-color-felt-dark': '#134e4a',
    '--ds-color-rail': '#1e293b',
    '--ds-color-surface': 'rgb(15 23 42 / 0.94)',
    '--ds-color-surface-elevated': 'rgb(30 41 59 / 0.96)',
  },
  typographyTokens: {
    '--ds-font-heading': "'Hanken Grotesk', system-ui, sans-serif",
    '--ds-font-body': "'Hanken Grotesk', system-ui, sans-serif",
    '--ds-font-mono': "'JetBrains Mono', ui-monospace, monospace",
  },
  tableLayoutPreference: 'card',
  cardStyle: 'flat',
  chipStyle: 'flat',
  buttonStyle: 'pill',
  density: 'compact',
};
