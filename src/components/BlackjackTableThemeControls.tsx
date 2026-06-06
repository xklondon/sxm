import type { GameState } from '../types';
import type {
  BlackjackTableThemeOverrides,
  ThemeFontToken,
  ThemeMonoFontToken,
  ThemeRadiusToken,
} from '../design/blackjackTableTheme';
import {
  DEFAULT_BLACKJACK_TABLE_THEME,
  mergeBlackjackTableTheme,
  validateBlackjackTableThemeOverrides,
} from '../design/blackjackTableTheme';
import {
  saveSettings,
  settingsFromGameState,
} from '../storage/settingsStorage';

interface BlackjackTableThemeControlsProps {
  gameState: GameState;
  onGameStateChange: (state: GameState) => void;
  disabled?: boolean;
}

function persistTheme(
  gameState: GameState,
  onGameStateChange: (state: GameState) => void,
  nextOverrides: BlackjackTableThemeOverrides | null,
) {
  const validated =
    nextOverrides === null ? null : validateBlackjackTableThemeOverrides(nextOverrides);
  if (nextOverrides !== null && validated === null) {
    return;
  }
  const next = { ...gameState, blackjackTableTheme: validated };
  onGameStateChange(next);
  saveSettings(settingsFromGameState(next));
}

function patchTheme(
  gameState: GameState,
  onGameStateChange: (state: GameState) => void,
  patch: Partial<BlackjackTableThemeOverrides>,
) {
  const current = gameState.blackjackTableTheme ?? {};
  persistTheme(gameState, onGameStateChange, { ...current, ...patch });
}

export function BlackjackTableThemeControls({
  gameState,
  onGameStateChange,
  disabled = false,
}: BlackjackTableThemeControlsProps) {
  const theme = mergeBlackjackTableTheme(gameState.blackjackTableTheme);

  return (
    <section className="bj-flow-settings__card" aria-labelledby="bj-settings-blackjack-theme">
      <h3 id="bj-settings-blackjack-theme" className="bj-flow-settings__card-title">
        Blackjack theme
      </h3>
      <p className="bj-flow-settings__hint">
        Visual tokens for felt, accents, and player boxes on this table.
      </p>

      <label className="bj-flow-settings__field">
        <span className="bj-flow-settings__label">Felt color</span>
        <input
          type="color"
          value={theme.feltColor}
          disabled={disabled}
          onChange={(e) => patchTheme(gameState, onGameStateChange, { feltColor: e.target.value })}
        />
      </label>

      <label className="bj-flow-settings__field">
        <span className="bj-flow-settings__label">Felt highlight</span>
        <input
          type="color"
          value={theme.feltGradientHighlight}
          disabled={disabled}
          onChange={(e) =>
            patchTheme(gameState, onGameStateChange, { feltGradientHighlight: e.target.value })
          }
        />
      </label>

      <label className="bj-flow-settings__field">
        <span className="bj-flow-settings__label">Border color</span>
        <input
          type="text"
          value={theme.borderColor}
          disabled={disabled}
          readOnly
          aria-hidden
          className="bj-theme-controls__readonly"
        />
        <input
          type="color"
          value="#d4af37"
          disabled={disabled}
          onChange={(e) =>
            patchTheme(gameState, onGameStateChange, {
              borderColor: `rgb(${parseInt(e.target.value.slice(1, 3), 16)} ${parseInt(e.target.value.slice(3, 5), 16)} ${parseInt(e.target.value.slice(5, 7), 16)} / 0.35)`,
            })
          }
        />
      </label>

      <label className="bj-flow-settings__field">
        <span className="bj-flow-settings__label">Gold / accent</span>
        <input
          type="color"
          value={theme.accentColor}
          disabled={disabled}
          onChange={(e) => patchTheme(gameState, onGameStateChange, { accentColor: e.target.value })}
        />
      </label>

      <label className="bj-flow-settings__field">
        <span className="bj-flow-settings__label">Text color</span>
        <input
          type="color"
          value={theme.textColor}
          disabled={disabled}
          onChange={(e) => patchTheme(gameState, onGameStateChange, { textColor: e.target.value })}
        />
      </label>

      <label className="bj-flow-settings__field">
        <span className="bj-flow-settings__label">Muted text</span>
        <input
          type="color"
          value={theme.mutedTextColor}
          disabled={disabled}
          onChange={(e) =>
            patchTheme(gameState, onGameStateChange, { mutedTextColor: e.target.value })
          }
        />
      </label>

      <label className="bj-flow-settings__field">
        <span className="bj-flow-settings__label">Button radius</span>
        <select
          value={theme.buttonRadius}
          disabled={disabled}
          onChange={(e) =>
            patchTheme(gameState, onGameStateChange, {
              buttonRadius: e.target.value as ThemeRadiusToken,
            })
          }
        >
          <option value="sm">Small</option>
          <option value="md">Medium</option>
          <option value="lg">Large</option>
          <option value="xl">Extra large</option>
          <option value="full">Pill</option>
        </select>
      </label>

      <label className="bj-flow-settings__field">
        <span className="bj-flow-settings__label">Card / table radius</span>
        <select
          value={theme.surfaceRadius}
          disabled={disabled}
          onChange={(e) =>
            patchTheme(gameState, onGameStateChange, {
              surfaceRadius: e.target.value as ThemeRadiusToken,
            })
          }
        >
          <option value="sm">Small</option>
          <option value="md">Medium</option>
          <option value="lg">Large</option>
          <option value="xl">Extra large</option>
          <option value="full">Pill</option>
        </select>
      </label>

      <label className="bj-flow-settings__field">
        <span className="bj-flow-settings__label">Body font</span>
        <select
          value={theme.fontFamily}
          disabled={disabled}
          onChange={(e) =>
            patchTheme(gameState, onGameStateChange, {
              fontFamily: e.target.value as ThemeFontToken,
            })
          }
        >
          <option value="manrope">Manrope</option>
          <option value="hanken">Hanken Grotesk</option>
          <option value="system">System</option>
        </select>
      </label>

      <label className="bj-flow-settings__field">
        <span className="bj-flow-settings__label">Mono / display font</span>
        <select
          value={theme.monoFontFamily}
          disabled={disabled}
          onChange={(e) =>
            patchTheme(gameState, onGameStateChange, {
              monoFontFamily: e.target.value as ThemeMonoFontToken,
            })
          }
        >
          <option value="jetbrains">JetBrains Mono</option>
          <option value="mono-system">System mono</option>
        </select>
      </label>

      <label className="bj-flow-settings__field">
        <span className="bj-flow-settings__label">Panel background</span>
        <input
          type="text"
          value={theme.panelBackground}
          disabled={disabled}
          readOnly
          className="bj-theme-controls__readonly"
        />
        <input
          type="color"
          value="#131313"
          disabled={disabled}
          onChange={(e) =>
            patchTheme(gameState, onGameStateChange, {
              panelBackground: `rgb(${parseInt(e.target.value.slice(1, 3), 16)} ${parseInt(e.target.value.slice(3, 5), 16)} ${parseInt(e.target.value.slice(5, 7), 16)} / 0.92)`,
            })
          }
        />
      </label>

      <label className="bj-flow-settings__field">
        <span className="bj-flow-settings__label">Player box background</span>
        <input
          type="text"
          value={theme.boxBackground}
          disabled={disabled}
          readOnly
          className="bj-theme-controls__readonly"
        />
        <input
          type="color"
          value="#000000"
          disabled={disabled}
          onChange={(e) =>
            patchTheme(gameState, onGameStateChange, {
              boxBackground: `rgb(${parseInt(e.target.value.slice(1, 3), 16)} ${parseInt(e.target.value.slice(3, 5), 16)} ${parseInt(e.target.value.slice(5, 7), 16)} / 0.18)`,
            })
          }
        />
      </label>

      <label className="bj-flow-settings__field">
        <span className="bj-flow-settings__label">Player box border</span>
        <input
          type="color"
          value="#d4af37"
          disabled={disabled}
          onChange={(e) =>
            patchTheme(gameState, onGameStateChange, {
              boxBorder: `rgb(${parseInt(e.target.value.slice(1, 3), 16)} ${parseInt(e.target.value.slice(3, 5), 16)} ${parseInt(e.target.value.slice(5, 7), 16)} / 0.45)`,
            })
          }
        />
      </label>

      <label className="bj-flow-settings__field">
        <span className="bj-flow-settings__label">Active glow</span>
        <input
          type="color"
          value="#d4af37"
          disabled={disabled}
          onChange={(e) =>
            patchTheme(gameState, onGameStateChange, {
              activeGlowColor: `rgb(${parseInt(e.target.value.slice(1, 3), 16)} ${parseInt(e.target.value.slice(3, 5), 16)} ${parseInt(e.target.value.slice(5, 7), 16)} / 0.55)`,
            })
          }
        />
      </label>

      <button
        type="button"
        className="secondary bj-flow-settings__link-btn"
        disabled={disabled}
        onClick={() => persistTheme(gameState, onGameStateChange, null)}
      >
        Reset to default
      </button>
    </section>
  );
}

export { DEFAULT_BLACKJACK_TABLE_THEME };
