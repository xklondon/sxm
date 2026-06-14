import { useRef, useState, useEffect, useMemo, type CSSProperties } from 'react';
import type { GameState, TableViewMode } from '../types';
import { resolveShowRoundSummaryOverlay } from '../types/table';
import { feltSkinModifierClass, resolveTableClothName, resolveTableClothWager, resolveTableFeltSkin, resolveTableTrayLabel } from '../types/tableFeltSkin';
import {
  claimBoxSlot,
  defaultBlackjackSeatId,
  isBankerReady,
  movePlayerInOrder,
  resolveControllerPersonId,
  canControllerCallBox,
} from '../engine/session';
import { isJoinAssignedHighlight } from '../engine/session/inviteJoin';
import {
  blackjackHandKey,
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
  removeLastChipFromBoxStake,
  getStakeForBox,
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
import { StakeChips, ValueAndChipsBar, type ChipValue } from './ChipStack';
import { PlayingCard } from './PlayingCard';
import { formatBoxCardRanksLabel } from './cardDisplay';
import { useBlackjackTableFlow } from './useBlackjackTableFlow';
import { BlackjackFlowSettingsMenu } from './BlackjackFlowSettings';
import { BlackjackCardView } from './BlackjackCardView';
import { BankerSetupPanel } from './BankerSetupPanel';
import { dealSpeedDisplayLabel, DEAL_SPEED_CYCLE } from './DealerBlock';
import { BlackjackActionPanel } from './BlackjackActionPanel';
import { BlackjackCommandBox } from './BlackjackCommandBox';
import { BlackjackDealerArea } from './BlackjackDealerArea';
import { BlackjackTableLayoutShell } from './BlackjackTableLayoutShell';
import { isBlackjackLayoutDebugEnabled, logLayoutDebugChipTarget } from './blackjackLayoutDebug';
import { BlackjackLayoutDebugPanel } from './BlackjackLayoutDebugPanel';
import { BlackjackFeltClothLayer } from './BlackjackFeltClothLayer';
import { Magic8Ball } from './magic8/Magic8Ball';
import { buildBlackjackPlayerBoxInfo } from './blackjackPlayerBoxInfo';
import { BlackjackPlayerBoxHead } from './BlackjackPlayerBoxes';
import { LocalProfileSetup } from './LocalProfileSetup';
import { PlayLedgerModal, PlayLedgerPanel } from './LedgerModals';
import { TableSideRailShell } from './TableSideRailShell';
import {
  affirmChipTargetAfterPlacement,
  applyDefaultAssignedChipTarget,
  createEmptyLocalChipTarget,
  getCurrentChipTargetForBetting,
  localChipTargetsEqual,
  logChipBetDiagnostic,
  logChipTargetResolution,
  reconcileLocalChipTarget,
  selectLocalChipTarget,
  uiFromLocalChipTarget,
  type LocalSelectedChipTarget,
} from './localChipTargetSelection';
import {
  mergeStakeChipsForSlotDisplay,
  resolveOccupantBoxIdForSlot,
  resolvePlaceBetPayloadTarget,
  slotArcReactKey,
} from './blackjackBoxPlacementContract';
import { InsuranceDecisionOverlay } from './InsuranceDecisionOverlay';
import { bindTapSelect, createTapSelectHandler } from './tapSelect';
import { toggleSideRailPanel, type SideRailPanel } from './sideRailPanel';
import { TABLE_UX } from './tableUxContract';
import { TableInfoBar } from './TableInfoBar';
import { buildTableInfoDisplay } from './tableInfoDisplay';
import { AssignChipsModal } from './AssignChipsModal';
import { ChangeMinBetModal } from './ChangeMinBetModal';
import { TableAccountsPanel } from './TableAccountsPanel';
import {
  takeInsuranceForPersonOnState,
  declineInsuranceForPersonOnState,
  takeEvenMoneyOnState,
  waitForBlackjackPayoutOnState,
  getStakeBetValidationMessage,
} from '../engine/blackjack';
import { isTableOwner } from '../engine/session';
import { canCurrentUserDealTable } from '../engine/session/tableDealPermission';
import { getTableWagerDisplay } from '../engine/session/wagerDisplay';
import {
  addGameToPersonalLedger,
  canAddGameToPersonalLedger,
  hasPersonalLedgerEntryForTable,
} from '../engine/scoreLedger/scoreLedger';
import {
  buildIouHandoffCreateRequest,
  canOfferGameEndIou,
  getGameEndIouDisabledReason,
} from '../engine/scoreLedger/gameEndIou';
import { createIouHandoff } from '../api/iouHandoff';
import { iouHandoffStorageKey } from '../lib/iouHandoffPayload';
import type { GameOverIouFeedback } from './GameOverActionOverlay';
import { buildRoundResultSummary } from '../engine/blackjack';
import { buildRoundSummaryOverlayModel } from '../engine/blackjack/roundSummaryOverlay';
import { buildBlackjackCommandText } from './tableCommandDisplay';
import { useHandTransitionHold } from './useHandTransitionHold';
import { OptionalPlayDecisionOverlay } from './OptionalPlayDecisionOverlay';
import { RoundSummaryOverlay } from './RoundSummaryOverlay';
import {
  MOBILE_GAME_OVER_OVERLAY_DELAY_MS,
  ROUND_SUMMARY_OVERLAY_DELAY_MS,
} from './roundSummaryOverlayTiming';
import {
  formatPlaceBetError,
  placeBetPayloadFromTarget,
} from '../engine/blackjack/chipPlacement';
import {
  canUserAssignChips,
  canUserChangeProtocol,
  canUserResetTable,
} from '../engine/table/adminControls';
import {
  getDisplayedHandValue,
  getVisibleDealerCardIds,
  getVisibleHandCardIds,
} from './blackjackDealingContract';
import {
  getBlackjackProtocolForState,
  getBlackjackProtocolOrDefault,
  listBlackjackProtocolPresets,
  setBlackjackProtocolOnState,
  updateBlackjackFlowSettings,
} from '../engine/blackjack';
import {
  canShowPlayerDecisionControls,
  resolveViewerActionPermission,
  resolvePlayerHandActionOptions,
  getPrimaryInsuranceActionForController,
} from './blackjackActionContract';
import {
  getActiveTurnBoxId,
  isPlayerTurnPhase,
} from './blackjackViewPhase';
import { getDisplayBlackjackProtocolPhase } from '../engine/blackjack/protocol';
import {
  BET_BOX_PULSE,
  getBoxActivePulseClassName,
  getBoxCardVisualClasses,
  resolveBoxBorderVisualState,
} from './cardViewBox';
import { boxStakeLabelClassName, cardColumnHandValueClassName, resolvePrimaryHandValueLabel } from './boxHandValueDisplay';
import {
  formatBoxNetResultLabel,
  resolveBoxBetAmountDuringPlay,
  resolveBoxNetChipsForHands,
  boxHadActiveHandInRound,
  boxNetResultTone,
} from './boxBetResultDisplay';
import {
  cardAreaOutcomeMarkerClass,
  cardAreaOutcomeMarkerText,
  cardAreaOutcomeToneFromMarker,
  resolveCardAreaOutcomeMarker,
} from './cardAreaOutcomeDisplay';
import { shouldShowBoxHandResultMarkers } from './boxHandStatusDisplay';
import { buildBlackjackCountByBoxDisplay } from './blackjackCountByBoxDisplay';
import { GameOverActionOverlay, type GameOverCompleteOptions } from './GameOverActionOverlay';
import { buildGameOverPresentationModel } from './gameOverPresentation';
import { AceDecisionButtonRow } from './blackjackAceDecisionActions';
import {
  buildViewerIdentityHints,
  resolveViewerPersonIdForTable,
} from './viewerIdentity';
import type { AuthUser } from '../api/client';
import { MAX_TABLE_BOXES } from '../types/table';
import {
  arcSlotRotation,
  DEFAULT_VISIBLE_TABLE_BOXES,
  filterVisibleBoxSlots,
  resolveEffectiveVisibleBoxCount,
  visibleBoxArcClass,
} from './tableBoxLayout';
import { loadProfile, type PlayFlowAutoStand } from '../storage/profileStorage';
import { loadSettings } from '../storage/settingsStorage';
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
  const [gameOverOverlayDismissed, setGameOverOverlayDismissed] = useState(false);
  const [gameOverOverlayConfirmed, setGameOverOverlayConfirmed] = useState(false);
  const [iouPending, setIouPending] = useState(false);
  const [iouFeedback, setIouFeedback] = useState<GameOverIouFeedback | null>(null);
  const [assignChipsOpen, setAssignChipsOpen] = useState(false);
  const [minBetOpen, setMinBetOpen] = useState(false);
  const [tableAidTip, setTableAidTip] = useState<string | null>(null);
  const [magic8Answer, setMagic8Answer] = useState<string | null>(null);
  const [roundSummaryDismissed, setRoundSummaryDismissed] = useState(false);
  const [roundSummaryDelayReady, setRoundSummaryDelayReady] = useState(false);
  const [gameOverDelayReady, setGameOverDelayReady] = useState(false);
  const [expandedVisibleBoxCount, setExpandedVisibleBoxCount] = useState(DEFAULT_VISIBLE_TABLE_BOXES);
  /** Single local chip target — tray pulse and placement both read from here. */
  const [localChipSelection, setLocalChipSelection] = useState<LocalSelectedChipTarget>(() =>
    createEmptyLocalChipTarget(),
  );
  const localSelectedChipTargetRef = useRef<LocalSelectedChipTarget>(createEmptyLocalChipTarget());
  const betInFlightSlotsRef = useRef<Set<number>>(new Set());
  const betChainBySlotRef = useRef<Map<number, Promise<void>>>(new Map());
  const [pendingOnlineStakesBySlot, setPendingOnlineStakesBySlot] = useState<
    Record<number, ChipValue[]>
  >({});
  const pendingOnlineStakesBySlotRef = useRef<Record<number, ChipValue[]>>({});
  const tapSelectRef = useRef(createTapSelectHandler());
  const SHUFFLE_ANIM_DURATION_MS = 3000;
  const [shuffleAnimating, setShuffleAnimating] = useState(false);
  const shuffleAnimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const profile = loadProfile();
  const controllerName = profile.name.trim() || tableMeta.controllerName;
  const viewerHints = buildViewerIdentityHints(gameState, onlineTableId, viewerAuth);
  const viewerPersonId = resolveViewerPersonIdForTable(gameState, onlineTableId, viewerAuth);
  const canUserDealTable = canCurrentUserDealTable(gameState, viewerPersonId);
  const tableOwner = isTableOwner(gameState, controllerName);
  const canDriveTableAutomation =
    tableOwner || controllerName === tableMeta.controllerName;

  const isMobileViewport = useIsMobileViewport();
  const { displayState: tableVisualState, isRevealing, activeHandRevealComplete } =
    useSequentialCardReveal(gameState, {
    onlineMode: Boolean(onlineDispatch) || isOnlineModeEnabled(),
  });
  const cardRevealComplete = !isRevealing;
  const protocolPhaseForHold = getDisplayBlackjackProtocolPhase(gameState, cardRevealComplete);
  const handTransitionHold = useHandTransitionHold(gameState, protocolPhaseForHold, {
    cardRevealComplete,
    activeHandRevealComplete,
    isRevealing,
  });

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
    handlePrimaryDealAction: runPrimaryDealAction,
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
    handTransitionHold.suppressEngineAutoAdvance,
  );

  // Full Table felt only degrades to the "Use Card View" hint on ultra-narrow
  // screens (< 360px). All normal phone widths render the real Full Table.
  const isUltraNarrowViewport = useIsUltraNarrowViewport();
  // View mode is CLIENT-LOCAL: it must never be sourced from server-replaced
  // gameState, or every table:update would flip Card View back to Full Table.
  const [localViewMode, setLocalViewMode] = useState<TableViewMode>(() =>
    resolveInitialViewMode(isMobileViewport, tableViewMode),
  );
  const [layoutDebug, setLayoutDebug] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return isBlackjackLayoutDebugEnabled(window.location?.search ?? '');
  });
  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const syncLayoutDebug = () => {
      setLayoutDebug(isBlackjackLayoutDebugEnabled(window.location?.search ?? ''));
    };
    syncLayoutDebug();
    window.addEventListener('popstate', syncLayoutDebug);
    return () => window.removeEventListener('popstate', syncLayoutDebug);
  }, []);
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
    uiFromLocalChipTarget(localChipSelection.target, gameState);
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
  const uiActiveBoxId = handTransitionHold.holdActiveBoxId ?? activeBoxId;
  const playerDecisionActionsEnabled =
    !handTransitionHold.playerActionsBlocked && !dealActionPending && !onlineActionInFlight;

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
    const local = localSelectedChipTargetRef.current;
    const online = Boolean(onlineDispatch);
    let next = reconcileLocalChipTarget(local, gameState, online);
    if (bettingOpen && local.hasUserSelected && local.target) {
      next = affirmChipTargetAfterPlacement(
        { ...local, hasUserSelected: true },
        gameState,
        local.target.slotNumber,
        online,
      );
    }
    if (!localChipTargetsEqual(localSelectedChipTargetRef.current, next)) {
      commitLocalChipTarget(next);
    }
  }, [
    gameState.tableMeta.boxSlots,
    gameState.tableMeta.boxStakes,
    gameState.session.boxSlotNumbers,
    onlineDispatch,
    gameState.session.id,
    bettingOpen,
  ]);

  useEffect(() => {
    if (!onlineDispatch) {
      return;
    }
    const pending = pendingOnlineStakesBySlotRef.current;
    const slotsToClear = Object.keys(pending)
      .map(Number)
      .filter((slotNumber) => {
        const boxId = resolveOccupantBoxIdForSlot(gameState, slotNumber);
        return boxId != null && getStakeForBox(gameState, boxId) > 0;
      });
    if (slotsToClear.length === 0) {
      return;
    }
    const next = { ...pendingOnlineStakesBySlotRef.current };
    for (const slotNumber of slotsToClear) {
      delete next[slotNumber];
    }
    pendingOnlineStakesBySlotRef.current = next;
    setPendingOnlineStakesBySlot(next);
  }, [gameState.tableMeta.boxStakes, gameState.tableMeta.boxSlots, onlineDispatch]);

  useEffect(() => {
    if (handTransitionHold.holdActiveHandKey) {
      return;
    }
    if (round?.status !== 'player-turns' || !round.activeHandKey) {
      return;
    }
    const { playerId } = parseBlackjackHandKey(round.activeHandKey);
    const current = gameStateRef.current;
    if (current.selectedSeatId !== playerId) {
      onGameStateChange({ ...current, selectedSeatId: playerId });
    }
  }, [round?.status, round?.activeHandKey, handTransitionHold.holdActiveHandKey, onGameStateChange]);

  useEffect(() => {
    return () => {
      if (shuffleAnimTimerRef.current) {
        clearTimeout(shuffleAnimTimerRef.current);
      }
    };
  }, []);

  const playingFor = getTableWagerDisplay(gameState);
  const effectiveVisibleBoxCount = resolveEffectiveVisibleBoxCount(
    tableMeta.boxSlots,
    expandedVisibleBoxCount,
  );
  const displaySlots = filterVisibleBoxSlots(tableMeta.boxSlots, effectiveVisibleBoxCount);
  const visibleArcClass = visibleBoxArcClass(effectiveVisibleBoxCount);
  const canAddVisibleBox = effectiveVisibleBoxCount < MAX_BOXES;
  const bankerReady = isBankerReady(gameState);
  const canSaveToLedger = canAddGameToPersonalLedger(gameState);
  const viewerEmail = viewerAuth?.email?.trim() || profile.email.trim();
  const canAddIou = canOfferGameEndIou(gameState, viewerEmail);
  const iouDisabledReason = canAddIou ? undefined : getGameEndIouDisabledReason(gameState);
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
    !roundSummaryDismissed &&
    cardRevealComplete &&
    roundSummaryDelayReady;
  const tableCommand = useMemo(
    () =>
      buildBlackjackCommandText({
        gameState,
        displayState: tableVisualState,
        cardRevealComplete,
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
      tableVisualState,
      cardRevealComplete,
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

  const showGameOverActions =
    gameEnded && !gameOverOverlayDismissed && !gameOverOverlayConfirmed;
  const gameEndRevealReady = cardRevealComplete || gameEnded;
  const showGameOverOverlay =
    showGameOverActions &&
    deviceView === 'mobile' &&
    gameEndRevealReady &&
    gameOverDelayReady;
  const showGameOverDesktopPanel =
    showGameOverActions && deviceView === 'desktop' && gameEndRevealReady;

  const gameOverPresentation = useMemo(
    () => buildGameOverPresentationModel(gameState, gameOverMessage, viewerPersonId, magic8Answer),
    [gameState, gameOverMessage, viewerPersonId, magic8Answer, gameState.session.id],
  );

  useEffect(() => {
    if (!gameEnded) {
      setGameOverOverlayDismissed(false);
      setGameOverOverlayConfirmed(false);
      setPersonalLedgerAdded(false);
      setIouFeedback(null);
      setIouPending(false);
    }
  }, [gameEnded, gameState.session.id]);

  useEffect(() => {
    if (showGameOverDesktopPanel && sideRailPanel !== 'thisTable') {
      setSideRailPanel('thisTable');
    }
  }, [showGameOverDesktopPanel, sideRailPanel]);

  useEffect(() => {
    if (!awaitingNextRound) {
      setRoundSummaryDismissed(false);
      setRoundSummaryDelayReady(false);
      return;
    }
    if (gameEnded || !cardRevealComplete) {
      setRoundSummaryDelayReady(false);
      return;
    }
    const timer = window.setTimeout(
      () => setRoundSummaryDelayReady(true),
      ROUND_SUMMARY_OVERLAY_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [awaitingNextRound, gameEnded, cardRevealComplete]);

  useEffect(() => {
    if (!gameEnded) {
      setGameOverDelayReady(false);
      return;
    }
    if (!gameEndRevealReady) {
      setGameOverDelayReady(false);
      return;
    }
    const timer = window.setTimeout(
      () => setGameOverDelayReady(true),
      MOBILE_GAME_OVER_OVERLAY_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [gameEnded, gameEndRevealReady, gameState.session.id]);

  function handleAddToPersonalLedger() {
    setError(null);
    if (onlineDispatch) {
      void onlineDispatch('addGameToPersonalLedger', {}).then(() => setPersonalLedgerAdded(true)).catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not add to personal ledger');
      });
      return;
    }
    try {
      addGameToPersonalLedger(gameStateRef.current, {
        savedByEmail: viewerEmail || undefined,
      });
      setPersonalLedgerAdded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add to personal ledger');
    }
  }

  async function submitIouHandoff(customMessage?: string) {
    setError(null);
    setIouPending(true);
    setIouFeedback(null);
    try {
      const request = buildIouHandoffCreateRequest(gameStateRef.current, {
        message: customMessage,
      });
      if (!request) {
        throw new Error('Missing debtor or creditor email for this wager.');
      }

      const storageKey = iouHandoffStorageKey(request.tableId, request.sessionId);
      const prior = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
      if (prior) {
        setIouFeedback({
          tone: 'info',
          message: 'This IOU handoff was already submitted.',
        });
        return;
      }

      const result = await createIouHandoff(request);
      if (!result.ok) {
        throw new Error(result.error);
      }

      if (typeof localStorage !== 'undefined' && result.iouId) {
        localStorage.setItem(storageKey, result.iouId);
      }

      setIouFeedback({
        tone: result.alreadySubmitted ? 'info' : 'success',
        message: result.alreadySubmitted
          ? 'This IOU handoff was already submitted.'
          : 'IOU created. The counterparty can accept or decline it in IOU Wallet.',
        openUrl: result.openUrl,
      });
    } catch (err) {
      setIouFeedback({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Could not create IOU.',
      });
    } finally {
      setIouPending(false);
    }
  }

  async function handleGameOverComplete(options: GameOverCompleteOptions) {
    if (options.saveLedger) {
      handleAddToPersonalLedger();
    }
    if (options.createIou) {
      await submitIouHandoff(options.iouMessage);
    }
    setGameOverOverlayConfirmed(true);
  }

  async function handleGameOverNewGame(options: GameOverCompleteOptions) {
    await handleGameOverComplete(options);
    if (onBeginTableReset && canResetTable) {
      setSideRailPanel(null);
      onBeginTableReset('newGame');
    }
  }

  function handleGameOverDismiss() {
    setGameOverOverlayDismissed(true);
    setIouFeedback(null);
  }

  function run(
    action: (state: GameState) => GameState,
    online?: { type: string; payload?: Record<string, unknown> },
  ) {
    setError(null);
    if (handTransitionHold.playerActionsBlocked) {
      return;
    }
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

  function selectLocalTarget(slotNumber: number) {
    commitLocalChipTarget(selectLocalChipTarget(localSelectedChipTargetRef.current, slotNumber));
  }

  function addPendingOnlineStake(slotNumber: number, amount: ChipValue) {
    const prev = pendingOnlineStakesBySlotRef.current[slotNumber] ?? [];
    const next = {
      ...pendingOnlineStakesBySlotRef.current,
      [slotNumber]: [...prev, amount],
    };
    pendingOnlineStakesBySlotRef.current = next;
    setPendingOnlineStakesBySlot(next);
  }

  function rollbackPendingOnlineStake(slotNumber: number) {
    const prev = pendingOnlineStakesBySlotRef.current[slotNumber];
    if (!prev?.length) {
      return;
    }
    const chips = prev.slice(0, -1);
    const next = { ...pendingOnlineStakesBySlotRef.current };
    if (chips.length === 0) {
      delete next[slotNumber];
    } else {
      next[slotNumber] = chips;
    }
    pendingOnlineStakesBySlotRef.current = next;
    setPendingOnlineStakesBySlot(next);
  }

  function preserveLocalChipTargetAfterStateSync(
    nextState?: GameState,
    placedSlotNumber?: number,
  ) {
    const state = nextState ?? gameStateRef.current;
    const online = Boolean(onlineDispatch);
    const next =
      placedSlotNumber != null
        ? affirmChipTargetAfterPlacement(
            localSelectedChipTargetRef.current,
            state,
            placedSlotNumber,
            online,
          )
        : reconcileLocalChipTarget(localSelectedChipTargetRef.current, state, online);
    commitLocalChipTarget(next);
  }

  function resolveActiveChipTrayTarget(explicitDropSlotNumber?: number | null) {
    return getCurrentChipTargetForBetting({
      ref: localSelectedChipTargetRef.current,
      state: localChipSelection,
      gameState: gameStateRef.current,
      online: Boolean(onlineDispatch),
      viewerPersonId,
      visibleBoxCount: effectiveVisibleBoxCount,
      explicitDropSlotNumber,
    });
  }

  function applyOptimisticChipPlacement(slotNumber: number, amount: ChipValue, online: boolean): GameState {
    let state = gameStateRef.current;
    let boxId = resolveOccupantBoxIdForSlot(state, slotNumber);
    if (!boxId) {
      if (online) {
        return state;
      }
      state = claimBoxSlot(state, slotNumber);
      boxId = resolveOccupantBoxIdForSlot(state, slotNumber);
      if (!boxId) {
        throw new Error('Could not claim box');
      }
    }
    const personId = resolveControllerPersonId(state, controllerName);
    return addChipToBoxStake(state, boxId, amount, personId ?? undefined);
  }

  async function placeBetAtTargetCore(slotNumber: number, amount: ChipValue): Promise<void> {
    const online = Boolean(onlineDispatch);
    selectLocalTarget(slotNumber);

    logChipBetDiagnostic({
      stage: 'tap-target',
      selectedTarget: localSelectedChipTargetRef.current.target,
      slotNumber,
      optimisticBoxId: resolveOccupantBoxIdForSlot(gameStateRef.current, slotNumber),
    });

    const inFlight = betInFlightSlotsRef.current.has(slotNumber);
    let payloadTarget;
    try {
      payloadTarget = resolvePlaceBetPayloadTarget(
        gameStateRef.current,
        slotNumber,
        online,
        inFlight,
      );
    } catch (err) {
      setError(formatPlaceBetError(err));
      return;
    }
    const payload = placeBetPayloadFromTarget(payloadTarget, amount);

    logChipBetDiagnostic({
      stage: 'payload',
      selectedTarget: localSelectedChipTargetRef.current.target,
      payload,
      slotNumber,
    });

    if (onlineDispatch) {
      setError(null);
      const snapshot = gameStateRef.current;
      const hadOccupant = resolveOccupantBoxIdForSlot(snapshot, slotNumber) != null;
      try {
        if (hadOccupant) {
          const optimistic = applyOptimisticChipPlacement(slotNumber, amount, true);
          onGameStateChange(optimistic);
          logChipBetDiagnostic({
            stage: 'optimistic',
            selectedTarget: localSelectedChipTargetRef.current.target,
            optimisticBoxId: resolveOccupantBoxIdForSlot(optimistic, slotNumber),
            slotNumber,
          });
        } else {
          addPendingOnlineStake(slotNumber, amount);
          logChipBetDiagnostic({
            stage: 'optimistic',
            selectedTarget: localSelectedChipTargetRef.current.target,
            optimisticBoxId: null,
            slotNumber,
          });
        }
        preserveLocalChipTargetAfterStateSync(undefined, slotNumber);
        betInFlightSlotsRef.current.add(slotNumber);
      } catch (err) {
        setError(formatPlaceBetError(err));
        return;
      }
      try {
        await onlineDispatch('placeBet', payload);
        logChipBetDiagnostic({
          stage: 'reconcile',
          selectedTarget: localSelectedChipTargetRef.current.target,
          slotNumber,
        });
        preserveLocalChipTargetAfterStateSync(undefined, slotNumber);
      } catch (err) {
        onGameStateChange(snapshot);
        if (!hadOccupant) {
          rollbackPendingOnlineStake(slotNumber);
        }
        logChipBetDiagnostic({
          stage: 'error',
          selectedTarget: localSelectedChipTargetRef.current.target,
          slotNumber,
          message: formatPlaceBetError(err),
        });
        preserveLocalChipTargetAfterStateSync(snapshot, slotNumber);
        setError(formatPlaceBetError(err));
      } finally {
        betInFlightSlotsRef.current.delete(slotNumber);
      }
      return;
    }

    setError(null);
    try {
      const nextState = applyOptimisticChipPlacement(slotNumber, amount, false);
      onGameStateChange(nextState);
      preserveLocalChipTargetAfterStateSync(nextState, slotNumber);
    } catch (err) {
      setError(formatPlaceBetError(err));
    }
  }

  function placeBetAtTarget(slotNumber: number, amount: ChipValue) {
    const online = Boolean(onlineDispatch);
    if (online && slotNumber >= 2) {
      const prev = betChainBySlotRef.current.get(slotNumber) ?? Promise.resolve();
      const chained = prev
        .catch(() => {})
        .then(() => placeBetAtTargetCore(slotNumber, amount));
      betChainBySlotRef.current.set(slotNumber, chained);
      void chained;
      return;
    }

    void placeBetAtTargetCore(slotNumber, amount);
  }

  function selectBox(boxId: string) {
    const slot = gameStateRef.current.tableMeta.boxSlots.find((s) => s.playerId === boxId);
    if (slot) {
      selectLocalTarget(slot.slotNumber);
      return;
    }
    const slotNum = gameStateRef.current.session.boxSlotNumbers?.[boxId];
    if (slotNum != null) {
      selectLocalTarget(slotNum);
    }
  }

  function bindBoxTapSelect(action: () => void) {
    return bindTapSelect(tapSelectRef.current, action);
  }


  function removeLastChipFromBox(boxId: string) {
    run((s) => removeLastChipFromBoxStake(s, boxId), { type: 'retractChip', payload: { boxId } });
  }

  function handlePlayFlowChange(personId: string, playFlow: PlayFlowAutoStand) {
    run((s) => setPersonPlayFlow(s, personId, playFlow));
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }

  function handleSlotChipDrop(slotNumber: number, e: React.DragEvent) {
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

    selectLocalTarget(slotNumber);
    placeBetAtTarget(slotNumber, value);
  }

  function handleClaimOrSelectSlot(slotNumber: number) {
    if (!tableMeta.boxSlots.some((s) => s.slotNumber === slotNumber)) {
      return;
    }
    selectLocalTarget(slotNumber);
  }

  function handleChipTrayClick(value: ChipValue) {
    const result = resolveActiveChipTrayTarget();
    if (layoutDebug) {
      logLayoutDebugChipTarget({
        refTarget: localSelectedChipTargetRef.current.target,
        refHasUserSelected: localSelectedChipTargetRef.current.hasUserSelected,
        stateTarget: localChipSelection.target,
        result,
      });
    }
    if (!result.ok) {
      const local = localSelectedChipTargetRef.current;
      const ui = uiFromLocalChipTarget(local.target ?? localChipSelection.target, gameStateRef.current);
      logChipTargetResolution(result.reason, {
        ...ui,
        hasUserSelected: local.hasUserSelected || localChipSelection.hasUserSelected,
        visibleBoxCount: effectiveVisibleBoxCount,
      });
      setError('Tap a box to bet');
      return;
    }
    placeBetAtTarget(result.slotNumber, value);
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
  const showAddBoxLead = canAddVisibleBox && inBetting;
  const showBoxHandResultMarkers = shouldShowBoxHandResultMarkers({
    awaitingNextRound,
    protocolPhase,
    round: gameState.blackjack,
  });
  const chipPointerDrag = useMemo(
    () =>
      createChipPointerDragHandlers({
        enabled: inBetting,
        onHighlight: setDropTargetId,
        onDrop: (value, target: ChipDropTarget) => {
          if (!bettingOpen) {
            return;
          }
          selectLocalTarget(target.slotNumber);
          placeBetAtTarget(target.slotNumber, value);
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
    blackjackCountByBox: buildBlackjackCountByBoxDisplay(gameState),
    canResetTable: canResetTable && Boolean(onBeginTableReset),
    onResetTable: onBeginTableReset
      ? () => {
          setSideRailPanel(null);
          onBeginTableReset('resetTable');
        }
      : undefined,
  };

  function handlePrimaryDealAction() {
    if (!canUserDealTable) {
      return;
    }
    runPrimaryDealAction({
      firstStartShuffleDelayMs: tableMeta.shoeStarted ? 0 : SHUFFLE_ANIM_DURATION_MS,
      onFirstStartShuffleAnimationStart: () => {
        setShuffleAnimating(true);
        if (shuffleAnimTimerRef.current) {
          clearTimeout(shuffleAnimTimerRef.current);
        }
        shuffleAnimTimerRef.current = setTimeout(() => {
          setShuffleAnimating(false);
          shuffleAnimTimerRef.current = null;
        }, SHUFFLE_ANIM_DURATION_MS);
      },
      onFirstStartShuffleAnimationEnd: () => {
        setShuffleAnimating(false);
        if (shuffleAnimTimerRef.current) {
          clearTimeout(shuffleAnimTimerRef.current);
          shuffleAnimTimerRef.current = null;
        }
      },
    });
  }

  const dealerBlockProps = {
    awaitingNextRound,
    gameEnded,
    onNewGame:
      gameEnded && onBeginTableReset && !showGameOverActions
        ? () => onBeginTableReset('newGame')
        : undefined,
    canStartNewGame: canResetTable,
    newGameDisabledReason:
      gameEnded && !canResetTable ? 'Only the table owner can start a new game.' : null,
    commentaryText: tableAidTip,
    commandMessage: tableCommand.commandMessage,
    commandLines: tableCommand.commandLines,
    onNextRound: handleNextRound,
    protocolPhase,
    bankerReady,
    shoeStarted,
    bettingOpen,
    canUserDealTable,
    canDeal,
    hasStakes,
    onShuffleToStart: handleShuffleToStart,
    shuffleAnimating,
    onDealCards: handlePrimaryDealAction,
    onDealNextCard: handleDealNextCard,
    onDrawBank: handleDrawBank,
    dealActionPending,
    nextRoundPending,
    engineStatus,
    initialDealManual: initialDealStaged,
    bankDrawManual: flowSettings.bankDrawMode === 'manual',
    bankInfo: (
      <TableInfoBar
        gameState={gameState}
        displayState={tableVisualState}
        viewerPersonId={viewerPersonId}
        variant="dealer"
      />
    ),
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

  function renderInsuranceDecisionOverlay() {
    if (protocolPhase !== 'insurance' || !round?.insuranceOfferPending) {
      return null;
    }

    const primary = getPrimaryInsuranceActionForController(gameState, round, viewerPersonId);
    if (!primary) {
      return null;
    }

    const { personId, maxBet, canAfford, slotNumbers } = primary;
    const boxLabel =
      slotNumbers.length > 1
        ? `Boxes ${slotNumbers.join(' & ')}`
        : `Box ${slotNumbers[0] ?? '?'}`;
    return (
      <InsuranceDecisionOverlay
        boxLabel={boxLabel}
        maxBet={maxBet}
        canAfford={canAfford}
        onInsurance={() =>
          run((s) => takeInsuranceForPersonOnState(s, personId), {
            type: 'takeInsurance',
            payload: { personId },
          })
        }
        onDecline={() =>
          run((s) => declineInsuranceForPersonOnState(s, personId), {
            type: 'declineInsurance',
            payload: { personId },
          })
        }
      />
    );
  }

  function renderOptionalPlayDecisionOverlay() {
    if (round?.evenMoneyOfferHandKey) {
      return null;
    }
    if (
      !canShowPlayerDecisionControls(gameState, protocolPhase, {
        cardRevealComplete,
        activeHandRevealComplete,
      })
    ) {
      return null;
    }
    if (!round?.activeHandKey) {
      return null;
    }
    const actionPermission = resolveViewerActionPermission(gameState, viewerPersonId);
    if (!actionPermission.canAct) {
      return null;
    }
    const actionable = actionPermission.actionable!;
    const handOptions = resolvePlayerHandActionOptions(
      gameState,
      actionable.handKey,
      blackjackSettings,
      Boolean(deck),
    );
    const { canDouble, canSplit, showDouble, showSplit } = handOptions;
    if (!showDouble && !showSplit) {
      return null;
    }
    if (!canDouble && !canSplit) {
      return null;
    }
    return (
      <OptionalPlayDecisionOverlay
        canDouble={canDouble}
        canSplit={canSplit}
        showDouble={showDouble}
        showSplit={showSplit}
        actionsEnabled={playerDecisionActionsEnabled}
        onDouble={() =>
          run((s) => doubleDownBlackjackOnState(s, actionable.handKey), {
            type: 'double',
            payload: {},
          })
        }
        onSplit={() =>
          run((s) => splitBlackjackOnState(s, actionable.handKey), {
            type: 'split',
            payload: {},
          })
        }
      />
    );
  }

  function renderSummaryContent() {
    const insurance = renderInsuranceDecisionOverlay();
    if (insurance) {
      return insurance;
    }
    const optionalPlay = renderOptionalPlayDecisionOverlay();
    if (optionalPlay) {
      return optionalPlay;
    }
    const alert = renderTableAlert();
    return alert ?? <div className={TABLE_UX.summaryPlaceholder} aria-hidden="true" />;
  }

  function renderActionsContent() {
    const playerActions = renderTablePlayerActions();
    const content = playerActions;
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
    const trayLabel = resolveTableTrayLabel(tableMeta, loadSettings());
    return (
      <div className="bj-casino__tray-wrap">
        <ValueAndChipsBar
          available={playerAvailable}
          showChips
          onChipClick={handleChipTrayClick}
          onChipPointerDown={chipPointerDrag.onChipPointerDown}
          disabled={!bettingOpen}
          minimumBet={minimumBet}
          trayLabel={trayLabel}
        />
        {inBetting && chipTrayHint && (
          <p className="bj-casino__tray-hint" role="status">{chipTrayHint}</p>
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
      <AceDecisionButtonRow
        panelClassName="bj-table-actions--even-money"
        ariaLabel="Even-money decision"
        primaryLabel="Take 1:1"
        secondaryLabel="Play vs Ace"
        onPrimary={() =>
          run((s) => takeEvenMoneyOnState(s, offerKey), {
            type: 'takeEvenMoney',
            payload: { handKey: offerKey },
          })
        }
        onSecondary={() =>
          run((s) => waitForBlackjackPayoutOnState(s, offerKey), {
            type: 'waitFor3to2',
            payload: { handKey: offerKey },
          })
        }
      />
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
    const handOptions = resolvePlayerHandActionOptions(
      gameState,
      actionable.handKey,
      blackjackSettings,
      Boolean(deck),
    );
    const { canHit, canStand, canDouble, canSplit } = handOptions;

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
        actionsEnabled={playerDecisionActionsEnabled}
        canHit={canHit}
        canStand={canStand}
        canDouble={canDouble}
        canSplit={canSplit}
        showDouble={false}
        showSplit={false}
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
    const primaryHand = primaryHandKey ? visualRound?.playerHands[primaryHandKey] : null;
    const isBusted = primaryHand?.actionStatus === 'busted';
    const valueLabel = resolvePrimaryHandValueLabel(
      visualDeck,
      visualRound,
      primaryHandKey,
      primaryHand,
    );
    const boxParticipated =
      Boolean(primaryHand) &&
      primaryHand!.currentBet > 0 &&
      (primaryHand!.cardIds.some(Boolean) ||
        Boolean(primaryHandKey && visualRound?.outcomes?.[primaryHandKey]));
    const primaryOutcome = primaryHandKey
      ? visualRound?.outcomes?.[primaryHandKey]
      : undefined;
    const outcomeMarker = boxParticipated
      ? resolveCardAreaOutcomeMarker(
          showBoxHandResultMarkers,
          primaryOutcome,
          primaryHand?.actionStatus,
          primaryHandKey
            ? getDisplayedHandValue(visualDeck, visualRound, primaryHandKey)
            : null,
        )
      : null;
    const hideCardValueOnMobile =
      deviceView === 'mobile' &&
      outcomeMarker !== null &&
      (outcomeMarker === 'blackjack' || showBoxHandResultMarkers);
    const cardColumnValueLabel = hideCardValueOnMobile ? '' : valueLabel;
    const isActiveHand =
      isPlayerTurnPhase(protocolPhase) &&
      uiActiveBoxId === boxId &&
      !showBoxHandResultMarkers &&
      primaryHand?.actionStatus === 'acting';
    const rotation =
      deviceView === 'mobile'
        ? 0
        : arcSlotRotation(slotNumber, effectiveVisibleBoxCount, {
            mobile: false,
          });
    const isSplit = handKeys.length > 1;
    return (
      <div
        key={`cards-${boxId}`}
        className={[
          'bj-arc__slot',
          'bj-arc__slot--card-column',
          isSplit ? 'bj-arc__slot--card-split' : '',
        ].filter(Boolean).join(' ')}
        style={{ '--arc-rot': `${rotation}deg` } as CSSProperties}
        data-box-slot={slotNumber}
      >
        {outcomeMarker && !isSplit ? (
          <span className={cardAreaOutcomeMarkerClass(outcomeMarker)} aria-hidden="true">
            {cardAreaOutcomeMarkerText(outcomeMarker)}
          </span>
        ) : null}
        {isSplit ? (
          <div className="bj-arc__split-hands">
            {handKeys.map((handKey) => {
              const cardIds = getVisibleHandCardIds(visualRound, handKey);
              const splitHand = visualRound?.playerHands[handKey];
              const splitOutcome = visualRound?.outcomes?.[handKey];
              const splitParticipated =
                Boolean(splitHand) &&
                splitHand!.currentBet > 0 &&
                (splitHand!.cardIds.some(Boolean) || Boolean(splitOutcome));
              const splitMarker = splitParticipated
                ? resolveCardAreaOutcomeMarker(
                    showBoxHandResultMarkers,
                    splitOutcome,
                    splitHand?.actionStatus,
                    getDisplayedHandValue(visualDeck, visualRound, handKey),
                  )
                : null;
              return (
                <div key={handKey} className="bj-arc__split-hand">
                  {splitMarker ? (
                    <span className={cardAreaOutcomeMarkerClass(splitMarker)} aria-hidden="true">
                      {cardAreaOutcomeMarkerText(splitMarker)}
                    </span>
                  ) : null}
                  {renderArcCardStack(cardIds)}
                </div>
              );
            })}
          </div>
        ) : (
          renderArcCardStack(
            handKeys[0] ? getVisibleHandCardIds(visualRound, handKeys[0]) : [],
          )
        )}
        <span
          className={[
            cardColumnHandValueClassName(
              Boolean(cardColumnValueLabel),
              isBusted,
              isActiveHand,
              cardAreaOutcomeToneFromMarker(outcomeMarker),
            ),
            TABLE_UX.cardColumnValueBelow,
          ].join(' ')}
          aria-hidden={cardColumnValueLabel ? undefined : 'true'}
        >
          {cardColumnValueLabel || '\u00a0'}
        </span>
      </div>
    );
  }

  function renderEmptyCardColumn(slotNumber: number) {
    const rotation =
      deviceView === 'mobile'
        ? 0
        : arcSlotRotation(slotNumber, effectiveVisibleBoxCount, { mobile: false });
    return (
      <div
        key={`cards-empty-${slotNumber}`}
        className="bj-arc__slot bj-arc__slot--card-column bj-arc__slot--card-empty"
        style={{ '--arc-rot': `${rotation}deg` } as CSSProperties}
        data-box-slot={slotNumber}
        aria-hidden="true"
      >
        <span
          className={[
            TABLE_UX.cardColumnValueBelow,
            'bj-phone-view__box-value--placeholder',
          ].join(' ')}
          aria-hidden="true"
        >
          {'\u00a0'}
        </span>
      </div>
    );
  }

  function renderArcSlot(slotNumber: number) {
    const slot = tableMeta.boxSlots.find((s) => s.slotNumber === slotNumber);
    const boxId = slot?.playerId ?? null;
    const isEmpty = !boxId;
    const pendingChips = pendingOnlineStakesBySlot[slotNumber] ?? [];
    const openStake = boxId ? getStakeForBox(gameState, boxId) : 0;
    const pendingStakeTotal = pendingChips.reduce((sum, chip) => sum + chip, 0);
    const isJoinAssigned = isJoinAssignedHighlight(gameState, slotNumber, protocolPhase);
    const borderState = resolveBoxBorderVisualState({
      state: gameState,
      boxPlayerId: boxId ?? `slot-${slotNumber}`,
      viewerPersonId,
      openStake: openStake || pendingStakeTotal,
      selectedBettingBoxId: selectedBettingBoxIdForUi,
      selectedBettingSlotNumber,
      activeBoxId: uiActiveBoxId,
      isDropHover: dropTargetId === chipDropKey({ slotNumber, boxId }),
      bettingStage: inBetting,
      playerPhase: isPlayerTurnPhase(protocolPhase),
    });
    const boxInfo = boxId
      ? buildBlackjackPlayerBoxInfo(gameState, slotNumber, boxId)
      : null;
    let handKeys = boxId ? (handKeysByBox.get(boxId) ?? []) : [];
    if (boxId && handKeys.length === 0 && visualRound) {
      const primaryKey = blackjackHandKey(boxId, 0);
      const hand = visualRound.playerHands[primaryKey];
      if (hand && (hand.currentBet > 0 || hand.cardIds.some(Boolean))) {
        handKeys = [primaryKey];
      }
    }
    const primaryHandKey = handKeys[0];
    const primaryHand = primaryHandKey ? visualRound?.playerHands[primaryHandKey] : null;
    const visibleCardIds = primaryHandKey
      ? getVisibleHandCardIds(visualRound, primaryHandKey)
      : [];
    const isBusted = primaryHand?.actionStatus === 'busted';
    const wager = inBetting ? openStake || pendingStakeTotal : (primaryHand?.currentBet ?? openStake);
    const betAmount = resolveBoxBetAmountDuringPlay(
      inBetting,
      openStake || pendingStakeTotal,
      primaryHand?.currentBet,
    );
    const boxParticipated =
      Boolean(visualRound) && boxId != null && boxHadActiveHandInRound(visualRound!, handKeys);
    const boxNetChips =
      showBoxHandResultMarkers && visualRound && boxParticipated
        ? resolveBoxNetChipsForHands(
            visualRound,
            handKeys,
            gameState.blackjackSettings.blackjackPayout,
          )
        : null;
    const boxValueLabel = showBoxHandResultMarkers && boxParticipated
      ? boxNetChips !== null
        ? formatBoxNetResultLabel(boxNetChips)
        : ''
      : betAmount > 0
        ? String(betAmount)
        : '';
    const boxNetTone =
      showBoxHandResultMarkers && boxParticipated && boxNetChips !== null
        ? boxNetResultTone(boxNetChips)
        : null;
    const stakeChips = mergeStakeChipsForSlotDisplay(gameState, slotNumber, boxId, pendingChips);
    const showBettingChips = inBetting && (openStake > 0 || pendingChips.length > 0) && stakeChips.length > 0;
    const showPlayChips = !inBetting && wager > 0;
    const displayChips = showBettingChips
      ? stakeChips
      : showPlayChips
        ? (stakeChips.length > 0 ? stakeChips : [wager])
        : [];
    const showStakeContent = inBetting || displayChips.length > 0;
    const dropKey = chipDropKey({ slotNumber, boxId });
    const rotation =
      deviceView === 'mobile'
        ? 0
        : arcSlotRotation(slotNumber, effectiveVisibleBoxCount, { mobile: false });
    const isSelected = inBetting && selectedBettingSlotNumber === slotNumber;
    const isDrop = dropTargetId === dropKey || dropTargetId === `slot-${slotNumber}`;
    const onSelect = () => (boxId ? selectBox(boxId) : handleClaimOrSelectSlot(slotNumber));

    return (
      <div
        key={slotArcReactKey(slotNumber)}
        className={[
          'bj-arc__slot',
          isEmpty ? 'bj-arc__slot--empty' : 'bj-arc__slot--owned',
          TABLE_UX.boxHitZone,
          isJoinAssigned ? 'bj-arc__slot--join-highlight' : '',
          isDrop ? 'bj-arc__slot--drop' : '',
        ].filter(Boolean).join(' ')}
        style={{ '--arc-rot': `${rotation}deg` } as CSSProperties}
        {...{
          [CHIP_DROP_SLOT_ATTR]: slotNumber,
          [CHIP_DROP_BOX_ATTR]: boxId ?? '',
        }}
      >
        <button
          type="button"
          className={TABLE_UX.boxHitArea}
          {...bindBoxTapSelect(onSelect)}
          aria-label={
            isEmpty
              ? `Join box ${slotNumber}${pendingStakeTotal > 0 ? `, ${pendingStakeTotal}c staked` : ''}`
              : `Box ${slotNumber}${wager > 0 ? `, ${wager}c staked` : ''}`
          }
          aria-current={borderState.isSelected || uiActiveBoxId === boxId ? 'true' : undefined}
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
          onDrop={inBetting ? (e) => handleSlotChipDrop(slotNumber, e) : undefined}
        />
        <span
          className={boxStakeLabelClassName(Boolean(boxValueLabel), isBusted, boxNetTone)}
          aria-hidden={boxValueLabel ? undefined : 'true'}
        >
          {boxValueLabel || '\u00a0'}
        </span>
        <div
          {...sxmSectionProps(
            SXM_LAYOUT.playerBox,
            getBoxCardVisualClasses(borderState),
            TABLE_UX.fullArcBox,
            'bj-player-box-mobile',
            isEmpty ? 'bj-phone-view__mini-hand--empty' : '',
            isSelected ? 'bj-box--selected' : '',
            isSelected ? BET_BOX_PULSE : '',
            isDrop ? 'bj-bet-zone--drop' : '',
            getBoxActivePulseClassName(borderState),
          )}
        >
          {boxInfo ? (
            <BlackjackPlayerBoxHead
              boxLabel={boxInfo.boxLabel}
              callerDisplayName={boxInfo.callerDisplayName}
            />
          ) : (
            <span className="bj-phone-view__mini-hand-head">
              <span className="bj-phone-view__mini-hand-box">Box {slotNumber}</span>
              <span className="bj-phone-view__mini-hand-name">Join</span>
            </span>
          )}
          {visibleCardIds.length > 0 && visualDeck ? (
            <span
              className="bj-phone-view__mini-hand-composition"
              aria-label={`Cards: ${visibleCardIds
                .map((id) => {
                  const card = getCardById(visualDeck, id);
                  return card?.rank ?? '';
                })
                .filter(Boolean)
                .join(', ')}`}
            >
              {formatBoxCardRanksLabel(
                visibleCardIds
                  .map((id) => getCardById(visualDeck, id))
                  .filter((card): card is NonNullable<typeof card> => Boolean(card)),
              )}
            </span>
          ) : (
            <span
              className="bj-phone-view__mini-hand-composition bj-phone-view__mini-hand-composition--placeholder"
              aria-hidden="true"
            >
              &nbsp;
            </span>
          )}
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
                removable={inBetting && showBettingChips && Boolean(boxId) && pendingChips.length === 0}
                onRemoveTopChip={boxId ? () => removeLastChipFromBox(boxId) : undefined}
              />
            ) : (
              <span className={TABLE_UX.stakeSlotReserved} aria-hidden="true">
                &nbsp;
              </span>
            )}
          </span>
        </div>
      </div>
    );
  }

  function renderPlayerBoxesArc() {
    return (
      <div className="bj-player-boxes-wrap">
        <div
          className={[
            'bj-table-slot-row',
            'bj-arc',
            'bj-arc--player-boxes',
            visibleArcClass,
            showAddBoxLead ? 'bj-table-slot-row--with-add' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ '--slot-count': effectiveVisibleBoxCount } as CSSProperties}
        >
          {showAddBoxLead ? (
            <button
              type="button"
              className="bj-table-slot-row__add bj-player-boxes-wrap__add"
              aria-label="Add player box"
              onClick={() =>
                setExpandedVisibleBoxCount((count) =>
                  Math.min(MAX_BOXES, Math.max(count, effectiveVisibleBoxCount) + 1),
                )
              }
            >
              +
            </button>
          ) : null}
          {displaySlots.map((slot) => renderArcSlot(slot.slotNumber))}
        </div>
      </div>
    );
  }

  const focusBoxId =
    round?.status === 'player-turns' && uiActiveBoxId
      ? uiActiveBoxId
      : bettingOpen && selectedBettingSlotNumber != null
        ? selectedBettingBoxIdForUi
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
            tableDetails={tableDetailsProps}
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

  function renderGameOverSummaryContent() {
    return (
      <GameOverActionOverlay
        layout="inline"
        open
        presentation={gameOverPresentation}
        canSaveToLedger={canSaveToLedger}
        ledgerAlreadyAdded={personalLedgerAdded}
        canCreateIou={canAddIou}
        iouPending={iouPending}
        iouFeedback={iouFeedback}
        iouDisabledReason={iouDisabledReason}
        canStartNewGame={canResetTable}
        newGameDisabledReason={
          !canResetTable
            ? 'Only the table owner can start a new game.'
            : !onBeginTableReset
              ? 'New game setup is unavailable on this table.'
              : null
        }
        onOpenLedger={() => setActiveTablePanel('playLedger')}
        onComplete={handleGameOverNewGame}
        onDismiss={handleGameOverDismiss}
      />
    );
  }

  function closeSideRailPanel() {
    if (showGameOverDesktopPanel) {
      handleGameOverDismiss();
      return;
    }
    setSideRailPanel(null);
  }

  function renderSideRailPanel(variant: 'dock' | 'overlay') {
    if (!sideRailPanel) {
      return null;
    }
    const isOverlay = variant === 'overlay';
    const title =
      showGameOverDesktopPanel && !isOverlay
        ? 'Game Over'
        : mobileSidePanelTab === 'playLedger'
          ? 'Play Ledger'
          : mobileSidePanelTab === 'settings'
            ? 'Settings'
            : 'This Table';
    const panelContent = isOverlay ? (
      renderMobileSidePanelBody()
    ) : showGameOverDesktopPanel ? (
      renderGameOverSummaryContent()
    ) : (
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
        <TableSideRailShell title={title} onClose={closeSideRailPanel}>
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
      <header
        {...sxmSectionProps(
          SXM_LAYOUT.appHeader,
          TABLE_UX.tableHeader,
          layoutDebug ? TABLE_UX.layoutDebug : '',
        )}
      >
        <div className="bj-casino__toolbar">
          <div {...sxmSectionProps(SXM_LAYOUT.viewSwitcher, 'bj-casino__view-toggle')}>
            <button type="button" className={viewMode === 'full' ? 'bj-casino__view-btn--active' : 'bj-casino__view-btn'} onClick={() => setViewMode('full')}>Full Table</button>
            <button type="button" className={viewMode === 'card' ? 'bj-casino__view-btn--active' : 'bj-casino__view-btn'} onClick={() => setViewMode('card')}>Card View</button>
          </div>
          {renderTableNav()}
        </div>
      </header>
    );
  }

  const clothProtocolLabel = getBlackjackProtocolOrDefault(gameState.blackjackProtocolId).displayName;
  const clothWagerText =
    tableMeta.tableMode === 'practice'
      ? resolveTableClothWager(tableMeta) || 'Practice'
      : resolveTableClothWager(tableMeta) || getTableWagerDisplay(gameState);

  return (
    <div
      ref={layoutRootRef}
      {...sxmSectionProps(SXM_LAYOUT.layoutRoot, `bj-casino ${viewRootClass}`)}
      aria-label="Blackjack table"
      data-view-mode={viewMode}
      data-device-view={deviceView}
      data-phase={protocolPhase}
      data-game-ended={gameEnded ? 'true' : 'false'}
      data-game-over-ui={showGameOverActions ? 'true' : 'false'}
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
          tableDetails={tableDetailsProps}
        />
      )}

      {showGameOverOverlay && (
        <GameOverActionOverlay
          open
          presentation={gameOverPresentation}
          canSaveToLedger={canSaveToLedger}
          ledgerAlreadyAdded={personalLedgerAdded}
          canCreateIou={canAddIou}
          iouPending={iouPending}
          iouFeedback={iouFeedback}
          iouDisabledReason={iouDisabledReason}
          canStartNewGame={canResetTable}
          newGameDisabledReason={
            !canResetTable
              ? 'Only the table owner can start a new game.'
              : !onBeginTableReset
                ? 'New game setup is unavailable on this table.'
                : null
          }
          onOpenLedger={() => setActiveTablePanel('playLedger')}
          onComplete={handleGameOverNewGame}
          onDismiss={handleGameOverDismiss}
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
            layoutDebug={layoutDebug}
            tableBankInfo={
              <TableInfoBar
                gameState={gameState}
                displayState={tableVisualState}
                viewerPersonId={viewerPersonId}
                variant="felt"
              />
            }
            feltClothLayer={
              resolveTableFeltSkin(tableMeta) === 'classic-casino' ? (
                <BlackjackFeltClothLayer
                  tableName={resolveTableClothName(tableMeta)}
                  wagerText={clothWagerText}
                  protocolText={clothProtocolLabel}
                  customRulesText="House Rules: Standard"
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
                  className={[
                    'bj-table-slot-row',
                    'bj-arc',
                    'bj-arc--cards',
                    visibleArcClass,
                    showAddBoxLead ? 'bj-table-slot-row--with-add' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{ '--slot-count': effectiveVisibleBoxCount } as CSSProperties}
                >
                  {showAddBoxLead ? (
                    <div className="bj-table-slot-row__lead-spacer" aria-hidden="true" />
                  ) : null}
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
                  activeBoxId={uiActiveBoxId}
                  heroHandKeyOverride={handTransitionHold.holdActiveHandKey}
                  handHoldActive={Boolean(handTransitionHold.holdActiveHandKey)}
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
      <BlackjackLayoutDebugPanel
        enabled={layoutDebug}
        layoutRootRef={layoutRootRef}
        viewRootClass={viewRootClass}
        deviceView={deviceView}
        isMobileViewport={isMobileViewport}
        visibleBoxCount={effectiveVisibleBoxCount}
        selectedBettingBoxId={selectedBettingBoxIdForUi}
        selectedBettingSlotNumber={selectedBettingSlotNumber}
        chipTargetPreview={layoutDebug ? resolveActiveChipTrayTarget() : null}
        trayComponentLabel="ValueAndChipsBar · bj-value-chips · bj-table-zone--bottom"
      />
    </div>
  );
}
