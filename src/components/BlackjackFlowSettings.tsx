import type { GameState } from '../types';
import { useState } from 'react';
import type { DealSpeedPreset } from '../engine/blackjack/flowSettings';
import { isNaturalInitialDeal } from '../engine/blackjack/dealing/dealingModes';
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
import { CustomProtocolBuilder } from './CustomProtocolBuilder';
import { TablePanelOverlay } from './LedgerModals';
import './BlackjackFlowSettings.css';

interface BlackjackFlowSettingsMenuProps {
  gameState: GameState;
  onGameStateChange: (state: GameState) => void;
  open: boolean;
  onClose: () => void;
}

function persistAndApply(
  gameState: GameState,
  onGameStateChange: (state: GameState) => void,
  patch: Parameters<typeof updateBlackjackFlowSettings>[1],
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

function dealSpeedLabel(preset: DealSpeedPreset): string {
  switch (preset) {
    case 'fast':
      return 'Fast (1s)';
    case 'slow':
      return 'Slow (5s)';
    default:
      return 'Normal (3s)';
  }
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
  const naturalDealing = isNaturalInitialDeal(s.initialDealMode);
  const [customBuilderOpen, setCustomBuilderOpen] = useState(false);

  if (!open && !customBuilderOpen) {
    return null;
  }

  return (
    <>
      {open && (
      <TablePanelOverlay
        open
        title="Table settings"
        subtitle="Protocol, dealing pace, and table options for this device."
        onClose={onClose}
      >
        <div className="bj-flow-settings__form">
          <section className="bj-flow-settings__protocol" aria-label="Active protocol">
            <p className="bj-flow-settings__protocol-name">{protocol.displayName}</p>
            <p className="bj-flow-settings__protocol-summary">{protocol.shortDescription}</p>
            {protocolLocked && (
              <p className="bj-flow-settings__protocol-locked">Protocol locked — round in progress.</p>
            )}
            <label className="bj-flow-settings__row">
              <span>Protocol</span>
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
            <span>Natural dealing</span>
            <input
              type="checkbox"
              checked={naturalDealing}
              onChange={(e) =>
                persistAndApply(gameState, onGameStateChange, {
                  initialDealMode: e.target.checked ? 'natural' : 'instant',
                })
              }
            />
          </label>

          <label className="bj-flow-settings__row">
            <span>Deal speed</span>
            <select
              value={s.dealSpeedPreset}
              onChange={(e) =>
                persistAndApply(gameState, onGameStateChange, {
                  dealSpeedPreset: e.target.value as DealSpeedPreset,
                })
              }
            >
              <option value="fast">{dealSpeedLabel('fast')}</option>
              <option value="normal">{dealSpeedLabel('normal')}</option>
              <option value="slow">{dealSpeedLabel('slow')}</option>
            </select>
          </label>

          <label className="bj-flow-settings__row">
            <span>Turn timer</span>
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
              <option value={5}>5 sec</option>
              <option value={10}>10 sec</option>
              <option value={15}>15 sec</option>
              <option value={30}>30 sec</option>
            </select>
          </label>

          <label className="bj-flow-settings__row">
            <span>Auto bank play</span>
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

          <p className="bj-flow-settings__note">Settings save automatically to this device.</p>
        </div>
      </TablePanelOverlay>
      )}

      <CustomProtocolBuilder
        gameState={gameState}
        onGameStateChange={onGameStateChange}
        open={customBuilderOpen}
        onClose={() => setCustomBuilderOpen(false)}
      />
    </>
  );
}
