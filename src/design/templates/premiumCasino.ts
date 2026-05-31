import type { DesignTemplate } from './types';

/** Current default — luxury casino look (Stitch-inspired). */
export const PREMIUM_CASINO_TEMPLATE: DesignTemplate = {
  templateId: 'premium-casino',
  displayName: 'Premium Casino',
  description: 'Deep felt green, gold accents, cinematic table density.',
  colorTokens: {
    '--ds-color-primary': '#064e3b',
    '--ds-color-primary-light': '#0a6b52',
    '--ds-color-primary-dark': '#043528',
    '--ds-color-gold': '#fbbf24',
    '--ds-color-felt': '#064e3b',
    '--ds-color-felt-mid': '#0a5c44',
    '--ds-color-felt-dark': '#043528',
    '--ds-color-rail': '#2a1a0e',
    '--ds-color-surface': 'rgb(17 24 39 / 0.92)',
    '--ds-color-surface-elevated': 'rgb(31 41 55 / 0.95)',
  },
  typographyTokens: {
    '--ds-font-heading': "'Hanken Grotesk', system-ui, sans-serif",
    '--ds-font-body': "'Hanken Grotesk', system-ui, sans-serif",
    '--ds-font-mono': "'JetBrains Mono', ui-monospace, monospace",
  },
  tableLayoutPreference: 'full',
  cardStyle: 'premium',
  chipStyle: 'gold-rim',
  buttonStyle: 'gold',
  density: 'cinematic',
};
