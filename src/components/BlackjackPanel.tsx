import { useRef, useState, useEffect, type CSSProperties } from 'react';
import type { GameState, TableViewMode } from '../types';
import {
  claimBoxSlot,
  defaultBlackjackSeatId,
  isBankerReady,
  movePlayerInOrder,
  releaseBoxSlot,
  resolveControllerPersonId,
  canControllerCallBox,
  getCallerPersonIdForBox,
  getCallerInitials,
} from '../engine/session';
import {
  blackjackHandKey,
  canDoubleBlackjackForState,
  canHitBlackjack,
  canSplitBlackjackForState,
  canStandBlackjack,
  cardsFromIds,
  doubleDownBlackjackOnState,
  getAidAdvice,
  getBlackjackHandValue,
  getShoeDeckCount,
  hitBlackjackOnState,
  isInsufficientChipsMessage,
  orderedHandKeys,
  parseBlackjackHandKey,
  splitBlackjackOnState,
  standBlackjackOnState,
  addChipToBoxStake,
  clearBoxStake,
  removeLastChipFromBoxStake,
  confirmBoxStake,
  getStakeForBox,
  getStakeChipsForBox,
  getTableMinimumBet,
  canChangeMinimumBet,
  setPersonPlayFlow,
} from '../engine/blackjack';
import { getCardById, getRemainingCardCount } from '../engine/deck';
import { readChipDragValue } from './chipDrag';
import { ChipTray, StakeChips, type ChipValue } from './ChipStack';
import { PlayingCard } from './PlayingCard';
import { useBlackjackTableFlow } from './useBlackjackTableFlow';
import { BlackjackFlowSettingsMenu } from './BlackjackFlowSettings';
import { BlackjackCardView } from './BlackjackCardView';
import { BankerSetupPanel } from './BankerSetupPanel';
import { DealerBlock, dealSpeedDisplayLabel, DEAL_SPEED_CYCLE } from './DealerBlock';
import { LocalProfileSetup } from './LocalProfileSetup';
import { PlayLedgerPanel } from './LedgerModals';
import { AssignChipsModal } from './AssignChipsModal';
import { ChangeMinBetModal } from './ChangeMinBetModal';
import { TableAccountsPanel } from './TableAccountsPanel';
import {
  takeInsuranceOnState,
  declineInsuranceOnState,
  takeEvenMoneyOnState,
  waitForBlackjackPayoutOnState,
  getStakeBetValidationMessage,
} from '../engine/blackjack';
import { isTableOwner } from '../engine/session';
import { getTableWagerDisplay } from '../engine/session/wagerDisplay';
import {
  addGameToPersonalLedger,
  hasPersonalLedgerEntryForTable,
  isBotBankGame,
} from '../engine/scoreLedger/scoreLedger';
import { buildRoundResultSummary } from '../engine/blackjack';
import {
  formatPlaceBetError,
  getChipPlacementTarget,
  getChipPlacementTargetFromBoxId,
  placeBetPayloadFromTarget,
  resolveChipTrayBetTarget,
  type PlaceBetTarget,
} from '../engine/blackjack/chipPlacement';
import { canUserAssignChips, canUserChangeProtocol } from '../engine/table/adminControls';
import { getVisibleDealerCardIds } from '../engine/blackjack/protocolState';
import {
  getBlackjackProtocolForState,
  listBlackjackProtocolPresets,
  setBlackjackProtocolOnState,
  updateBlackjackFlowSettings,
} from '../engine/blackjack';
import { getActionableHandForView, getInsuranceActionsForController } from './blackjackViewPhase';
import { MAX_TABLE_BOXES } from '../types/table';
import { getPlayerInitials, loadProfile, type PlayFlowAutoStand } from '../storage/profileStorage';
import { isOnlineModeEnabled } from '../api/config';
import {
  useIsMobileViewport,
  useIsUltraNarrowViewport,
  shouldShowMobileFullTableFallback,
} from '../hooks/useIsMobileViewport';
import { FullTableMobileFallback } from './FullTableMobileFallback';
import {
  getDeviceView,
  getViewRootClass,
  resolveInitialViewMode,
} from './tableViewContract';
import './BlackjackPanel.css';

const MAX_BOXES = MAX_TABLE_BOXES;
const ARC_ROTATIONS = [-18, -12, -6, 0, 6, 12, 18];

interface BlackjackPanelProps {
  gameState: GameState;
  onGameStateChange: (state: GameState) => void;
  onJoinTable?: () => void;
  onInviteTable?: () => void;
  onLeaveBox?: () => void;
  onlineDispatch?: (type: string, payload?: Record<string, unknown>) => Promise<unknown>;
  onlineActionInFlight?: boolean;
  profileOpen?: boolean;
  onProfileOpenChange?: (open: boolean) => void;
  onSaveTable?: () => void;
}

function arcVisualIndex(slotNumber: number): number {
  return MAX_BOXES - slotNumber;
}

export function BlackjackPanel({
  gameState,
  onGameStateChange,
  onInviteTable,
  onlineDispatch,
  onlineActionInFlight = false,
  profileOpen: profileOpenProp,
  onProfileOpenChange,
  onSaveTable,
}: BlackjackPanelProps) {
  const { session, players, ledger, deck, blackjack, blackjackSettings, tableViewMode, tableMeta } =
    gameState;
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const [error, setError] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [activeTablePanel, setActiveTablePanel] = useState<'thisTable' | 'playLedger' | 'settings'>('thisTable');
  const [profileOpenInternal, setProfileOpenInternal] = useState(
    () => !isOnlineModeEnabled() && !loadProfile().name.trim(),
  );
  const profileOpen = profileOpenProp ?? profileOpenInternal;
  const setProfileOpen = onProfileOpenChange ?? setProfileOpenInternal;
  const [personalLedgerAdded, setPersonalLedgerAdded] = useState(false);
  const [assignChipsOpen, setAssignChipsOpen] = useState(false);
  const [minBetOpen, setMinBetOpen] = useState(false);
  const [tableAidTip, setTableAidTip] = useState<string | null>(null);
  /** Last chip-tray / box-tap target — shared across Full Table and Card View. */
  const lastBetTargetRef = useRef<PlaceBetTarget | null>(null);

  const {
    centerStatus,
    flowError,
    bettingOpen,
    canDeal,
    dealActionPending,
    protocolPhase,
    hasStakes,
    awaitingNextRound,
    gameEnded,
    gameOverMessage,
    handleDealCards,
    handleNextRound,
    handleDealNextCard,
    handleDrawBank,
    handleShuffleToStart,
    engineStatus,
    initialDealStaged,
  } = useBlackjackTableFlow(gameState, onGameStateChange, onlineDispatch, onlineActionInFlight);

  const isMobileViewport = useIsMobileViewport();
  // Full Table felt only degrades to the "Use Card View" hint on ultra-narrow
  // screens (< 360px). All normal phone widths render the real Full Table.
  const isUltraNarrowViewport = useIsUltraNarrowViewport();
  // View mode is CLIENT-LOCAL: it must never be sourced from server-replaced
  // gameState, or every table:update would flip Card View back to Full Table.
  const [localViewMode, setLocalViewMode] = useState<TableViewMode>(() =>
    resolveInitialViewMode(isMobileViewport, tableViewMode),
  );
  const round = blackjack;
  const hasDeck = deck !== null;
  const deckCount = deck ? getShoeDeckCount(deck) : blackjackSettings.numberOfDecks;
  const remaining = deck ? getRemainingCardCount(deck) : 0;
  const viewMode = localViewMode;
  const deviceView = getDeviceView(isMobileViewport);
  const viewRootClass = getViewRootClass(deviceView, viewMode);
  const effectiveBoxId = gameState.selectedSeatId ?? defaultBlackjackSeatId(gameState);
  const flowSettings = gameState.blackjackFlowSettings;
  const profile = loadProfile();
  const controllerName = profile.name.trim() || tableMeta.controllerName;
  const tableOwner = isTableOwner(gameState, controllerName);
  const canAssignChips = canUserAssignChips(gameState, controllerName);
  const minimumBet = getTableMinimumBet(gameState);
  const canChangeMinBet = tableOwner && canChangeMinimumBet(gameState);
  const canChangeProtocol =
    tableOwner && canUserChangeProtocol(gameState, controllerName) && canChangeMinimumBet(gameState);
  const canChangeDealSpeed = tableOwner && canChangeMinimumBet(gameState);
  const activeProtocol = getBlackjackProtocolForState(gameState);
  const activeBoxId =
    round?.activeHandKey != null ? parseBlackjackHandKey(round.activeHandKey).playerId : null;

  useEffect(() => {
    if (gameState.tableMeta.gameStatus === 'ended') {
      setPersonalLedgerAdded(hasPersonalLedgerEntryForTable(gameState.session.id));
    }
  }, [gameState.tableMeta.gameStatus, gameState.session.id]);

  useEffect(() => {
    if (round?.status !== 'player-turns' || !round.activeHandKey) {
      return;
    }
    const { playerId } = parseBlackjackHandKey(round.activeHandKey);
    const current = gameStateRef.current;
    if (current.selectedSeatId !== playerId) {
      onGameStateChange({ ...current, selectedSeatId: playerId });
    }
  }, [round?.status, round?.activeHandKey, onGameStateChange]);

  const playingFor = getTableWagerDisplay(gameState);
  const displaySlots = [...tableMeta.boxSlots].sort((a, b) => b.slotNumber - a.slotNumber);
  const bankerReady = isBankerReady(gameState);
  // Personal (score) ledger is human-vs-human only — never for a Bot Bank game.
  const showPersonalLedgerOffer = gameEnded && !isBotBankGame(gameState);
  // Consolidated end-of-round summary, shown once (in the dealer block, above
  // the Next Round button). Per-box result chips are intentionally not repeated.
  const roundSummaryLines =
    awaitingNextRound && !gameEnded ? buildRoundResultSummary(gameState) : [];
  const showRoundSummary = roundSummaryLines.length > 0;
  const centerText = gameEnded ? gameOverMessage : showRoundSummary ? '' : centerStatus;

  function handleAddToPersonalLedger() {
    setError(null);
    if (onlineDispatch) {
      void onlineDispatch('addGameToPersonalLedger', {}).then(() => setPersonalLedgerAdded(true)).catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not add to personal ledger');
      });
      return;
    }
    try {
      addGameToPersonalLedger(gameStateRef.current);
      setPersonalLedgerAdded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add to personal ledger');
    }
  }

  function run(
    action: (state: GameState) => GameState,
    online?: { type: string; payload?: Record<string, unknown> },
  ) {
    setError(null);
    if (onlineDispatch && online) {
      void onlineDispatch(online.type, online.payload ?? {}).catch((err) => {
        setError(err instanceof Error ? err.message : 'Action failed');
      });
      return;
    }
    try {
      onGameStateChange(action(gameStateRef.current));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  }

  function setViewMode(mode: TableViewMode) {
    setLocalViewMode(mode);
    // Mirror into gameState for offline persistence only; online broadcasts
    // never carry it back because the panel reads from localViewMode.
    run((s) => ({ ...s, tableViewMode: mode }));
  }

  function rememberBetTarget(target: PlaceBetTarget) {
    lastBetTargetRef.current = target;
  }

  function placeBetAtTarget(target: PlaceBetTarget, amount: ChipValue) {
    rememberBetTarget(target);
    const payload = placeBetPayloadFromTarget(target, amount);

    if (onlineDispatch) {
      setError(null);
      void onlineDispatch('placeBet', payload).catch((err) => {
        setError(formatPlaceBetError(err));
      });
      return;
    }

    setError(null);
    try {
      let state = gameStateRef.current;
      if (target.kind === 'slot') {
        const slot = state.tableMeta.boxSlots.find((s) => s.slotNumber === target.slotNumber);
        if (!slot?.playerId) {
          state = claimBoxSlot(state, target.slotNumber);
        }
        const boxId = state.tableMeta.boxSlots.find((s) => s.slotNumber === target.slotNumber)
          ?.playerId;
        if (!boxId) {
          throw new Error('Could not claim box');
        }
        const personId = resolveControllerPersonId(state, controllerName);
        onGameStateChange(addChipToBoxStake(state, boxId, amount, personId ?? undefined));
        rememberBetTarget({ kind: 'box', boxId });
        return;
      }
      const personId = resolveControllerPersonId(state, controllerName);
      onGameStateChange(
        addChipToBoxStake(state, target.boxId, amount, personId ?? undefined),
      );
    } catch (err) {
      setError(formatPlaceBetError(err));
    }
  }

  function selectBox(boxId: string) {
    run((s) => ({ ...s, selectedSeatId: boxId }));
    try {
      rememberBetTarget(
        getChipPlacementTargetFromBoxId(
          gameStateRef.current,
          boxId,
          Boolean(onlineDispatch),
        ),
      );
    } catch {
      const slotNum = gameStateRef.current.session.boxSlotNumbers?.[boxId];
      if (slotNum != null) {
        rememberBetTarget(getChipPlacementTarget(gameStateRef.current, { slotNumber: slotNum }));
      }
    }
  }

  function addChipToBox(boxId: string, amount: ChipValue) {
    const target = getChipPlacementTargetFromBoxId(
      gameStateRef.current,
      boxId,
      Boolean(onlineDispatch),
    );
    placeBetAtTarget(target, amount);
  }

  function clearBoxStakeOnBox(boxId: string) {
    run((s) => clearBoxStake(s, boxId), { type: 'clearBet', payload: { boxId } });
  }

  function removeLastChipFromBox(boxId: string) {
    run((s) => removeLastChipFromBoxStake(s, boxId), { type: 'retractChip', payload: { boxId } });
  }

  function handlePlayFlowChange(personId: string, playFlow: PlayFlowAutoStand) {
    run((s) => setPersonPlayFlow(s, personId, playFlow));
  }

  function confirmBoxStakeOnBox(boxId: string) {
    setError(null);
    try {
      run((s) => confirmBoxStake(s, boxId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cannot confirm bet');
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }

  function handleSlotChipDrop(slotNumber: number, boxId: string | null, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetId(null);
    if (!bettingOpen) {
      return;
    }
    const value = readChipDragValue(e.dataTransfer);
    if (value === null) {
      return;
    }

    const target = getChipPlacementTarget(gameStateRef.current, { slotNumber, boxId });
    placeBetAtTarget(target, value);
  }

  function handleBetZoneDrop(boxId: string, slotNumber: number, e: React.DragEvent) {
    handleSlotChipDrop(slotNumber, boxId, e);
  }

  function handleClaimOrSelectSlot(slotNumber: number) {
    const slot = tableMeta.boxSlots.find((s) => s.slotNumber === slotNumber);
    if (!slot) {
      return;
    }
    if (slot.playerId) {
      selectBox(slot.playerId);
      return;
    }

    rememberBetTarget({ kind: 'slot', slotNumber });

    if (onlineDispatch) {
      setError(null);
      void onlineDispatch('assignBox', { slotNumber }).catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not claim box');
      });
      return;
    }

    setError(null);
    try {
      const name = controllerName;
      const claimed = claimBoxSlot(
        { ...gameStateRef.current, tableMeta: { ...gameStateRef.current.tableMeta, controllerName: name } },
        slotNumber,
      );
      onGameStateChange(claimed);
      const boxId = claimed.tableMeta.boxSlots.find((s) => s.slotNumber === slotNumber)?.playerId;
      if (boxId) {
        rememberBetTarget({ kind: 'box', boxId });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not claim box');
    }
  }

  function handleReleaseSlot(slotNumber: number) {
    run((state) => releaseBoxSlot(state, slotNumber));
  }

  function handleChipTrayClick(value: ChipValue) {
    const target = resolveChipTrayBetTarget(
      gameStateRef.current,
      controllerName,
      lastBetTargetRef.current,
      Boolean(onlineDispatch),
    );
    if (!target) {
      setError('Tap a box to bet');
      return;
    }
    placeBetAtTarget(target, value);
  }

  function renderCard(cardId: string, faceDown = false, compact = true, reactKey?: string) {
    if (!deck) {
      return null;
    }
    const card = getCardById(deck, cardId);
    if (!card) {
      return null;
    }
    return (
      <PlayingCard key={reactKey ?? cardId} card={card} compact={compact} faceDown={faceDown} animationMode="slide" />
    );
  }

  const dealerCards = round && deck ? getVisibleDealerCardIds(gameState) : [];
  const showHoleHidden = Boolean(
    round?.dealerHoleHidden &&
      round.status !== 'resolved' &&
      round.status !== 'bank-turn' &&
      round.status !== 'banking',
  );
  const handKeysByBox = new Map<string, string[]>();
  if (round) {
    for (const key of orderedHandKeys(session, round)) {
      const { playerId } = round.playerHands[key]!;
      const list = handKeysByBox.get(playerId) ?? [];
      list.push(key);
      handKeysByBox.set(playerId, list);
    }
  }

  const inBetting = bettingOpen;
  const displayError = error ?? flowError;
  const activeBoxStakeMessage = effectiveBoxId
    ? getStakeBetValidationMessage(gameState, effectiveBoxId)
    : null;
  const chipTrayHint =
    displayError && isInsufficientChipsMessage(displayError)
      ? displayError
      : inBetting && activeBoxStakeMessage
        ? activeBoxStakeMessage
        : null;
  const tableAlert =
    displayError && !isInsufficientChipsMessage(displayError) ? displayError : null;
  const shoeStarted = Boolean(tableMeta.shoeStarted);

  function handleCycleDealSpeed() {
    if (!canChangeDealSpeed) {
      return;
    }
    const presets = DEAL_SPEED_CYCLE;
    const idx = presets.indexOf(flowSettings.dealSpeedPreset);
    const nextPreset = presets[(idx + 1) % presets.length]!;
    run((s) => updateBlackjackFlowSettings(s, { dealSpeedPreset: nextPreset }));
  }

  function handleCycleProtocol() {
    if (!canChangeProtocol) {
      return;
    }
    const presets = listBlackjackProtocolPresets();
    const idx = presets.findIndex((p) => p.protocolId === gameState.blackjackProtocolId);
    const next = presets[(idx + 1) % presets.length]!;
    run((s) => setBlackjackProtocolOnState(s, next.protocolId, controllerName));
  }

  const dealerBlockProps = {
    deckCount,
    totalCards: deckCount * 52,
    remaining,
    playingFor,
    minimumBet,
    canChangeMinBet,
    onChangeMinBet: () => setMinBetOpen(true),
    dealSpeedLabel: dealSpeedDisplayLabel(flowSettings.dealSpeedPreset),
    canChangeDealSpeed,
    onCycleDealSpeed: handleCycleDealSpeed,
    protocolLabel: activeProtocol.displayName,
    canChangeProtocol,
    onChangeProtocol: handleCycleProtocol,
    awaitingNextRound,
    gameEnded,
    gameOverMessage,
    roundSummaryLines,
    onNextRound: handleNextRound,
    protocolPhase,
    hasDeck,
    bankerReady,
    shoeStarted,
    bettingOpen,
    canDeal,
    hasStakes,
    onShuffleToStart: handleShuffleToStart,
    onDealCards: handleDealCards,
    onDealNextCard: handleDealNextCard,
    onDrawBank: handleDrawBank,
    dealActionPending,
    engineStatus,
    initialDealManual: initialDealStaged,
    bankDrawManual: flowSettings.bankDrawMode === 'manual',
  };

  function renderTableAlert() {
    if (!tableAlert) {
      return null;
    }
    return (
      <p className="bj-table-alert" role="alert">
        {tableAlert}
      </p>
    );
  }

  function renderBetZone(boxId: string, slotNumber: number) {
    const stake = getStakeForBox(gameState, boxId);
    const chips = getStakeChipsForBox(gameState, boxId);
    const dropKey = `box-${boxId}`;
    const isDrop = dropTargetId === dropKey;
    const hasStake = stake > 0;
    const stakeValidationMessage = hasStake ? getStakeBetValidationMessage(gameState, boxId) : null;
    const belowMin = Boolean(stakeValidationMessage);

    return (
      <div
        className={[
          'bj-bet-zone',
          isDrop ? 'bj-bet-zone--drop' : '',
          hasStake ? 'bj-bet-zone--has-chips' : '',
          belowMin ? 'bj-bet-zone--below-min' : '',
        ].filter(Boolean).join(' ')}
        onDragOver={handleDragOver}
        onDragEnter={(e) => {
          e.stopPropagation();
          if (inBetting) {
            setDropTargetId(dropKey);
          }
        }}
        onDragLeave={(e) => {
          e.stopPropagation();
          setDropTargetId(null);
        }}
        onDrop={(e) => inBetting && handleBetZoneDrop(boxId, slotNumber, e)}
        onClick={(e) => e.stopPropagation()}
      >
        {hasStake && (
          <>
            <span className="bj-bet-zone__amount bj-bet-zone__amount--confirmed">{stake}</span>
            <StakeChips
              chips={chips}
              variant="bet"
              removable={inBetting}
              onRemoveTopChip={() => removeLastChipFromBox(boxId)}
            />
          </>
        )}
        {belowMin && stakeValidationMessage && (
          <span className="bj-bet-zone__min-warn">{stakeValidationMessage}</span>
        )}
        {inBetting && hasStake && (
          <div className="bj-bet-zone__actions">
            {belowMin && (
              <button
                type="button"
                className="bj-bet-zone__confirm"
                onClick={() => confirmBoxStakeOnBox(boxId)}
              >
                Confirm
              </button>
            )}
            <button
              type="button"
              className="bj-bet-zone__clear-all"
              onClick={() => clearBoxStakeOnBox(boxId)}
            >
              Clear
            </button>
          </div>
        )}
      </div>
    );
  }

  function handleMovePlayer(personId: string, direction: 'up' | 'down') {
    run((s) => movePlayerInOrder(s, personId, direction));
  }

  function renderEvenMoneyActions() {
    const offerKey = round?.evenMoneyOfferHandKey;
    if (!offerKey || protocolPhase !== 'player') {
      return null;
    }

    const { playerId } = parseBlackjackHandKey(offerKey);
    const activeSlotNum = session.boxSlotNumbers?.[playerId];
    const controllerPersonId = resolveControllerPersonId(gameState, controllerName);
    const isCaller =
      controllerPersonId !== null &&
      canControllerCallBox(gameState, playerId, controllerPersonId);

    if (!isCaller) {
      return (
        <p className="bj-table-actions bj-table-actions--wait">
          Box {activeSlotNum ?? '?'} — even-money decision pending…
        </p>
      );
    }

    return (
      <div className="bj-table-actions bj-table-actions--even-money" aria-live="polite">
        <p className="bj-table-actions__label">Dealer may have blackjack. Take 1:1 now?</p>
        <div className="bj-table-actions__row">
          <button
            type="button"
            className="ds-btn ds-btn--secondary bj-table-actions__btn"
            onClick={() => run((s) => takeEvenMoneyOnState(s, offerKey), { type: 'takeEvenMoney', payload: { handKey: offerKey } })}
          >
            Take 1:1
          </button>
          <button
            type="button"
            className="ds-btn ds-btn--ghost bj-table-actions__btn"
            onClick={() => run((s) => waitForBlackjackPayoutOnState(s, offerKey), { type: 'waitFor3to2', payload: { handKey: offerKey } })}
          >
            Wait for 3:2
          </button>
        </div>
      </div>
    );
  }

  function renderTablePlayerActions() {
    if (round?.evenMoneyOfferHandKey) {
      return renderEvenMoneyActions();
    }

    if (protocolPhase !== 'player' || !round?.activeHandKey) {
      return null;
    }

    const turnHandKey = round.activeHandKey;
    const { playerId } = parseBlackjackHandKey(turnHandKey);
    const activeSlotNum = session.boxSlotNumbers?.[playerId];
    const callerId = getCallerPersonIdForBox(gameState, playerId);
    const caller = callerId ? players[callerId] : null;
    const callerName = caller?.controllerName?.trim() || caller?.displayName || 'caller';
    const controllerPersonId = resolveControllerPersonId(gameState, controllerName);
    const isCaller =
      controllerPersonId !== null &&
      canControllerCallBox(gameState, playerId, controllerPersonId);

    if (!isCaller) {
      return (
        <p className="bj-table-actions bj-table-actions--wait">
          Waiting for {callerName} to call Box {activeSlotNum ?? '?'}.
        </p>
      );
    }

    // Canonical gate: controls enabled only when this viewer may act on the
    // server-authoritative active hand. Shared with Card View.
    const actionable = getActionableHandForView(gameState, controllerPersonId, isOnlineModeEnabled());
    const canHit = Boolean(actionable) && canHitBlackjack(round, turnHandKey);
    const canStand = Boolean(actionable) && canStandBlackjack(round, turnHandKey);

    function handleTableAid() {
      if (!deck || !round) {
        return;
      }
      const advice = getAidAdvice(round, turnHandKey, deck, flowSettings, gameState, ledger);
      if (advice) {
        setTableAidTip(advice.text);
      }
    }

    return (
      <div className="bj-table-actions" aria-live="polite">
        <div className="bj-table-actions__row">
          <button
            type="button"
            className="ds-btn ds-btn--stand bj-table-actions__btn"
            disabled={!canStand}
            onClick={() => run((s) => standBlackjackOnState(s, turnHandKey), { type: 'stand', payload: {} })}
          >
            Stay
          </button>
          <button
            type="button"
            className="ds-btn ds-btn--hit bj-table-actions__btn"
            disabled={!canHit}
            onClick={() => run((s) => hitBlackjackOnState(s, turnHandKey), { type: 'hit', payload: {} })}
          >
            Hit
          </button>
          {blackjackSettings.allowDoubleDown && (
            <button
              type="button"
              className="ds-btn ds-btn--secondary bj-table-actions__btn bj-table-actions__btn--sm"
              disabled={!actionable || !deck || !canDoubleBlackjackForState(gameState, turnHandKey)}
              onClick={() => run((s) => doubleDownBlackjackOnState(s, turnHandKey), { type: 'double', payload: {} })}
            >
              2×
            </button>
          )}
          {blackjackSettings.allowSplit && deck && (
            <button
              type="button"
              className="ds-btn ds-btn--secondary bj-table-actions__btn bj-table-actions__btn--sm"
              disabled={!actionable || !canSplitBlackjackForState(gameState, turnHandKey)}
              onClick={() => run((s) => splitBlackjackOnState(s, turnHandKey), { type: 'split', payload: {} })}
            >
              Split
            </button>
          )}
          {flowSettings.adviceEnabled && (
            <button type="button" className="ds-btn ds-btn--ghost bj-table-actions__btn bj-table-actions__btn--sm" onClick={handleTableAid}>
              AID
            </button>
          )}
        </div>
        {tableAidTip && <p className="bj-table-actions__aid">{tableAidTip}</p>}
      </div>
    );
  }

  function renderInsuranceActions() {
    if (protocolPhase !== 'insurance' || !round?.insuranceOfferPending) {
      return null;
    }

    const actions = getInsuranceActionsForController(gameState, round, controllerName);

    if (actions.length === 0) {
      return (
        <p className="bj-table-actions bj-table-actions--wait">
          Dealer shows Ace — waiting for insurance decisions…
        </p>
      );
    }

    return (
      <div className="bj-table-actions bj-table-actions--insurance" aria-live="polite">
        <p className="bj-table-actions__label">Dealer shows Ace — insurance pays 2:1</p>
        {actions.map(({ playerId, maxBet, canAfford, slotNumber }) => (
          <div key={playerId} className="bj-table-actions__ins-row">
            <span className="bj-table-actions__ins-label">
              Box {slotNumber ?? '?'} — up to {maxBet}c
              {!canAfford && ' (not enough chips)'}
            </span>
            <button
              type="button"
              className="ds-btn ds-btn--secondary bj-table-actions__btn bj-table-actions__btn--sm"
              disabled={!canAfford}
              onClick={() => run((s) => takeInsuranceOnState(s, playerId), { type: 'takeInsurance', payload: { playerId } })}
            >
              Insure {maxBet}
            </button>
            <button
              type="button"
              className="ds-btn ds-btn--ghost bj-table-actions__btn bj-table-actions__btn--sm"
              onClick={() => run((s) => declineInsuranceOnState(s, playerId), { type: 'declineInsurance', payload: { playerId } })}
            >
              No thanks
            </button>
          </div>
        ))}
      </div>
    );
  }

  function renderWaitingForTurn() {
    if (protocolPhase !== 'player' || round?.activeHandKey) {
      return null;
    }
    return <p className="bj-table-actions bj-table-actions--wait">Waiting for next box…</p>;
  }

  function renderArcSlot(boxId: string, slotNumber: number) {
    const player = players[boxId];
    const isSelected = effectiveBoxId === boxId;
    const isTurn = activeBoxId === boxId && round?.status === 'player-turns';
    const initials = getCallerInitials(gameState, boxId) || getPlayerInitials(player.controllerName);
    let handKeys = handKeysByBox.get(boxId) ?? [];
    if (handKeys.length === 0 && round) {
      const primaryKey = blackjackHandKey(boxId, 0);
      const hand = round.playerHands[primaryKey];
      if (hand && (hand.currentBet > 0 || hand.cardIds.some(Boolean))) {
        handKeys = [primaryKey];
      }
    }
    const visualIdx = arcVisualIndex(slotNumber);
    const rotation = ARC_ROTATIONS[visualIdx] ?? 0;

    return (
      <div
        key={boxId}
        className={[
          'bj-arc__slot',
          'bj-arc__slot--owned',
          isSelected ? 'bj-arc__slot--selected' : '',
          isTurn ? 'bj-arc__slot--turn' : '',
        ].filter(Boolean).join(' ')}
        style={{ '--arc-rot': `${rotation}deg` } as CSSProperties}
        role="button"
        tabIndex={0}
        onClick={() => selectBox(boxId)}
        onKeyDown={(e) => e.key === 'Enter' && selectBox(boxId)}
      >
        <div className="bj-arc__play-zone">
          <div className="bj-arc__cards">
            {handKeys.map((handKey) => {
              const hand = round?.playerHands[handKey];
              const cardIds = (hand?.cardIds ?? []).filter(Boolean);
              if (cardIds.length === 0) {
                return null;
              }
              const cards = deck ? cardsFromIds(deck, cardIds) : [];
              const { value } = getBlackjackHandValue(cards);
              const isBusted = hand?.actionStatus === 'busted';
              return (
                <div key={handKey} className="bj-arc__hand">
                  {isBusted && <span className="bj-arc__bust" aria-label="Busted">BUST</span>}
                  <span className="bj-arc__total-lg">{value}</span>
                  <div className="bj-cards-fan">
                    {cardIds.map((id, index) => renderCard(id, false, true, `${handKey}-${index}`))}
                  </div>
                </div>
              );
            })}
          </div>

          {renderBetZone(boxId, slotNumber)}
        </div>

        <div className="bj-arc__slot-foot">
          <span className="bj-arc__box-label">Box {slotNumber}</span>
          {initials && (
            <span className="bj-arc__initials" aria-label={player.controllerName}>{initials}</span>
          )}
        </div>

        <button
          type="button"
          className="bj-arc__leave"
          onClick={(e) => {
            e.stopPropagation();
            handleReleaseSlot(slotNumber);
          }}
        >
          Leave
        </button>
      </div>
    );
  }

  function renderEmptySlot(slotNumber: number) {
    const visualIdx = arcVisualIndex(slotNumber);
    const rotation = ARC_ROTATIONS[visualIdx] ?? 0;
    const dropKey = `slot-${slotNumber}`;
    const isDrop = dropTargetId === dropKey;
    return (
      <div
        key={`empty-${slotNumber}`}
        className={[
          'bj-arc__slot',
          'bj-arc__slot--empty',
          isDrop ? 'bj-arc__slot--drop' : '',
        ].filter(Boolean).join(' ')}
        style={{ '--arc-rot': `${rotation}deg` } as CSSProperties}
        role="button"
        tabIndex={0}
        onClick={() => handleClaimOrSelectSlot(slotNumber)}
        onKeyDown={(e) => e.key === 'Enter' && handleClaimOrSelectSlot(slotNumber)}
        onDragOver={handleDragOver}
        onDragEnter={() => inBetting && setDropTargetId(dropKey)}
        onDragLeave={() => setDropTargetId(null)}
        onDrop={(e) => inBetting && handleSlotChipDrop(slotNumber, null, e)}
      >
        <div
          className={[
            'bj-bet-zone',
            'bj-bet-zone--open',
            isDrop ? 'bj-bet-zone--drop' : '',
          ].filter(Boolean).join(' ')}
          aria-label="Open box — drop chips to claim"
        />
      </div>
    );
  }

  const focusBoxId =
    round?.status === 'player-turns' && activeBoxId
      ? activeBoxId
      : effectiveBoxId ?? defaultBlackjackSeatId(gameState);

  const dealerCardNodes =
    dealerCards.length > 0
      ? dealerCards.map((cardId, index) => renderCard(cardId, showHoleHidden && index === 1, true))
      : null;

  return (
    <div
      className={`bj-casino ${viewRootClass}`}
      aria-label="Blackjack table"
      data-view-mode={viewMode}
      data-device-view={deviceView}
      data-phase={protocolPhase}
    >
      {tableMeta.showBankerSetup && tableMeta.agreement && (
        <BankerSetupPanel gameState={gameState} onConfirm={onGameStateChange} />
      )}

      <div className="bj-casino__toolbar">
        <div className="bj-casino__view-toggle">
          <button type="button" className={viewMode === 'full' ? 'bj-casino__view-btn--active' : 'bj-casino__view-btn'} onClick={() => setViewMode('full')}>Full Table</button>
          <button type="button" className={viewMode === 'card' ? 'bj-casino__view-btn--active' : 'bj-casino__view-btn'} onClick={() => setViewMode('card')}>Card View</button>
        </div>
        <div className="bj-casino__table-nav">
          <button
            type="button"
            className={activeTablePanel === 'thisTable' ? 'bj-casino__nav-btn--active' : 'bj-casino__nav-btn'}
            onClick={() => setActiveTablePanel('thisTable')}
          >
            This Table
          </button>
          <button
            type="button"
            className={activeTablePanel === 'playLedger' ? 'bj-casino__nav-btn--active' : 'bj-casino__nav-btn'}
            onClick={() => setActiveTablePanel('playLedger')}
          >
            Play Ledger
          </button>
          <button
            type="button"
            className={activeTablePanel === 'settings' ? 'bj-casino__nav-btn--active' : 'bj-casino__nav-btn'}
            onClick={() => setActiveTablePanel('settings')}
          >
            Settings
          </button>
        </div>
      </div>

      {activeTablePanel === 'playLedger' && (
        <div className="bj-table-wide-panel">
          <PlayLedgerPanel gameState={gameState} />
        </div>
      )}
      {activeTablePanel === 'settings' && (
        <div className="bj-table-wide-panel bj-table-wide-panel--settings">
          <BlackjackFlowSettingsMenu
            embedded
            gameState={gameState}
            onGameStateChange={onGameStateChange}
            open
            onClose={() => setActiveTablePanel('thisTable')}
          />
        </div>
      )}

      <LocalProfileSetup
        open={profileOpen}
        required={!isOnlineModeEnabled() && !loadProfile().name.trim()}
        onClose={() => setProfileOpen(false)}
        onSaved={(saved) => {
          const personId = tableMeta.ownerPersonId;
          if (personId) {
            run((s) => setPersonPlayFlow(s, personId, saved.playFlow));
          }
        }}
      />
      <AssignChipsModal
        gameState={gameState}
        open={assignChipsOpen}
        onClose={() => setAssignChipsOpen(false)}
        onAssign={onGameStateChange}
      />
      <ChangeMinBetModal
        gameState={gameState}
        open={minBetOpen}
        onClose={() => setMinBetOpen(false)}
        onSave={onGameStateChange}
      />

      {shouldShowMobileFullTableFallback(isUltraNarrowViewport, viewMode) ? (
        <FullTableMobileFallback onSwitchToCardView={() => setViewMode('card')} />
      ) : (
      <div className="bj-casino__rail">
        <div
          className={`bj-casino__felt${
            activeTablePanel === 'thisTable' ? ' bj-casino__felt--with-account' : ''
          }${viewMode === 'card' ? ' bj-casino__felt--card-view' : ''}`}
        >
          {viewMode === 'full' && (
            <>
              <div className="bj-casino__felt-main">
              <DealerBlock {...dealerBlockProps} dealerCards={dealerCardNodes} />
              {renderTableAlert()}

              {centerText && (
                <p className={`bj-center-status${gameEnded ? ' bj-center-status--game-over' : ''}`} aria-live="polite">
                  {centerText}
                </p>
              )}
              {showPersonalLedgerOffer && (
                <div className="bj-personal-ledger-offer">
                  <button
                    type="button"
                    className="ds-btn ds-btn--secondary"
                    disabled={personalLedgerAdded}
                    onClick={handleAddToPersonalLedger}
                  >
                    {personalLedgerAdded ? 'Added to personal ledger' : 'Add game to personal ledger'}
                  </button>
                </div>
              )}

              {renderInsuranceActions()}
              {renderTablePlayerActions()}
              {renderWaitingForTurn()}

              <div className="bj-arc-separator" aria-hidden="true" />

              <div className="bj-arc bj-arc--rtl" style={{ '--slot-count': MAX_BOXES } as CSSProperties}>
                {displaySlots.map((slot) =>
                  slot.playerId ? renderArcSlot(slot.playerId, slot.slotNumber) : renderEmptySlot(slot.slotNumber),
                )}
              </div>

              {inBetting && (
                <div className="bj-casino__tray-wrap">
                  <div className="bj-casino__tray">
                    <ChipTray onChipClick={handleChipTrayClick} disabled={!bettingOpen} />
                  </div>
                  {chipTrayHint && (
                    <p className="bj-casino__tray-hint" role="status">{chipTrayHint}</p>
                  )}
                </div>
              )}
              </div>
              {activeTablePanel === 'thisTable' && (
                <TableAccountsPanel
                  gameState={gameState}
                  showAssignButton={canAssignChips}
                  onAssignChips={() => setAssignChipsOpen(true)}
                  onInvite={onInviteTable}
                  onSaveTable={onSaveTable}
                  showPlayerOrderControls={tableOwner && bettingOpen}
                  onMovePlayer={handleMovePlayer}
                  onPlayFlowChange={handlePlayFlowChange}
                />
              )}
            </>
          )}

          {viewMode === 'card' && (
            <>
              <div className="bj-casino__felt-main bj-casino__felt-main--card">
                <DealerBlock {...dealerBlockProps} dealerCards={dealerCardNodes} />
                {renderTableAlert()}

                {centerText && (
                  <p className={`bj-center-status${gameEnded ? ' bj-center-status--game-over' : ''}`} aria-live="polite">
                    {centerText}
                  </p>
                )}
                {showPersonalLedgerOffer && (
                  <div className="bj-personal-ledger-offer">
                    <button
                      type="button"
                      className="ds-btn ds-btn--secondary"
                      disabled={personalLedgerAdded}
                      onClick={handleAddToPersonalLedger}
                    >
                      {personalLedgerAdded ? 'Added to personal ledger' : 'Add game to personal ledger'}
                    </button>
                  </div>
                )}

                <BlackjackCardView
                  gameState={gameState}
                  deviceView={deviceView}
                  focusBoxId={focusBoxId ?? undefined}
                  activeBoxId={activeBoxId}
                  showHoleHidden={showHoleHidden}
                  protocolPhase={protocolPhase}
                  bettingOpen={bettingOpen}
                  gameEnded={gameEnded}
                  onSelectBox={selectBox}
                  onClaimSlot={handleClaimOrSelectSlot}
                  onReleaseSlot={handleReleaseSlot}
                  onAddChip={addChipToBox}
                  onClearStake={clearBoxStakeOnBox}
                  onRemoveLastChip={removeLastChipFromBox}
                  onSlotChipDrop={handleSlotChipDrop}
                  onStay={(hk) => run((s) => standBlackjackOnState(s, hk), { type: 'stand', payload: {} })}
                  onCard={(hk) => run((s) => hitBlackjackOnState(s, hk), { type: 'hit', payload: {} })}
                  onDouble={(hk) => run((s) => doubleDownBlackjackOnState(s, hk), { type: 'double', payload: {} })}
                  onSplit={(hk) => run((s) => splitBlackjackOnState(s, hk), { type: 'split', payload: {} })}
                  onTakeEvenMoney={(hk) => run((s) => takeEvenMoneyOnState(s, hk), { type: 'takeEvenMoney', payload: { handKey: hk } })}
                  onWaitForBlackjackPayout={(hk) => run((s) => waitForBlackjackPayoutOnState(s, hk), { type: 'waitFor3to2', payload: { handKey: hk } })}
                  onTakeInsurance={(pid) => run((s) => takeInsuranceOnState(s, pid), { type: 'takeInsurance', payload: { playerId: pid } })}
                  onDeclineInsurance={(pid) => run((s) => declineInsuranceOnState(s, pid), { type: 'declineInsurance', payload: { playerId: pid } })}
                  onBack={() => setViewMode('full')}
                />

                {inBetting && (
                  <div className="bj-casino__tray-wrap">
                    <div className="bj-casino__tray">
                      <ChipTray onChipClick={handleChipTrayClick} disabled={!bettingOpen} />
                    </div>
                    {chipTrayHint && (
                      <p className="bj-casino__tray-hint" role="status">{chipTrayHint}</p>
                    )}
                  </div>
                )}
              </div>
              {activeTablePanel === 'thisTable' && (
                <TableAccountsPanel
                  gameState={gameState}
                  showAssignButton={canAssignChips}
                  onAssignChips={() => setAssignChipsOpen(true)}
                  onInvite={onInviteTable}
                  onSaveTable={onSaveTable}
                  showPlayerOrderControls={tableOwner && bettingOpen}
                  onMovePlayer={handleMovePlayer}
                  onPlayFlowChange={handlePlayFlowChange}
                />
              )}
            </>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
