import { useState } from 'react';
import type { GameState } from '../types';
import type { CustomRuleType, CustomRuleTrigger } from '../engine/protocols/customProtocolTypes';
import { createCustomProtocol } from '../engine/protocols/customProtocolBuilder';
import { customProtocolSelectId, saveCustomProtocol } from '../storage/customProtocolStorage';
import { listBlackjackProtocolPresets } from '../engine/blackjack/protocols';
import { setBlackjackProtocolOnState } from '../engine/blackjack/protocolState';
import { loadProfile } from '../storage/profileStorage';
import './CustomProtocolBuilder.css';

interface CustomProtocolBuilderProps {
  gameState: GameState;
  onGameStateChange: (state: GameState) => void;
  open: boolean;
  onClose: () => void;
}

export function CustomProtocolBuilder({
  gameState,
  onGameStateChange,
  open,
  onClose,
}: CustomProtocolBuilderProps) {
  const presets = listBlackjackProtocolPresets();
  const [baseProtocolId, setBaseProtocolId] = useState(presets[0]?.protocolId ?? 'las-vegas-house');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ruleTitle, setRuleTitle] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [ruleType, setRuleType] = useState<CustomRuleType>('social');
  const [ruleTrigger, setRuleTrigger] = useState<CustomRuleTrigger>('always');
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  function handleSave() {
    setError(null);
    try {
      const person = loadProfile().name.trim() || gameState.tableMeta.controllerName || 'Host';
      const custom = createCustomProtocol({
        baseProtocolId,
        name,
        description,
        rules: ruleTitle.trim()
          ? [
              {
                title: ruleTitle.trim(),
                description: ruleDescription.trim() || ruleTitle.trim(),
                ruleType,
                trigger: ruleTrigger,
                effect: ruleDescription.trim(),
                isEnabled: true,
              },
            ]
          : [],
      });
      saveCustomProtocol(custom);
      const next = setBlackjackProtocolOnState(
        gameState,
        customProtocolSelectId(custom),
        person,
      );
      onGameStateChange(next);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save custom protocol');
    }
  }

  return (
    <div className="custom-protocol-overlay" role="dialog" aria-label="Create custom protocol">
      <div className="custom-protocol-modal">
        <h2>Create custom protocol</h2>
        <p className="custom-protocol-modal__sub">
          Based on an existing preset. Social rules show in table instructions; executable rules
          are stored safely — no code execution.
        </p>

        <label className="custom-protocol-modal__field">
          Base protocol
          <select value={baseProtocolId} onChange={(e) => setBaseProtocolId(e.target.value)}>
            {presets.map((p) => (
              <option key={p.protocolId} value={p.protocolId}>
                {p.displayName}
              </option>
            ))}
          </select>
        </label>

        <label className="custom-protocol-modal__field">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My house rules" />
        </label>

        <label className="custom-protocol-modal__field">
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </label>

        <fieldset className="custom-protocol-modal__fieldset">
          <legend>Add a rule (optional)</legend>
          <label className="custom-protocol-modal__field">
            Rule title
            <input value={ruleTitle} onChange={(e) => setRuleTitle(e.target.value)} />
          </label>
          <label className="custom-protocol-modal__field">
            Rule description
            <textarea value={ruleDescription} onChange={(e) => setRuleDescription(e.target.value)} rows={2} />
          </label>
          <label className="custom-protocol-modal__field">
            Rule type
            <select value={ruleType} onChange={(e) => setRuleType(e.target.value as CustomRuleType)}>
              <option value="social">Social / table challenge (not enforced by engine)</option>
              <option value="executable">Executable (schema only — may be not yet active)</option>
            </select>
          </label>
          <label className="custom-protocol-modal__field">
            Trigger
            <select value={ruleTrigger} onChange={(e) => setRuleTrigger(e.target.value as CustomRuleTrigger)}>
              <option value="always">Always remind</option>
              <option value="phase">Phase reminder</option>
              <option value="hand-condition">Hand condition</option>
              <option value="card-condition">Card condition</option>
            </select>
          </label>
        </fieldset>

        {error && <p className="custom-protocol-modal__error">{error}</p>}

        <div className="custom-protocol-modal__actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" onClick={handleSave}>
            Save locally &amp; select
          </button>
        </div>
      </div>
    </div>
  );
}
