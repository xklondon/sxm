import type { DesignTemplate } from './types';

/** Classic home-table felt — warm greens, relaxed normal density. */
export const CLASSIC_FELT_TEMPLATE: DesignTemplate = {
  templateId: 'classic-felt',
  displayName: 'Classic Felt',
  description: 'Traditional green felt, cream text, home-table warmth.',
  colorTokens: {
    '--ds-color-primary': '#14532d',
    '--ds-color-primary-light': '#166534',
    '--ds-color-primary-dark': '#052e16',
    '--ds-color-gold': '#eab308',
    '--ds-color-felt': '#14532d',
    '--ds-color-felt-mid': '#166534',
    '--ds-color-felt-dark': '#052e16',
    '--ds-color-rail': '#3f2e1f',
    '--ds-color-surface': 'rgb(20 35 25 / 0.93)',
    '--ds-color-surface-elevated': 'rgb(30 50 35 / 0.95)',
  },
  typographyTokens: {
    '--ds-font-heading': "'Hanken Grotesk', Georgia, serif",
    '--ds-font-body': "'Hanken Grotesk', system-ui, sans-serif",
    '--ds-font-mono': "'JetBrains Mono', ui-monospace, monospace",
  },
  tableLayoutPreference: 'full',
  cardStyle: 'classic',
  chipStyle: 'felt',
  buttonStyle: 'outline',
  density: 'normal',
};
