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
import { updateBlackjackFlowSettings } from '../engine/blackjack';
import type { DealSpeedPreset } from '../engine/blackjack/flowSettings';
import { isNaturalInitialDeal } from '../engine/blackjack/dealing/dealingModes';

import { loadProfile } from '../storage/profileStorage';
import { log } from '../utils/logger';
import { isOnlineModeEnabled } from '../api/config';

import './TableStakePanel.css';

const STAKE_EXAMPLES = ['$5', 'dinner', 'car wash', 'bottle of wine', 'favour', 'immaterial promise'];

interface TableStakePanelProps {
  gameState: GameState;
  onConfirm: (state: GameState) => void;
}

export function TableStakePanel({ gameState, onConfirm }: TableStakePanelProps) {
  const profile = loadProfile();
  const flow = gameState.blackjackFlowSettings;
  const [stake, setStake] = useState('');
  const [inviteNote, setInviteNote] = useState('');
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [naturalDealing, setNaturalDealing] = useState(isNaturalInitialDeal(flow.initialDealMode));
  const [dealSpeedPreset, setDealSpeedPreset] = useState<DealSpeedPreset>(flow.dealSpeedPreset);
  const [cardTimerPreset, setCardTimerPreset] = useState(flow.cardTimerPreset);
  const [bankDrawAuto, setBankDrawAuto] = useState(flow.bankDrawMode === 'auto');

  const selectedProtocol = getBlackjackProtocolOrDefault(protocolId);
  const protocolRules = getProtocolDisplayRules(selectedProtocol);
  const showPlayingFor = bankerMode === 'bot';
  const onlineMode = isOnlineModeEnabled();

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
    const stakeDescription = showPlayingFor ? stake.trim() || 'Friendly wager' : 'Table session';

    log.info('setupStartingChipsInput', {
      seatChipsInput: seatChips,
      bankChipsInput: bankChips,
      seatAmount,
      bankAmount,
      inviteNote: inviteNote.trim() || undefined,
    });

    let next = confirmTableAgreement(gameState, stakeDescription, seatAmount, bankAmount);

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
    next = updateBlackjackFlowSettings(next, {
      initialDealMode: naturalDealing ? 'natural' : 'instant',
      dealSpeedPreset,
      cardTimerPreset,
      countdownSeconds: cardTimerPreset,
      bankDrawMode: bankDrawAuto ? 'auto' : 'manual',
    });
    onConfirm(next);
  }

  return (
    <div className="table-stake-overlay" role="dialog" aria-label="New table setup">
      <div className="table-stake-panel">
        <header className="table-stake-panel__header">
          <h2 className="table-stake-panel__title">New Table</h2>
          <p className="table-stake-panel__sub">
            Set up who plays, who banks, and how the table runs.
          </p>
        </header>

        <div className="table-stake-panel__grid">
          <div className="table-stake-panel__col">
            <fieldset className="table-stake-panel__banker">
              <legend>Invite who to play with</legend>
              <p className="table-stake-panel__hint">
                {onlineMode
                  ? 'After the table starts, use Invite on This Table to email friends a join link.'
                  : 'Add players at the table once play begins.'}
              </p>
              {onlineMode && (
                <input
                  type="text"
                  className="table-stake-panel__input"
                  placeholder="Friend names or emails (optional reminder)"
                  value={inviteNote}
                  onChange={(e) => setInviteNote(e.target.value)}
                />
              )}
            </fieldset>

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

            {showPlayingFor && (
              <label className="table-stake-panel__field">
                <span>What to play for</span>
                <input
                  type="text"
                  className="table-stake-panel__input"
                  placeholder="e.g. dinner, favour, friendly wager"
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  list="stake-examples"
                />
                <span className="table-stake-panel__hint">
                  Recorded on your personal ledger when the bank is the house bot.
                </span>
                <datalist id="stake-examples">
                  {STAKE_EXAMPLES.map((ex) => (
                    <option key={ex} value={ex} />
                  ))}
                </datalist>
              </label>
            )}
          </div>

          <div className="table-stake-panel__col">
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

            <div className="table-stake-panel__advanced">
              <button
                type="button"
                className="table-stake-panel__advanced-toggle secondary"
                onClick={() => setAdvancedOpen((v) => !v)}
                aria-expanded={advancedOpen}
              >
                Advanced settings {advancedOpen ? '▾' : '▸'}
              </button>
              {advancedOpen && (
                <div className="table-stake-panel__advanced-body">
                  <label className="table-stake-panel__option">
                    <input
                      type="checkbox"
                      checked={naturalDealing}
                      onChange={(e) => setNaturalDealing(e.target.checked)}
                    />
                    Natural dealing
                  </label>
                  <label className="table-stake-panel__field">
                    <span>Deal speed</span>
                    <select
                      className="table-stake-panel__input"
                      value={dealSpeedPreset}
                      onChange={(e) => setDealSpeedPreset(e.target.value as DealSpeedPreset)}
                    >
                      <option value="fast">Fast (1s)</option>
                      <option value="normal">Normal (3s)</option>
                      <option value="slow">Slow (5s)</option>
                    </select>
                  </label>
                  <label className="table-stake-panel__field">
                    <span>Turn timer</span>
                    <select
                      className="table-stake-panel__input"
                      value={cardTimerPreset}
                      onChange={(e) => setCardTimerPreset(Number(e.target.value) as typeof cardTimerPreset)}
                    >
                      <option value={0}>Off</option>
                      <option value={5}>5 sec</option>
                      <option value={10}>10 sec</option>
                      <option value={15}>15 sec</option>
                      <option value={30}>30 sec</option>
                    </select>
                  </label>
                  <label className="table-stake-panel__option">
                    <input
                      type="checkbox"
                      checked={bankDrawAuto}
                      onChange={(e) => setBankDrawAuto(e.target.checked)}
                    />
                    Auto bank play
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        <button type="button" className="table-stake-panel__confirm" onClick={handleConfirm}>
          Start playing
        </button>
      </div>
    </div>
  );
}
