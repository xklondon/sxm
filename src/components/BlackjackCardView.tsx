import {
  useRef,
  useState,
  useEffect,
  type CSSProperties,
  type ReactNode,
  type TouchEvent,
} from "react";

import type { GameState } from "../types";

import type { BlackjackProtocolPhase } from "../engine/blackjack/protocol";

import {
  canDoubleBlackjackForState,
  canHitBlackjack,
  canSplitBlackjackForState,
  canStandBlackjack,
  getAidAdvice,
  getStakeForBox,
  getStakeChipsForBox,
  parseBlackjackHandKey,
} from "../engine/blackjack";

import { getCardById } from "../engine/deck";

import { getPlayerInitials } from "../storage/profileStorage";
import { resolveViewerPersonIdForTable } from "./viewerIdentity";
import type { AuthUser } from "../api/client";

import {
  canCallEvenMoneyForHand,
  formatCardViewBoxStatus,
  getCardViewBoxStatus,
  getCardViewHandKeyForBox,
  getCardViewHeroBoxId,
  getCardViewHeroHandKey,
  getPrimaryInsuranceActionForController,
  showHeroPlayerCards,
  isBettingPhase,
  isDealingPhase,
  isPlayerTurnPhase,
  showBettingMainStage,
  showEvenMoneyControls,
  showInsuranceControls,
  canShowPlayerDecisionControls,
  resolveViewerActionPermission,
  getActiveTurnBoxId,
} from "./blackjackViewPhase";
import { getDisplayedHandValue, getVisibleHandCardIds } from "../engine/blackjack/dealing/cardRevealDisplay";

import { getBoxCallerDisplayName } from "./boxCallerDisplay";
import { sortBoxSlotsForCardViewDisplay, type DeviceView } from "./tableViewContract";
import { TABLE_UX } from "./tableUxContract";
import {
  CHIP_DROP_BOX_ATTR,
  CHIP_DROP_SLOT_ATTR,
  chipDropKey,
} from "./chipPointerDrag";

import { StakeChips, type ChipValue } from "./ChipStack";

import { PlayingCard } from "./PlayingCard";

import {
  getBetBoxPulseClassName,
  getBoxCardVisualClasses,
  getBoxCardValueLabel,
  isCardViewBettingBoxVisuallyAssigned,
  resolveBoxBorderVisualState,
  BOX_CARD_VALUE,
  BOX_CARD_VALUE_ABOVE,
  BOX_CARD_VALUE_BUST,
  BOX_CARD_VALUE_RESERVED,
  BOX_CARD_COLUMN,
  BOX_CARD_STAKE_LABEL,
  BOX_CARD_STAKE_LABEL_RESERVED,
  BOX_CARD_CHIP_STACK,
  BOX_CARD_CHIP_STACK_RESERVED,
} from "./cardViewBox";
import { SXM_LAYOUT, sxmSectionProps } from "./sxmLayoutContract";


import "./BlackjackCardView.css";

interface BlackjackCardViewProps {
  /** Dealer zone content — rendered in bj-card-layout__dealer only. */
  dealer: ReactNode;
  /** Tray + balance row — rendered in bj-card-layout__tray only. */
  tray: ReactNode;
  /** Panel summary extras (alerts, ledger offer) above insurance/even-money. */
  summaryExtras?: ReactNode;
  /** Display state (may mask card visibility during natural dealing). */
  gameState: GameState;
  /** Authoritative engine state for hand keys, totals, and hero visibility. */
  logicalGameState?: GameState;
  /** Drives desktop vs mobile betting layout; defaults to mobile-canonical. */
  deviceView?: DeviceView;
  focusBoxId?: string;
  /** Client-local chip target — same source as Full Table selection. */
  selectedBettingBoxId?: string | null;
  activeBoxId: string | null;
  showHoleHidden: boolean;
  protocolPhase: BlackjackProtocolPhase;
  /** False while natural-deal reveal is catching up — hides decision buttons. */
  cardRevealComplete?: boolean;
  /** Active hand cards fully revealed in natural dealing (may lead full-table reveal). */
  activeHandRevealComplete?: boolean;
  bettingOpen: boolean;
  gameEnded: boolean;
  onSelectBox: (boxId: string) => void;
  onClaimSlot: (slotNumber: number) => void;
  onReleaseSlot: (slotNumber: number) => void;
  onAddChip: (boxId: string, value: ChipValue) => void;
  onClearStake: (boxId: string) => void;
  onRemoveLastChip: (boxId: string) => void;
  onSlotChipDrop: (
    slotNumber: number,
    boxId: string | null,
    e: React.DragEvent,
  ) => void;
  dropTargetId?: string | null;
  onStay: (handKey: string) => void;
  onCard: (handKey: string) => void;
  onDouble: (handKey: string) => void;
  onSplit: (handKey: string) => void;
  onTakeEvenMoney?: (handKey: string) => void;
  onWaitForBlackjackPayout?: (handKey: string) => void;
  onTakeInsurance?: (playerId: string) => void;
  onDeclineInsurance?: (playerId: string) => void;
  /** @deprecated View toggle lives in table toolbar; kept for API compatibility. */
  onBack: () => void;
  /** Seated person id for this client — drives Hit/Stand visibility in multiplayer. */
  viewerPersonId?: string | null;
  onlineTableId?: string | null;
  viewerAuth?: Pick<AuthUser, 'email' | 'displayName'> | null;
}

const SWIPE_THRESHOLD = 48;

export function BlackjackCardView({
  dealer,
  tray,
  summaryExtras,
  gameState,
  logicalGameState: logicalGameStateProp,
  deviceView = "mobile",
  focusBoxId,
  selectedBettingBoxId = null,
  activeBoxId,
  showHoleHidden: _showHoleHidden,
  protocolPhase,
  cardRevealComplete = true,
  activeHandRevealComplete = true,
  bettingOpen,
  gameEnded,
  onSelectBox,
  onClaimSlot,
  onClearStake: _onClearStake,
  onRemoveLastChip,
  onSlotChipDrop,
  dropTargetId = null,
  onStay,
  onCard,
  onDouble,
  onSplit,
  onTakeEvenMoney,
  onWaitForBlackjackPayout,
  onTakeInsurance,
  onDeclineInsurance,
  viewerPersonId: viewerPersonIdProp,
  onlineTableId = null,
  viewerAuth = null,
}: BlackjackCardViewProps) {
  const logicalGameState = logicalGameStateProp ?? gameState;
  const {
    session,
    players,
    deck,
    blackjack: round,
    blackjackSettings,
    blackjackFlowSettings,
  } = gameState;
  const logicalRound = logicalGameState.blackjack;

  const [aidTip, setAidTip] = useState<string | null>(null);

  const [swipeHint, setSwipeHint] = useState<string | null>(null);

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const bettingMainStage = showBettingMainStage(protocolPhase, gameEnded);
  const insuranceActive = showInsuranceControls(protocolPhase, round);
  const evenMoneyActive = showEvenMoneyControls(protocolPhase, round);
  const stitchedActionsActive = canShowPlayerDecisionControls(
    logicalGameState,
    protocolPhase,
    { cardRevealComplete, activeHandRevealComplete },
  );
  const isPlayerPhase = isPlayerTurnPhase(protocolPhase);

  const turnHandKey = isPlayerPhase ? (round?.activeHandKey ?? null) : null;
  const heroBoxId = getCardViewHeroBoxId(
    protocolPhase,
    activeBoxId,
    selectedBettingBoxId,
    focusBoxId ?? null,
  );
  const heroHandKey = getCardViewHeroHandKey(protocolPhase, logicalRound, heroBoxId);
  /** Hero box follows active turn in play, selected seat in betting. */

  const viewerPersonId =
    viewerPersonIdProp ??
    resolveViewerPersonIdForTable(logicalGameState, onlineTableId, viewerAuth);

  const activeTurnBoxId = getActiveTurnBoxId(logicalGameState, protocolPhase);
  const actionPermission = resolveViewerActionPermission(
    logicalGameState,
    viewerPersonId,
    { cardViewHeroBoxId: heroBoxId },
  );
  const isActiveTurn = actionPermission.canAct;
  const actionableHandKey = actionPermission.actionable?.handKey ?? null;
  const activeSlotNum = actionPermission.activeBoxId
    ? session.boxSlotNumbers?.[actionPermission.activeBoxId]
    : null;

  const logicalHand =
    heroHandKey && logicalRound?.playerHands[heroHandKey]
      ? logicalRound.playerHands[heroHandKey]
      : undefined;
  const visualHand =
    heroHandKey && round?.playerHands[heroHandKey]
      ? round.playerHands[heroHandKey]
      : undefined;

  const canHit = Boolean(
    isActiveTurn && actionableHandKey && round && canHitBlackjack(round, actionableHandKey),
  );

  const canStand = Boolean(
    isActiveTurn &&
    actionableHandKey &&
    round &&
    canStandBlackjack(round, actionableHandKey),
  );

  const logicalCardIds = (logicalHand?.cardIds ?? []).filter((id) => id.length > 0);
  const visualCardIds = (visualHand?.cardIds ?? []).filter((id) => id.length > 0);
  /** Reveal may lag authoritative state — show dealt cards once engine has them. */
  const heroCardIds = visualCardIds;

  const heroDisplayValue =
    heroHandKey !== null ? getDisplayedHandValue(deck, round, heroHandKey) : null;

  const slots = sortBoxSlotsForCardViewDisplay(gameState.tableMeta.boxSlots, deviceView);

  const heroCardsVisible = showHeroPlayerCards(
    protocolPhase,
    gameEnded,
    logicalCardIds.length,
  );
  const showSideControls =
    stitchedActionsActive && !evenMoneyActive && !insuranceActive;
  const mountPlayerActionBar =
    isPlayerPhase && !evenMoneyActive && !insuranceActive && !bettingMainStage;

  function getActionDisabledReason(): string | null {
    if (isBettingPhase(protocolPhase)) {
      return "Place bets";
    }

    if (insuranceActive) {
      return "Insurance decision";
    }

    if (evenMoneyActive) {
      return "Even-money decision";
    }

    if (protocolPhase === "bank") {
      return "Bank turn";
    }

    if (protocolPhase === "banking") {
      return "Round settled";
    }

    if (isDealingPhase(protocolPhase)) {
      return "Dealing…";
    }

    if (isPlayerPhase && actionPermission.blockReason === 'not-decision-owner' && actionPermission.waitMessage) {
      return actionPermission.waitMessage;
    }

    if (isPlayerPhase && actionPermission.blockReason === 'wrong-hero-box' && actionPermission.waitMessage) {
      return actionPermission.waitMessage;
    }

    if (isPlayerPhase && !isActiveTurn) {
      return activeSlotNum
        ? `Waiting for Box ${activeSlotNum}`
        : "Waiting for turn…";
    }

    if (isPlayerPhase && isActiveTurn && !actionableHandKey) {
      return "No active hand";
    }

    return null;
  }

  const disabledReason = getActionDisabledReason();

  const evenMoneyHandKey = evenMoneyActive ? round?.evenMoneyOfferHandKey ?? null : null;
  const canCallEvenMoney =
    evenMoneyHandKey !== null &&
    canCallEvenMoneyForHand(gameState, evenMoneyHandKey, viewerPersonId);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    console.log("[SXMCards] cardViewTurn", {
      protocolPhase,

      engineStatus: round?.status,

      activeHandKey: turnHandKey,

      heroHandKey,

      heroBoxId,

      activeBoxId,

      isActiveTurn,

      actionPermission: {
        canAct: actionPermission.canAct,
        blockReason: actionPermission.blockReason,
        decisionOwnerId: actionPermission.decisionOwnerId,
      },

      logicalCardIds,
      heroCardIds,

      canHit,

      canStand,

      disabledReason,

      showSideControls,
    });
  }, [
    protocolPhase,

    round?.status,

    turnHandKey,

    heroHandKey,

    heroBoxId,

    activeBoxId,

    isActiveTurn,

    actionPermission.canAct,
    actionPermission.blockReason,
    actionPermission.decisionOwnerId,

    logicalCardIds,
    heroCardIds,

    canHit,

    canStand,

    disabledReason,

    showSideControls,
  ]);

  function logSwipe(
    swipeDirection: "left" | "right" | null,

    actionTriggered: "stay" | "hit" | null,

    beforeHandCards: string[],

    afterHandCards?: string[],
  ) {
    if (!import.meta.env?.DEV) {
      return;
    }

    console.log("[SXMCards] cardViewSwipe", {
      swipeDirection,

      actionTriggered,

      activeHandKey: turnHandKey,

      beforeHandCards,

      afterHandCards: afterHandCards ?? beforeHandCards,
    });
  }

  function renderHugeCard(
    cardId: string,
    faceDown = false,
    size: "hero" | "bank" = "hero",
    reactKey?: string,
  ) {
    if (!deck) {
      return null;
    }

    const card = getCardById(deck, cardId);

    if (!card) {
      return null;
    }

    return (
      <PlayingCard
        key={reactKey ?? cardId}
        card={card}
        compact={false}
        faceDown={faceDown}
        animationMode="slide"
        className={[
          "bj-phone-card",

          "ds-card",

          size === "bank"
            ? "bj-phone-card--bank"
            : "bj-phone-card--hero ds-card--hero",
        ]
          .filter(Boolean)
          .join(" ")}
      />
    );
  }

  function handleTouchStart(e: TouchEvent) {
    const t = e.changedTouches[0];

    if (t) {
      touchStart.current = { x: t.clientX, y: t.clientY };
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    if (!showSideControls || !actionPermission.canAct || !actionPermission.actionable || !round) {
      return;
    }

    const swipeHandKey = actionPermission.actionable.handKey;

    const start = touchStart.current;

    touchStart.current = null;

    const t = e.changedTouches[0];

    if (!start || !t) {
      return;
    }

    const dx = t.clientX - start.x;

    const dy = Math.abs(t.clientY - start.y);

    if (dy > 60) {
      return;
    }

    const beforeHandCards = [...logicalCardIds];

    if (dx > SWIPE_THRESHOLD) {
      logSwipe(
        "right",
        canHitBlackjack(round, swipeHandKey) ? "hit" : null,
        beforeHandCards,
      );

      if (canHitBlackjack(round, swipeHandKey)) {
        setSwipeHint("Hit");

        onCard(swipeHandKey);
      }
    } else if (dx < -SWIPE_THRESHOLD) {
      logSwipe(
        "left",
        canStandBlackjack(round, swipeHandKey) ? "stay" : null,
        beforeHandCards,
      );

      if (canStandBlackjack(round, swipeHandKey)) {
        setSwipeHint("Stay");

        onStay(swipeHandKey);
      }
    }

    window.setTimeout(() => setSwipeHint(null), 600);
  }

  function handleStayClick() {
    if (!actionableHandKey || !canStand) {
      return;
    }

    if (import.meta.env?.DEV) {
      console.log("[SXMCards] cardViewAction", {
        actionTriggered: "stay",

        activeHandKey: actionableHandKey,

        beforeHandCards: logicalCardIds,
      });
    }

    onStay(actionableHandKey);
  }

  function handleHitClick() {
    if (!actionableHandKey || !canHit) {
      return;
    }

    if (import.meta.env?.DEV) {
      console.log("[SXMCards] cardViewAction", {
        actionTriggered: "hit",

        activeHandKey: actionableHandKey,

        beforeHandCards: logicalCardIds,
      });
    }

    onCard(actionableHandKey);
  }

  function handleAid() {
    if (!round || !deck || !actionableHandKey || !isActiveTurn) {
      return;
    }

    const advice = getAidAdvice(
      round,
      actionableHandKey,
      deck,
      blackjackFlowSettings,
      gameState,
      gameState.ledger,
    );

    if (advice) {
      setAidTip(advice.text);
    }
  }

  function renderCardViewBoxColumn({
    aboveLabel,
    aboveBust,
    tile,
    wager,
    stakeChips,
    showBetStakeChips,
    bettingOpen,
    boxId,
  }: {
    aboveLabel: string;
    aboveBust: boolean;
    tile: ReactNode;
    wager: number;
    stakeChips: ChipValue[];
    showBetStakeChips: boolean;
    bettingOpen: boolean;
    boxId?: string;
  }) {
    const valueReserved = aboveLabel.length === 0;
    const betReserved = wager <= 0;
    const chipsReserved = !showBetStakeChips;

    return (
      <div {...sxmSectionProps(SXM_LAYOUT.playerBox, BOX_CARD_COLUMN)}>
        <span
          {...sxmSectionProps(
            SXM_LAYOUT.playerBoxValue,
            BOX_CARD_VALUE,
            BOX_CARD_VALUE_ABOVE,
            aboveBust ? BOX_CARD_VALUE_BUST : "",
            valueReserved ? BOX_CARD_VALUE_RESERVED : "",
          )}
          aria-hidden={valueReserved || undefined}
        >
          {aboveLabel || "\u00a0"}
        </span>
        <div {...sxmSectionProps(SXM_LAYOUT.playerBoxCards)}>{tile}</div>
        <span
          {...sxmSectionProps(
            SXM_LAYOUT.playerBoxBet,
            BOX_CARD_STAKE_LABEL,
            betReserved ? BOX_CARD_STAKE_LABEL_RESERVED : "",
          )}
          aria-hidden={betReserved || undefined}
        >
          {wager > 0 ? `Bet: ${wager}` : "\u00a0"}
        </span>
        <div
          className={[
            BOX_CARD_CHIP_STACK,
            chipsReserved ? BOX_CARD_CHIP_STACK_RESERVED : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden={chipsReserved || undefined}
        >
          {showBetStakeChips && boxId ? (
            <StakeChips
              chips={stakeChips}
              variant="bet"
              removable={bettingOpen}
              onRemoveTopChip={() => onRemoveLastChip(boxId)}
            />
          ) : (
            <span aria-hidden="true">&nbsp;</span>
          )}
        </div>
      </div>
    );
  }

  function renderMiniHandBox(slotNumber: number, boxId: string) {
    const handKey = getCardViewHandKeyForBox(protocolPhase, logicalRound, boxId);
    const displayBoxHand = round?.playerHands[handKey];
    const ids = getVisibleHandCardIds(round, handKey);
    const miniTotal = getDisplayedHandValue(deck, round, handKey);
    const openStake = getStakeForBox(gameState, boxId);
    const stakeChips = getStakeChipsForBox(gameState, boxId);
    const wager = bettingMainStage ? openStake : (displayBoxHand?.currentBet ?? openStake);
    const showBetStakeChips = bettingMainStage && openStake > 0 && stakeChips.length > 0;
    const isTurnBox = activeTurnBoxId === boxId;
    const borderState = resolveBoxBorderVisualState({
      state: gameState,
      boxPlayerId: boxId,
      viewerPersonId,
      openStake,
      selectedBettingBoxId,
      activeBoxId: activeTurnBoxId,
      isDropHover: dropTargetId === chipDropKey({ slotNumber, boxId }),
      bettingStage: bettingMainStage,
      playerPhase: isPlayerPhase,
    });
    const isSelected = borderState.isSelected;
    const isTurn = borderState.isTurn;
    const bettingBoxAssigned = isCardViewBettingBoxVisuallyAssigned(
      gameState,
      boxId,
      openStake,
      viewerPersonId,
    );
    const status = getCardViewBoxStatus(
      protocolPhase,
      gameEnded,
      round,
      handKey,
      openStake,
      isTurnBox && isPlayerPhase,
    );
    const valueLabel = getBoxCardValueLabel(miniTotal, status);
    const callerDisplayName = getBoxCallerDisplayName(gameState, boxId);
    const aboveLabel =
      valueLabel ||
      (status !== "betting" && status !== "waiting" ? formatCardViewBoxStatus(status) : "");
    const showHeadInTile = ids.length === 0 && bettingMainStage;
    const showAssignedHead = showHeadInTile && bettingBoxAssigned;

    const handTile = renderCardViewBoxColumn({
      aboveLabel,
      aboveBust: status === "bust",
      wager,
      stakeChips,
      showBetStakeChips,
      bettingOpen,
      boxId,
      tile: (
        <button
          type="button"
          className={[
            getBoxCardVisualClasses(borderState),
            TABLE_UX.cardViewCompactBox,
            getBetBoxPulseClassName(bettingOpen, bettingMainStage && isSelected),
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onSelectBox(boxId)}
          aria-label={`Box ${slotNumber}${wager > 0 ? `, ${wager}c staked` : ''}`}
          aria-current={isSelected || isTurn ? "true" : undefined}
        >
          {showHeadInTile ? (
            <span className="bj-phone-view__mini-hand-head">
              <span className="bj-phone-view__mini-hand-box">Box {slotNumber}</span>
              {showAssignedHead ? (
                <span className="bj-phone-view__mini-hand-name">{callerDisplayName}</span>
              ) : null}
            </span>
          ) : null}
          <span
            className="bj-phone-view__mini-hand-card-stack"
            aria-hidden={ids.length === 0}
          >
            {ids.length > 0 && deck
              ? ids.slice(0, 3).map((id, i) => (
                  <span
                    key={id}
                    className="bj-phone-view__mini-card"
                    style={{ "--mini-card-i": i } as CSSProperties}
                  >
                    <PlayingCard card={getCardById(deck, id)!} compact />
                  </span>
                ))
              : null}
          </span>
        </button>
      ),
    });

    if (bettingMainStage && bettingOpen) {
      const dropKey = chipDropKey({ slotNumber, boxId });
      const isDrop = dropTargetId === dropKey;
      return (
        <div
          key={boxId}
          className={[
            "bj-phone-view__mini-hand-shell",
            isDrop ? "bj-phone-view__mini-hand-shell--drop" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          {...{
            [CHIP_DROP_SLOT_ATTR]: slotNumber,
            [CHIP_DROP_BOX_ATTR]: boxId,
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(e) => onSlotChipDrop(slotNumber, boxId, e)}
        >
          {handTile}
        </div>
      );
    }

    return <div key={boxId}>{handTile}</div>;
  }

  function renderBettingHeroPlaceholder() {
    return (
      <div className="bj-phone-view__hand bj-phone-view__hand--waiting">
        <div className="bj-phone-view__hero-stage">
          <div className="bj-phone-view__hero-center">
            <div className="bj-phone-view__cards-slot">
              <div
                {...sxmSectionProps(SXM_LAYOUT.heroCards, 'bj-phone-view__cards-placeholder')}
                aria-hidden="true"
              />
            </div>
            <div className="bj-phone-view__hand-meta">
              <div
                {...sxmSectionProps(
                  SXM_LAYOUT.handTotal,
                  'ds-badge ds-badge--total bj-phone-view__total bj-phone-view__total--hero',
                  TABLE_UX.cardViewTotalCompact,
                  'bj-phone-view__total--placeholder',
                )}
                aria-hidden="true"
              >
                &nbsp;
              </div>
            </div>
            <div
              className="bj-phone-view__hero-actions bj-phone-view__hero-actions--placeholder"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    );
  }

  function renderMiniEmptySlot(slotNumber: number) {
    const joinTile = renderCardViewBoxColumn({
      aboveLabel: "",
      aboveBust: false,
      wager: 0,
      stakeChips: [],
      showBetStakeChips: false,
      bettingOpen,
      tile: (
        <button
          type="button"
          className={`bj-phone-view__mini-hand bj-phone-view__mini-hand--empty ${TABLE_UX.cardViewCompactBox}`}
          onClick={() => onClaimSlot(slotNumber)}
          aria-label={`Join box ${slotNumber}`}
        >
          <span className="bj-phone-view__mini-hand-box">Box {slotNumber}</span>
          <span className="bj-phone-view__mini-hand-name">Join</span>
        </button>
      ),
    });

    if (bettingMainStage && bettingOpen) {
      const dropKey = chipDropKey({ slotNumber, boxId: null });
      const isDrop = dropTargetId === dropKey;
      return (
        <div
          key={`mini-empty-${slotNumber}`}
          className={[
            "bj-phone-view__mini-hand-shell",
            isDrop ? "bj-phone-view__mini-hand-shell--drop" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          {...{
            [CHIP_DROP_SLOT_ATTR]: slotNumber,
            [CHIP_DROP_BOX_ATTR]: "",
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(e) => onSlotChipDrop(slotNumber, null, e)}
        >
          {joinTile}
        </div>
      );
    }

    return <div key={`mini-empty-${slotNumber}`}>{joinTile}</div>;
  }

  function renderMiniBoxesRow() {
    return (
      <div className="bj-phone-view__mini-row">
        {slots.map((s) =>
          s.playerId
            ? renderMiniHandBox(s.slotNumber, s.playerId)
            : renderMiniEmptySlot(s.slotNumber),
        )}
      </div>
    );
  }

  function renderInsuranceActions() {
    if (!insuranceActive || !round) {
      return null;
    }

    const action = getPrimaryInsuranceActionForController(gameState, round, viewerPersonId);

    if (!action) {
      return null;
    }

    const { playerId, maxBet, canAfford, slotNumber } = action;

    return (
      <div className={`${TABLE_UX.playerActions} bj-phone-view__phase-actions bj-phone-view__phase-actions--insurance`} aria-live="polite">
        <div className="bj-phone-view__ins-row">
          <span className="bj-phone-view__ins-label">
            Box {slotNumber ?? "?"} — up to {maxBet}c
            {!canAfford && " (not enough chips)"}
          </span>
          {canAfford ? (
            <button
              type="button"
              className={[
                "ds-btn",
                "ds-btn--secondary",
                "bj-phone-view__ins-btn",
                "bj-table-actions__btn--legal",
                "bj-phone-view__extra-btn--legal",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onTakeInsurance?.(playerId)}
            >
              Insure {maxBet}
            </button>
          ) : null}
          <button
            type="button"
            className="ds-btn ds-btn--ghost bj-phone-view__ins-btn"
            onClick={() => onDeclineInsurance?.(playerId)}
          >
            No thanks
          </button>
        </div>
      </div>
    );
  }

  function renderEvenMoneyActions() {
    if (!evenMoneyActive || !evenMoneyHandKey) {
      return null;
    }

    if (!canCallEvenMoney) {
      const { playerId } = parseBlackjackHandKey(evenMoneyHandKey);
      const slotNum = session.boxSlotNumbers?.[playerId];
      return (
        <p className={`${TABLE_UX.playerActions} bj-phone-view__phase-actions bj-phone-view__phase-actions--wait`}>
          Box {slotNum ?? "?"} — even-money decision pending…
        </p>
      );
    }

    return (
      <div className={`${TABLE_UX.playerActions} bj-phone-view__phase-actions bj-phone-view__phase-actions--even-money`} aria-live="polite">
        <div className="bj-phone-view__even-money-actions">
          <button
            type="button"
            className="ds-btn ds-btn--secondary"
            onClick={() => onTakeEvenMoney?.(evenMoneyHandKey)}
          >
            Take 1:1
          </button>
          <button
            type="button"
            className="ds-btn ds-btn--ghost"
            onClick={() => onWaitForBlackjackPayout?.(evenMoneyHandKey)}
          >
            Wait for 3:2
          </button>
        </div>
      </div>
    );
  }

  function renderPlayHeroPlaceholder() {
    return (
      <div className="bj-phone-view__hand bj-phone-view__hand--waiting">
        <div className="bj-phone-view__hero-stage">
          <div className="bj-phone-view__hero-center">
            <div className="bj-phone-view__cards-slot">
              <div
                {...sxmSectionProps(SXM_LAYOUT.heroCards, 'bj-phone-view__cards-placeholder')}
                aria-hidden="true"
              />
            </div>
            <div className="bj-phone-view__hand-meta">
              <div
                {...sxmSectionProps(
                  SXM_LAYOUT.handTotal,
                  'ds-badge ds-badge--total bj-phone-view__total bj-phone-view__total--hero',
                  TABLE_UX.cardViewTotalCompact,
                  'bj-phone-view__total--placeholder',
                )}
                aria-hidden="true"
              >
                &nbsp;
              </div>
            </div>
            <div
              className="bj-phone-view__hero-actions bj-phone-view__hero-actions--placeholder"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    );
  }

  function renderMobileStandControl() {
    if (deviceView !== "mobile" || !showSideControls || !isActiveTurn) {
      return null;
    }

    return (
      <button
        type="button"
        className={[
          "bj-phone-view__side-action",
          "bj-phone-view__side-action--stand",
          "ds-btn",
          "ds-btn--stand",
          canStand ? "bj-phone-view__side-action--live" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        disabled={!canStand}
        onClick={handleStayClick}
        aria-label="Stand — swipe left"
      >
        <span className="bj-phone-view__side-action-label">Stand</span>
      </button>
    );
  }

  function renderMobileHitControl() {
    if (deviceView !== "mobile" || !showSideControls || !isActiveTurn) {
      return null;
    }

    return (
      <button
        type="button"
        className={[
          "bj-phone-view__side-action",
          "bj-phone-view__side-action--hit",
          "ds-btn",
          "ds-btn--hit",
          canHit ? "bj-phone-view__side-action--live" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        disabled={!canHit}
        onClick={handleHitClick}
        aria-label="Hit — swipe right"
      >
        <span className="bj-phone-view__side-action-label">Hit</span>
      </button>
    );
  }

  function renderStageContent() {
    if (protocolPhase === "banking" || gameEnded) {
      const results = round?.resultMessages ?? {};
      const lines = Object.entries(results).filter(([key]) => key !== "__round__").slice(0, 4);

      return (
        <div className="bj-phone-view__settle-results">
          {lines.length === 0 ? (
            <p>Payout complete.</p>
          ) : (
            lines.map(([key, msg]) => {
              const { playerId } = parseBlackjackHandKey(key);
              const ini = getPlayerInitials(
                players[playerId]?.controllerName ?? "",
              );
              return (
                <p key={key} className="bj-phone-view__result-line">
                  {ini ?? "Box"}: {msg}
                </p>
              );
            })
          )}
        </div>
      );
    }

    if (!heroCardsVisible) {
      return renderPlayHeroPlaceholder();
    }

    const heroBusted = logicalHand?.actionStatus === 'busted';

    const heroCenter = (
      <div className="bj-phone-view__hero-center">
        <div className="bj-phone-view__cards-slot">
          {heroCardIds.length > 0 ? (
            <div
              {...sxmSectionProps(
                SXM_LAYOUT.heroCards,
                'bj-phone-view__cards bj-phone-view__cards--fan bj-phone-view__cards--stitched',
              )}
            >
              {heroCardIds.map((id, i) => (
                <div
                  key={`${heroHandKey}-${i}-${id}`}
                  className="bj-phone-view__card-wrap"
                  style={{ "--card-i": i } as CSSProperties}
                >
                  {renderHugeCard(
                    id,
                    false,
                    "hero",
                    `${heroHandKey}-${i}-${id}`,
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div
              {...sxmSectionProps(SXM_LAYOUT.heroCards, 'bj-phone-view__cards-placeholder')}
              aria-hidden="true"
            />
          )}
        </div>
        <div className="bj-phone-view__hand-meta">
          {heroDisplayValue !== null ? (
            <div
              {...sxmSectionProps(
                SXM_LAYOUT.handTotal,
                'ds-badge ds-badge--total bj-phone-view__total bj-phone-view__total--hero',
                TABLE_UX.cardViewTotalCompact,
              )}
            >
              Total {heroDisplayValue}
            </div>
          ) : (
            <div
              {...sxmSectionProps(
                SXM_LAYOUT.handTotal,
                'ds-badge ds-badge--total bj-phone-view__total bj-phone-view__total--hero',
                TABLE_UX.cardViewTotalCompact,
                'bj-phone-view__total--placeholder',
              )}
              aria-hidden="true"
            >
              &nbsp;
            </div>
          )}
          {heroBusted ? (
            <span className="bj-phone-view__bust-label bj-phone-view__bust-label--meta" aria-label="Busted">
              BUST
            </span>
          ) : null}
        </div>
        {deviceView === "mobile" && showSideControls && isActiveTurn && (
          <p className="bj-phone-view__swipe-guide" aria-hidden="true">
            ← Stand · Hit →
          </p>
        )}
      </div>
    );

    return (
      <div className="bj-phone-view__hand">
        <div className="bj-phone-view__hero-stage">
          <div
            className={[
              "bj-phone-view__play-area",
              deviceView === "mobile" && showSideControls && isActiveTurn
                ? "bj-phone-view__play-area--controls"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {renderMobileStandControl()}
            {heroCenter}
            {renderMobileHitControl()}
          </div>
        </div>
      </div>
    );
  }

  function renderActionBarPlaceholder() {
    return (
      <div
        className="bj-phone-view__action-bar bj-phone-view__action-bar--play-placeholder"
        aria-hidden="true"
      >
        <div
          {...sxmSectionProps(
            SXM_LAYOUT.primaryActions,
            'bj-phone-view__action-bar-row bj-phone-view__action-bar-row--primary',
          )}
        />
        <div
          {...sxmSectionProps(
            SXM_LAYOUT.secondaryActions,
            'bj-phone-view__action-bar-row bj-phone-view__action-bar-row--secondary',
          )}
        />
      </div>
    );
  }

  function renderActionBar() {
    if (bettingMainStage) {
      return renderActionBarPlaceholder();
    }

    if (!mountPlayerActionBar) {
      return renderActionBarPlaceholder();
    }

    const actionsEnabled = showSideControls && isActiveTurn;

    if (!actionsEnabled && disabledReason) {
      return (
        <div className="bj-phone-view__action-bar bj-phone-view__action-bar--wait">
          <p className={TABLE_UX.playerActions} aria-live="polite">
            {disabledReason}
          </p>
        </div>
      );
    }

    const canDoubleNow =
      actionsEnabled &&
      actionableHandKey &&
      blackjackSettings.allowDoubleDown &&
      canDoubleBlackjackForState(logicalGameState, actionableHandKey);
    const canSplitNow =
      actionsEnabled &&
      actionableHandKey &&
      blackjackSettings.allowSplit &&
      deck &&
      canSplitBlackjackForState(gameState, actionableHandKey);
    const showDouble = blackjackSettings.allowDoubleDown;
    const showSplit = blackjackSettings.allowSplit && Boolean(deck);
    const showAid = blackjackFlowSettings.adviceEnabled;

    return (
      <div
        className={`${TABLE_UX.playerActions} ${TABLE_UX.cardViewBareActions} bj-phone-view__action-bar bj-phone-view__action-bar--playing`}
        aria-label="Player actions"
      >
        <div
          {...sxmSectionProps(
            SXM_LAYOUT.primaryActions,
            'bj-phone-view__action-bar-row bj-phone-view__action-bar-row--primary',
          )}
        >
          <button
            type="button"
            className={[
              "bj-phone-view__action-bar-btn",
              "bj-phone-view__action-bar-btn--stand",
              "ds-btn",
              "ds-btn--stand",
              actionsEnabled ? "bj-phone-view__action-bar-btn--live" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={!actionsEnabled || !canStand}
            onClick={handleStayClick}
          >
            Stand
          </button>
          <button
            type="button"
            className={[
              "bj-phone-view__action-bar-btn",
              "bj-phone-view__action-bar-btn--hit",
              "ds-btn",
              "ds-btn--hit",
              actionsEnabled ? "bj-phone-view__action-bar-btn--live" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={!actionsEnabled || !canHit}
            onClick={handleHitClick}
          >
            Hit
          </button>
        </div>
        <div
          {...sxmSectionProps(
            SXM_LAYOUT.secondaryActions,
            'bj-phone-view__action-bar-row bj-phone-view__action-bar-row--secondary',
          )}
        >
          {showDouble ? (
            <button
              type="button"
              className={[
                "bj-phone-view__action-bar-extra",
                TABLE_UX.cardViewActionCompact,
                "bj-phone-view__action-btn--tappable",
                canDoubleNow ? "bj-phone-view__action-bar-extra--legal" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={!canDoubleNow}
              onClick={() => actionableHandKey && onDouble(actionableHandKey)}
            >
              2×
            </button>
          ) : (
            <span className="bj-phone-view__action-bar-extra bj-phone-view__action-bar-extra--placeholder" aria-hidden="true" />
          )}
          {showSplit ? (
            <button
              type="button"
              className={[
                "bj-phone-view__action-bar-extra",
                TABLE_UX.cardViewActionCompact,
                "bj-phone-view__action-btn--tappable",
                canSplitNow ? "bj-phone-view__action-bar-extra--legal" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={!canSplitNow}
              onClick={() => actionableHandKey && onSplit(actionableHandKey)}
            >
              Split
            </button>
          ) : (
            <span className="bj-phone-view__action-bar-extra bj-phone-view__action-bar-extra--placeholder" aria-hidden="true" />
          )}
          {showAid ? (
            <button
              type="button"
              className={`bj-phone-view__action-bar-extra ${TABLE_UX.cardViewActionCompact} bj-phone-view__action-btn--tappable bj-phone-view__action-bar-extra--aid`}
              disabled={!actionsEnabled}
              onClick={handleAid}
            >
              AID
            </button>
          ) : (
            <span className="bj-phone-view__action-bar-extra bj-phone-view__action-bar-extra--placeholder" aria-hidden="true" />
          )}
        </div>
      </div>
    );
  }

  function renderSummaryZoneContent() {
    if (bettingMainStage) {
      return <div className={TABLE_UX.cardLayoutSummaryPlaceholder} aria-hidden="true" />;
    }
    const insurance = renderInsuranceActions();
    const evenMoney = renderEvenMoneyActions();
    const content = insurance ?? evenMoney;
    return content ?? <div className={TABLE_UX.summaryPlaceholder} aria-hidden="true" />;
  }

  /** Card View uses fixed grid rows. Do not position boxes with flex or phase-dependent margins. */
  return (
    <div className={`${TABLE_UX.cardLayout} bj-phone-view ${TABLE_UX.columnSurface}`}>
      <div className={TABLE_UX.cardLayoutDealer}>{dealer}</div>

      <div {...sxmSectionProps(SXM_LAYOUT.statusZone, TABLE_UX.cardLayoutSummary)}>
        {summaryExtras}
        {renderSummaryZoneContent()}
      </div>

      <div {...sxmSectionProps(SXM_LAYOUT.heroZone, TABLE_UX.cardLayoutHero)}>
        <div className="bj-phone-view__axis">
          <div className="bj-phone-view__play-stack">
            <div
              className="bj-phone-view__stage"
              onTouchStart={bettingMainStage ? undefined : handleTouchStart}
              onTouchEnd={bettingMainStage ? undefined : handleTouchEnd}
            >
              {bettingMainStage ? renderBettingHeroPlaceholder() : renderStageContent()}

              {!bettingMainStage && swipeHint && (
                <p className="bj-phone-view__swipe-hint">{swipeHint}</p>
              )}

              {!bettingMainStage && aidTip && <p className="bj-phone-view__aid">{aidTip}</p>}
            </div>
          </div>
        </div>
      </div>

      <div {...sxmSectionProps(SXM_LAYOUT.actionZone, TABLE_UX.cardLayoutActions)}>
        {renderActionBar()}
      </div>

      <div {...sxmSectionProps(SXM_LAYOUT.playerBoxesZone, TABLE_UX.cardLayoutBoxes)}>
        {renderMiniBoxesRow()}
      </div>

      <div className={TABLE_UX.cardLayoutTray}>{tray}</div>
    </div>
  );
}
