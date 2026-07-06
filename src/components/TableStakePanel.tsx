import { useEffect, useRef, useState } from 'react';

import type { GameState, TableMode } from '../types';
import type { BankBustSettlementMode } from '../types/table';

import {
  applyTableResetSetup,
  applyTableStakeSetup,
  applyHoldemTableResetSetup,
  applyHoldemTableStakeSetup,
  applyZilchTableResetSetup,
  applyZilchTableStakeSetup,
  DEFAULT_TABLE_CHIPS,
  type TableBankerSetupMode,
  type TableStakeSetupInput,
  type HoldemTableStakeSetupInput,
  type ZilchTableStakeSetupInput,
} from '../engine/session';
import {
  listBlackjackProtocolPresets,
  getBlackjackProtocolOrDefault,
} from '../engine/blackjack/protocols';
import { isNaturalInitialDeal } from '../engine/blackjack/dealing/dealingModes';
import type { DealSpeedPreset } from '../engine/blackjack/flowSettings';

import { loadProfile } from '../storage/profileStorage';
import { log } from '../utils/logger';
import { invitePersonToTable } from '../api/client';
import type { InvitedTablePlayerSetup } from '../features/messaging/tableMessagingTypes';
import { isOnlineModeEnabled } from '../api/config';
import { createTableInvite } from '../engine/table/invites';
import { validatePokerBlinds } from '../types/poker';

import { DEFAULT_PRACTICE_TABLE_NAME } from '../types/tableFeltSkin';

import {
  collectTableStakeSetupSnapshot,
  createInitialTableStakeSetupSnapshot,
  isTableStakeSetupDirty,
  type TableStakeSetupSnapshot,
} from './tableStakeSetupDirty';
import {
  createFreshSetupDraft,
  goBackFromCardGame,
  goBackFromMode,
  goBackFromSettings,
  isHoldemSetupDraft,
  isZilchSetupDraft,
  prepareTableStateForSetupConfirm,
  selectCardGame,
  selectCategoryCards,
  selectCategoryDice,
  selectMode,
  type SetupDraft,
  type SetupEntryPoint,
} from './tableSetupFlow';
import './TableStakePanel.css';

const STAKE_EXAMPLES = ['Dinner', '€20', 'Loser buys drinks', 'Just pride', 'car wash', 'favour'];

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
  onConfirmNewTable?: (input: TableStakeSetupInput | ZilchTableStakeSetupInput | HoldemTableStakeSetupInput) => void | Promise<void>;
  /** Called after online reset dispatches (state arrives via socket). */
  onFinished?: () => void;
  onlineDispatch?: (type: string, payload?: Record<string, unknown>) => Promise<unknown>;
  onlineTableId?: string | null;
  /** When true, panel title is rendered by NewTableOverlay shell. */
  embeddedInOverlay?: boolean;
  /** Canonical setup entry — drives fresh draft on open. */
  entryPoint?: SetupEntryPoint;
  /** Change when overlay opens to re-initialise setup draft. */
  setupFlowKey?: number | string;
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
  entryPoint: entryPointProp,
  setupFlowKey = 0,
  onSetupDirtyChange,
}: TableStakePanelProps) {
  const profile = loadProfile();
  const flow = gameState.blackjackFlowSettings;
  const isReset = mode === 'reset';
  const isNewGameSetup = isReset && resetSetupVariant === 'newGame';
  const entryPoint: SetupEntryPoint =
    entryPointProp ?? (isReset ? 'reset-table' : embeddedInOverlay ? 'root' : 'menu-new-table');
  const agreement = gameState.tableMeta.agreement;

  const [draft, setDraft] = useState<SetupDraft>(() => createFreshSetupDraft(entryPoint));
  const tableMode = draft.mode ?? 'practice';
  const setupCategory = draft.category;
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
  const [inviteNote] = useState('');
  const [seatChips, setSeatChips] = useState(
    String(gameState.tableMeta.startingChipsEachSeat ?? DEFAULT_TABLE_CHIPS),
  );
  const [bankChips, setBankChips] = useState(
    String(gameState.tableMeta.startingChipsBank ?? gameState.tableMeta.startingChipsEachSeat ?? DEFAULT_TABLE_CHIPS),
  );
  const [bankChipsCustom, setBankChipsCustom] = useState(false);
  const bankerMode: TableBankerSetupMode = initialBankerMode(gameState);
  const bankerName = gameState.tableMeta.bankerSetup.displayName ?? '';
  const [virtualPlayerCount, setVirtualPlayerCount] = useState(1);
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
  const [bankDrawAuto, setBankDrawAuto] = useState(flow.bankDrawMode === 'auto');
  const [submitting, setSubmitting] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [smallBlind, setSmallBlind] = useState(String(gameState.holdemSettings.smallBlind ?? 5));
  const [bigBlind, setBigBlind] = useState(String(gameState.holdemSettings.bigBlind ?? 10));
  const isZilchStakeFlow = isZilchSetupDraft(draft);
  const isHoldemStakeFlow = isHoldemSetupDraft(draft);
  const initialSetupSnapshotRef = useRef<TableStakeSetupSnapshot | null>(null);
  if (!initialSetupSnapshotRef.current) {
    initialSetupSnapshotRef.current = createInitialTableStakeSetupSnapshot(gameState);
  }

  useEffect(() => {
    setDraft(createFreshSetupDraft(entryPoint));
    setSetupError(null);
    initialSetupSnapshotRef.current = createInitialTableStakeSetupSnapshot(gameState);
  }, [setupFlowKey, entryPoint, gameState.session.id]);

  const selectedProtocol = getBlackjackProtocolOrDefault(protocolId);
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

    if (setupCategory === 'cards') {
      if (draft.cardGame === 'holdem') {
        if (tableMode === 'practice') {
          return {
            stakeDescription: 'Practice',
            tableName: tableName.trim() || DEFAULT_PRACTICE_TABLE_NAME,
            seatChips: seatAmount,
            bankChips: seatAmount,
            bankerMode: 'self',
            bankerName: controller,
            controllerName: controller,
            controllerEmail: profile.email,
            protocolId: 'texas-holdem',
            naturalDealing: false,
            dealSpeedPreset: 'normal',
            cardTimerPreset: 0,
            bankDrawAuto: true,
            tableMode: 'practice',
            invitedEmails: [],
          };
        }
        return {
          stakeDescription: stake.trim() || 'Friendly wager',
          tableName: tableName.trim() || stake.trim() || 'Poker Challenge',
          seatChips: seatAmount,
          bankChips: seatAmount,
          bankerMode: 'self',
          bankerName: controller,
          controllerName: controller,
          controllerEmail: profile.email,
          protocolId: 'texas-holdem',
          naturalDealing: false,
          dealSpeedPreset: 'normal',
          cardTimerPreset: 0,
          bankDrawAuto: true,
          tableMode: 'challenge',
          invitedEmails,
          invitedPlayers: invitedPlayers.map((player) => ({
            email: player.email,
            inviteMessage: player.inviteMessage?.trim() || undefined,
          })),
        };
      }
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
          cardTimerPreset: 0,
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
        cardTimerPreset: 0,
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

    if (setupCategory === 'dice') {
      if (tableMode === 'practice') {
        return {
          stakeDescription: stake.trim() || 'Practice',
          tableName: tableName.trim() || DEFAULT_PRACTICE_TABLE_NAME,
          seatChips: seatAmount,
          bankChips: bankAmount,
          bankerMode: 'bot',
          bankerName: '',
          controllerName: controller,
          controllerEmail: profile.email,
          protocolId: 'zilch',
          naturalDealing: false,
          dealSpeedPreset: 'normal',
          cardTimerPreset: 0,
          bankDrawAuto: true,
          tableMode: 'practice',
          invitedEmails: [],
        };
      }
      return {
        stakeDescription: stake.trim() || 'Friendly wager',
        tableName: tableName.trim() || stake.trim() || 'Zilch Challenge',
        seatChips: seatAmount,
        bankChips: bankAmount,
        bankerMode: 'self',
        bankerName: controller,
        controllerName: controller,
        controllerEmail: profile.email,
        protocolId: 'zilch',
        naturalDealing: false,
        dealSpeedPreset: 'normal',
        cardTimerPreset: 0,
        bankDrawAuto: true,
        tableMode: 'challenge',
        invitedEmails,
        invitedPlayers: invitedPlayers.map((player) => ({
          email: player.email,
          inviteMessage: player.inviteMessage?.trim() || undefined,
        })),
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
      cardTimerPreset: 0,
      bankDrawAuto,
    };
  }

  function parseOptionalChallengeAmountFromStake(stakeText: string): number | undefined {
    const parsed = Number.parseFloat(stakeText.replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }

  function buildHoldemSetupInput(): HoldemTableStakeSetupInput {
    const base = buildSetupInput();
    const sb = Number.parseInt(smallBlind, 10) || 5;
    const bb = Number.parseInt(bigBlind, 10) || 10;
    const challengeValue =
      tableMode === 'challenge' ? parseOptionalChallengeAmountFromStake(stake) : undefined;
    return {
      ...base,
      smallBlind: sb,
      bigBlind: bb,
      totalChallengeValue: challengeValue,
      currency: '$',
      virtualPlayerCount: tableMode === 'practice' ? virtualPlayerCount : undefined,
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
      virtualPlayerCount: tableMode === 'practice' ? virtualPlayerCount : undefined,
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

    if (setupCategory === 'cards' && draft.cardGame === 'holdem' && tableMode === 'challenge') {
      if (!stake.trim()) {
        setSetupError('Enter what you are playing for.');
        return;
      }
      const sb = Number.parseInt(smallBlind, 10);
      const bb = Number.parseInt(bigBlind, 10);
      if (!Number.isFinite(sb) || sb <= 0 || !Number.isFinite(bb) || bb <= 0) {
        setSetupError('Enter valid small and big blind amounts.');
        return;
      }
      const blindRuleError = validatePokerBlinds(sb, bb);
      if (blindRuleError) {
        setSetupError(blindRuleError);
        return;
      }
      if (invitedEmails.length === 0) {
        setSetupError('Add at least one invited email.');
        return;
      }
    }

    if (setupCategory === 'cards' && draft.cardGame === 'holdem' && tableMode === 'practice') {
      if (virtualPlayerCount < 1) {
        setSetupError('Add at least one virtual player.');
        return;
      }
      const sb = Number.parseInt(smallBlind, 10);
      const bb = Number.parseInt(bigBlind, 10);
      if (!Number.isFinite(sb) || sb <= 0 || !Number.isFinite(bb) || bb <= 0) {
        setSetupError('Enter valid small and big blind amounts.');
        return;
      }
      const blindRuleError = validatePokerBlinds(sb, bb);
      if (blindRuleError) {
        setSetupError(blindRuleError);
        return;
      }
    }

    if (setupCategory === 'cards' && draft.cardGame === 'blackjack' && tableMode === 'challenge') {
      if (!stake.trim()) {
        setSetupError('Enter what you are playing for.');
        return;
      }
      if (invitedEmails.length === 0) {
        setSetupError('Add at least one invited email.');
        return;
      }
    }

    if (setupCategory === 'dice' && tableMode === 'challenge') {
      if (!stake.trim()) {
        setSetupError('Enter what you are playing for.');
        return;
      }
      if (invitedEmails.length === 0) {
        setSetupError('Add at least one invited email.');
        return;
      }
    }

    if (setupCategory === 'dice' && tableMode === 'practice') {
      if (virtualPlayerCount < 1) {
        setSetupError('Add at least one virtual player.');
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
        const resetPayload = isZilchStakeFlow
          ? {
              ...buildZilchSetupInput(),
              gameCategory: 'dice',
              gameType: 'zilch',
              diceGame: 'zilch',
              inviteNote: inviteNote.trim() || undefined,
            }
          : isHoldemStakeFlow
            ? {
                ...buildHoldemSetupInput(),
                gameCategory: 'cards',
                gameType: 'texas-holdem',
                cardGame: 'holdem',
                inviteNote: inviteNote.trim() || undefined,
              }
            : {
                ...input,
                gameCategory: 'cards',
                gameType: 'blackjack',
                cardGame: 'blackjack',
                inviteNote: inviteNote.trim() || undefined,
              };
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
        const payload = isZilchStakeFlow
          ? {
              ...buildZilchSetupInput(),
              gameCategory: 'dice',
              gameType: 'zilch',
              diceGame: 'zilch',
            }
          : isHoldemStakeFlow
            ? {
                ...buildHoldemSetupInput(),
                gameCategory: 'cards',
                gameType: 'texas-holdem',
                cardGame: 'holdem',
              }
            : {
                ...input,
                gameCategory: 'cards',
                gameType: 'blackjack',
                cardGame: 'blackjack',
              };
        await onlineDispatch('configureTable', payload as unknown as Record<string, unknown>);
        if (
          onlineTableId &&
          input.tableMode === 'challenge' &&
          (input.invitedPlayers?.length ?? 0) > 0
        ) {
          for (const player of input.invitedPlayers ?? []) {
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
        await onConfirmNewTable(
          isZilchStakeFlow
            ? buildZilchSetupInput()
            : isHoldemStakeFlow
              ? buildHoldemSetupInput()
              : input,
        );
        onFinished?.();
      } finally {
        setSubmitting(false);
      }
      return;
    }

    let base = prepareTableStateForSetupConfirm(gameState, draft);

    let next =
      isZilchStakeFlow
        ? isReset
          ? applyZilchTableResetSetup(base, buildZilchSetupInput(), base.tableMeta.ownerPersonId)
          : applyZilchTableStakeSetup(base, buildZilchSetupInput())
        : isHoldemStakeFlow
          ? isReset
            ? applyHoldemTableResetSetup(base, buildHoldemSetupInput(), base.tableMeta.ownerPersonId ?? '')
            : applyHoldemTableStakeSetup(base, buildHoldemSetupInput())
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

  function mapDraftStepToSnapshotStage(step: SetupDraft['step']): 'category' | 'mode' | 'settings' {
    if (step === 'cardGame') {
      return 'category';
    }
    return step;
  }

  useEffect(() => {
    if (!onSetupDirtyChange || !initialSetupSnapshotRef.current) {
      return;
    }
    const current = collectTableStakeSetupSnapshot({
      gameState,
      setupStage: mapDraftStepToSnapshotStage(draft.step),
      setupTab: setupCategory ?? 'cards',
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
      cardTimerPreset: 0,
      bankDrawAuto,
      inviteNote,
    });
    onSetupDirtyChange(isTableStakeSetupDirty(initialSetupSnapshotRef.current, current));
  }, [
    onSetupDirtyChange,
    gameState,
    draft.step,
    setupCategory,
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
    cardTimerPreset: 0,
    bankDrawAuto,
    inviteNote,
  ]);

  function handleSelectCategoryCards() {
    setDraft((prev) => selectCategoryCards(prev));
  }

  function handleSelectCategoryDice() {
    setDraft((prev) => selectCategoryDice(prev));
  }

  function handleSelectMode(next: TableMode) {
    setDraft((prev) => selectMode(prev, next));
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
              <span>Card deal speed</span>
              <select
                className="table-stake-panel__input"
                value={dealSpeedPreset}
                onChange={(e) => setDealSpeedPreset(e.target.value as DealSpeedPreset)}
              >
                <option value="fast">1 sec</option>
                <option value="medium">2 sec</option>
                <option value="normal">3 sec</option>
                <option value="slow">5 sec</option>
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

  function renderBlackjackProtocolFields() {
    return (
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

  function renderCardGameStage() {
    return (
      <>
        <fieldset className="table-stake-panel__banker">
          <legend>Game / protocol</legend>
          <p className="table-stake-panel__hint">Choose a card game under the Cards category.</p>
          <div className="table-stake-panel__tabs" role="group" aria-label="Card game">
            <button
              type="button"
              className="table-stake-panel__select-btn"
              onClick={() => setDraft((prev) => selectCardGame(prev, 'blackjack'))}
            >
              Blackjack
            </button>
            <button
              type="button"
              className="table-stake-panel__select-btn"
              onClick={() => setDraft((prev) => selectCardGame(prev, 'holdem'))}
            >
              Poker — Texas Hold&apos;em
            </button>
          </div>
        </fieldset>
        <div className="table-stake-panel__nav">
          <button
            type="button"
            className="secondary"
            onClick={() => setDraft((prev) => goBackFromCardGame(prev))}
          >
            Back
          </button>
        </div>
      </>
    );
  }

  function renderHoldemPracticeConfigure() {
    return (
      <>
        <div className="table-stake-panel__body table-stake-panel__body--scroll">
          <p className="table-stake-panel__hint">
            Practice poker with virtual players. No wager or IOU settlement — default stacks and blinds are fine.
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
          <span>Virtual players</span>
          <input
            type="number"
            min={1}
            max={8}
            className="table-stake-panel__input table-stake-panel__input--short"
            value={virtualPlayerCount}
            onChange={(e) => setVirtualPlayerCount(Number.parseInt(e.target.value, 10) || 1)}
          />
        </label>
        <label className="table-stake-panel__field">
          <span>Starting stack per player</span>
          <input
            type="number"
            min={1}
            className="table-stake-panel__input table-stake-panel__input--short"
            value={seatChips}
            onChange={(e) => handleSeatChipsChange(e.target.value)}
          />
        </label>
        <label className="table-stake-panel__field">
          <span>Small blind</span>
          <input
            type="number"
            min={1}
            className="table-stake-panel__input table-stake-panel__input--short"
            value={smallBlind}
            onChange={(e) => setSmallBlind(e.target.value)}
          />
        </label>
        <label className="table-stake-panel__field">
          <span>Big blind</span>
          <input
            type="number"
            min={1}
            className="table-stake-panel__input table-stake-panel__input--short"
            value={bigBlind}
            onChange={(e) => setBigBlind(e.target.value)}
          />
        </label>
        </div>
        <div className="table-stake-panel__nav">
          <button type="button" className="secondary" onClick={() => setDraft((prev) => goBackFromSettings(prev))}>
            Back
          </button>
          <button
            type="button"
            className="table-stake-panel__confirm table-stake-panel__select-btn"
            onClick={() => void handleConfirm()}
            disabled={submitting}
          >
            {confirmButtonLabel()}
          </button>
        </div>
      </>
    );
  }

  function renderHoldemChallengeConfigure() {
    return (
      <>
        <div className="table-stake-panel__body table-stake-panel__body--scroll table-stake-panel__body--holdem-challenge">
        <label className="table-stake-panel__field">
          <span>Table name</span>
          <input
            type="text"
            className="table-stake-panel__input"
            placeholder="Friday Night Poker"
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
            placeholder='e.g. "Dinner", "$100", "Loser buys drinks"'
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            list="stake-examples-holdem"
          />
          <datalist id="stake-examples-holdem">
            {STAKE_EXAMPLES.map((ex) => (
              <option key={ex} value={ex} />
            ))}
          </datalist>
        </label>
        <fieldset className="table-stake-panel__banker">
          <legend>Invite players by email</legend>
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
                    <button type="button" className="secondary" onClick={() => removeInvitedEmail(player.email)}>
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
          <span>Starting stack per player</span>
          <input
            type="number"
            min={1}
            className="table-stake-panel__input table-stake-panel__input--short"
            value={seatChips}
            onChange={(e) => handleSeatChipsChange(e.target.value)}
          />
        </label>
        <label className="table-stake-panel__field">
          <span>Small blind</span>
          <input
            type="number"
            min={1}
            className="table-stake-panel__input table-stake-panel__input--short"
            value={smallBlind}
            onChange={(e) => setSmallBlind(e.target.value)}
          />
        </label>
        <label className="table-stake-panel__field">
          <span>Big blind</span>
          <input
            type="number"
            min={1}
            className="table-stake-panel__input table-stake-panel__input--short"
            value={bigBlind}
            onChange={(e) => setBigBlind(e.target.value)}
          />
        </label>
        <p className="table-stake-panel__hint">
          Winner takes all — use Play for what to describe the stake (dinner, drinks, cash, etc.). Cash IOUs require a numeric amount in the wager text.
        </p>
        </div>
        <div className="table-stake-panel__nav">
          <button type="button" className="secondary" onClick={() => setDraft((prev) => goBackFromSettings(prev))}>
            Back
          </button>
          <button
            type="button"
            className="table-stake-panel__confirm table-stake-panel__select-btn"
            onClick={() => void handleConfirm()}
            disabled={submitting}
          >
            {confirmButtonLabel()}
          </button>
        </div>
      </>
    );
  }

  function renderCategoryStage() {
    return (
      <>
        <fieldset className="table-stake-panel__banker">
          <legend>Game category</legend>
          <p className="table-stake-panel__hint">
            Choose cards or dice — practice and challenge options come next.
          </p>
          <div className="table-stake-panel__tabs" role="group" aria-label="Game category">
            <button
              type="button"
              className="table-stake-panel__select-btn"
              onClick={handleSelectCategoryCards}
            >
              Cards
            </button>
            <button
              type="button"
              className="table-stake-panel__select-btn"
              onClick={handleSelectCategoryDice}
            >
              Dice
            </button>
          </div>
        </fieldset>
      </>
    );
  }

  function renderStagedModeStage() {
    const isDice = setupCategory === 'dice';
    const gameLabel = isDice ? 'Zilch' : isHoldemStakeFlow ? "Texas Hold'em" : 'Blackjack';
    return (
      <>
        {isReset && (
          <p className="table-stake-panel__hint">
            Players, seats, and invites stay the same. Choose mode for the new {gameLabel} game.
          </p>
        )}
        <fieldset className="table-stake-panel__banker">
          <legend>Mode</legend>
          <p className="table-stake-panel__hint table-stake-panel__hint--mode">
            {isDice
              ? 'Practice uses virtual players you control. Challenge is for real players with a wager and email invites.'
              : isHoldemStakeFlow
                ? 'Practice uses virtual players with no IOU settlement. Challenge adds a wager, invites, and winner-takes-all IOUs.'
                : 'Practice is a quick solo game with the dealer as bank. Challenge adds a wager, invited players, and a player bank.'}
          </p>
          <div className="table-stake-panel__tabs" role="group" aria-label="Table mode">
            <button
              type="button"
              className="table-stake-panel__select-btn"
              onClick={() => handleSelectMode('practice')}
            >
              Practice
            </button>
            <button
              type="button"
              className="table-stake-panel__select-btn"
              onClick={() => handleSelectMode('challenge')}
            >
              Challenge
            </button>
          </div>
        </fieldset>
        <div className="table-stake-panel__nav">
          <button
            type="button"
            className="secondary"
            onClick={() => setDraft((prev) => goBackFromMode(prev))}
          >
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
        {renderBlackjackProtocolFields()}
        {renderAdvancedSettings()}
        <div className="table-stake-panel__nav">
          <button type="button" className="secondary" onClick={() => setDraft((prev) => goBackFromSettings(prev))}>
            Back
          </button>
          <button
            type="button"
            className="table-stake-panel__confirm table-stake-panel__select-btn"
            onClick={() => void handleConfirm()}
            disabled={submitting}
          >
            {confirmButtonLabel()}
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

        {renderBlackjackProtocolFields()}
        {renderAdvancedSettings()}

        <div className="table-stake-panel__nav">
          <button type="button" className="secondary" onClick={() => setDraft((prev) => goBackFromSettings(prev))}>
            Back
          </button>
          <button
            type="button"
            className="table-stake-panel__confirm table-stake-panel__select-btn"
            onClick={() => void handleConfirm()}
            disabled={submitting}
          >
            {confirmButtonLabel()}
          </button>
        </div>
      </>
    );
  }

  function renderZilchPracticeConfigure() {
    return (
      <>
        <p className="table-stake-panel__hint">
          Virtual players only — you control every seat. No email invites.
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
          <span>Virtual players</span>
          <input
            type="number"
            min={1}
            max={6}
            className="table-stake-panel__input table-stake-panel__input--short"
            value={virtualPlayerCount}
            onChange={(e) => setVirtualPlayerCount(Number.parseInt(e.target.value, 10) || 1)}
          />
        </label>
        <label className="table-stake-panel__field">
          <span>Play for what (optional)</span>
          <input
            type="text"
            className="table-stake-panel__input"
            placeholder='e.g. "Just pride", "Loser buys drinks"'
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            list="stake-examples-zilch-practice"
          />
          <datalist id="stake-examples-zilch-practice">
            {STAKE_EXAMPLES.map((ex) => (
              <option key={ex} value={ex} />
            ))}
          </datalist>
        </label>
        {renderDiceConfigure()}
        <div className="table-stake-panel__nav">
          <button type="button" className="secondary" onClick={() => setDraft((prev) => goBackFromSettings(prev))}>
            Back
          </button>
          <button
            type="button"
            className="table-stake-panel__confirm table-stake-panel__select-btn"
            onClick={() => void handleConfirm()}
            disabled={submitting}
          >
            {confirmButtonLabel()}
          </button>
        </div>
      </>
    );
  }

  function renderZilchChallengeConfigure() {
    return (
      <>
        <label className="table-stake-panel__field">
          <span>Table name</span>
          <input
            type="text"
            className="table-stake-panel__input"
            placeholder="Friday Night Zilch"
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
            list="stake-examples-zilch-challenge"
          />
          <datalist id="stake-examples-zilch-challenge">
            {STAKE_EXAMPLES.map((ex) => (
              <option key={ex} value={ex} />
            ))}
          </datalist>
        </label>

        <fieldset className="table-stake-panel__banker">
          <legend>Invite players by email</legend>
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

        {renderDiceConfigure()}
        <div className="table-stake-panel__nav">
          <button type="button" className="secondary" onClick={() => setDraft((prev) => goBackFromSettings(prev))}>
            Back
          </button>
          <button
            type="button"
            className="table-stake-panel__confirm table-stake-panel__select-btn"
            onClick={() => void handleConfirm()}
            disabled={submitting}
          >
            {confirmButtonLabel()}
          </button>
        </div>
      </>
    );
  }

  function renderStagedSettingsStage() {
    if (setupCategory === 'dice') {
      if (tableMode === 'practice') {
        return renderZilchPracticeConfigure();
      }
      return renderZilchChallengeConfigure();
    }
    if (isHoldemStakeFlow) {
      if (tableMode === 'practice') {
        return renderHoldemPracticeConfigure();
      }
      return renderHoldemChallengeConfigure();
    }
    if (tableMode === 'practice') {
      return renderPracticeConfigure();
    }
    return renderChallengeConfigure();
  }

  function renderResetPlayersNote() {
    if (!isReset) {
      return null;
    }
    return (
      <p className="table-stake-panel__hint">
        Players, seats, and invites stay the same for this table.
      </p>
    );
  }

  function confirmButtonLabel(): string {
    if (isReset) {
      if (isNewGameSetup) {
        return isZilchStakeFlow ? 'Start new Zilch game' : isHoldemStakeFlow ? 'Start new Poker game' : 'Start new game';
      }
      return isZilchStakeFlow ? 'Start Zilch' : isHoldemStakeFlow ? 'Start Poker' : 'Start new game';
    }
    return isZilchStakeFlow ? 'Start Zilch' : isHoldemStakeFlow ? 'Start Poker' : 'Start Table';
  }

  return (
    <div
      className={`table-stake-panel table-stake-panel--compact${
        embeddedInOverlay ? ' table-stake-panel--embedded' : ''
      }${
        isHoldemStakeFlow && draft.step === 'settings'
          ? tableMode === 'challenge'
            ? ' table-stake-panel--holdem-settings table-stake-panel--holdem-challenge'
            : ' table-stake-panel--holdem-settings'
          : ''
      }`}
    >
      {!embeddedInOverlay && (
        <header className="table-stake-panel__header">
          <h2 className="table-stake-panel__title">
            {isReset
              ? isNewGameSetup
                ? 'New game'
                : 'Reset table'
              : 'Start new table'}
          </h2>
          {isReset && draft.step === 'category' && (
            <p className="table-stake-panel__sub">
              Choose a game category. Players and invites stay on this table.
            </p>
          )}
        </header>
      )}

      {setupError && (
        <p className="table-stake-panel__error" role="alert">
          {setupError}
        </p>
      )}

      {draft.step === 'category' && renderCategoryStage()}
      {draft.step === 'cardGame' && renderCardGameStage()}
      {draft.step === 'mode' && renderStagedModeStage()}
      {draft.step === 'settings' && (
        <>
          {renderResetPlayersNote()}
          {renderStagedSettingsStage()}
        </>
      )}
    </div>
  );
}
