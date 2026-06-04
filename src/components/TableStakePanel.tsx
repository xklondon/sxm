import { useState } from 'react';

import type { GameState } from '../types';

import {
  applyTableResetSetup,
  applyTableStakeSetup,
  applyZilchTableStakeSetup,
  createNewZilchTable,
  DEFAULT_TABLE_CHIPS,
  switchGameType,
  type TableBankerSetupMode,
  type TableStakeSetupInput,
  type ZilchTableStakeSetupInput,
} from '../engine/session';
import {
  listBlackjackProtocolPresets,
  getBlackjackProtocolOrDefault,
  getProtocolDisplayRules,
} from '../engine/blackjack/protocols';
import { isNaturalInitialDeal } from '../engine/blackjack/dealing/dealingModes';
import type { DealSpeedPreset } from '../engine/blackjack/flowSettings';

import { loadProfile } from '../storage/profileStorage';
import { log } from '../utils/logger';
import { isOnlineModeEnabled } from '../api/config';

import './TableStakePanel.css';

const STAKE_EXAMPLES = ['$5', 'dinner', 'car wash', 'bottle of wine', 'favour', 'immaterial promise'];

type SetupCategoryTab = 'cards' | 'dice';

export type TableStakePanelMode = 'new' | 'reset';

interface TableStakePanelProps {
  gameState: GameState;
  mode?: TableStakePanelMode;
  onConfirm: (state: GameState) => void;
  /** Called after online reset dispatches (state arrives via socket). */
  onFinished?: () => void;
  onlineDispatch?: (type: string, payload?: Record<string, unknown>) => Promise<unknown>;
}

function initialBankerMode(state: GameState): TableBankerSetupMode {
  const mode = state.tableMeta.bankerSetup.mode;
  if (mode === 'person') {
    const owner = state.tableMeta.owner?.ownerName?.trim();
    const bankName = state.tableMeta.bankerSetup.displayName?.trim();
    if (owner && bankName && owner === bankName) {
      return 'self';
    }
    return 'other';
  }
  return 'bot';
}

export function TableStakePanel({
  gameState,
  mode = 'new',
  onConfirm,
  onFinished,
  onlineDispatch,
}: TableStakePanelProps) {
  const profile = loadProfile();
  const flow = gameState.blackjackFlowSettings;
  const isReset = mode === 'reset';
  const agreement = gameState.tableMeta.agreement;

  const [stake, setStake] = useState(
    () => agreement?.stakeDescription ?? '',
  );
  const [inviteNote, setInviteNote] = useState('');
  const [seatChips, setSeatChips] = useState(
    String(gameState.tableMeta.startingChipsEachSeat ?? DEFAULT_TABLE_CHIPS),
  );
  const [bankChips, setBankChips] = useState(
    String(gameState.tableMeta.startingChipsBank ?? gameState.tableMeta.startingChipsEachSeat ?? DEFAULT_TABLE_CHIPS),
  );
  const [bankChipsCustom, setBankChipsCustom] = useState(false);
  const [bankerMode, setBankerMode] = useState<TableBankerSetupMode>(() => initialBankerMode(gameState));
  const [bankerName, setBankerName] = useState(
    () => gameState.tableMeta.bankerSetup.displayName ?? '',
  );
  const [setupTab, setSetupTab] = useState<SetupCategoryTab>(() =>
    gameState.tableMeta.gameCategory === 'dice' || gameState.tableGame === 'zilch'
      ? 'dice'
      : 'cards',
  );
  const [protocolId, setProtocolId] = useState(
    gameState.blackjackProtocolId ?? listBlackjackProtocolPresets()[0]?.protocolId ?? 'las-vegas-house',
  );
  const [zilchMode, setZilchMode] = useState<'target_points' | 'fixed_rounds'>(
    gameState.zilchSettings.mode ?? 'target_points',
  );
  const [targetPoints, setTargetPoints] = useState(
    String(gameState.zilchSettings.targetPoints ?? 100),
  );
  const [roundLimit, setRoundLimit] = useState(String(gameState.zilchSettings.roundLimit ?? 10));
  const [diceAnimMode, setDiceAnimMode] = useState<'fixed' | 'random'>(
    gameState.zilchSettings.diceAnimation.diceAnimationMode,
  );
  const [diceAnimMs, setDiceAnimMs] = useState(
    String(gameState.zilchSettings.diceAnimation.diceAnimationMs),
  );
  const [diceAnimMin, setDiceAnimMin] = useState(
    String(gameState.zilchSettings.diceAnimation.diceAnimationRandomMinMs),
  );
  const [diceAnimMax, setDiceAnimMax] = useState(
    String(gameState.zilchSettings.diceAnimation.diceAnimationRandomMaxMs),
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [naturalDealing, setNaturalDealing] = useState(isNaturalInitialDeal(flow.initialDealMode));
  const [dealSpeedPreset, setDealSpeedPreset] = useState<DealSpeedPreset>(flow.dealSpeedPreset);
  const [cardTimerPreset, setCardTimerPreset] = useState(flow.cardTimerPreset);
  const [bankDrawAuto, setBankDrawAuto] = useState(flow.bankDrawMode === 'auto');
  const [submitting, setSubmitting] = useState(false);

  const selectedProtocol = getBlackjackProtocolOrDefault(protocolId);
  const protocolRules = getProtocolDisplayRules(selectedProtocol);
  const showPlayingFor = bankerMode === 'bot';
  const onlineMode = isOnlineModeEnabled();

  const controller = profile.name.trim() || gameState.tableMeta.controllerName;

  function buildZilchSetupInput(): ZilchTableStakeSetupInput {
    const base = buildSetupInput();
    return {
      ...base,
      zilchMode,
      targetPoints: Number.parseInt(targetPoints, 10) || 100,
      roundLimit: Number.parseInt(roundLimit, 10) || 10,
      diceAnimationMode: diceAnimMode,
      diceAnimationMs: Number.parseInt(diceAnimMs, 10) || 2500,
      diceAnimationRandomMinMs: Number.parseInt(diceAnimMin, 10) || 2000,
      diceAnimationRandomMaxMs: Number.parseInt(diceAnimMax, 10) || 8000,
    };
  }

  function buildSetupInput(): TableStakeSetupInput {
    const seatAmount = Number.parseInt(seatChips, 10) || DEFAULT_TABLE_CHIPS;
    const bankAmount = Number.parseInt(bankChips, 10) || seatAmount;
    const showPlayingForStake = bankerMode === 'bot';
    return {
      stakeDescription: showPlayingForStake ? stake.trim() || 'Friendly wager' : 'Table session',
      seatChips: seatAmount,
      bankChips: bankAmount,
      bankerMode,
      bankerName,
      controllerName: controller,
      controllerEmail: profile.email,
      protocolId,
      naturalDealing,
      dealSpeedPreset,
      cardTimerPreset,
      bankDrawAuto,
    };
  }

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

  async function handleConfirm() {
    const input = buildSetupInput();

    log.info('setupStartingChipsInput', {
      mode: isReset ? 'reset' : 'new',
      seatChipsInput: seatChips,
      bankChipsInput: bankChips,
      seatAmount: input.seatChips,
      bankAmount: input.bankChips,
      inviteNote: inviteNote.trim() || undefined,
    });

    if (onlineMode && onlineDispatch && isReset) {
      setSubmitting(true);
      try {
        const resetPayload =
          setupTab === 'dice'
            ? { ...buildZilchSetupInput(), inviteNote: inviteNote.trim() || undefined }
            : { ...input, inviteNote: inviteNote.trim() || undefined };
        await onlineDispatch('resetTable', resetPayload);
        onFinished?.();
      } finally {
        setSubmitting(false);
      }
      return;
    }

    let base = gameState;
    if (setupTab === 'dice' && base.tableGame !== 'zilch') {
      base = applySettingsToDiceTable(base);
    } else if (setupTab === 'cards' && base.tableGame === 'zilch') {
      base = switchGameType(base, 'blackjack');
    }

    const next =
      setupTab === 'dice'
        ? isReset
          ? applyZilchTableStakeSetup(
              applyTableResetSetup(base, input, base.tableMeta.ownerPersonId),
              buildZilchSetupInput(),
            )
          : applyZilchTableStakeSetup(base, buildZilchSetupInput())
        : isReset
          ? applyTableResetSetup(base, input, base.tableMeta.ownerPersonId)
          : applyTableStakeSetup(base, input);
    onConfirm(next);
  }

  function applySettingsToDiceTable(state: GameState): GameState {
    const fresh = createNewZilchTable();
    return {
      ...fresh,
      session: { ...fresh.session, id: state.session.id },
      ledger: state.ledger,
      players: state.players,
      tableMeta: {
        ...state.tableMeta,
        gameCategory: 'dice',
        diceGame: 'zilch',
        showStakeSetup: true,
      },
      tableAdminSettings: state.tableAdminSettings,
      designTemplateId: state.designTemplateId,
      blackjackFlowSettings: state.blackjackFlowSettings,
      blackjackProtocolId: state.blackjackProtocolId,
    };
  }

  return (
    <div
      className="table-stake-overlay"
      role="dialog"
      aria-label={isReset ? 'Reset table setup' : 'New table setup'}
    >
      <div className="table-stake-panel">
        <header className="table-stake-panel__header">
          <h2 className="table-stake-panel__title">
            {isReset ? 'Reset table' : 'New Table'}
          </h2>
          <p className="table-stake-panel__sub">
            {isReset
              ? 'Start a new game with the players currently at this table.'
              : 'Set up who plays, who banks, and how the table runs.'}
          </p>
        </header>

        <div className="table-stake-panel__grid">
          <div className="table-stake-panel__col">
            <fieldset className="table-stake-panel__banker">
              <legend>Players at this table</legend>
              <p className="table-stake-panel__hint">
                {isReset
                  ? 'Seat assignments and invites stay the same. Adjust bank, wager, and chips below.'
                  : onlineMode
                    ? 'After the table starts, use Invite on This Table to email friends a join link.'
                    : 'Add players at the table once play begins.'}
              </p>
              {onlineMode && !isReset && (
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
              <legend>Game category</legend>
              <div className="table-stake-panel__tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={setupTab === 'cards'}
                  className={setupTab === 'cards' ? '' : 'secondary'}
                  onClick={() => setSetupTab('cards')}
                >
                  Cards
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={setupTab === 'dice'}
                  className={setupTab === 'dice' ? '' : 'secondary'}
                  onClick={() => setSetupTab('dice')}
                >
                  Dice
                </button>
              </div>

              {setupTab === 'cards' && (
                <>
                  <label className="table-stake-panel__field">
                    <span>Rule protocol</span>
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
                  </label>
                  <p className="table-stake-panel__hint">{selectedProtocol.shortDescription}</p>
                  <ul className="table-stake-panel__protocol-rules">
                    {protocolRules.map((rule) => (
                      <li key={rule.id}>
                        <strong>{rule.label}:</strong> {rule.value}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {setupTab === 'dice' && (
                <>
                  <p className="table-stake-panel__hint">
                    <strong>Zilch</strong> — six dice, scoring combinations, bank your turn or
                    risk a zilch.
                  </p>
                  <label className="table-stake-panel__field">
                    <span>Game mode</span>
                    <select
                      className="table-stake-panel__input"
                      value={zilchMode}
                      onChange={(e) =>
                        setZilchMode(e.target.value as 'target_points' | 'fixed_rounds')
                      }
                    >
                      <option value="target_points">First to target points</option>
                      <option value="fixed_rounds">Most points after fixed rounds</option>
                    </select>
                  </label>
                  {zilchMode === 'target_points' ? (
                    <label className="table-stake-panel__field">
                      <span>Target points</span>
                      <input
                        type="number"
                        min={1}
                        className="table-stake-panel__input table-stake-panel__input--short"
                        value={targetPoints}
                        onChange={(e) => setTargetPoints(e.target.value)}
                      />
                    </label>
                  ) : (
                    <label className="table-stake-panel__field">
                      <span>Round limit (per player)</span>
                      <input
                        type="number"
                        min={1}
                        className="table-stake-panel__input table-stake-panel__input--short"
                        value={roundLimit}
                        onChange={(e) => setRoundLimit(e.target.value)}
                      />
                    </label>
                  )}
                  <label className="table-stake-panel__field">
                    <span>Dice animation</span>
                    <select
                      className="table-stake-panel__input"
                      value={diceAnimMode}
                      onChange={(e) => setDiceAnimMode(e.target.value as 'fixed' | 'random')}
                    >
                      <option value="fixed">Fixed duration</option>
                      <option value="random">Random duration</option>
                    </select>
                  </label>
                  {diceAnimMode === 'fixed' ? (
                    <label className="table-stake-panel__field">
                      <span>Animation ms</span>
                      <input
                        type="number"
                        min={200}
                        className="table-stake-panel__input table-stake-panel__input--short"
                        value={diceAnimMs}
                        onChange={(e) => setDiceAnimMs(e.target.value)}
                      />
                    </label>
                  ) : (
                    <>
                      <label className="table-stake-panel__field">
                        <span>Min ms</span>
                        <input
                          type="number"
                          min={200}
                          className="table-stake-panel__input table-stake-panel__input--short"
                          value={diceAnimMin}
                          onChange={(e) => setDiceAnimMin(e.target.value)}
                        />
                      </label>
                      <label className="table-stake-panel__field">
                        <span>Max ms</span>
                        <input
                          type="number"
                          min={200}
                          className="table-stake-panel__input table-stake-panel__input--short"
                          value={diceAnimMax}
                          onChange={(e) => setDiceAnimMax(e.target.value)}
                        />
                      </label>
                    </>
                  )}
                </>
              )}
            </fieldset>

            {setupTab === 'cards' && (
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
            )}
          </div>
        </div>

        <button
          type="button"
          className="table-stake-panel__confirm"
          onClick={() => void handleConfirm()}
          disabled={submitting}
        >
          {isReset ? 'Start new game' : 'Start playing'}
        </button>
      </div>
    </div>
  );
}
