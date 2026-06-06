import { describe, expect, it } from 'vitest';

import {
  applyBlackjackTableTheme,
  BLACKJACK_THEME_CSS_VARS,
  DEFAULT_BLACKJACK_TABLE_THEME,
  mergeBlackjackTableTheme,
  themeToCssVariables,
  validateBlackjackTableThemeOverrides,
} from '../design/blackjackTableTheme';

describe('blackjackTableTheme', () => {
  it('accepts whitelisted color and token overrides', () => {
    const result = validateBlackjackTableThemeOverrides({
      feltColor: '#0a3d2a',
      accentColor: '#e9c349',
      borderColor: 'rgb(212 175 55 / 0.35)',
      buttonRadius: 'full',
      surfaceRadius: 'md',
      fontFamily: 'manrope',
      monoFontFamily: 'jetbrains',
    });
    expect(result).toEqual({
      feltColor: '#0a3d2a',
      accentColor: '#e9c349',
      borderColor: 'rgb(212 175 55 / 0.35)',
      buttonRadius: 'full',
      surfaceRadius: 'md',
      fontFamily: 'manrope',
      monoFontFamily: 'jetbrains',
    });
  });

  it('rejects arbitrary css and unknown tokens', () => {
    expect(validateBlackjackTableThemeOverrides({ feltColor: 'red' })).toBeNull();
    expect(
      validateBlackjackTableThemeOverrides({
        feltColor: '#0a3d2a',
        buttonRadius: 'huge',
      }),
    ).toBeNull();
    expect(
      validateBlackjackTableThemeOverrides({
        panelBackground: 'url(https://evil.example/x.png)',
      }),
    ).toBeNull();
    expect(validateBlackjackTableThemeOverrides('not-an-object')).toBeNull();
  });

  it('maps merged theme to css variables only from whitelist', () => {
    const vars = themeToCssVariables(
      mergeBlackjackTableTheme({
        feltColor: '#112233',
        accentColor: '#aabbcc',
      }),
    );
    expect(vars['--sxm-theme-felt']).toBe('#112233');
    expect(vars['--sxm-theme-accent']).toBe('#aabbcc');
    expect(vars['--ds-color-felt']).toBe('#112233');
    expect(Object.keys(vars).every((key) => BLACKJACK_THEME_CSS_VARS.includes(key as never))).toBe(
      true,
    );
  });

  it('applyBlackjackTableTheme clears inline overrides on reset', () => {
    const properties: Record<string, string> = {};
    const target = {
      style: {
        getPropertyValue(key: string) {
          return properties[key] ?? '';
        },
        setProperty(key: string, value: string) {
          properties[key] = value;
        },
        removeProperty(key: string) {
          delete properties[key];
        },
      },
    } as unknown as HTMLElement;

    applyBlackjackTableTheme({ feltColor: '#0a3d2a' }, target);
    expect(target.style.getPropertyValue('--sxm-theme-felt')).toBe('#0a3d2a');

    applyBlackjackTableTheme(null, target);
    expect(target.style.getPropertyValue('--sxm-theme-felt')).toBe('');
  });

  it('keeps stitch-aligned defaults separate from overrides', () => {
    expect(DEFAULT_BLACKJACK_TABLE_THEME.feltColor).toBe('#0a3d2a');
    expect(DEFAULT_BLACKJACK_TABLE_THEME.accentColor).toBe('#e9c349');
    expect(mergeBlackjackTableTheme(null)).toEqual(DEFAULT_BLACKJACK_TABLE_THEME);
  });
});
