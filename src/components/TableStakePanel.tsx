import { useState } from 'react';

import type { GameState } from '../types';

import {
  assignBankBot,
  assignBankPerson,
  confirmTableAgreement,
  DEFAULT_TABLE_CHIPS,
  ensureTableOwnerPersonBankroll,
  logDerivedBalances,
  logLedgerAfterAllocation,
  logTableMetaStartingChips,
  setTableOwner,
} from '../engine/session';
import {
  listBlackjackProtocolPresets,
  getBlackjackProtocolOrDefault,
  getProtocolDisplayRules,
} from '../engine/blackjack/protocols';
import { setBlackjackProtocolOnState } from '../engine/blackjack/protocolState';

import { loadProfile } from '../storage/profileStorage';
import { log } from '../utils/logger';

import './TableStakePanel.css';

const STAKE_EXAMPLES = ['$5', 'dinner', 'car wash', 'bottle of wine', 'favour', 'immaterial promise'];

interface TableStakePanelProps {
  gameState: GameState;
  onConfirm: (state: GameState) => void;
}

export function TableStakePanel({ gameState, onConfirm }: TableStakePanelProps) {
  const profile = loadProfile();
  const [stake, setStake] = useState('');
  const [seatChips, setSeatChips] = useState(
    String(gameState.tableMeta.startingChipsEachSeat ?? DEFAULT_TABLE_CHIPS),
  );
  const [bankChips, setBankChips] = useState(
    String(gameState.tableMeta.startingChipsBank ?? gameState.tableMeta.startingChipsEachSeat ?? DEFAULT_TABLE_CHIPS),
  );
  const [bankChipsCustom, setBankChipsCustom] = useState(false);
  const [bankerMode, setBankerMode] = useState<'bot' | 'self' | 'other'>('bot');
  const [bankerName, setBankerName] = useState('');
  const [protocolId, setProtocolId] = useState(
    gameState.blackjackProtocolId ?? listBlackjackProtocolPresets()[0]?.protocolId ?? 'las-vegas-house',
  );

  const selectedProtocol = getBlackjackProtocolOrDefault(protocolId);
  const protocolRules = getProtocolDisplayRules(selectedProtocol);

  const controller = profile.name.trim() || gameState.tableMeta.controllerName;

  function handleSeatChipsChange(value: string) {
    setSeatChips(value);
    if (!bankChipsCustom) {
      setBankChips(value);
    }
  }

  function handleBankChipsChange(value: string) {
    setBankChipsCustom(true);
    setBankChips(value);
  }

  function handleConfirm() {
    const seatAmount = Number.parseInt(seatChips, 10) || DEFAULT_TABLE_CHIPS;
    const bankAmount = Number.parseInt(bankChips, 10) || seatAmount;

    log.info('setupStartingChipsInput', {
      seatChipsInput: seatChips,
      bankChipsInput: bankChips,
      seatAmount,
      bankAmount,
    });

    let next = confirmTableAgreement(gameState, stake, seatAmount, bankAmount);

    next = setTableOwner(next, controller, profile.email);

    next = {
      ...next,
      tableMeta: {
        ...next.tableMeta,
        controllerName: controller,
        showBankerSetup: false,
      },
    };

    if (bankerMode === 'bot') {
      next = assignBankBot(next, bankAmount);
    } else if (bankerMode === 'self') {
      next = assignBankPerson(next, controller, bankAmount);
    } else {
      next = assignBankPerson(next, bankerName.trim(), bankAmount);
    }

    next = ensureTableOwnerPersonBankroll(next);

    logLedgerAfterAllocation(next, 'start-playing');
    logDerivedBalances(next, 'start-playing');
    logTableMetaStartingChips(next, 'start-playing');
    next = setBlackjackProtocolOnState(next, protocolId, controller);
    onConfirm(next);
  }

  return (
    <div className="table-stake-overlay" role="dialog" aria-label="Table agreement">
      <div className="table-stake-panel">
        <h2 className="table-stake-panel__title">What are we playing for?</h2>
        <p className="table-stake-panel__sub">
          Local honor-system agreement — not payment processing.
        </p>

        <label className="table-stake-panel__field">
          <span>Playing for / wager</span>
          <input
            type="text"
            className="table-stake-panel__input"
            placeholder="e.g. dinner, favour, friendly wager"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            list="stake-examples"
          />
          <datalist id="stake-examples">
            {STAKE_EXAMPLES.map((ex) => (
              <option key={ex} value={ex} />
            ))}
          </datalist>
        </label>

        <label className="table-stake-panel__field">
          <span>Starting chips each seat</span>
          <input
            type="number"
            min={1}
            className="table-stake-panel__input table-stake-panel__input--short"
            value={seatChips}
            onChange={(e) => handleSeatChipsChange(e.target.value)}
          />
        </label>

        <label className="table-stake-panel__field">
          <span>Starting chips bank</span>
          <input
            type="number"
            min={1}
            className="table-stake-panel__input table-stake-panel__input--short"
            value={bankChips}
            onChange={(e) => handleBankChipsChange(e.target.value)}
          />
          {!bankChipsCustom && (
            <span className="table-stake-panel__hint">Defaults to seat amount</span>
          )}
        </label>

        <fieldset className="table-stake-panel__banker">
          <legend>Who is the bank?</legend>
          <label className="table-stake-panel__option">
            <input
              type="radio"
              name="banker"
              checked={bankerMode === 'bot'}
              onChange={() => setBankerMode('bot')}
            />
            Bank Bot
          </label>
          <label className="table-stake-panel__option">
            <input
              type="radio"
              name="banker"
              checked={bankerMode === 'self'}
              onChange={() => setBankerMode('self')}
            />
            Me ({controller || 'local player'})
          </label>
          <label className="table-stake-panel__option">
            <input
              type="radio"
              name="banker"
              checked={bankerMode === 'other'}
              onChange={() => setBankerMode('other')}
            />
            Someone else
          </label>
          {bankerMode === 'other' && (
            <input
              type="text"
              className="table-stake-panel__input"
              placeholder="Banker name"
              value={bankerName}
              onChange={(e) => setBankerName(e.target.value)}
            />
          )}
        </fieldset>

        <fieldset className="table-stake-panel__banker">
          <legend>Rule protocol</legend>
          <select
            className="table-stake-panel__input"
            value={protocolId}
            onChange={(e) => setProtocolId(e.target.value)}
          >
            {listBlackjackProtocolPresets().map((p) => (
              <option key={p.protocolId} value={p.protocolId}>
                {p.displayName}
              </option>
            ))}
          </select>
          <p className="table-stake-panel__hint">{selectedProtocol.shortDescription}</p>
          <ul className="table-stake-panel__protocol-rules">
            {protocolRules.map((rule) => (
              <li key={rule.id}>
                <strong>{rule.label}:</strong> {rule.value}
              </li>
            ))}
          </ul>
        </fieldset>

        <button type="button" className="table-stake-panel__confirm" onClick={handleConfirm}>
          Start playing
        </button>
      </div>
    </div>
  );
}
