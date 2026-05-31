import type { GameState } from '../types';
import { useState } from 'react';
import type { BlackjackFlowSettings } from '../engine/blackjack/flowSettings';
import type { InitialDealMode } from '../engine/blackjack/dealing/dealingModes';
import { clampNaturalDealDelayMs } from '../engine/blackjack/dealing/dealingModes';
import {
  getBlackjackProtocolForState,
  getProtocolDisplayRules,
  listAllBlackjackProtocolsForSelector,
  setBlackjackProtocolOnState,
  updateBlackjackFlowSettings,
} from '../engine/blackjack';
import { canUserChangeDesign, canUserChangeProtocol } from '../engine/table/adminControls';
import { listDesignTemplates, applyDesignTemplateToDocument } from '../design/templates';
import { loadProfile } from '../storage/profileStorage';
import {
  saveSettings,
  settingsFromGameState,
} from '../storage/settingsStorage';
import { DebugPanel } from './DebugPanel';
import { CustomProtocolBuilder } from './CustomProtocolBuilder';
import { HostServerPanel } from './HostServerPanel';
import { isOnlineModeEnabled } from '../api/config';
import './BlackjackFlowSettings.css';

const DEBUG_PANEL_KEY = 'sxmcards:debug-panel';

function loadDebugPanelEnabled(): boolean {
  try {
    return localStorage.getItem(DEBUG_PANEL_KEY) === '1';
  } catch {
    return false;
  }
}

interface BlackjackFlowSettingsMenuProps {
  gameState: GameState;
  onGameStateChange: (state: GameState) => void;
  open: boolean;
  onClose: () => void;
}

function persistAndApply(
  gameState: GameState,
  onGameStateChange: (state: GameState) => void,
  patch: Partial<BlackjackFlowSettings>,
) {
  const next = updateBlackjackFlowSettings(gameState, patch);
  onGameStateChange(next);
  saveSettings(settingsFromGameState(next));
}

function persistBlackjackProtocol(
  gameState: GameState,
  onGameStateChange: (state: GameState) => void,
  protocolId: string,
  personName: string,
) {
  try {
    const next = setBlackjackProtocolOnState(gameState, protocolId, personName);
    onGameStateChange(next);
    saveSettings(settingsFromGameState(next));
  } catch {
    // locked or permission denied — ignore
  }
}

function persistDesignTemplate(
  gameState: GameState,
  onGameStateChange: (state: GameState) => void,
  templateId: string,
) {
  const next = { ...gameState, designTemplateId: templateId };
  applyDesignTemplateToDocument(templateId);
  onGameStateChange(next);
  saveSettings(settingsFromGameState(next));
}

export function BlackjackFlowSettingsMenu({
  gameState,
  onGameStateChange,
  open,
  onClose,
}: BlackjackFlowSettingsMenuProps) {
  const s = gameState.blackjackFlowSettings;
  const protocol = getBlackjackProtocolForState(gameState);
  const displayRules = getProtocolDisplayRules(protocol);
  const profile = loadProfile();
  const controller = profile.name.trim() || gameState.tableMeta.controllerName;
  const canChangeProtocol = canUserChangeProtocol(gameState, controller);
  const canChangeDesign = canUserChangeDesign(gameState, controller);
  const protocolLocked = gameState.tableMeta.protocolLocked;
  const [debugOpen, setDebugOpen] = useState(loadDebugPanelEnabled);
  const [customBuilderOpen, setCustomBuilderOpen] = useState(false);
  const [hostServerOpen, setHostServerOpen] = useState(false);

  function toggleDebug(enabled: boolean) {
    setDebugOpen(enabled);
    try {
      localStorage.setItem(DEBUG_PANEL_KEY, enabled ? '1' : '0');
    } catch {
      // ignore
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="bj-flow-settings" role="dialog" aria-label="Table settings">
      <div className="bj-flow-settings__panel">
        <header className="bj-flow-settings__header">
          <h3>Table settings</h3>
          <button type="button" className="bj-flow-settings__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <section className="bj-flow-settings__protocol" aria-label="Active protocol">
          <p className="bj-flow-settings__protocol-name">{protocol.displayName}</p>
          <p className="bj-flow-settings__protocol-summary">{protocol.shortDescription}</p>
          {protocolLocked && (
            <p className="bj-flow-settings__protocol-locked">Protocol locked — round in progress.</p>
          )}
          <label className="bj-flow-settings__row">
            <span>Rule protocol</span>
            <select
              value={gameState.blackjackProtocolId}
              disabled={!canChangeProtocol}
              onChange={(e) =>
                persistBlackjackProtocol(gameState, onGameStateChange, e.target.value, controller)
              }
            >
              {listAllBlackjackProtocolsForSelector().map((p) => (
                <option key={p.protocolId} value={p.protocolId}>
                  {p.displayName}
                </option>
              ))}
            </select>
          </label>
          {!protocolLocked && canChangeProtocol && (
            <button
              type="button"
              className="bj-flow-settings__custom-protocol secondary"
              onClick={() => setCustomBuilderOpen(true)}
            >
              Create custom protocol
            </button>
          )}
          <ul className="bj-flow-settings__protocol-rules">
            {displayRules.map((rule) => (
              <li key={rule.id}>
                <strong>{rule.label}:</strong> {rule.value}
              </li>
            ))}
          </ul>
        </section>

        <label className="bj-flow-settings__row">
          <span>Design template</span>
          <select
            value={gameState.designTemplateId}
            disabled={!canChangeDesign}
            onChange={(e) => persistDesignTemplate(gameState, onGameStateChange, e.target.value)}
          >
            {listDesignTemplates().map((t) => (
              <option key={t.templateId} value={t.templateId}>
                {t.displayName}
              </option>
            ))}
          </select>
        </label>

        <label className="bj-flow-settings__row">
          <span>Initial deal mode</span>
          <select
            value={s.initialDealMode}
            onChange={(e) =>
              persistAndApply(gameState, onGameStateChange, {
                initialDealMode: e.target.value as InitialDealMode,
              })
            }
          >
            <option value="instant">Instant</option>
            <option value="staged">Staged (manual)</option>
            <option value="natural">Natural (one card at a time)</option>
          </select>
        </label>

        <label className="bj-flow-settings__row">
          <span>Natural deal delay (ms)</span>
          <input
            type="number"
            min={600}
            max={900}
            step={50}
            value={s.naturalDealDelayMs}
            onChange={(e) =>
              persistAndApply(gameState, onGameStateChange, {
                naturalDealDelayMs: clampNaturalDealDelayMs(Number(e.target.value) || 750),
              })
            }
          />
        </label>

        <label className="bj-flow-settings__row">
          <span>Auto bank draw</span>
          <input
            type="checkbox"
            checked={s.bankDrawMode === 'auto'}
            onChange={(e) =>
              persistAndApply(gameState, onGameStateChange, {
                bankDrawMode: e.target.checked ? 'auto' : 'manual',
              })
            }
          />
        </label>

        <label className="bj-flow-settings__row">
          <span>Dealing speed</span>
          <select
            value={s.dealSpeedPreset}
            onChange={(e) =>
              persistAndApply(gameState, onGameStateChange, {
                dealSpeedPreset: e.target.value as typeof s.dealSpeedPreset,
              })
            }
          >
            <option value="fast">Fast</option>
            <option value="normal">Normal</option>
            <option value="slow">Slow</option>
          </select>
        </label>

        <label className="bj-flow-settings__row">
          <span>Card timer (sec)</span>
          <select
            value={s.cardTimerPreset}
            onChange={(e) =>
              persistAndApply(gameState, onGameStateChange, {
                cardTimerPreset: Number(e.target.value) as typeof s.cardTimerPreset,
                countdownSeconds: Number(e.target.value),
              })
            }
          >
            <option value={0}>Off</option>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={30}>30</option>
          </select>
        </label>

        <label className="bj-flow-settings__row">
          <span>Countdown (sec)</span>
          <input
            type="number"
            min={0}
            max={60}
            value={s.countdownSeconds}
            onChange={(e) =>
              persistAndApply(gameState, onGameStateChange, {
                countdownSeconds: Math.max(0, Number(e.target.value) || 0),
              })
            }
          />
        </label>

        <label className="bj-flow-settings__row">
          <span>Bank draw min (ms)</span>
          <input
            type="number"
            min={500}
            max={15000}
            step={500}
            value={s.bankDrawMinDelayMs}
            onChange={(e) =>
              persistAndApply(gameState, onGameStateChange, {
                bankDrawMinDelayMs: Math.max(500, Number(e.target.value) || 2000),
              })
            }
          />
        </label>

        <label className="bj-flow-settings__row">
          <span>Bank draw max (ms)</span>
          <input
            type="number"
            min={500}
            max={15000}
            step={500}
            value={s.bankDrawMaxDelayMs}
            onChange={(e) =>
              persistAndApply(gameState, onGameStateChange, {
                bankDrawMaxDelayMs: Math.max(500, Number(e.target.value) || 5000),
              })
            }
          />
        </label>

        <label className="bj-flow-settings__row">
          <span>Bank stand pause (ms)</span>
          <input
            type="number"
            min={500}
            max={10000}
            step={500}
            value={s.bankStandPauseMs}
            onChange={(e) =>
              persistAndApply(gameState, onGameStateChange, {
                bankStandPauseMs: Math.max(500, Number(e.target.value) || 1500),
              })
            }
          />
        </label>

        <label className="bj-flow-settings__row">
          <span>Payout display (ms)</span>
          <input
            type="number"
            min={500}
            max={10000}
            step={500}
            value={s.bankingDisplayMs}
            onChange={(e) =>
              persistAndApply(gameState, onGameStateChange, {
                bankingDisplayMs: Math.max(500, Number(e.target.value) || 1500),
              })
            }
          />
        </label>

        <label className="bj-flow-settings__row">
          <span>Bank draw delay (ms)</span>
          <input
            type="number"
            min={500}
            max={10000}
            step={500}
            value={s.bankAutoDrawDelayMs}
            onChange={(e) =>
              persistAndApply(gameState, onGameStateChange, {
                bankAutoDrawDelayMs: Math.max(500, Number(e.target.value) || 3000),
              })
            }
          />
        </label>

        <label className="bj-flow-settings__row">
          <span>AID advice</span>
          <input
            type="checkbox"
            checked={s.adviceEnabled}
            onChange={(e) =>
              persistAndApply(gameState, onGameStateChange, { adviceEnabled: e.target.checked })
            }
          />
        </label>

        <fieldset className="bj-flow-settings__fieldset">
          <legend>Advice cost</legend>
          <label className="bj-flow-settings__radio">
            <input
              type="radio"
              name="adviceCost"
              checked={s.adviceCostMode === 'free'}
              onChange={() => persistAndApply(gameState, onGameStateChange, { adviceCostMode: 'free' })}
            />
            Free
          </label>
          <label className="bj-flow-settings__radio">
            <input
              type="radio"
              name="adviceCost"
              checked={s.adviceCostMode === 'bank-offer'}
              onChange={() =>
                persistAndApply(gameState, onGameStateChange, { adviceCostMode: 'bank-offer' })
              }
            />
            Bank offer
          </label>
        </fieldset>

        {isOnlineModeEnabled() && (
          <div className="bj-flow-settings__row">
            <span>Host Server</span>
            <button
              type="button"
              className="secondary"
              onClick={() => setHostServerOpen(true)}
            >
              Open
            </button>
          </div>
        )}

        <label className="bj-flow-settings__row">
          <span>Show debug panel</span>
          <input
            type="checkbox"
            checked={debugOpen}
            onChange={(e) => toggleDebug(e.target.checked)}
          />
        </label>

        {debugOpen && <DebugPanel gameState={gameState} />}

        <p className="bj-flow-settings__note">Settings save automatically to this device.</p>
      </div>
      <CustomProtocolBuilder
        gameState={gameState}
        onGameStateChange={onGameStateChange}
        open={customBuilderOpen}
        onClose={() => setCustomBuilderOpen(false)}
      />
      <HostServerPanel open={hostServerOpen} onClose={() => setHostServerOpen(false)} />
    </div>
  );
}
