import { useRef, useState, useEffect, useMemo, type CSSProperties } from 'react';
import type { GameState, TableViewMode } from '../types';
import { resolveShowRoundSummaryOverlay } from '../types/table';
import { feltSkinModifierClass, resolveTableClothName, resolveTableClothWager, resolveTableFeltSkin } from '../types/tableFeltSkin';
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
import { dealSpeedDisplayLabel, DEAL_SPEED_CYCLE } from './DealerBlock';
import { BlackjackActionPanel } from './BlackjackActionPanel';
import { BlackjackCommandBox } from './BlackjackCommandBox';
import { BlackjackDealerArea } from './BlackjackDealerArea';
import { BlackjackTableLayoutShell } from './BlackjackTableLayoutShell';
import { BlackjackFeltClothLayer } from './BlackjackFeltClothLayer';
import { Magic8Ball } from './magic8/Magic8Ball';
import { buildBlackjackPlayerBoxInfo } from './blackjackPlayerBoxInfo';
import { BlackjackPlayerBoxHead } from './BlackjackPlayerBoxes';
import { LocalProfileSetup } from './LocalProfileSetup';
import { PlayLedgerModal, PlayLedgerPanel } from './LedgerModals';
import { TableSideRailShell } from './TableSideRailShell';
import {
  applyDefaultAssignedChipTarget,
  createEmptyLocalChipTarget,
  localChipTargetsEqual,
  reconcileLocalChipTarget,
  resolveTrayTargetFromLocalSelection,
  selectLocalChipTarget,
  uiFromLocalChipTarget,
  type LocalSelectedChipTarget,
} from './localChipTargetSelection';
import { bindTapSelect, createTapSelectHandler } from './tapSelect';
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
import { buildRoundSummaryOverlayModel } from '../engine/blackjack/roundSummaryOverlay';
import { buildBlackjackCommandText } from './tableCommandDisplay';
import { RoundSummaryOverlay } from './RoundSummaryOverlay';
import {
  formatPlaceBetError,
  getChipPlacementTarget,
  getChipPlacementTargetFromBoxId,
  placeBetPayloadFromTarget,
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
  getInsuranceActionsForController,
  getActiveTurnBoxId,
  isPlayerTurnPhase,
} from './blackjackViewPhase';
import { getDisplayedHandValue, getVisibleHandCardIds } from '../engine/blackjack/dealing/cardRevealDisplay';
import {
  BET_BOX_PULSE,
  BOX_CARD_VALUE,
  BOX_CARD_VALUE_BUST,
  getBoxActivePulseClassName,
  getBoxCardVisualClasses,
  resolveBoxBorderVisualState,
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
import { MOBILE_LAYOUT_MEDIA } from '../styles/mobileLayoutContract';
import type { TableResetSetupVariant } from './TableStakePanel';
import './BlackjackPanel.css';

function initialSideRailPanel(): SideRailPanel {
  if (typeof window === 'undefined') {
    return 'thisTable';
  }
  return window.matchMedia(MOBILE_LAYOUT_MEDIA).matches ? null : 'thisTable';
}

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
  const [sideRailPanel, setSideRailPanel] = useState<SideRailPanel>(initialSideRailPanel);
  const [mobileSidePanelTab, setMobileSidePanelTab] = useState<'thisTable' | 'playLedger' | 'settings'>(
    'thisTable',
  );
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
  const [magic8Answer, setMagic8Answer] = useState<string | null>(null);
  const [roundSummaryDismissed, setRoundSummaryDismissed] = useState(false);
  /** Single local chip target — tray pulse and placement both read from here. */
  const [localChipSelection, setLocalChipSelection] = useState<LocalSelectedChipTarget>(() =>
    createEmptyLocalChipTarget(),
  );
  const localSelectedChipTargetRef = useRef(localChipSelection);
  localSelectedChipTargetRef.current = localChipSelection;
  const tapSelectRef = useRef(createTapSelectHandler());
  const SHUFFLE_ANIM_DURATION_MS = 3000;
  const [shuffleAnimating, setShuffleAnimating] = useState(false);
  const shuffleAnimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const profile = loadProfile();
  const controllerName = profile.name.trim() || tableMeta.controllerName;
  const viewerHints = buildViewerIdentityHints(gameState, onlineTableId, viewerAuth);
  const viewerPersonId = resolveViewerPersonIdForTable(gameState, onlineTableId, viewerAuth);
  const tableOwner = isTableOwner(gameState, controllerName);
  const canDriveTableAutomation =
    tableOwner || controllerName === tableMeta.controllerName;

  const isMobileViewport = useIsMobileViewport();
  const { displayState: tableVisualState, isRevealing, activeHandRevealComplete } =
    useSequentialCardReveal(gameState, {
    onlineMode: Boolean(onlineDispatch) || isOnlineModeEnabled(),
  });
  const cardRevealComplete = !isRevealing;

  const {
    centerStatus,
    flowError,
    bettingOpen,
    canDeal,
    dealActionPending,
    nextRoundPending,
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
  const { selectedBettingBoxId: selectedBettingBoxIdForUi, selectedBettingSlotNumber } =
    uiFromLocalChipTarget(localChipSelection.target);
  const focusFallbackBoxId = defaultBlackjackSeatId(gameState);
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

  const magic8ShakeAllowed =
    !gameEnded &&
    isPlayerTurnPhase(protocolPhase) &&
    resolveViewerActionPermission(gameState, viewerPersonId).canAct;

  useEffect(() => {
    if (gameState.tableMeta.gameStatus === 'ended') {
      setPersonalLedgerAdded(hasPersonalLedgerEntryForTable(gameState.session.id));
    }
  }, [gameState.tableMeta.gameStatus, gameState.session.id]);

  useEffect(() => {
    const local = localSelectedChipTargetRef.current;
    if (local.hasUserSelected) {
      return;
    }
    const next = applyDefaultAssignedChipTarget(local, gameStateRef.current, viewerPersonId);
    if (!localChipTargetsEqual(local, next)) {
      commitLocalChipTarget(next);
    }
  }, [viewerPersonId, gameState.tableMeta.boxSlots, gameState.session.id]);

  useEffect(() => {
    const next = reconcileLocalChipTarget(
      localSelectedChipTargetRef.current,
      gameState,
      Boolean(onlineDispatch),
    );
    if (!localChipTargetsEqual(localSelectedChipTargetRef.current, next)) {
      commitLocalChipTarget(next);
    }
  }, [gameState.tableMeta.boxSlots, gameState.tableMeta.boxStakes, gameState.session.boxSlotNumbers, onlineDispatch, gameState.session.id]);

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

  useEffect(() => {
    return () => {
      if (shuffleAnimTimerRef.current) {
        clearTimeout(shuffleAnimTimerRef.current);
      }
    };
  }, []);

  const playingFor = getTableWagerDisplay(gameState);
  const displaySlots = [...tableMeta.boxSlots].sort((a, b) => b.slotNumber - a.slotNumber);
  const bankerReady = isBankerReady(gameState);
  // Personal (score) ledger is human-vs-human only — never for a Bot Bank game.
  const showPersonalLedgerOffer = gameEnded && !isBotBankGame(gameState);
  // Consolidated end-of-round summary, shown once (in the dealer block, above
  // the Next Round button). Per-box result chips are intentionally not repeated.
  const roundSummaryLines = useMemo(
    () => (awaitingNextRound && !gameEnded ? buildRoundResultSummary(gameState) : []),
    [awaitingNextRound, gameEnded, gameState],
  );
  const roundSummaryOverlayModel = useMemo(
    () => (awaitingNextRound && !gameEnded ? buildRoundSummaryOverlayModel(gameState) : null),
    [awaitingNextRound, gameEnded, gameState],
  );
  const showRoundSummaryOverlay =
    Boolean(roundSummaryOverlayModel) &&
    resolveShowRoundSummaryOverlay(tableMeta) &&
    !roundSummaryDismissed;
  const tableCommand = useMemo(
    () =>
      buildBlackjackCommandText({
        gameState,
        gameEnded,
        gameOverMessage,
        centerStatus,
        protocolPhase,
        roundSummaryLines,
        controllerName,
        viewerPersonId,
        viewerHints,
      }),
    [
      gameState,
      gameEnded,
      gameOverMessage,
      centerStatus,
      protocolPhase,
      roundSummaryLines,
      controllerName,
      viewerPersonId,
      viewerHints,
    ],
  );

  useEffect(() => {
    if (!awaitingNextRound) {
      setRoundSummaryDismissed(false);
    }
  }, [awaitingNextRound]);

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
      if (onlineActionInFlight) {
        return;
      }
      void onlineDispatch(online.type, online.payload ?? {}).catch((err) => {
        const msg = err instanceof Error ? err.message : 'Action failed';
        if (msg === 'Action already in progress') {
          return;
        }
        setError(msg);
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

  function commitLocalChipTarget(next: LocalSelectedChipTarget) {
    localSelectedChipTargetRef.current = next;
    setLocalChipSelection(next);
  }

  function selectLocalTarget(target: PlaceBetTarget) {
    commitLocalChipTarget(selectLocalChipTarget(localSelectedChipTargetRef.current, target));
  }

  function preserveLocalChipTargetAfterStateSync() {
    const next = reconcileLocalChipTarget(
      localSelectedChipTargetRef.current,
      gameStateRef.current,
      Boolean(onlineDispatch),
    );
    commitLocalChipTarget(next);
  }

  function resolveActiveChipTrayTarget(): PlaceBetTarget | null {
    return resolveTrayTargetFromLocalSelection(
      localSelectedChipTargetRef.current,
      gameStateRef.current,
      Boolean(onlineDispatch),
      viewerPersonId,
    );
  }

  function applyOptimisticChipPlacement(target: PlaceBetTarget, amount: ChipValue): GameState {
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
      return addChipToBoxStake(state, boxId, amount, personId ?? undefined);
    }
    const personId = resolveControllerPersonId(state, controllerName);
    return addChipToBoxStake(state, target.boxId, amount, personId ?? undefined);
  }

  function placeBetAtTarget(target: PlaceBetTarget, amount: ChipValue) {
    const payload = placeBetPayloadFromTarget(target, amount);

    if (onlineDispatch) {
      setError(null);
      const snapshot = gameStateRef.current;
      try {
        const optimistic = applyOptimisticChipPlacement(target, amount);
        onGameStateChange(optimistic);
        preserveLocalChipTargetAfterStateSync();
      } catch (err) {
        setError(formatPlaceBetError(err));
        return;
      }
      void onlineDispatch('placeBet', payload).catch((err) => {
        onGameStateChange(snapshot);
        preserveLocalChipTargetAfterStateSync();
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
        preserveLocalChipTargetAfterStateSync();
        return;
      }
      const personId = resolveControllerPersonId(state, controllerName);
      onGameStateChange(
        addChipToBoxStake(state, target.boxId, amount, personId ?? undefined),
      );
      preserveLocalChipTargetAfterStateSync();
    } catch (err) {
      setError(formatPlaceBetError(err));
    }
  }

  function selectBox(boxId: string) {
    try {
      selectLocalTarget(
        getChipPlacementTargetFromBoxId(
          gameStateRef.current,
          boxId,
          Boolean(onlineDispatch),
        ),
      );
    } catch {
      const slotNum = gameStateRef.current.session.boxSlotNumbers?.[boxId];
      if (slotNum != null) {
        selectLocalTarget(getChipPlacementTarget(gameStateRef.current, { slotNumber: slotNum }));
      }
    }
  }

  function bindBoxTapSelect(action: () => void) {
    return bindTapSelect(tapSelectRef.current, action);
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

    selectLocalTarget({ kind: 'slot', slotNumber });
  }

  function handleReleaseSlot(slotNumber: number) {
    run((state) => releaseBoxSlot(state, slotNumber));
  }

  function handleChipTrayClick(value: ChipValue) {
    const target = resolveActiveChipTrayTarget();
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
  const activeBoxStakeMessage = selectedBettingBoxIdForUi
    ? getStakeBetValidationMessage(gameState, selectedBettingBoxIdForUi)
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

  function renderTableNav(className = 'bj-casino__table-nav') {
    const isMobile = deviceView === 'mobile';
    return (
      <div {...sxmSectionProps(SXM_LAYOUT.userMenu, className)}>
        <button
          type="button"
          className={
            sideRailPanel === 'thisTable'
              ? 'bj-casino__nav-btn bj-casino__nav-btn--this-table bj-casino__nav-btn--active'
              : 'bj-casino__nav-btn bj-casino__nav-btn--this-table'
          }
          onClick={() => {
            setActiveTablePanel(null);
            if (isMobile) {
              setMobileSidePanelTab('thisTable');
            }
            setSideRailPanel((current) => toggleSideRailPanel(current, 'thisTable'));
          }}
          aria-expanded={sideRailPanel === 'thisTable'}
        >
          This Table
        </button>
        {!isMobile && (
          <>
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
          </>
        )}
      </div>
    );
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

  function handleShuffleWithAnimation() {
    setShuffleAnimating(true);
    if (shuffleAnimTimerRef.current) {
      clearTimeout(shuffleAnimTimerRef.current);
    }
    shuffleAnimTimerRef.current = setTimeout(() => {
      setShuffleAnimating(false);
      shuffleAnimTimerRef.current = null;
    }, SHUFFLE_ANIM_DURATION_MS);
    handleShuffleToStart();
  }

  const dealerBlockProps = {
    awaitingNextRound,
    gameEnded,
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
    onShuffleToStart: handleShuffleWithAnimation,
    shuffleAnimating,
    onDealCards: handleDealCards,
    onDealNextCard: handleDealNextCard,
    onDrawBank: handleDrawBank,
    dealActionPending,
    nextRoundPending,
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

  function renderSummaryContent() {
    const alert = renderTableAlert();
    return (
      <>
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
      </>
    );
  }

  function renderActionsContent() {
    const insurance = renderInsuranceActions();
    const playerActions = renderTablePlayerActions();
    const content = insurance ?? playerActions;
    const hasPrimarySecondary = Boolean(playerActions);
    if (content) {
      return content;
    }
    return (
      <>
        <div className={TABLE_UX.actionsPlaceholder} aria-hidden="true" />
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
          TABLE_UX.boxInteractive,
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
        {...bindBoxTapSelect(() => selectBox(boxId))}
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

    if (!canShowPlayerDecisionControls(gameState, protocolPhase, {
      cardRevealComplete,
      activeHandRevealComplete,
    })) {
      return null;
    }

    if (!round) {
      return null;
    }
    const activeRound: NonNullable<typeof round> = round;
    if (!activeRound.activeHandKey) {
      return null;
    }

    const actionPermission = resolveViewerActionPermission(gameState, viewerPersonId);
    if (!actionPermission.canAct) {
      return null;
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
      <BlackjackActionPanel
        variant="table"
        actionsEnabled
        canHit={canHit}
        canStand={canStand}
        canDouble={canDouble}
        canSplit={canSplit}
        showDouble={blackjackSettings.allowDoubleDown}
        showSplit={blackjackSettings.allowSplit && Boolean(deck)}
        showAid={flowSettings.adviceEnabled}
        onStand={() =>
          run((s) => standBlackjackOnState(s, actionable.handKey), { type: 'stand', payload: {} })
        }
        onHit={() =>
          run((s) => hitBlackjackOnState(s, actionable.handKey), { type: 'hit', payload: {} })
        }
        onDouble={() =>
          run((s) => doubleDownBlackjackOnState(s, actionable.handKey), {
            type: 'double',
            payload: {},
          })
        }
        onSplit={() =>
          run((s) => splitBlackjackOnState(s, actionable.handKey), { type: 'split', payload: {} })
        }
        onAid={handleTableAid}
      />
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


  function arcSlotRotation(slotNumber: number): number {
    const visualIdx = arcVisualIndex(slotNumber);
    return ARC_ROTATIONS[visualIdx] ?? 0;
  }

  function renderArcCardStack(cardIds: string[]) {
    if (cardIds.length === 0 || !visualDeck) {
      return null;
    }
    return (
      <div className="bj-arc__play-zone">
        <div
          className={[
            TABLE_UX.arcCards,
            TABLE_UX.arcCardsStackVertical,
          ].join(' ')}
        >
          <div
            className={TABLE_UX.arcCardsStack}
            data-bj-card-count={Math.min(cardIds.length, 6)}
          >
            {cardIds.map((id) => renderCard(id, false, deviceView === 'mobile', id))}
          </div>
        </div>
      </div>
    );
  }

  function renderArcCardColumn(boxId: string, slotNumber: number) {
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
    const rotation = arcSlotRotation(slotNumber);
    return (
      <div
        key={`cards-${boxId}`}
        className="bj-arc__slot bj-arc__slot--card-column"
        style={{ '--arc-rot': `${rotation}deg` } as CSSProperties}
      >
        {renderArcCardStack(cardIds)}
      </div>
    );
  }

  function renderEmptyCardColumn(slotNumber: number) {
    const rotation = arcSlotRotation(slotNumber);
    return (
      <div
        key={`cards-empty-${slotNumber}`}
        className="bj-arc__slot bj-arc__slot--card-column bj-arc__slot--card-empty"
        style={{ '--arc-rot': `${rotation}deg` } as CSSProperties}
        aria-hidden="true"
      />
    );
  }

  function renderArcBoxSlot(boxId: string, slotNumber: number) {
    const openStake = getStakeForBox(gameState, boxId);
    const isJoinAssigned = isJoinAssignedHighlight(gameState, slotNumber, protocolPhase);
    const borderState = resolveBoxBorderVisualState({
      state: gameState,
      boxPlayerId: boxId,
      viewerPersonId,
      openStake,
      selectedBettingBoxId: selectedBettingBoxIdForUi,
      selectedBettingSlotNumber,
      activeBoxId,
      isDropHover: dropTargetId === chipDropKey({ slotNumber, boxId }),
      bettingStage: inBetting,
      playerPhase: isPlayerTurnPhase(protocolPhase),
    });
    const isTurn = borderState.isTurn;
    const boxInfo = buildBlackjackPlayerBoxInfo(gameState, slotNumber, boxId);
    let handKeys = handKeysByBox.get(boxId) ?? [];
    if (handKeys.length === 0 && visualRound) {
      const primaryKey = blackjackHandKey(boxId, 0);
      const hand = visualRound.playerHands[primaryKey];
      if (hand && (hand.currentBet > 0 || hand.cardIds.some(Boolean))) {
        handKeys = [primaryKey];
      }
    }
    const primaryHandKey = handKeys[0];
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
    const rotation = arcSlotRotation(slotNumber);

    return (
      <div
        key={`box-${boxId}`}
        className={[
          'bj-arc__slot',
          'bj-arc__slot--owned',
          TABLE_UX.boxHitZone,
          isJoinAssigned ? 'bj-arc__slot--join-highlight' : '',
          isTurn ? 'bj-arc__slot--turn' : '',
        ].filter(Boolean).join(' ')}
        style={{ '--arc-rot': `${rotation}deg` } as CSSProperties}
      >
        <button
          type="button"
          className={TABLE_UX.boxHitArea}
          {...bindBoxTapSelect(() => selectBox(boxId))}
          aria-label={`Box ${slotNumber}${wager > 0 ? `, ${wager}c staked` : ''}`}
          aria-current={borderState.isSelected || isTurn ? 'true' : undefined}
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
        />
        <div
          {...sxmSectionProps(
            SXM_LAYOUT.playerBox,
            getBoxCardVisualClasses(borderState),
            TABLE_UX.fullArcBox,
            getBoxActivePulseClassName(borderState),
            showBettingChips ? 'bj-phone-view__mini-hand--has-stake' : '',
          )}
          {...{
            [CHIP_DROP_SLOT_ATTR]: slotNumber,
            [CHIP_DROP_BOX_ATTR]: boxId,
          }}
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
          <BlackjackPlayerBoxHead
            boxLabel={boxInfo.boxLabel}
            callerDisplayName={boxInfo.callerDisplayName}
          />
          <span
            className={['bj-phone-view__mini-stake-slot', TABLE_UX.boxInteractive]
              .filter(Boolean)
              .join(' ')}
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

  function renderEmptyBoxSlot(slotNumber: number) {
    const visualIdx = arcVisualIndex(slotNumber);
    const rotation = ARC_ROTATIONS[visualIdx] ?? 0;
    const dropKey = `slot-${slotNumber}`;
    const isDrop = dropTargetId === dropKey;
    const isSelected = inBetting && selectedBettingSlotNumber === slotNumber;
    return (
      <div
        key={`empty-${slotNumber}`}
        className={[
          'bj-arc__slot',
          'bj-arc__slot--empty',
          TABLE_UX.boxHitZone,
          isDrop ? 'bj-arc__slot--drop' : '',
        ].filter(Boolean).join(' ')}
        style={{ '--arc-rot': `${rotation}deg` } as CSSProperties}
        {...{
          [CHIP_DROP_SLOT_ATTR]: slotNumber,
          [CHIP_DROP_BOX_ATTR]: '',
        }}
      >
        <button
          type="button"
          className={TABLE_UX.boxHitArea}
          {...bindBoxTapSelect(() => handleClaimOrSelectSlot(slotNumber))}
          aria-label={`Join box ${slotNumber}`}
          aria-current={isSelected ? 'true' : undefined}
          onDragOver={handleDragOver}
          onDragEnter={() => inBetting && setDropTargetId(dropKey)}
          onDragLeave={() => setDropTargetId(null)}
          onDrop={(e) => inBetting && handleSlotChipDrop(slotNumber, null, e)}
        />
        <div
          className={[
            'bj-phone-view__mini-hand',
            'bj-phone-view__mini-hand--empty',
            isSelected ? BET_BOX_PULSE : '',
            isDrop ? 'bj-bet-zone--drop' : '',
          ].filter(Boolean).join(' ')}
        >
          <span className="bj-phone-view__mini-hand-box">Box {slotNumber}</span>
          <span className="bj-phone-view__mini-hand-name">Join</span>
        </div>
      </div>
    );
  }

  function renderPlayerBoxesArc() {
    return (
      <div
        className="bj-arc bj-arc--rtl bj-arc--player-boxes"
        style={{ '--slot-count': MAX_BOXES } as CSSProperties}
      >
        {displaySlots.map((slot) =>
          slot.playerId
            ? renderArcBoxSlot(slot.playerId, slot.slotNumber)
            : renderEmptyBoxSlot(slot.slotNumber),
        )}
      </div>
    );
  }

  const materializedSlotBoxId =
    selectedBettingSlotNumber != null
      ? gameState.tableMeta.boxSlots.find((s) => s.slotNumber === selectedBettingSlotNumber)
          ?.playerId ?? null
      : null;
  const localBettingFocusBoxId = selectedBettingBoxIdForUi ?? materializedSlotBoxId;

  const focusBoxId =
    round?.status === 'player-turns' && activeBoxId
      ? activeBoxId
      : bettingOpen && (selectedBettingBoxIdForUi != null || selectedBettingSlotNumber != null)
        ? localBettingFocusBoxId
        : selectedBettingBoxIdForUi ?? focusFallbackBoxId;

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

  function renderMobileSidePanelTabs() {
    return (
      <div className="bj-casino__mobile-panel-tabs" role="tablist" aria-label="Table panels">
        <button
          type="button"
          role="tab"
          aria-selected={mobileSidePanelTab === 'thisTable'}
          className={
            mobileSidePanelTab === 'thisTable'
              ? 'bj-casino__mobile-panel-tab bj-casino__mobile-panel-tab--active'
              : 'bj-casino__mobile-panel-tab'
          }
          onClick={() => setMobileSidePanelTab('thisTable')}
        >
          This Table
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileSidePanelTab === 'playLedger'}
          className={
            mobileSidePanelTab === 'playLedger'
              ? 'bj-casino__mobile-panel-tab bj-casino__mobile-panel-tab--active'
              : 'bj-casino__mobile-panel-tab'
          }
          onClick={() => setMobileSidePanelTab('playLedger')}
        >
          Play Ledger
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileSidePanelTab === 'settings'}
          className={
            mobileSidePanelTab === 'settings'
              ? 'bj-casino__mobile-panel-tab bj-casino__mobile-panel-tab--active'
              : 'bj-casino__mobile-panel-tab'
          }
          onClick={() => setMobileSidePanelTab('settings')}
        >
          Settings
        </button>
      </div>
    );
  }

  function renderMobileSidePanelBody() {
    if (sideRailPanel === 'tableDetails') {
      return <TableDetailsPanelContent {...tableDetailsProps} />;
    }
    switch (mobileSidePanelTab) {
      case 'playLedger':
        return <PlayLedgerPanel gameState={gameState} />;
      case 'settings':
        return (
          <BlackjackFlowSettingsMenu
            embedded
            gameState={gameState}
            onGameStateChange={onGameStateChange}
            open
            onClose={() => setMobileSidePanelTab('thisTable')}
          />
        );
      default:
        return (
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
        );
    }
  }

  function renderSideRailPanel(variant: 'dock' | 'overlay') {
    if (!sideRailPanel) {
      return null;
    }
    const isOverlay = variant === 'overlay';
    const title =
      sideRailPanel === 'tableDetails'
        ? 'Table Details'
        : mobileSidePanelTab === 'playLedger'
          ? 'Play Ledger'
          : mobileSidePanelTab === 'settings'
            ? 'Settings'
            : 'This Table';
    const panelContent = isOverlay ? (
      renderMobileSidePanelBody()
    ) : sideRailPanel === 'thisTable' ? (
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
    );

    const shell = (
      <div
        {...sxmSectionProps(
          SXM_LAYOUT.rightSidePanel,
          `${TABLE_UX.sideRailPlacement} ${isOverlay ? 'bj-casino__this-table--overlay' : TABLE_UX.sideRailDock}`,
        )}
        data-panel-placement={variant}
        data-side-panel={sideRailPanel}
      >
        {isOverlay && sideRailPanel === 'thisTable' && renderMobileSidePanelTabs()}
        <TableSideRailShell title={title} onClose={() => setSideRailPanel(null)}>
          {panelContent}
        </TableSideRailShell>
      </div>
    );

    if (isOverlay) {
      return (
        <div
          className={TABLE_UX.mobileSidePanelOverlay}
          role="presentation"
          onClick={() => setSideRailPanel(null)}
        >
          <div
            className={TABLE_UX.mobileSidePanelSheet}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
          >
            {shell}
          </div>
        </div>
      );
    }
    return shell;
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
          {renderTableNav()}
        </div>
        <div {...sxmSectionProps(SXM_LAYOUT.balanceDisplay, 'bj-casino__header-bank')}>
          <TableInfoBar gameState={gameState} viewerPersonId={viewerPersonId} variant="header" />
        </div>
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

      {activeTablePanel === 'playLedger' && deviceView !== 'mobile' && (
        <PlayLedgerModal
          open
          onClose={() => setActiveTablePanel(null)}
          gameState={gameState}
        />
      )}
      {activeTablePanel === 'settings' && deviceView !== 'mobile' && (
        <BlackjackFlowSettingsMenu
          gameState={gameState}
          onGameStateChange={onGameStateChange}
          open
          onClose={() => setActiveTablePanel(null)}
        />
      )}

      {showRoundSummaryOverlay && roundSummaryOverlayModel && (
        <RoundSummaryOverlay
          open
          model={roundSummaryOverlayModel}
          deck={deck}
          pending={nextRoundPending}
          onPlayOn={() => {
            setRoundSummaryDismissed(true);
            handleNextRound();
          }}
          onClose={() => setRoundSummaryDismissed(true)}
          onDontShowAgain={() => {
            onGameStateChange({
              ...gameState,
              tableMeta: {
                ...gameState.tableMeta,
                showRoundSummaryOverlay: false,
              },
            });
            setRoundSummaryDismissed(true);
          }}
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
          deviceView === 'desktop' ? TABLE_UX.desktopTableShell : TABLE_UX.mobileTableShell,
        )}
      >
      {renderTableHeader()}
      <div className={`bj-casino__rail ${TABLE_UX.rail}`}>
          <div
            className={`bj-casino__felt ${TABLE_UX.surface}${viewMode === 'card' ? ' bj-casino__felt--card-view' : ''} ${feltSkinModifierClass(resolveTableFeltSkin(tableMeta))}`}
        >
          <Magic8Ball
            variant="table"
            compact
            controlOnly
            canShake={magic8ShakeAllowed}
            answer={magic8Answer}
            onAnswer={setMagic8Answer}
          />
          <BlackjackTableLayoutShell
            feltClothLayer={
              resolveTableFeltSkin(tableMeta) === 'classic-casino' ? (
                <BlackjackFeltClothLayer
                  tableName={resolveTableClothName(tableMeta)}
                  wagerText={resolveTableClothWager(tableMeta)}
                />
              ) : null
            }
            dealer={
              <BlackjackDealerArea
                {...dealerBlockProps}
                dealerCards={dealerCardNodes}
                omitCommand
              />
            }
            command={
              <BlackjackCommandBox
                commandMessage={tableCommand.commandMessage}
                commandLines={tableCommand.commandLines}
                gameEnded={gameEnded}
              />
            }
            summaryExtras={renderSummaryContent()}
            actions={renderActionsContent()}
            cardsArea={
              viewMode === 'full' ? (
                <div
                  className="bj-arc bj-arc--cards bj-arc--rtl"
                  style={{ '--slot-count': MAX_BOXES } as CSSProperties}
                >
                  {displaySlots.map((slot) =>
                    slot.playerId
                      ? renderArcCardColumn(slot.playerId, slot.slotNumber)
                      : renderEmptyCardColumn(slot.slotNumber),
                  )}
                </div>
              ) : (
                <BlackjackCardView
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
                  activeHandRevealComplete={activeHandRevealComplete}
                  bettingOpen={bettingOpen}
                  gameEnded={gameEnded}
                  onStay={(hk) =>
                    run((s) => standBlackjackOnState(s, hk), { type: 'stand', payload: {} })
                  }
                  onCard={(hk) => run((s) => hitBlackjackOnState(s, hk), { type: 'hit', payload: {} })}
                  onBack={() => setViewMode('full')}
                />
              )
            }
            cardsAreaMode={viewMode === 'full' ? 'table' : 'hero'}
            playerBoxes={renderPlayerBoxesArc()}
            chipTray={renderTrayInner()}
          />
        </div>
        </div>
      </div>
      {deviceView === 'mobile' && sideRailPanel && renderSideRailPanel('overlay')}
      {thisTableInline && sideRailPanel && renderSideRailPanel('dock')}
      </div>
      )}
    </div>
  );
}
