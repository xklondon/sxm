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
import { DealerBlock } from './DealerBlock';
import { LocalProfileSetup } from './LocalProfileSetup';
import { PlayLedgerModal, ScoreLedgerModal } from './LedgerModals';
import { AssignChipsModal } from './AssignChipsModal';
import { ChangeMinBetModal } from './ChangeMinBetModal';
import { TableAccountsPanel } from './TableAccountsPanel';
import {
  takeInsuranceOnState,
  declineInsuranceOnState,
  insuranceBetMax,
  takeEvenMoneyOnState,
  waitForBlackjackPayoutOnState,
  getStakeBetValidationMessage,
} from '../engine/blackjack';
import { isTableOwner } from '../engine/session';
import { getTableWagerDisplay } from '../engine/session/wagerDisplay';
import {
  addGameToPersonalLedger,
  hasPersonalLedgerEntryForTable,
} from '../engine/scoreLedger/scoreLedger';
import { canUserAssignChips } from '../engine/table/adminControls';
import { getVisibleDealerCardIds } from '../engine/blackjack/protocolState';
import { MAX_TABLE_BOXES } from '../types/table';
import { getPlayerInitials, loadProfile, type PlayFlowAutoStand } from '../storage/profileStorage';
import { isOnlineModeEnabled } from '../api/config';
import { useIsMobileViewport, shouldShowMobileFullTableFallback } from '../hooks/useIsMobileViewport';
import { FullTableMobileFallback } from './FullTableMobileFallback';
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
}

function arcVisualIndex(slotNumber: number): number {
  return MAX_BOXES - slotNumber;
}

export function BlackjackPanel({
  gameState,
  onGameStateChange,
  onJoinTable,
  onInviteTable,
  onlineDispatch,
  onlineActionInFlight = false,
}: BlackjackPanelProps) {
  const { session, players, ledger, deck, blackjack, blackjackSettings, tableViewMode, tableMeta } =
    gameState;
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const [error, setError] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(
    () => !isOnlineModeEnabled() && !loadProfile().name.trim(),
  );
  const [playLedgerOpen, setPlayLedgerOpen] = useState(false);
  const [scoreLedgerOpen, setScoreLedgerOpen] = useState(false);
  const [personalLedgerAdded, setPersonalLedgerAdded] = useState(false);
  const [assignChipsOpen, setAssignChipsOpen] = useState(false);
  const [minBetOpen, setMinBetOpen] = useState(false);
  const [accountsCollapsed, setAccountsCollapsed] = useState(false);
  const [tableAidTip, setTableAidTip] = useState<string | null>(null);

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
  const round = blackjack;
  const hasDeck = deck !== null;
  const deckCount = deck ? getShoeDeckCount(deck) : blackjackSettings.numberOfDecks;
  const remaining = deck ? getRemainingCardCount(deck) : 0;
  const viewMode = tableViewMode;
  const effectiveBoxId = gameState.selectedSeatId ?? defaultBlackjackSeatId(gameState);
  const flowSettings = gameState.blackjackFlowSettings;
  const profile = loadProfile();
  const controllerName = profile.name.trim() || tableMeta.controllerName;
  const tableOwner = isTableOwner(gameState, controllerName);
  const canAssignChips = canUserAssignChips(gameState, controllerName);
  const minimumBet = getTableMinimumBet(gameState);
  const canChangeMinBet = tableOwner && canChangeMinimumBet(gameState);
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
    run((s) => ({ ...s, tableViewMode: mode }));
  }

  function selectBox(boxId: string) {
    run((s) => ({ ...s, selectedSeatId: boxId }));
  }

  function addChipToBox(boxId: string, amount: ChipValue) {
    run(
      (s) => {
        const personId = resolveControllerPersonId(s, controllerName);
        return addChipToBoxStake(s, boxId, amount, personId ?? undefined);
      },
      { type: 'placeBet', payload: { boxId, amount } },
    );
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

    if (boxId) {
      addChipToBox(boxId, value);
      return;
    }

    if (onlineDispatch) {
      run(() => gameStateRef.current, { type: 'placeBet', payload: { slotNumber, amount: value } });
      return;
    }

    setError(null);
    try {
      const profile = loadProfile();
      const name = profile.name.trim() || gameStateRef.current.tableMeta.controllerName;
      const claimed = claimBoxSlot(
        { ...gameStateRef.current, tableMeta: { ...gameStateRef.current.tableMeta, controllerName: name } },
        slotNumber,
      );
      const newBoxId = claimed.selectedSeatId;
      if (newBoxId) {
        const personId = resolveControllerPersonId(claimed, name);
        onGameStateChange(addChipToBoxStake(claimed, newBoxId, value, personId ?? undefined));
      } else {
        onGameStateChange(claimed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not claim box');
    }
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
    setError(null);
    try {
      const name = controllerName;
      const claimed = claimBoxSlot(
        { ...gameStateRef.current, tableMeta: { ...gameStateRef.current.tableMeta, controllerName: name } },
        slotNumber,
      );
      onGameStateChange(claimed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not claim box');
    }
  }

  function handleReleaseSlot(slotNumber: number) {
    run((state) => releaseBoxSlot(state, slotNumber));
  }

  function handleChipTrayClick(value: ChipValue) {
    if (!effectiveBoxId) {
      setError('Tap a box to bet');
      return;
    }
    addChipToBox(effectiveBoxId, value);
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
  const blockingError = displayError;
  const shoeStarted = Boolean(tableMeta.shoeStarted);

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

    const canHit = canHitBlackjack(round, turnHandKey);
    const canStand = canStandBlackjack(round, turnHandKey);

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
            onClick={() => run((s) => standBlackjackOnState(s, turnHandKey), { type: 'stand', payload: { handKey: turnHandKey } })}
          >
            Stay
          </button>
          <button
            type="button"
            className="ds-btn ds-btn--hit bj-table-actions__btn"
            disabled={!canHit}
            onClick={() => run((s) => hitBlackjackOnState(s, turnHandKey), { type: 'hit', payload: { handKey: turnHandKey } })}
          >
            Hit
          </button>
          {blackjackSettings.allowDoubleDown && (
            <button
              type="button"
              className="ds-btn ds-btn--secondary bj-table-actions__btn bj-table-actions__btn--sm"
              disabled={!deck || !canDoubleBlackjackForState(gameState, turnHandKey)}
              onClick={() => run((s) => doubleDownBlackjackOnState(s, turnHandKey), { type: 'double', payload: { handKey: turnHandKey } })}
            >
              2×
            </button>
          )}
          {blackjackSettings.allowSplit && deck && (
            <button
              type="button"
              className="ds-btn ds-btn--secondary bj-table-actions__btn bj-table-actions__btn--sm"
              disabled={!canSplitBlackjackForState(gameState, turnHandKey)}
              onClick={() => run((s) => splitBlackjackOnState(s, turnHandKey), { type: 'split', payload: { handKey: turnHandKey } })}
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

    const pendingPlayerIds = session.playerIds.filter((pid) => {
      const hand = round.playerHands[blackjackHandKey(pid, 0)];
      if (!hand || hand.currentBet <= 0) {
        return false;
      }
      const declined = round.insuranceDeclined?.[pid];
      const insBet = round.insuranceBets?.[pid] ?? 0;
      return !declined && insBet <= 0;
    });

    const myPending = pendingPlayerIds.filter(
      (pid) => players[pid]?.controllerName === controllerName,
    );

    if (myPending.length === 0) {
      return (
        <p className="bj-table-actions bj-table-actions--wait">
          Dealer shows Ace — waiting for insurance decisions…
        </p>
      );
    }

    return (
      <div className="bj-table-actions bj-table-actions--insurance" aria-live="polite">
        <p className="bj-table-actions__label">Dealer shows Ace — insurance pays 2:1</p>
        {myPending.map((pid) => {
          const hand = round.playerHands[blackjackHandKey(pid, 0)];
          const maxIns = hand ? insuranceBetMax(hand.currentBet) : 0;
          const slotNum = session.boxSlotNumbers?.[pid];
          return (
            <div key={pid} className="bj-table-actions__ins-row">
              <span className="bj-table-actions__ins-label">
                Box {slotNum ?? '?'} — up to {maxIns}c
              </span>
              <button
                type="button"
                className="ds-btn ds-btn--secondary bj-table-actions__btn bj-table-actions__btn--sm"
                onClick={() => run((s) => takeInsuranceOnState(s, pid), { type: 'takeInsurance', payload: { playerId: pid } })}
              >
                Insure {maxIns}
              </button>
              <button
                type="button"
                className="ds-btn ds-btn--ghost bj-table-actions__btn bj-table-actions__btn--sm"
                onClick={() => run((s) => declineInsuranceOnState(s, pid), { type: 'declineInsurance', payload: { playerId: pid } })}
              >
                No thanks
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  function renderActiveMiniHand() {
    if (protocolPhase !== 'player' || !round?.activeHandKey || !deck) {
      return null;
    }
    const handKey = round.activeHandKey;
    const hand = round.playerHands[handKey];
    const visibleIds = (hand?.cardIds ?? []).filter(Boolean);
    if (!hand || visibleIds.length === 0) {
      return null;
    }
    const cards = cardsFromIds(deck, visibleIds);
    const { value } = getBlackjackHandValue(cards);
    return (
      <div className="bj-center-mini-hand" aria-label={`Active hand total ${value}, stake ${hand.currentBet}`}>
        <div className="bj-center-mini-hand__cards">
          {visibleIds.map((id, index) => renderCard(id, false, true, `mini-${handKey}-${index}`))}
        </div>
        <p className="bj-center-mini-hand__meta">
          {value} · stake {hand.currentBet}
        </p>
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
              const result = round?.resultMessages[handKey];
              return (
                <div key={handKey} className="bj-arc__hand">
                  <span className="bj-arc__total-lg">{value}</span>
                  <div className="bj-cards-fan">
                    {cardIds.map((id, index) => renderCard(id, false, true, `${handKey}-${index}`))}
                  </div>
                  {result && <span className="bj-arc__result">{result}</span>}
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
    <div className="bj-casino" aria-label="Blackjack table">
      {tableMeta.showBankerSetup && tableMeta.agreement && (
        <BankerSetupPanel gameState={gameState} onConfirm={onGameStateChange} />
      )}

      <div className="bj-casino__toolbar">
        <div className="bj-casino__view-toggle">
          <button type="button" className={viewMode === 'full' ? 'bj-casino__view-btn--active' : 'bj-casino__view-btn'} onClick={() => setViewMode('full')}>Full Table</button>
          <button type="button" className={viewMode === 'card' ? 'bj-casino__view-btn--active' : 'bj-casino__view-btn'} onClick={() => setViewMode('card')}>Card View</button>
        </div>
        <div className="bj-casino__toolbar-actions">
          <button
            type="button"
            className="secondary bj-casino__accounts-btn"
            onClick={() => setAccountsCollapsed((v) => !v)}
          >
            This Table
          </button>
          <button type="button" className="secondary" onClick={() => setPlayLedgerOpen(true)}>Play Ledger</button>
          <button type="button" className="secondary" onClick={() => setScoreLedgerOpen(true)}>Score Ledger</button>
          <button type="button" className="secondary" onClick={() => setProfileOpen(true)}>Profile</button>
          {onJoinTable && <button type="button" className="secondary" onClick={onJoinTable}>+ Join</button>}
          <button type="button" className="secondary" onClick={() => setSettingsOpen(true)}>Settings</button>
        </div>
      </div>

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
      <BlackjackFlowSettingsMenu gameState={gameState} onGameStateChange={onGameStateChange} open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <PlayLedgerModal gameState={gameState} open={playLedgerOpen} onClose={() => setPlayLedgerOpen(false)} />
      <ScoreLedgerModal open={scoreLedgerOpen} onClose={() => setScoreLedgerOpen(false)} />
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

      {shouldShowMobileFullTableFallback(isMobileViewport, viewMode) ? (
        <FullTableMobileFallback onSwitchToCardView={() => setViewMode('card')} />
      ) : (
      <div className="bj-casino__rail">
        <div className={`bj-casino__felt bj-casino__felt--with-account${viewMode === 'card' ? ' bj-casino__felt--card-view' : ''}`}>
          {viewMode === 'full' && (
            <>
              <div className="bj-casino__felt-main">
              <DealerBlock
                deckCount={deckCount}
                totalCards={deckCount * 52}
                remaining={remaining}
                playingFor={playingFor}
                minimumBet={minimumBet}
                canChangeMinBet={canChangeMinBet}
                onChangeMinBet={() => setMinBetOpen(true)}
                awaitingNextRound={awaitingNextRound}
                gameEnded={gameEnded}
                gameOverMessage={gameOverMessage}
                onNextRound={handleNextRound}
                dealerCards={dealerCardNodes}
                protocolPhase={protocolPhase}
                hasDeck={hasDeck}
                bankerReady={bankerReady}
                shoeStarted={shoeStarted}
                bettingOpen={bettingOpen}
                canDeal={canDeal}
                hasStakes={hasStakes}
                onShuffleToStart={handleShuffleToStart}
                onDealCards={handleDealCards}
                onDealNextCard={handleDealNextCard}
                onDrawBank={handleDrawBank}
                dealActionPending={dealActionPending}
                engineStatus={engineStatus}
                initialDealManual={initialDealStaged}
                bankDrawManual={flowSettings.bankDrawMode === 'manual'}
              />

              <p className={`bj-center-status${gameEnded ? ' bj-center-status--game-over' : ''}`} aria-live="polite">
                {gameEnded ? gameOverMessage : centerStatus}
              </p>
              {gameEnded && (
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

              {renderActiveMiniHand()}

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
              <TableAccountsPanel
                gameState={gameState}
                showAssignButton={canAssignChips}
                onAssignChips={() => setAssignChipsOpen(true)}
                onInvite={onInviteTable}
                showPlayerOrderControls={tableOwner && bettingOpen}
                onMovePlayer={handleMovePlayer}
                onPlayFlowChange={handlePlayFlowChange}
                collapsed={accountsCollapsed}
              />
            </>
          )}

          {viewMode === 'card' && (
            <>
              <div className="bj-casino__felt-main bj-casino__felt-main--card">
                <DealerBlock
                  deckCount={deckCount}
                  totalCards={deckCount * 52}
                  remaining={remaining}
                  playingFor={playingFor}
                  minimumBet={minimumBet}
                  canChangeMinBet={canChangeMinBet}
                  onChangeMinBet={() => setMinBetOpen(true)}
                  awaitingNextRound={awaitingNextRound}
                  gameEnded={gameEnded}
                  gameOverMessage={gameOverMessage}
                  onNextRound={handleNextRound}
                  dealerCards={dealerCardNodes}
                  protocolPhase={protocolPhase}
                  hasDeck={hasDeck}
                  bankerReady={bankerReady}
                  shoeStarted={shoeStarted}
                  bettingOpen={bettingOpen}
                  canDeal={canDeal}
                  hasStakes={hasStakes}
                  onShuffleToStart={handleShuffleToStart}
                  onDealCards={handleDealCards}
                  onDealNextCard={handleDealNextCard}
                  onDrawBank={handleDrawBank}
                  dealActionPending={dealActionPending}
                  engineStatus={engineStatus}
                  initialDealManual={initialDealStaged}
                  bankDrawManual={flowSettings.bankDrawMode === 'manual'}
                />

                <p className={`bj-center-status${gameEnded ? ' bj-center-status--game-over' : ''}`} aria-live="polite">
                  {gameEnded ? gameOverMessage : centerStatus}
                </p>
                {gameEnded && (
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
                  onStay={(hk) => run((s) => standBlackjackOnState(s, hk), { type: 'stand', payload: { handKey: hk } })}
                  onCard={(hk) => run((s) => hitBlackjackOnState(s, hk), { type: 'hit', payload: { handKey: hk } })}
                  onDouble={(hk) => run((s) => doubleDownBlackjackOnState(s, hk), { type: 'double', payload: { handKey: hk } })}
                  onSplit={(hk) => run((s) => splitBlackjackOnState(s, hk), { type: 'split', payload: { handKey: hk } })}
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
              <TableAccountsPanel
                gameState={gameState}
                showAssignButton={canAssignChips}
                onAssignChips={() => setAssignChipsOpen(true)}
                onInvite={onInviteTable}
                showPlayerOrderControls={tableOwner && bettingOpen}
                onMovePlayer={handleMovePlayer}
                onPlayFlowChange={handlePlayFlowChange}
                collapsed={accountsCollapsed}
              />
            </>
          )}

          {blockingError && <p className="bj-casino__error" role="alert">{blockingError}</p>}
        </div>
      </div>
      )}
    </div>
  );
}
