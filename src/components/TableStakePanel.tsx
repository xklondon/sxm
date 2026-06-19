import { useEffect, useRef, useState } from 'react';

import type { GameState, TableMode } from '../types';
import type { BankBustSettlementMode } from '../types/table';

import {
  applyTableResetSetup,
  applyTableStakeSetup,
  applyZilchTableResetSetup,
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
import type { InvitedTablePlayerSetup } from '../features/messaging/tableMessagingTypes';
import { isOnlineModeEnabled } from '../api/config';
import { createTableInvite } from '../engine/table/invites';

import { DEFAULT_PRACTICE_TABLE_NAME } from '../types/tableFeltSkin';

import {
  collectTableStakeSetupSnapshot,
  createInitialTableStakeSetupSnapshot,
  isTableStakeSetupDirty,
  type TableStakeSetupSnapshot,
} from './tableStakeSetupDirty';
import './TableStakePanel.css';

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
  /** When true, panel title is rendered by NewTableOverlay shell. */
  embeddedInOverlay?: boolean;
  /** Staged New Table only — reports whether the user has changed setup from baseline. */
  onSetupDirtyChange?: (dirty: boolean) => void;
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
  embeddedInOverlay = false,
  onSetupDirtyChange,
}: TableStakePanelProps) {
  const profile = loadProfile();
  const flow = gameState.blackjackFlowSettings;
  const isReset = mode === 'reset';
  const isNewGameSetup = isReset && resetSetupVariant === 'newGame';
  const agreement = gameState.tableMeta.agreement;

  const [setupStage, setSetupStage] = useState<NewSetupStage>('game');
  const [tableMode, setTableMode] = useState<TableMode>('practice');
  const [invitedPlayers, setInvitedPlayers] = useState<InvitedTablePlayerSetup[]>([]);
  const [inviteEmailInput, setInviteEmailInput] = useState('');
  const invitedEmails = invitedPlayers.map((player) => player.email);
  const [challengeBank, setChallengeBank] = useState<'self' | string>('self');
  const [bankBustSettlementMode, setBankBustSettlementMode] = useState<BankBustSettlementMode>(
    () => gameState.tableMeta.bankBustSettlementMode ?? 'fractional',
  );

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
  const isStagedNew = !isReset;
  const initialSetupSnapshotRef = useRef<TableStakeSetupSnapshot | null>(null);
  if (isStagedNew && !initialSetupSnapshotRef.current) {
    initialSetupSnapshotRef.current = createInitialTableStakeSetupSnapshot(gameState);
  }

  const selectedProtocol = getBlackjackProtocolOrDefault(protocolId);
  const protocolRules = getProtocolDisplayRules(selectedProtocol);
  const showPlayingFor = isReset && bankerMode === 'bot';
  const onlineMode = isOnlineModeEnabled();
  const controller = profile.name.trim() || gameState.tableMeta.controllerName;

  function resolveChallengeBanker(): { bankerMode: TableBankerSetupMode; bankerName: string } {
    if (challengeBank === 'self') {
      return { bankerMode: 'self', bankerName: controller };
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
        invitedPlayers: invitedPlayers.map((player) => ({
          email: player.email,
          inviteMessage: player.inviteMessage?.trim() || undefined,
        })),
        bankBustSettlementMode,
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
      setInvitedPlayers((prev) => [...prev, { email: trimmed, inviteMessage: '' }]);
    }
    setInviteEmailInput('');
  }

  function removeInvitedEmail(email: string) {
    setInvitedPlayers((prev) => prev.filter((player) => player.email !== email));
    if (challengeBank === email) {
      setChallengeBank('self');
    }
  }

  function updateInviteMessage(email: string, inviteMessage: string) {
    setInvitedPlayers((prev) =>
      prev.map((player) => (player.email === email ? { ...player, inviteMessage } : player)),
    );
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

    if (onlineMode && onlineDispatch && onlineTableId && gameState.session.id === onlineTableId && isReset) {
      setSubmitting(true);
      try {
        const resetPayload =
          setupTab === 'dice'
            ? { ...buildZilchSetupInput(), inviteNote: inviteNote.trim() || undefined }
            : { ...input, inviteNote: inviteNote.trim() || undefined };
        await onlineDispatch('resetTable', resetPayload);
        onFinished?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Reset failed';
        if (/not a member/i.test(message)) {
          setSetupError(
            'You are not seated at this online table. Reload it from the lobby, or reset locally after leaving online mode.',
          );
        } else {
          setSetupError(message);
        }
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
        if (onlineTableId && input.tableMode === 'challenge' && input.invitedPlayers?.length) {
          for (const player of input.invitedPlayers) {
            await invitePersonToTable(
              onlineTableId,
              player.email,
              player.email.split('@')[0] || 'Guest',
              undefined,
              player.inviteMessage,
            );
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
          ? applyZilchTableResetSetup(base, buildZilchSetupInput(), base.tableMeta.ownerPersonId)
          : applyZilchTableStakeSetup(base, buildZilchSetupInput())
        : isReset
          ? applyTableResetSetup(base, input, base.tableMeta.ownerPersonId)
          : applyTableStakeSetup(base, input);
    if (!isReset && input.invitedPlayers?.length) {
      for (const player of input.invitedPlayers) {
        ({ state: next } = createTableInvite(
          next,
          player.email.split('@')[0] || 'Guest',
          player.email,
          player.inviteMessage ?? '',
        ));
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

  useEffect(() => {
    if (!isStagedNew || !onSetupDirtyChange || !initialSetupSnapshotRef.current) {
      return;
    }
    const current = collectTableStakeSetupSnapshot({
      gameState,
      setupStage,
      setupTab,
      tableMode,
      stake,
      tableName,
      invitedEmails,
      invitedPlayers,
      inviteEmailInput,
      challengeBank,
      seatChips,
      bankChips,
      bankChipsCustom,
      bankerMode,
      bankerName,
      protocolId,
      zilchMode,
      targetPoints,
      roundLimit,
      diceAnimMode,
      diceAnimMs,
      diceAnimMin,
      diceAnimMax,
      advancedOpen,
      naturalDealing,
      dealSpeedPreset,
      cardTimerPreset,
      bankDrawAuto,
      inviteNote,
    });
    onSetupDirtyChange(isTableStakeSetupDirty(initialSetupSnapshotRef.current, current));
  }, [
    isStagedNew,
    onSetupDirtyChange,
    gameState,
    setupStage,
    setupTab,
    tableMode,
    stake,
    tableName,
    invitedEmails,
    invitedPlayers,
    inviteEmailInput,
    challengeBank,
    seatChips,
    bankChips,
    bankChipsCustom,
    bankerMode,
    bankerName,
    protocolId,
    zilchMode,
    targetPoints,
    roundLimit,
    diceAnimMode,
    diceAnimMs,
    diceAnimMin,
    diceAnimMax,
    advancedOpen,
    naturalDealing,
    dealSpeedPreset,
    cardTimerPreset,
    bankDrawAuto,
    inviteNote,
  ]);

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
          <strong>Zilch</strong> — roll six dice, keep scoring combinations, and bank before you zilch.
        </p>
        <label className="table-stake-panel__field">
          <span>Game mode</span>
          <select
            className="table-stake-panel__input"
            value={zilchMode}
            onChange={(e) => setZilchMode(e.target.value as 'target_points' | 'fixed_rounds')}
          >
            <option value="target_points">Play to point goal</option>
            <option value="fixed_rounds">Play fixed amount of rounds</option>
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
            <span>Round limit</span>
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
          <legend>Game</legend>
          <div className="table-stake-panel__tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={setupTab === 'cards'}
              className={`table-stake-panel__select-btn${setupTab === 'cards' ? '' : ' secondary'}`}
              onClick={() => setSetupTab('cards')}
            >
              Cards
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={setupTab === 'dice'}
              className={`table-stake-panel__select-btn${setupTab === 'dice' ? '' : ' secondary'}`}
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
            </>
          )}
        </fieldset>
        <div className="table-stake-panel__nav">
          <button
            type="button"
            className="table-stake-panel__confirm table-stake-panel__select-btn"
            onClick={handleGameStageNext}
          >
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
          <legend>Mode</legend>
          <p className="table-stake-panel__hint table-stake-panel__hint--mode">
            Practice is a quick solo game with the dealer as bank. Challenge adds a wager, invited
            players, and a player bank.
          </p>
          <div className="table-stake-panel__tabs" role="group" aria-label="Table mode">
            <button
              type="button"
              className={`table-stake-panel__select-btn${tableMode === 'practice' ? '' : ' secondary'}`}
              onClick={() => selectBlackjackMode('practice')}
            >
              Practice
            </button>
            <button
              type="button"
              className={`table-stake-panel__select-btn${tableMode === 'challenge' ? '' : ' secondary'}`}
              onClick={() => selectBlackjackMode('challenge')}
            >
              Challenge
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
            className="table-stake-panel__confirm table-stake-panel__select-btn"
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
          {invitedPlayers.length > 0 && (
            <ul className="table-stake-panel__invite-list">
              {invitedPlayers.map((player) => (
                <li key={player.email}>
                  <div className="table-stake-panel__invite-item">
                    <span>{player.email}</span>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => removeInvitedEmail(player.email)}
                    >
                      Remove
                    </button>
                  </div>
                  <label className="table-stake-panel__field table-stake-panel__invite-message">
                    <span>Message for invite</span>
                    <input
                      type="text"
                      className="table-stake-panel__input"
                      placeholder="Add a short note to this player's invite…"
                      value={player.inviteMessage ?? ''}
                      onChange={(e) => updateInviteMessage(player.email, e.target.value)}
                      maxLength={500}
                    />
                  </label>
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
        </fieldset>

        <fieldset className="table-stake-panel__banker">
          <legend>Bank bust settlement</legend>
          <label className="table-stake-panel__option">
            <input
              type="radio"
              name="bank-bust-settlement"
              checked={bankBustSettlementMode === 'fractional'}
              onChange={() => setBankBustSettlementMode('fractional')}
            />
            Fractional / Ranked
          </label>
          <label className="table-stake-panel__option">
            <input
              type="radio"
              name="bank-bust-settlement"
              checked={bankBustSettlementMode === 'winner-takes-all'}
              onChange={() => setBankBustSettlementMode('winner-takes-all')}
            />
            Winner Takes All
          </label>
        </fieldset>

        {renderAdvancedSettings()}

        <div className="table-stake-panel__nav">
          <button type="button" className="secondary" onClick={() => setSetupStage('blackjack-mode')}>
            Back
          </button>
          <button
            type="button"
            className="table-stake-panel__confirm table-stake-panel__select-btn"
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
              className="table-stake-panel__confirm table-stake-panel__select-btn"
              onClick={() => void handleConfirm()}
              disabled={submitting}
            >
              Start Zilch
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
      className={`table-stake-panel${isStagedNew ? ' table-stake-panel--compact' : ''}${
        embeddedInOverlay ? ' table-stake-panel--embedded' : ''
      }`}
    >
      {!embeddedInOverlay && (
        <header className="table-stake-panel__header">
          <h2 className="table-stake-panel__title">
            {isNewGameSetup ? 'New Game' : isReset ? 'Reset table' : 'New Table'}
          </h2>
          <p className="table-stake-panel__sub">
            {isReset
              ? 'Start a new game with the players currently at this table.'
              : isStagedNew
                ? null
                : 'Set up who plays, who banks, and how the table runs.'}
          </p>
        </header>
      )}

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
            {isReset ? 'Start new Zilch game' : 'Start Zilch'}
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
  );
}
