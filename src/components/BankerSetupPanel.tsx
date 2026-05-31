import { useState } from 'react';
import type { GameState } from '../types';
import {
  assignBankBot,
  assignBankPerson,
  getStartingChipsBank,
} from '../engine/session';
import './BankerSetupPanel.css';

interface BankerSetupPanelProps {
  gameState: GameState;
  onConfirm: (state: GameState) => void;
}

export function BankerSetupPanel({ gameState, onConfirm }: BankerSetupPanelProps) {
  const [personName, setPersonName] = useState(gameState.tableMeta.controllerName);
  const [newPersonName, setNewPersonName] = useState('');
  const [mode, setMode] = useState<'bot' | 'existing' | 'new'>('bot');

  const chips = getStartingChipsBank(gameState);
  const existingNames = [
    ...new Set(
      Object.values(gameState.players)
        .map((p) => p.controllerName)
        .filter(Boolean),
    ),
  ];

  function handleConfirm() {
    try {
      if (mode === 'bot') {
        onConfirm(assignBankBot(gameState, chips));
        return;
      }
      if (mode === 'new') {
        onConfirm(assignBankPerson(gameState, newPersonName.trim(), chips));
        return;
      }
      onConfirm(assignBankPerson(gameState, personName.trim(), chips));
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="banker-setup-overlay" role="dialog" aria-label="Choose banker">
      <div className="banker-setup-panel">
        <h2 className="banker-setup-panel__title">Who is the bank?</h2>
        <p className="banker-setup-panel__sub">
          Banker can be a bot or a real person. The same person may also play boxes.
        </p>

        <label className="banker-setup-panel__option">
          <input
            type="radio"
            name="banker"
            checked={mode === 'bot'}
            onChange={() => setMode('bot')}
          />
          Bank Bot
        </label>

        {existingNames.length > 0 && (
          <label className="banker-setup-panel__option">
            <input
              type="radio"
              name="banker"
              checked={mode === 'existing'}
              onChange={() => setMode('existing')}
            />
            Existing person
            {mode === 'existing' && (
              <select
                className="banker-setup-panel__select"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
              >
                {existingNames.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            )}
          </label>
        )}

        <label className="banker-setup-panel__option">
          <input
            type="radio"
            name="banker"
            checked={mode === 'new'}
            onChange={() => setMode('new')}
          />
          New person as banker
          {mode === 'new' && (
            <input
              type="text"
              className="banker-setup-panel__input"
              placeholder="Banker name"
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
            />
          )}
        </label>

        <button type="button" className="banker-setup-panel__confirm" onClick={handleConfirm}>
          Set banker
        </button>
      </div>
    </div>
  );
}
