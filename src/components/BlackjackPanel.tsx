import { useRef, useState, useEffect, useMemo, type CSSProperties } from 'react';
import type { GameState, TableViewMode } from '../types';
import {
  claimBoxSlot,
  defaultBlackjackSeatId,
  isBankerReady,
  movePlayerInOrder,
  releaseBoxSlot,
  resolveControllerPersonId,
  canControllerCallBox,
} from '../engine/session';
import { isJoinAssignedHighlight } from '../engine/session/inviteJoin';
import {
  blackjackHandKey,
  canDoubleBlackjackForState,
  canHitBlackjack,
  canSplitBlackjackForState,
  canStandBlackjack,
  doubleDownBlackjackOnState,
  getAidAdvice,
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
import {
  CHIP_DROP_BOX_ATTR,
  CHIP_DROP_SLOT_ATTR,
  chipDropKey,
  createChipPointerDragHandlers,
  type ChipDropTarget,
} from './chipPointerDrag';
import { ChipTray, StakeChips, type ChipValue } from './ChipStack';
import { PlayingCard } from './PlayingCard';
import { useBlackjackTableFlow } from './useBlackjackTableFlow';
import { BlackjackFlowSettingsMenu } from './BlackjackFlowSettings';
import { BlackjackCardView } from './BlackjackCardView';
import { BankerSetupPanel } from './BankerSetupPanel';
import { DealerBlock, dealSpeedDisplayLabel, DEAL_SPEED_CYCLE } from './DealerBlock';
import { getBoxCallerDisplayName } from './boxCallerDisplay';
import { LocalProfileSetup } from './LocalProfileSetup';
import { PlayLedgerModal } from './LedgerModals';
import { TableSideRailShell } from './TableSideRailShell';
import { toggleSideRailPanel, type SideRailPanel } from './sideRailPanel';
import { TABLE_UX } from './tableUxContract';
import { TableInfoBar } from './TableInfoBar';
import { buildTableInfoDisplay } from './tableInfoDisplay';
import { TableDetailsPanelContent } from './TableDetailsPanel';
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
import { buildTableCommandDisplay } from './tableCommandDisplay';
import {
  formatPlaceBetError,
  getChipPlacementTarget,
  getChipPlacementTargetFromBoxId,
  placeBetPayloadFromTarget,
  resolveChipTrayBetTarget,
  type PlaceBetTarget,
} from '../engine/blackjack/chipPlacement';
import {
  canUserAssignChips,
  canUserChangeProtocol,
  canUserResetTable,
} from '../engine/table/adminControls';
import { getVisibleDealerCardIds } from '../engine/blackjack/protocolState';
import {
  getBlackjackProtocolForState,
  listBlackjackProtocolPresets,
  setBlackjackProtocolOnState,
  updateBlackjackFlowSettings,
} from '../engine/blackjack';
import {
  canShowPlayerDecisionControls,
  resolveViewerActionPermission,
  formatDecisionOwnerWaitMessage,
  getInsuranceActionsForController,
  getActiveTurnBoxId,
} from './blackjackViewPhase';
import { getDisplayedHandValue, getVisibleHandCardIds } from '../engine/blackjack/dealing/cardRevealDisplay';
import {
  BOX_CARD_VALUE,
  BOX_CARD_VALUE_BUST,
  getBoxCardClassName,
  getBetBoxPulseClassName,
} from './cardViewBox';
import {
  buildViewerIdentityHints,
  resolveViewerPersonIdForTable,
} from './viewerIdentity';
import type { AuthUser } from '../api/client';
import { MAX_TABLE_BOXES } from '../types/table';
import { loadProfile, type PlayFlowAutoStand } from '../storage/profileStorage';
import { isOnlineModeEnabled } from '../api/config';
import {
  useIsMobileViewport,
  useIsUltraNarrowViewport,
  shouldShowMobileFullTableFallback,
} from '../hooks/useIsMobileViewport';
import { useSequentialCardReveal } from '../hooks/useSequentialCardReveal';
import { FullTableMobileFallback } from './FullTableMobileFallback';
import {
  getDeviceView,
  getViewRootClass,
  resolveInitialViewMode,
} from './tableViewContract';
import { SXM_LAYOUT, sxmSectionProps } from './sxmLayoutContract';
import { applyBlackjackTableTheme } from '../design/blackjackTableTheme';
import type { TableResetSetupVariant } from './TableStakePanel';
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
  onBeginTableReset?: (variant?: TableResetSetupVariant) => void;
  onlineTableId?: string | null;
  viewerAuth?: Pick<AuthUser, 'email' | 'displayName'> | null;
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
  onBeginTableReset,
  onlineTableId = null,
  viewerAuth = null,
}: BlackjackPanelProps) {
  const { session, ledger, deck, blackjack, blackjackSettings, tableViewMode, tableMeta } =
    gameState;
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const layoutRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyBlackjackTableTheme(gameState.blackjackTableTheme ?? null, layoutRootRef.current);
  }, [gameState.blackjackTableTheme]);

  const [error, setError] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [sideRailPanel, setSideRailPanel] = useState<SideRailPanel>('thisTable');
  const [activeTablePanel, setActiveTablePanel] = useState<'playLedger' | 'settings' | null>(null);
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

  const profile = loadProfile();
  const controllerName = profile.name.trim() || tableMeta.controllerName;
  const viewerHints = buildViewerIdentityHints(gameState, onlineTableId, viewerAuth);
  const viewerPersonId = resolveViewerPersonIdForTable(gameState, onlineTableId, viewerAuth);
  const tableOwner = isTableOwner(gameState, controllerName);
  const canDriveTableAutomation =
    tableOwner || controllerName === tableMeta.controllerName;

  const isMobileViewport = useIsMobileViewport();
  const { displayState: tableVisualState, isRevealing } = useSequentialCardReveal(gameState, {
    onlineMode: Boolean(onlineDispatch) || isOnlineModeEnabled(),
  });
  const cardRevealComplete = !isRevealing;

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
  } = useBlackjackTableFlow(
    gameState,
    onGameStateChange,
    onlineDispatch,
    onlineActionInFlight,
    canDriveTableAutomation,
    cardRevealComplete,
  );

  // Full Table felt only degrades to the "Use Card View" hint on ultra-narrow
  // screens (< 360px). All normal phone widths render the real Full Table.
  const isUltraNarrowViewport = useIsUltraNarrowViewport();
  // View mode is CLIENT-LOCAL: it must never be sourced from server-replaced
  // gameState, or every table:update would flip Card View back to Full Table.
  const [localViewMode, setLocalViewMode] = useState<TableViewMode>(() =>
    resolveInitialViewMode(isMobileViewport, tableViewMode),
  );
  const round = blackjack;
  const visualRound = tableVisualState.blackjack;
  const visualDeck = tableVisualState.deck;
  const hasDeck = deck !== null;
  const deckCount = deck ? getShoeDeckCount(deck) : blackjackSettings.numberOfDecks;
  const remaining = deck ? getRemainingCardCount(deck) : 0;
  const viewMode = localViewMode;
  const deviceView = getDeviceView(isMobileViewport);
  const viewRootClass = getViewRootClass(deviceView, viewMode);
  const effectiveBoxId = gameState.selectedSeatId ?? defaultBlackjackSeatId(gameState);
  const flowSettings = gameState.blackjackFlowSettings;
  const canAssignChips = canUserAssignChips(gameState, controllerName);
  const minimumBet = getTableMinimumBet(gameState);
  const canChangeMinBet = tableOwner && canChangeMinimumBet(gameState);
  const canChangeProtocol =
    tableOwner && canUserChangeProtocol(gameState, controllerName) && canChangeMinimumBet(gameState);
  const canChangeDealSpeed = tableOwner && canChangeMinimumBet(gameState);
  const canResetTable = canUserResetTable(gameState, controllerName);
  const activeProtocol = getBlackjackProtocolForState(gameState);
  const activeBoxId = getActiveTurnBoxId(gameState, protocolPhase);

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
  const tableCommand = buildTableCommandDisplay({
    gameState,
    gameEnded,
    gameOverMessage,
    centerStatus,
    protocolPhase,
    roundSummaryLines,
    controllerName,
    viewerPersonId,
    viewerHints,
  });

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
    if (!visualDeck) {
      return null;
    }
    const card = getCardById(visualDeck, cardId);
    if (!card) {
      return null;
    }
    return (
      <PlayingCard key={reactKey ?? cardId} card={card} compact={compact} faceDown={faceDown} animationMode="slide" />
    );
  }

  const dealerCards =
    visualRound && visualDeck ? getVisibleDealerCardIds(tableVisualState) : [];
  const showHoleHidden = Boolean(
    round?.dealerHoleHidden &&
      round.status !== 'resolved' &&
      round.status !== 'bank-turn' &&
      round.status !== 'banking',
  );
  const handKeysByBox = new Map<string, string[]>();
  if (visualRound) {
    for (const key of orderedHandKeys(session, visualRound)) {
      const { playerId } = visualRound.playerHands[key]!;
      const list = handKeysByBox.get(playerId) ?? [];
      list.push(key);
      handKeysByBox.set(playerId, list);
    }
  }

  const inBetting = bettingOpen;
  const chipPointerDrag = useMemo(
    () =>
      createChipPointerDragHandlers({
        enabled: inBetting,
        onHighlight: setDropTargetId,
        onDrop: (value, target: ChipDropTarget) => {
          if (!bettingOpen) {
            return;
          }
          const placementTarget = getChipPlacementTarget(gameStateRef.current, target);
          placeBetAtTarget(placementTarget, value);
        },
      }),
    [inBetting, bettingOpen],
  );
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

  function toggleTableDetails() {
    setActiveTablePanel(null);
    setSideRailPanel((current) => toggleSideRailPanel(current, 'tableDetails'));
  }

  const tableDetailsProps = {
    playingFor,
    minimumBet,
    canChangeMinBet,
    onChangeMinBet: () => setMinBetOpen(true),
    deckCount,
    totalCards: deckCount * 52,
    remaining,
    hasDeck,
    dealSpeedLabel: dealSpeedDisplayLabel(flowSettings.dealSpeedPreset),
    canChangeDealSpeed,
    onCycleDealSpeed: handleCycleDealSpeed,
    protocolLabel: activeProtocol.displayName,
    canChangeProtocol,
    onChangeProtocol: handleCycleProtocol,
    gameEnded,
    canResetTable: canResetTable && Boolean(onBeginTableReset),
    onResetTable: onBeginTableReset
      ? () => {
          setSideRailPanel(null);
          onBeginTableReset('resetTable');
        }
      : undefined,
  };

  const dealerBankInfo = viewMode === 'full' ? (
    <TableInfoBar gameState={gameState} viewerPersonId={viewerPersonId} variant="dealer" />
  ) : undefined;

  const dealerBlockProps = {
    awaitingNextRound,
    gameEnded,
    bankInfo: dealerBankInfo,
    onNewGame:
      gameEnded && onBeginTableReset
        ? () => onBeginTableReset('newGame')
        : undefined,
    canStartNewGame: canResetTable,
    newGameDisabledReason:
      gameEnded && !canResetTable ? 'Only the table owner can start a new game.' : null,
    commentaryText: tableAidTip,
    commandMessage: tableCommand.commandMessage,
    commandLines: tableCommand.commandLines,
    onOpenTableDetails: toggleTableDetails,
    tableDetailsOpen: sideRailPanel === 'tableDetails',
    onNextRound: handleNextRound,
    protocolPhase,
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

  function renderSummaryZone() {
    const alert = renderTableAlert();
    return (
      <div
        {...sxmSectionProps(SXM_LAYOUT.statusZone, `bj-table-zone ${TABLE_UX.tableZoneSummary}`)}
      >
        {alert ?? (
          <div className={TABLE_UX.summaryPlaceholder} aria-hidden="true" />
        )}
        {showPersonalLedgerOffer ? (
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
        ) : null}
      </div>
    );
  }

  function renderActionsZone() {
    const insurance = renderInsuranceActions();
    const playerActions = renderTablePlayerActions();
    const content = insurance ?? playerActions;
    const hasPrimarySecondary = Boolean(playerActions);
    return (
      <div
        {...sxmSectionProps(SXM_LAYOUT.actionZone, `bj-table-zone ${TABLE_UX.tableZoneActions}`)}
      >
        {content ?? (
          <div className={TABLE_UX.actionsPlaceholder} aria-hidden="true" />
        )}
        {!hasPrimarySecondary && (
          <>
            <div
              {...sxmSectionProps(SXM_LAYOUT.primaryActions, TABLE_UX.actionsPlaceholder)}
              aria-hidden="true"
            />
            <div
              {...sxmSectionProps(SXM_LAYOUT.secondaryActions, TABLE_UX.actionsPlaceholder)}
              aria-hidden="true"
            />
          </>
        )}
      </div>
    );
  }

  function renderCardViewSummaryExtras() {
    const alert = renderTableAlert();
    return (
      <>
        {alert}
        {showPersonalLedgerOffer ? (
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
        ) : null}
      </>
    );
  }

  function renderTrayInner() {
    const { playerAvailable } = buildTableInfoDisplay(gameState, viewerPersonId);
    return (
      <div className="bj-casino__tray-wrap">
        <div
          {...sxmSectionProps(
            SXM_LAYOUT.chipTray,
            'bj-casino__tray',
            inBetting ? '' : TABLE_UX.trayReserved,
          )}
        >
          {inBetting && (
            <ChipTray
              onChipClick={handleChipTrayClick}
              onChipPointerDown={chipPointerDrag.onChipPointerDown}
              disabled={!bettingOpen}
              minimumBet={minimumBet}
            />
          )}
        </div>
        {inBetting && chipTrayHint && (
          <p className="bj-casino__tray-hint" role="status">{chipTrayHint}</p>
        )}
        <p
          {...sxmSectionProps(
            SXM_LAYOUT.playerBalance,
            'bj-casino__player-balance',
            playerAvailable === null ? 'bj-casino__player-balance--placeholder' : '',
          )}
          aria-label={playerAvailable !== null ? `Available ${playerAvailable} chips` : undefined}
          aria-hidden={playerAvailable === null}
        >
          {playerAvailable !== null ? `You: ${playerAvailable}` : '\u00a0'}
        </p>
      </div>
    );
  }

  function renderBottomTrayZone() {
    return (
      <div className={`bj-table-zone ${TABLE_UX.tableZoneBottom}`}>
        {renderTrayInner()}
      </div>
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
        {...{
          [CHIP_DROP_SLOT_ATTR]: slotNumber,
          [CHIP_DROP_BOX_ATTR]: boxId,
        }}
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
    const isCaller =
      viewerPersonId !== null &&
      canControllerCallBox(gameState, playerId, viewerPersonId);

    if (!isCaller) {
      return (
        <p className={`${TABLE_UX.playerActions} bj-table-actions bj-table-actions--wait`}>
          Box {activeSlotNum ?? '?'} — even-money decision pending…
        </p>
      );
    }

    return (
      <div className={`${TABLE_UX.playerActions} bj-table-actions bj-table-actions--even-money`} aria-live="polite">
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

    if (!canShowPlayerDecisionControls(gameState, protocolPhase, { cardRevealComplete })) {
      return null;
    }

    if (!round) {
      return null;
    }
    const activeRound: NonNullable<typeof round> = round;
    if (!activeRound.activeHandKey) {
      return null;
    }
    const { playerId } = parseBlackjackHandKey(activeRound.activeHandKey);

    const actionPermission = resolveViewerActionPermission(gameState, viewerPersonId);
    if (!actionPermission.canAct) {
      const waitMessage =
        actionPermission.waitMessage ??
        formatDecisionOwnerWaitMessage(gameState, playerId);
      return (
        <p className={`${TABLE_UX.playerActions} bj-table-actions bj-table-actions--wait`}>
          {waitMessage}
        </p>
      );
    }

    const actionable = actionPermission.actionable!;
    const canHit = canHitBlackjack(activeRound, actionable.handKey);
    const canStand = canStandBlackjack(activeRound, actionable.handKey);

    const canDouble =
      Boolean(deck) && canDoubleBlackjackForState(gameState, actionable.handKey);
    const canSplit = canSplitBlackjackForState(gameState, actionable.handKey);

    function handleTableAid() {
      if (!deck) {
        return;
      }
      const advice = getAidAdvice(activeRound, actionable.handKey, deck, flowSettings, gameState, ledger);
      if (advice) {
        setTableAidTip(advice.text);
      }
    }

    return (
      <div className={`${TABLE_UX.playerActions} bj-table-actions`} aria-live="polite">
        <div {...sxmSectionProps(SXM_LAYOUT.primaryActions, 'bj-table-actions__row')}>
          <button
            type="button"
            className="ds-btn ds-btn--stand bj-table-actions__btn"
            disabled={!canStand}
            onClick={() => run((s) => standBlackjackOnState(s, actionable.handKey), { type: 'stand', payload: {} })}
          >
            Stay
          </button>
          <button
            type="button"
            className="ds-btn ds-btn--hit bj-table-actions__btn"
            disabled={!canHit}
            onClick={() => run((s) => hitBlackjackOnState(s, actionable.handKey), { type: 'hit', payload: {} })}
          >
            Hit
          </button>
        </div>
        <div {...sxmSectionProps(SXM_LAYOUT.secondaryActions, 'bj-table-actions__row')}>
          {blackjackSettings.allowDoubleDown && (
            <button
              type="button"
              className={[
                'ds-btn',
                'ds-btn--secondary',
                'bj-table-actions__btn',
                'bj-table-actions__btn--sm',
                canDouble ? 'bj-table-actions__btn--legal' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={!canDouble}
              onClick={() => run((s) => doubleDownBlackjackOnState(s, actionable.handKey), { type: 'double', payload: {} })}
            >
              2×
            </button>
          )}
          {blackjackSettings.allowSplit && deck && (
            <button
              type="button"
              className={[
                'ds-btn',
                'ds-btn--secondary',
                'bj-table-actions__btn',
                'bj-table-actions__btn--sm',
                canSplit ? 'bj-table-actions__btn--legal' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={!canSplit}
              onClick={() => run((s) => splitBlackjackOnState(s, actionable.handKey), { type: 'split', payload: {} })}
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
      </div>
    );
  }

  function renderInsuranceActions() {
    if (protocolPhase !== 'insurance' || !round?.insuranceOfferPending) {
      return null;
    }

    const actions = getInsuranceActionsForController(gameState, round, viewerPersonId);

    if (actions.length === 0) {
      return null;
    }

    return (
      <div className={`${TABLE_UX.playerActions} bj-table-actions bj-table-actions--insurance`} aria-live="polite">
        {actions.map(({ playerId, maxBet, canAfford, slotNumber }) => (
          <div key={playerId} className="bj-table-actions__ins-row">
            <span className="bj-table-actions__ins-label">
              Box {slotNumber ?? '?'} — up to {maxBet}c
              {!canAfford && ' (not enough chips)'}
            </span>
            <button
              type="button"
              className={[
                'ds-btn',
                'ds-btn--secondary',
                'bj-table-actions__btn',
                'bj-table-actions__btn--sm',
                canAfford ? 'bj-table-actions__btn--legal' : '',
              ]
                .filter(Boolean)
                .join(' ')}
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


  function renderArcSlot(boxId: string, slotNumber: number) {
    const isSelected = effectiveBoxId === boxId;
    const isTurn = activeBoxId === boxId;
    const isActiveBox = isSelected || isTurn;
    const isJoinAssigned = isJoinAssignedHighlight(gameState, slotNumber, protocolPhase);
    const callerDisplayName = getBoxCallerDisplayName(gameState, boxId);
    let handKeys = handKeysByBox.get(boxId) ?? [];
    if (handKeys.length === 0 && visualRound) {
      const primaryKey = blackjackHandKey(boxId, 0);
      const hand = visualRound.playerHands[primaryKey];
      if (hand && (hand.currentBet > 0 || hand.cardIds.some(Boolean))) {
        handKeys = [primaryKey];
      }
    }
    const primaryHandKey = handKeys[0];
    const cardIds = primaryHandKey ? getVisibleHandCardIds(visualRound, primaryHandKey) : [];
    const displayValue = primaryHandKey
      ? getDisplayedHandValue(visualDeck, visualRound, primaryHandKey)
      : null;
    const primaryHand = primaryHandKey ? visualRound?.playerHands[primaryHandKey] : null;
    const isBusted = primaryHand?.actionStatus === 'busted';
    const valueLabel = isBusted
      ? 'BUST'
      : displayValue !== null && displayValue > 0
        ? String(displayValue)
        : '';
    const openStake = getStakeForBox(gameState, boxId);
    const stakeChips = getStakeChipsForBox(gameState, boxId);
    const wager = inBetting ? openStake : (primaryHand?.currentBet ?? openStake);
    const showBettingChips = inBetting && openStake > 0 && stakeChips.length > 0;
    const showPlayChips = !inBetting && wager > 0;
    const displayChips = showBettingChips
      ? stakeChips
      : showPlayChips
        ? (stakeChips.length > 0 ? stakeChips : [wager])
        : [];
    const showStakeContent = inBetting || displayChips.length > 0;
    const dropKey = chipDropKey({ slotNumber, boxId });
    const isDrop = dropTargetId === dropKey;
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
          isJoinAssigned ? 'bj-arc__slot--assigned' : '',
        ].filter(Boolean).join(' ')}
        style={{ '--arc-rot': `${rotation}deg` } as CSSProperties}
      >
        <div
          {...sxmSectionProps(SXM_LAYOUT.playerBox, getBoxCardClassName(isActiveBox), TABLE_UX.fullArcBox, getBetBoxPulseClassName(bettingOpen, true), showBettingChips ? 'bj-phone-view__mini-hand--has-stake' : '', isDrop ? 'bj-bet-zone--drop' : '')}
          {...{
            [CHIP_DROP_SLOT_ATTR]: slotNumber,
            [CHIP_DROP_BOX_ATTR]: boxId,
          }}
          role="button"
          tabIndex={0}
          onClick={() => selectBox(boxId)}
          onKeyDown={(e) => e.key === 'Enter' && selectBox(boxId)}
          onDragOver={inBetting ? handleDragOver : undefined}
          onDragEnter={
            inBetting
              ? (e) => {
                  e.stopPropagation();
                  setDropTargetId(dropKey);
                }
              : undefined
          }
          onDragLeave={
            inBetting
              ? (e) => {
                  e.stopPropagation();
                  setDropTargetId(null);
                }
              : undefined
          }
          onDrop={inBetting ? (e) => handleBetZoneDrop(boxId, slotNumber, e) : undefined}
        >
          {valueLabel ? (
            <span
              className={[
                BOX_CARD_VALUE,
                isBusted ? BOX_CARD_VALUE_BUST : '',
              ].filter(Boolean).join(' ')}
            >
              {valueLabel}
            </span>
          ) : (
            <span className={`${BOX_CARD_VALUE} ${BOX_CARD_VALUE}--placeholder`} aria-hidden="true">
              &nbsp;
            </span>
          )}
          <span className="bj-phone-view__mini-hand-head">
            <span className="bj-phone-view__mini-hand-box">Box {slotNumber}</span>
            <span className="bj-phone-view__mini-hand-name">{callerDisplayName}</span>
          </span>
          <div
            className={[
              TABLE_UX.arcCards,
              cardIds.length === 0 ? `${TABLE_UX.arcCards}--empty` : '',
            ].filter(Boolean).join(' ')}
            aria-hidden={cardIds.length === 0}
          >
            {cardIds.length > 0 && visualDeck ? (
              <div className={TABLE_UX.cardsFan}>
                {cardIds.map((id) => renderCard(id, false, deviceView === 'mobile', id))}
              </div>
            ) : null}
          </div>
          <span
            className="bj-phone-view__mini-stake-slot"
            aria-hidden={!showStakeContent}
          >
            {displayChips.length > 0 ? (
              <StakeChips
                chips={displayChips}
                variant="bet"
                removable={inBetting && showBettingChips}
                onRemoveTopChip={() => removeLastChipFromBox(boxId)}
              />
            ) : inBetting ? (
              renderBetZone(boxId, slotNumber)
            ) : (
              <span className={TABLE_UX.stakeSlotReserved} aria-hidden="true">
                &nbsp;
              </span>
            )}
          </span>
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
      >
        <div
          className={[
            'bj-phone-view__mini-hand',
            'bj-phone-view__mini-hand--empty',
            isDrop ? 'bj-bet-zone--drop' : '',
          ].filter(Boolean).join(' ')}
          {...{
            [CHIP_DROP_SLOT_ATTR]: slotNumber,
            [CHIP_DROP_BOX_ATTR]: '',
          }}
          role="button"
          tabIndex={0}
          onClick={() => handleClaimOrSelectSlot(slotNumber)}
          onKeyDown={(e) => e.key === 'Enter' && handleClaimOrSelectSlot(slotNumber)}
          onDragOver={handleDragOver}
          onDragEnter={() => inBetting && setDropTargetId(dropKey)}
          onDragLeave={() => setDropTargetId(null)}
          onDrop={(e) => inBetting && handleSlotChipDrop(slotNumber, null, e)}
          aria-label={`Join box ${slotNumber}`}
        >
          <span className="bj-phone-view__mini-hand-box">Box {slotNumber}</span>
          <span className="bj-phone-view__mini-hand-name">Join</span>
        </div>
      </div>
    );
  }

  const focusBoxId =
    round?.status === 'player-turns' && activeBoxId
      ? activeBoxId
      : effectiveBoxId ?? defaultBlackjackSeatId(gameState);

  const dealerCardNodes =
    dealerCards.length > 0
      ? dealerCards.map((cardId, index) =>
          renderCard(
            cardId,
            showHoleHidden && index === 1,
            true,
            `dealer-${index}-${cardId}`,
          ),
        )
      : null;

  const thisTableInline = deviceView === 'desktop';

  function renderSideRailPanel(variant: 'dock' | 'below') {
    if (!sideRailPanel) {
      return null;
    }
    const title = sideRailPanel === 'thisTable' ? 'This Table' : 'Table Details';
    return (
      <div
        {...sxmSectionProps(
          SXM_LAYOUT.rightSidePanel,
          `${TABLE_UX.sideRailPlacement} bj-casino__this-table--${variant}`,
        )}
        data-panel-placement={variant}
        data-side-panel={sideRailPanel}
      >
        <TableSideRailShell title={title} onClose={() => setSideRailPanel(null)}>
          {sideRailPanel === 'thisTable' ? (
            <TableAccountsPanel
              gameState={gameState}
              showAssignButton={canAssignChips}
              onAssignChips={() => setAssignChipsOpen(true)}
              onInvite={onInviteTable}
              onSaveTable={onSaveTable}
              showPlayerOrderControls={tableOwner && bettingOpen}
              onMovePlayer={handleMovePlayer}
              onPlayFlowChange={handlePlayFlowChange}
              variant="inline"
            />
          ) : (
            <TableDetailsPanelContent {...tableDetailsProps} />
          )}
        </TableSideRailShell>
      </div>
    );
  }

  function renderTableHeader() {
    return (
      <header {...sxmSectionProps(SXM_LAYOUT.appHeader, TABLE_UX.tableHeader)}>
        <div className="bj-casino__toolbar">
          <div {...sxmSectionProps(SXM_LAYOUT.viewSwitcher, 'bj-casino__view-toggle')}>
            <button type="button" className={viewMode === 'full' ? 'bj-casino__view-btn--active' : 'bj-casino__view-btn'} onClick={() => setViewMode('full')}>Full Table</button>
            <button type="button" className={viewMode === 'card' ? 'bj-casino__view-btn--active' : 'bj-casino__view-btn'} onClick={() => setViewMode('card')}>Card View</button>
          </div>
          <h1 {...sxmSectionProps(SXM_LAYOUT.gameTitle, TABLE_UX.pageTitle)}>BLACKJACK</h1>
          <div {...sxmSectionProps(SXM_LAYOUT.userMenu, 'bj-casino__table-nav')}>
            <button
              type="button"
              className={
                sideRailPanel === 'thisTable'
                  ? 'bj-casino__nav-btn bj-casino__nav-btn--this-table bj-casino__nav-btn--active'
                  : 'bj-casino__nav-btn bj-casino__nav-btn--this-table'
              }
              onClick={() => {
                setActiveTablePanel(null);
                setSideRailPanel((current) => toggleSideRailPanel(current, 'thisTable'));
              }}
              aria-expanded={sideRailPanel === 'thisTable'}
            >
              This Table
            </button>
            <button
              type="button"
              className={activeTablePanel === 'playLedger' ? 'bj-casino__nav-btn--active' : 'bj-casino__nav-btn'}
              onClick={() => {
                setSideRailPanel(null);
                setActiveTablePanel('playLedger');
              }}
            >
              Play Ledger
            </button>
            <button
              type="button"
              className={activeTablePanel === 'settings' ? 'bj-casino__nav-btn--active' : 'bj-casino__nav-btn'}
              onClick={() => {
                setSideRailPanel(null);
                setActiveTablePanel('settings');
              }}
            >
              Settings
            </button>
          </div>
        </div>
        {viewMode === 'card' && (
          <div {...sxmSectionProps(SXM_LAYOUT.balanceDisplay)}>
            <TableInfoBar gameState={gameState} viewerPersonId={viewerPersonId} variant="header" />
          </div>
        )}
      </header>
    );
  }

  return (
    <div
      ref={layoutRootRef}
      {...sxmSectionProps(SXM_LAYOUT.layoutRoot, `bj-casino ${viewRootClass}`)}
      aria-label="Blackjack table"
      data-view-mode={viewMode}
      data-device-view={deviceView}
      data-phase={protocolPhase}
    >
      {tableMeta.showBankerSetup && tableMeta.agreement && (
        <BankerSetupPanel gameState={gameState} onConfirm={onGameStateChange} />
      )}

      {activeTablePanel === 'playLedger' && (
        <PlayLedgerModal
          open
          onClose={() => setActiveTablePanel(null)}
          gameState={gameState}
        />
      )}
      {activeTablePanel === 'settings' && (
        <BlackjackFlowSettingsMenu
          gameState={gameState}
          onGameStateChange={onGameStateChange}
          open
          onClose={() => setActiveTablePanel(null)}
        />
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
        onAssignOnline={
          onlineDispatch
            ? (params) => onlineDispatch('assignChips', params)
            : undefined
        }
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
      <div
        className={[
          deviceView === 'desktop' ? TABLE_UX.desktopStage : '',
          deviceView === 'desktop' && sideRailPanel
            ? 'bj-casino__desktop-stage--with-rail'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
      <div
        {...sxmSectionProps(
          SXM_LAYOUT.tableShell,
          'bj-casino__rail-wrap',
          deviceView === 'desktop' ? TABLE_UX.desktopTableShell : '',
        )}
      >
      {renderTableHeader()}
      <div className={`bj-casino__rail ${TABLE_UX.rail}`}>
          <div
            className={`bj-casino__felt ${TABLE_UX.surface}${viewMode === 'card' ? ' bj-casino__felt--card-view' : ''}`}
        >
          {viewMode === 'full' && (
            <>
              <div className="bj-casino__felt-main">
              <div className={`bj-table-zone ${TABLE_UX.tableZoneDealer}`}>
              <DealerBlock {...dealerBlockProps} dealerCards={dealerCardNodes} />
              </div>

              {renderSummaryZone()}

              <div
                {...sxmSectionProps(SXM_LAYOUT.heroZone, 'bj-table-zone__hero-reserved')}
                aria-hidden="true"
              />

              {renderActionsZone()}

              <div className={`bj-table-zone ${TABLE_UX.tableZonePlay}`}>
              <div className="bj-arc-separator" aria-hidden="true" />

              <div
                {...sxmSectionProps(SXM_LAYOUT.playerBoxesZone, 'bj-arc bj-arc--rtl')}
                style={{ '--slot-count': MAX_BOXES } as CSSProperties}
              >
                {displaySlots.map((slot) =>
                  slot.playerId ? renderArcSlot(slot.playerId, slot.slotNumber) : renderEmptySlot(slot.slotNumber),
                )}
              </div>
              </div>

              {renderBottomTrayZone()}
              </div>
            </>
          )}

          {viewMode === 'card' && (
            <BlackjackCardView
              dealer={<DealerBlock {...dealerBlockProps} dealerCards={dealerCardNodes} />}
              tray={renderTrayInner()}
              summaryExtras={renderCardViewSummaryExtras()}
              gameState={tableVisualState}
                  logicalGameState={gameState}
                  viewerPersonId={viewerPersonId}
                  onlineTableId={onlineTableId}
                  viewerAuth={viewerAuth}
                  deviceView={deviceView}
                  focusBoxId={focusBoxId ?? undefined}
                  activeBoxId={activeBoxId}
                  showHoleHidden={showHoleHidden}
                  protocolPhase={protocolPhase}
                  cardRevealComplete={cardRevealComplete}
                  bettingOpen={bettingOpen}
                  gameEnded={gameEnded}
                  onSelectBox={selectBox}
                  onClaimSlot={handleClaimOrSelectSlot}
                  onReleaseSlot={handleReleaseSlot}
                  onAddChip={addChipToBox}
                  onClearStake={clearBoxStakeOnBox}
                  onRemoveLastChip={removeLastChipFromBox}
                  onSlotChipDrop={handleSlotChipDrop}
                  dropTargetId={dropTargetId}
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
          )}
        </div>
        </div>
        {!thisTableInline && renderSideRailPanel('below')}
      </div>
      {thisTableInline && sideRailPanel && renderSideRailPanel('dock')}
      </div>
      )}
    </div>
  );
}
