import { useState } from 'react';

import type { GameState, TableMode } from '../types';

import {
  applyTableResetSetup,
  applyTableStakeSetup,
  applyZilchTableStakeSetup,
  DEFAULT_TABLE_CHIPS,
  ensureZilchTableIdentity,
  isZilchTable,
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
import { invitePersonToTable } from '../api/client';
import { isOnlineModeEnabled } from '../api/config';
import { createTableInvite } from '../engine/table/invites';

import { DEFAULT_PRACTICE_TABLE_NAME } from '../types/tableFeltSkin';

const STAKE_EXAMPLES = ['Dinner', '€20', 'Loser buys drinks', 'Just pride', 'car wash', 'favour'];

type SetupCategoryTab = 'cards' | 'dice';
type NewSetupStage = 'game' | 'blackjack-mode' | 'configure';

export type TableStakePanelMode = 'new' | 'reset';

/** Copy variant when mode is reset (same resetTable path). */
export type TableResetSetupVariant = 'newGame' | 'resetTable';

interface TableStakePanelProps {
  gameState: GameState;
  mode?: TableStakePanelMode;
  /** When mode is reset: main-button flow uses newGame; Table Details uses resetTable. */
  resetSetupVariant?: TableResetSetupVariant;
  onConfirm: (state: GameState) => void;
  /** When set with mode `new`, confirm creates a fresh table instead of mutating the current one. */
  onConfirmNewTable?: (input: TableStakeSetupInput) => void | Promise<void>;
  /** Called after online reset dispatches (state arrives via socket). */
  onFinished?: () => void;
  onlineDispatch?: (type: string, payload?: Record<string, unknown>) => Promise<unknown>;
  onlineTableId?: string | null;
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

function emailLabel(email: string): string {
  return email.split('@')[0] || email;
}

export function TableStakePanel({
  gameState,
  mode = 'new',
  resetSetupVariant = 'resetTable',
  onConfirm,
  onConfirmNewTable,
  onFinished,
  onlineDispatch,
  onlineTableId = null,
}: TableStakePanelProps) {
  const profile = loadProfile();
  const flow = gameState.blackjackFlowSettings;
  const isReset = mode === 'reset';
  const isNewGameSetup = isReset && resetSetupVariant === 'newGame';
  const agreement = gameState.tableMeta.agreement;

  const [setupStage, setSetupStage] = useState<NewSetupStage>('game');
  const [tableMode, setTableMode] = useState<TableMode>('practice');
  const [invitedEmails, setInvitedEmails] = useState<string[]>([]);
  const [inviteEmailInput, setInviteEmailInput] = useState('');
  const [challengeBank, setChallengeBank] = useState<'self' | 'dealer' | string>('self');

  const [stake, setStake] = useState(() => agreement?.stakeDescription ?? '');
  const [tableName, setTableName] = useState(
    () => gameState.tableMeta.tableClothName?.trim() || DEFAULT_PRACTICE_TABLE_NAME,
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
  const [setupError, setSetupError] = useState<string | null>(null);

  const selectedProtocol = getBlackjackProtocolOrDefault(protocolId);
  const protocolRules = getProtocolDisplayRules(selectedProtocol);
  const showPlayingFor = isReset && bankerMode === 'bot';
  const onlineMode = isOnlineModeEnabled();
  const controller = profile.name.trim() || gameState.tableMeta.controllerName;
  const isStagedNew = !isReset;

  function resolveChallengeBanker(): { bankerMode: TableBankerSetupMode; bankerName: string } {
    if (challengeBank === 'self') {
      return { bankerMode: 'self', bankerName: controller };
    }
    if (challengeBank === 'dealer') {
      return { bankerMode: 'bot', bankerName: '' };
    }
    return { bankerMode: 'other', bankerName: emailLabel(challengeBank) };
  }

  function buildSetupInput(): TableStakeSetupInput {
    const seatAmount = Number.parseInt(seatChips, 10) || DEFAULT_TABLE_CHIPS;
    const bankAmount = Number.parseInt(bankChips, 10) || seatAmount;

    if (isStagedNew && setupTab === 'cards') {
      if (tableMode === 'practice') {
        return {
          stakeDescription: 'Practice',
          tableName: tableName.trim() || DEFAULT_PRACTICE_TABLE_NAME,
          seatChips: seatAmount,
          bankChips: bankAmount,
          bankerMode: 'bot',
          bankerName: '',
          controllerName: controller,
          controllerEmail: profile.email,
          protocolId,
          naturalDealing,
          dealSpeedPreset,
          cardTimerPreset,
          bankDrawAuto,
          tableMode: 'practice',
          invitedEmails: [],
        };
      }
      const bank = resolveChallengeBanker();
      return {
        stakeDescription: stake.trim() || 'Friendly wager',
        tableName: tableName.trim() || stake.trim() || 'Challenge Table',
        seatChips: seatAmount,
        bankChips: bankAmount,
        bankerMode: bank.bankerMode,
        bankerName: bank.bankerName,
        controllerName: controller,
        controllerEmail: profile.email,
        protocolId,
        naturalDealing,
        dealSpeedPreset,
        cardTimerPreset,
        bankDrawAuto,
        tableMode: 'challenge',
        invitedEmails,
      };
    }

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

  function addInvitedEmail() {
    const trimmed = inviteEmailInput.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      return;
    }
    if (!invitedEmails.includes(trimmed)) {
      setInvitedEmails((prev) => [...prev, trimmed]);
    }
    setInviteEmailInput('');
  }

  function removeInvitedEmail(email: string) {
    setInvitedEmails((prev) => prev.filter((e) => e !== email));
    if (challengeBank === email) {
      setChallengeBank('self');
    }
  }

  async function handleConfirm() {
    setSetupError(null);

    if (isStagedNew && setupTab === 'cards' && tableMode === 'challenge') {
      if (!stake.trim()) {
        setSetupError('Enter what you are playing for.');
        return;
      }
      if (invitedEmails.length === 0) {
        setSetupError('Add at least one invited email.');
        return;
      }
    }

    const input = buildSetupInput();

    log.info('setupStartingChipsInput', {
      mode: isReset ? 'reset' : 'new',
      tableMode: input.tableMode,
      seatChipsInput: seatChips,
      bankChipsInput: bankChips,
      seatAmount: input.seatChips,
      bankAmount: input.bankChips,
      invitedEmails: input.invitedEmails,
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

    if (onlineMode && onlineDispatch && !isReset && !onConfirmNewTable) {
      setSubmitting(true);
      try {
        const payload =
          setupTab === 'dice' ? buildZilchSetupInput() : input;
        await onlineDispatch('configureTable', payload as unknown as Record<string, unknown>);
        if (onlineTableId && input.tableMode === 'challenge' && input.invitedEmails?.length) {
          for (const email of input.invitedEmails) {
            await invitePersonToTable(onlineTableId, email, email.split('@')[0] || 'Guest');
          }
        }
        onFinished?.();
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!isReset && onConfirmNewTable) {
      setSubmitting(true);
      try {
        await onConfirmNewTable(input);
        onFinished?.();
      } finally {
        setSubmitting(false);
      }
      return;
    }

    let base = gameState;
    if (setupTab === 'dice' && !isZilchTable(base)) {
      base = applySettingsToDiceTable(base);
    } else if (setupTab === 'cards' && isZilchTable(base)) {
      base = switchGameType(base, 'blackjack');
    }

    let next =
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
    if (!isReset && input.invitedEmails?.length) {
      for (const email of input.invitedEmails) {
        ({ state: next } = createTableInvite(next, email.split('@')[0] || 'Guest', email));
      }
    }
    onConfirm(next);
  }

  function applySettingsToDiceTable(state: GameState): GameState {
    return ensureZilchTableIdentity({
      ...state,
      blackjack: null,
      tableMeta: {
        ...state.tableMeta,
        showStakeSetup: true,
      },
    });
  }

  function handleGameStageNext() {
    if (setupTab === 'dice') {
      setSetupStage('configure');
      return;
    }
    setSetupStage('blackjack-mode');
  }

  function selectBlackjackMode(next: TableMode) {
    setTableMode(next);
    setSetupStage('configure');
  }

  function renderStageIndicator() {
    if (!isStagedNew) {
      return null;
    }
    const steps =
      setupTab === 'dice'
        ? ['Game', 'Setup']
        : ['Game', 'Mode', 'Setup'];
    const activeIndex =
      setupStage === 'game' ? 0 : setupStage === 'blackjack-mode' ? 1 : setupTab === 'dice' ? 1 : 2;
    return (
      <ol className="table-stake-panel__steps" aria-label="Setup progress">
        {steps.map((label, index) => (
          <li
            key={label}
            className={index <= activeIndex ? 'table-stake-panel__step--active' : undefined}
          >
            {label}
          </li>
        ))}
      </ol>
    );
  }

  function renderAdvancedSettings() {
    return (
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
    );
  }

  function renderDiceConfigure() {
    return (
      <>
        <p className="table-stake-panel__hint">
          <strong>Zilch</strong> — six dice, scoring combinations, bank your turn or risk a zilch.
        </p>
        <label className="table-stake-panel__field">
          <span>Game mode</span>
          <select
            className="table-stake-panel__input"
            value={zilchMode}
            onChange={(e) => setZilchMode(e.target.value as 'target_points' | 'fixed_rounds')}
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
    );
  }

  function renderStagedGameStage() {
    return (
      <>
        <fieldset className="table-stake-panel__banker">
          <legend>Game / protocol</legend>
          <div className="table-stake-panel__tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={setupTab === 'cards'}
              className={setupTab === 'cards' ? '' : 'secondary'}
              onClick={() => setSetupTab('cards')}
            >
              Cards — Blackjack
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={setupTab === 'dice'}
              className={setupTab === 'dice' ? '' : 'secondary'}
              onClick={() => setSetupTab('dice')}
            >
              Dice — Zilch
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
            </>
          )}
        </fieldset>
        <div className="table-stake-panel__nav">
          <button type="button" className="table-stake-panel__confirm" onClick={handleGameStageNext}>
            Continue
          </button>
        </div>
      </>
    );
  }

  function renderStagedModeStage() {
    return (
      <>
        <fieldset className="table-stake-panel__banker">
          <legend>Blackjack mode</legend>
          <p className="table-stake-panel__hint">
            Practice is a quick solo game with the dealer as bank. Challenge adds a wager, invited
            players, and a player bank.
          </p>
          <div className="table-stake-panel__mode-grid">
            <button type="button" className="table-stake-panel__mode-card" onClick={() => selectBlackjackMode('practice')}>
              <strong>Practice</strong>
              <span>Dealer bank · no wager · start immediately</span>
            </button>
            <button type="button" className="table-stake-panel__mode-card" onClick={() => selectBlackjackMode('challenge')}>
              <strong>Challenge</strong>
              <span>Wager · invite friends · choose bank</span>
            </button>
          </div>
        </fieldset>
        <div className="table-stake-panel__nav">
          <button type="button" className="secondary" onClick={() => setSetupStage('game')}>
            Back
          </button>
        </div>
      </>
    );
  }

  function renderPracticeConfigure() {
    return (
      <>
        <p className="table-stake-panel__hint">
          Dealer is the bank. No wager or invites required — default chip allocation is fine.
        </p>
        <label className="table-stake-panel__field">
          <span>Table name</span>
          <input
            type="text"
            className="table-stake-panel__input"
            placeholder={DEFAULT_PRACTICE_TABLE_NAME}
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            maxLength={48}
          />
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
        {renderAdvancedSettings()}
        <div className="table-stake-panel__nav">
          <button type="button" className="secondary" onClick={() => setSetupStage('blackjack-mode')}>
            Back
          </button>
          <button
            type="button"
            className="table-stake-panel__confirm"
            onClick={() => void handleConfirm()}
            disabled={submitting}
          >
            Start Table
          </button>
        </div>
      </>
    );
  }

  function renderChallengeConfigure() {
    return (
      <>
        <label className="table-stake-panel__field">
          <span>Table name</span>
          <input
            type="text"
            className="table-stake-panel__input"
            placeholder="Friday Night Blackjack"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            maxLength={48}
          />
        </label>
        <label className="table-stake-panel__field">
          <span>Play for what</span>
          <input
            type="text"
            className="table-stake-panel__input"
            placeholder='e.g. "Dinner", "€20", "Loser buys drinks"'
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

        <fieldset className="table-stake-panel__banker">
          <legend>Play who — invite by email</legend>
          <div className="table-stake-panel__invite-row">
            <input
              type="email"
              className="table-stake-panel__input"
              placeholder="friend@example.com"
              value={inviteEmailInput}
              onChange={(e) => setInviteEmailInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addInvitedEmail())}
            />
            <button type="button" className="secondary" onClick={addInvitedEmail}>
              Add
            </button>
          </div>
          {invitedEmails.length > 0 && (
            <ul className="table-stake-panel__invite-list">
              {invitedEmails.map((email) => (
                <li key={email}>
                  {email}
                  <button type="button" className="secondary" onClick={() => removeInvitedEmail(email)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="table-stake-panel__hint">
            {onlineMode
              ? 'Invites are sent when the table starts.'
              : 'Invite links are created when the table starts.'}
          </p>
        </fieldset>

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
        </label>

        <fieldset className="table-stake-panel__banker">
          <legend>Who is the bank?</legend>
          <label className="table-stake-panel__option">
            <input
              type="radio"
              name="challenge-bank"
              checked={challengeBank === 'self'}
              onChange={() => setChallengeBank('self')}
            />
            Me ({controller || 'you'})
          </label>
          {invitedEmails.map((email) => (
            <label key={email} className="table-stake-panel__option">
              <input
                type="radio"
                name="challenge-bank"
                checked={challengeBank === email}
                onChange={() => setChallengeBank(email)}
              />
              {emailLabel(email)} ({email})
            </label>
          ))}
          <label className="table-stake-panel__option">
            <input
              type="radio"
              name="challenge-bank"
              checked={challengeBank === 'dealer'}
              onChange={() => setChallengeBank('dealer')}
            />
            Dealer / house
          </label>
        </fieldset>

        {renderAdvancedSettings()}

        <div className="table-stake-panel__nav">
          <button type="button" className="secondary" onClick={() => setSetupStage('blackjack-mode')}>
            Back
          </button>
          <button
            type="button"
            className="table-stake-panel__confirm"
            onClick={() => void handleConfirm()}
            disabled={submitting}
          >
            Start Table
          </button>
        </div>
      </>
    );
  }

  function renderStagedConfigureStage() {
    if (setupTab === 'dice') {
      return (
        <>
          {renderDiceConfigure()}
          <div className="table-stake-panel__nav">
            <button type="button" className="secondary" onClick={() => setSetupStage('game')}>
              Back
            </button>
            <button
              type="button"
              className="table-stake-panel__confirm"
              onClick={() => void handleConfirm()}
              disabled={submitting}
            >
              Start Table
            </button>
          </div>
        </>
      );
    }
    if (tableMode === 'practice') {
      return renderPracticeConfigure();
    }
    return renderChallengeConfigure();
  }

  function renderResetPanel() {
    return (
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
                <ul className="table-stake-panel__protocol-rules">
                  {protocolRules.map((rule) => (
                    <li key={rule.id}>
                      <strong>{rule.label}:</strong> {rule.value}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {setupTab === 'dice' && renderDiceConfigure()}
          </fieldset>

          {setupTab === 'cards' && renderAdvancedSettings()}
        </div>
      </div>
    );
  }

  return (
    <div
      className="table-stake-overlay"
      role="dialog"
      aria-label={
        isNewGameSetup ? 'New game setup' : isReset ? 'Reset table setup' : 'New table setup'
      }
    >
      <div className="table-stake-panel">
        <header className="table-stake-panel__header">
          <h2 className="table-stake-panel__title">
            {isNewGameSetup ? 'New Game' : isReset ? 'Reset table' : 'New Table'}
          </h2>
          <p className="table-stake-panel__sub">
            {isReset
              ? 'Start a new game with the players currently at this table.'
              : isStagedNew
                ? 'Pick a game, then choose how you want to play.'
                : 'Set up who plays, who banks, and how the table runs.'}
          </p>
          {renderStageIndicator()}
        </header>

        {setupError && (
          <p className="table-stake-panel__error" role="alert">
            {setupError}
          </p>
        )}

        {isReset ? (
          <>
            {renderResetPanel()}
            <button
              type="button"
              className="table-stake-panel__confirm"
              onClick={() => void handleConfirm()}
              disabled={submitting}
            >
              {isReset ? 'Start new game' : 'Start playing'}
            </button>
          </>
        ) : (
          <>
            {setupStage === 'game' && renderStagedGameStage()}
            {setupStage === 'blackjack-mode' && renderStagedModeStage()}
            {setupStage === 'configure' && renderStagedConfigureStage()}
          </>
        )}
      </div>
    </div>
  );
}
