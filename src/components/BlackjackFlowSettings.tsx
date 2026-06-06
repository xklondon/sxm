import type { GameState } from '../types';
import { useState } from 'react';
import type { DealSpeedPreset } from '../engine/blackjack/flowSettings';
import { isNaturalInitialDeal } from '../engine/blackjack/dealing/dealingModes';
import {
  listAllBlackjackProtocolsForSelector,
  setBlackjackProtocolOnState,
  updateBlackjackFlowSettings,
} from '../engine/blackjack';
import { canUserChangeDesign, canUserChangeProtocol } from '../engine/table/adminControls';
import { listDesignTemplates, applyDesignTemplateToDocument } from '../design/templates';
import { SXM_LAYOUT, sxmSectionProps } from './sxmLayoutContract';
import { loadProfile } from '../storage/profileStorage';
import {
  saveSettings,
  settingsFromGameState,
} from '../storage/settingsStorage';
import { CustomProtocolBuilder } from './CustomProtocolBuilder';
import { BlackjackTableThemeControls } from './BlackjackTableThemeControls';
import './BlackjackFlowSettings.css';
import './InviteModal.css';

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
    // locked or permission denied
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
        <div
          className="invite-modal-overlay bj-table-panel-overlay"
          role="presentation"
          onClick={onClose}
        >
          <div
            {...sxmSectionProps(
              SXM_LAYOUT.settingsPanel,
              'invite-modal invite-modal--ledger invite-modal--settings-panel',
            )}
            role="dialog"
            aria-labelledby="table-settings-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="invite-modal__header">
              <h2 id="table-settings-title" className="invite-modal__title">
                Table settings
              </h2>
              <button
                type="button"
                className="invite-modal__close secondary"
                onClick={onClose}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="invite-modal__sub bj-settings-modal__sub">
              Device preferences for protocol, style, dealing, and timers.
            </p>

            <div className="bj-settings-modal__body">
              <div className="bj-flow-settings__grid">
                <section className="bj-flow-settings__card" aria-labelledby="bj-settings-protocol">
                  <h3 id="bj-settings-protocol" className="bj-flow-settings__card-title">
                    Protocol
                  </h3>
                  {protocolLocked && (
                    <p className="bj-flow-settings__hint bj-flow-settings__hint--warn">
                      Locked during play.
                    </p>
                  )}
                  <label className="bj-flow-settings__field">
                    <span className="bj-flow-settings__label">Active protocol</span>
                    <select
                      value={gameState.blackjackProtocolId}
                      disabled={!canChangeProtocol}
                      onChange={(e) =>
                        persistBlackjackProtocol(
                          gameState,
                          onGameStateChange,
                          e.target.value,
                          controller,
                        )
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
                      className="secondary bj-flow-settings__link-btn"
                      onClick={() => setCustomBuilderOpen(true)}
                    >
                      Create custom protocol
                    </button>
                  )}
                </section>

                <section className="bj-flow-settings__card" aria-labelledby="bj-settings-style">
                  <h3 id="bj-settings-style" className="bj-flow-settings__card-title">
                    Table style
                  </h3>
                  <label className="bj-flow-settings__field">
                    <span className="bj-flow-settings__label">Design template</span>
                    <select
                      value={gameState.designTemplateId}
                      disabled={!canChangeDesign}
                      onChange={(e) =>
                        persistDesignTemplate(gameState, onGameStateChange, e.target.value)
                      }
                    >
                      {listDesignTemplates().map((t) => (
                        <option key={t.templateId} value={t.templateId}>
                          {t.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                </section>

                {canChangeDesign && (
                  <BlackjackTableThemeControls
                    gameState={gameState}
                    onGameStateChange={onGameStateChange}
                  />
                )}

                <section className="bj-flow-settings__card" aria-labelledby="bj-settings-dealing">
                  <h3 id="bj-settings-dealing" className="bj-flow-settings__card-title">
                    Dealing
                  </h3>
                  <label className="bj-flow-settings__field bj-flow-settings__field--check">
                    <span className="bj-flow-settings__label">Natural dealing</span>
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
                  <label className="bj-flow-settings__field">
                    <span className="bj-flow-settings__label">Deal speed</span>
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
                </section>

                <section className="bj-flow-settings__card" aria-labelledby="bj-settings-timer">
                  <h3 id="bj-settings-timer" className="bj-flow-settings__card-title">
                    Timer / Bank play
                  </h3>
                  <label className="bj-flow-settings__field">
                    <span className="bj-flow-settings__label">Turn timer</span>
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
                  <label className="bj-flow-settings__field bj-flow-settings__field--check">
                    <span className="bj-flow-settings__label">Auto bank play</span>
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
                </section>
              </div>
              <p className="bj-flow-settings__note">Changes save automatically on this device.</p>
            </div>

            <footer className="bj-settings-modal__footer">
              <button type="button" className="secondary" onClick={onClose}>
                Close
              </button>
            </footer>
          </div>
        </div>
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
