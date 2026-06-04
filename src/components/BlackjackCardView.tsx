import {
  useRef,
  useState,
  useEffect,
  type CSSProperties,
  type TouchEvent,
} from "react";

import type { GameState } from "../types";

import type { BlackjackProtocolPhase } from "../engine/blackjack/protocol";

import {
  canDoubleBlackjackForState,
  canHitBlackjack,
  canSplitBlackjackForState,
  canStandBlackjack,
  cardsFromIds,
  getAidAdvice,
  getBlackjackHandValue,
  getStakeForBox,
  getStakeChipsForBox,
  parseBlackjackHandKey,
} from "../engine/blackjack";

import { getCardById } from "../engine/deck";

import { getPlayerInitials, loadProfile } from "../storage/profileStorage";
import {
  canControllerCallBox,
  getCallerPersonIdForBox,
  resolveControllerPersonId,
} from "../engine/session";

import {
  canCallEvenMoneyForHand,
  formatCardViewBoxStatus,
  getActionableHandForView,
  getCardViewBoxStatus,
  getCardViewHeroBoxId,
  getCardViewHeroHandKey,
  getInsuranceActionsForController,
  isBettingPhase,
  isDealingPhase,
  isPlayerTurnPhase,
  showBettingMainStage,
  showEvenMoneyControls,
  showInsuranceControls,
  showStitchedActionControls,
  showStitchedPlayerCards,
} from "./blackjackViewPhase";

import { getBoxCallerDisplayName } from "./boxCallerDisplay";
import { sortBoxSlotsForCardViewDisplay, type DeviceView } from "./tableViewContract";

import { isOnlineModeEnabled } from "../api/config";

import { StakeChips, type ChipValue } from "./ChipStack";

import { PlayingCard } from "./PlayingCard";

import {
  getBetBoxPulseClassName,
  getBoxCardClassName,
  getBoxCardValueLabel,
  BOX_CARD_VALUE,
  BOX_CARD_VALUE_BUST,
} from "./cardViewBox";


import "./BlackjackCardView.css";

interface BlackjackCardViewProps {
  gameState: GameState;
  /** Drives desktop vs mobile betting layout; defaults to mobile-canonical. */
  deviceView?: DeviceView;
  focusBoxId?: string;
  activeBoxId: string | null;
  showHoleHidden: boolean;
  protocolPhase: BlackjackProtocolPhase;
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
}

const SWIPE_THRESHOLD = 48;

export function BlackjackCardView({
  gameState,
  deviceView = "mobile",
  focusBoxId,
  activeBoxId,
  showHoleHidden: _showHoleHidden,
  protocolPhase,
  bettingOpen,
  gameEnded,
  onSelectBox,
  onClaimSlot,
  onClearStake: _onClearStake,
  onRemoveLastChip,
  onSlotChipDrop,
  onStay,
  onCard,
  onDouble,
  onSplit,
  onTakeEvenMoney,
  onWaitForBlackjackPayout,
  onTakeInsurance,
  onDeclineInsurance,
}: BlackjackCardViewProps) {
  const {
    session,
    players,
    deck,
    blackjack: round,
    blackjackSettings,
    blackjackFlowSettings,
  } = gameState;

  const [aidTip, setAidTip] = useState<string | null>(null);

  const [swipeHint, setSwipeHint] = useState<string | null>(null);

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const bettingMainStage = showBettingMainStage(protocolPhase, gameEnded);
  const insuranceActive = showInsuranceControls(protocolPhase, round);
  const evenMoneyActive = showEvenMoneyControls(protocolPhase, round);
  const stitchedActionsActive = showStitchedActionControls(protocolPhase, round);
  const isPlayerPhase = isPlayerTurnPhase(protocolPhase);

  const turnHandKey = isPlayerPhase ? (round?.activeHandKey ?? null) : null;
  const turnBoxId = turnHandKey ? parseBlackjackHandKey(turnHandKey).playerId : null;
  const heroBoxId = getCardViewHeroBoxId(
    protocolPhase,
    activeBoxId,
    gameState.selectedSeatId,
    focusBoxId ?? null,
  );
  const heroHandKey = getCardViewHeroHandKey(protocolPhase, round, heroBoxId);
  /** Hero box follows active turn in play, selected seat in betting. */

  const controllerLabel =
    loadProfile().name.trim() || gameState.tableMeta.controllerName;
  const controllerPersonId = resolveControllerPersonId(gameState, controllerLabel);
  const callerPersonId = turnBoxId ? getCallerPersonIdForBox(gameState, turnBoxId) : null;
  const caller = callerPersonId ? players[callerPersonId] : null;
  const callerName = caller?.controllerName?.trim() || caller?.displayName || "caller";
  const isCaller =
    turnBoxId !== null &&
    controllerPersonId !== null &&
    canControllerCallBox(gameState, turnBoxId, controllerPersonId);

  const hand =
    heroHandKey && round?.playerHands[heroHandKey]
      ? round.playerHands[heroHandKey]
      : undefined;

  // Canonical gate shared with Full Table: the hero box is actionable only when
  // it owns the server-authoritative active hand and the viewer may call it.
  const actionable = getActionableHandForView(
    gameState,
    controllerPersonId,
    isOnlineModeEnabled(),
  );
  const isActiveTurn =
    actionable !== null &&
    heroBoxId !== null &&
    actionable.boxId === heroBoxId;

  const activeSlotNum = turnBoxId
    ? session.boxSlotNumbers?.[turnBoxId]
    : null;

  /** Card ids from engine hand only — no local card state. */

  const cardIds = (hand?.cardIds ?? []).filter((id) => id.length > 0);

  const cards = deck ? cardsFromIds(deck, cardIds) : [];

  const { value } = getBlackjackHandValue(cards);

  const slots = sortBoxSlotsForCardViewDisplay(gameState.tableMeta.boxSlots, deviceView);

  const selectedId = gameState.selectedSeatId ?? heroBoxId;

  const stitchedCardsVisible = showStitchedPlayerCards(
    protocolPhase,
    gameEnded,
    cardIds.length,
  );
  const showSideControls =
    stitchedActionsActive && !evenMoneyActive && !insuranceActive;

  const canHit = Boolean(
    isActiveTurn && turnHandKey && round && canHitBlackjack(round, turnHandKey),
  );

  const canStand = Boolean(
    isActiveTurn &&
    turnHandKey &&
    round &&
    canStandBlackjack(round, turnHandKey),
  );

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

    if (isPlayerPhase && turnHandKey && !isCaller) {
      return activeSlotNum
        ? `Waiting for ${callerName} to call Box ${activeSlotNum}.`
        : `Waiting for ${callerName} to call.`;
    }

    if (isPlayerPhase && !isActiveTurn) {
      return activeSlotNum
        ? `Waiting for Box ${activeSlotNum}`
        : "Waiting for turn…";
    }

    if (isPlayerPhase && isActiveTurn && !turnHandKey) {
      return "No active hand";
    }

    return null;
  }

  const disabledReason = getActionDisabledReason();

  const evenMoneyHandKey = evenMoneyActive ? round?.evenMoneyOfferHandKey ?? null : null;
  const canCallEvenMoney =
    evenMoneyHandKey !== null &&
    canCallEvenMoneyForHand(gameState, evenMoneyHandKey, controllerLabel);

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

      cardIds,

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

    cardIds,

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
    if (!isPlayerPhase || !turnHandKey || !round) {
      return;
    }

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

    const beforeHandCards = [...cardIds];

    if (dx > SWIPE_THRESHOLD) {
      logSwipe(
        "right",
        canHitBlackjack(round, turnHandKey) ? "hit" : null,
        beforeHandCards,
      );

      if (canHitBlackjack(round, turnHandKey)) {
        setSwipeHint("Hit");

        onCard(turnHandKey);
      }
    } else if (dx < -SWIPE_THRESHOLD) {
      logSwipe(
        "left",
        canStandBlackjack(round, turnHandKey) ? "stay" : null,
        beforeHandCards,
      );

      if (canStandBlackjack(round, turnHandKey)) {
        setSwipeHint("Stay");

        onStay(turnHandKey);
      }
    }

    window.setTimeout(() => setSwipeHint(null), 600);
  }

  function handleStayClick() {
    if (!turnHandKey || !canStand) {
      return;
    }

    if (import.meta.env?.DEV) {
      console.log("[SXMCards] cardViewAction", {
        actionTriggered: "stay",

        activeHandKey: turnHandKey,

        beforeHandCards: cardIds,
      });
    }

    onStay(turnHandKey);
  }

  function handleHitClick() {
    if (!turnHandKey || !canHit) {
      return;
    }

    if (import.meta.env?.DEV) {
      console.log("[SXMCards] cardViewAction", {
        actionTriggered: "hit",

        activeHandKey: turnHandKey,

        beforeHandCards: cardIds,
      });
    }

    onCard(turnHandKey);
  }

  function handleAid() {
    if (!round || !deck || !turnHandKey) {
      return;
    }

    const advice = getAidAdvice(
      round,
      turnHandKey,
      deck,
      blackjackFlowSettings,
      gameState,
      gameState.ledger,
    );

    if (advice) {
      setAidTip(advice.text);
    }
  }

  function renderMiniHandBox(slotNumber: number, boxId: string) {
    const handKey = `${boxId}:0`;
    const boxHand = round?.playerHands[handKey];
    const ids = (boxHand?.cardIds ?? []).filter(Boolean);
    const miniCards = deck ? cardsFromIds(deck, ids) : [];
    const miniTotal =
      miniCards.length > 0 ? getBlackjackHandValue(miniCards).value : null;
    const openStake = getStakeForBox(gameState, boxId);
    const stakeChips = getStakeChipsForBox(gameState, boxId);
    const wager = bettingMainStage ? openStake : (boxHand?.currentBet ?? openStake);
    const showBetStakeChips = bettingMainStage && openStake > 0 && stakeChips.length > 0;
    const isTurnBox = boxId === heroBoxId;
    const isActiveBox = bettingMainStage
      ? boxId === selectedId
      : isPlayerPhase && boxId === activeBoxId;
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

    const handTile = (
      <button
        type="button"
        className={[
          getBoxCardClassName(isActiveBox),
          getBetBoxPulseClassName(bettingOpen, true),
          showBetStakeChips ? "bj-phone-view__mini-hand--has-stake" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => onSelectBox(boxId)}
        aria-label={`Box ${slotNumber}${wager > 0 ? `, ${wager}c staked` : ''}`}
        aria-current={isActiveBox ? "true" : undefined}
      >
        {valueLabel && (
          <span
            className={[
              BOX_CARD_VALUE,
              status === "bust" ? BOX_CARD_VALUE_BUST : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {valueLabel}
          </span>
        )}
        <span className="bj-phone-view__mini-hand-head">
          <span className="bj-phone-view__mini-hand-box">Box {slotNumber}</span>
          <span className="bj-phone-view__mini-hand-name">{callerDisplayName}</span>
        </span>
        <span
          className="bj-phone-view__mini-stake-slot"
          aria-hidden={!showBetStakeChips}
        >
          {showBetStakeChips ? (
            <StakeChips
              chips={stakeChips}
              variant="bet"
              removable={bettingOpen}
              onRemoveTopChip={() => onRemoveLastChip(boxId)}
            />
          ) : null}
        </span>
        {ids.length > 0 && deck && (
          <span className="bj-phone-view__mini-hand-cards">
            {ids.slice(0, 3).map((id) => (
              <PlayingCard
                key={id}
                card={getCardById(deck, id)!}
                compact
                className="bj-phone-view__mini-card"
              />
            ))}
          </span>
        )}
        <span className="bj-phone-view__mini-hand-meta">
          {miniTotal !== null && <span>T {miniTotal}</span>}
          {wager > 0 && !showBetStakeChips && <span>W {wager}c</span>}
          {status !== 'betting' && (
            <span className={`bj-phone-view__mini-hand-status bj-phone-view__mini-hand-status--${status}`}>
              {formatCardViewBoxStatus(status)}
            </span>
          )}
          {status === 'betting' && (
            <span
              className="bj-phone-view__mini-hand-status bj-phone-view__mini-hand-status--betting bj-phone-view__mini-hand-status--reserved"
              aria-hidden="true"
            >
              &nbsp;
            </span>
          )}
        </span>
      </button>
    );

    if (bettingMainStage && bettingOpen) {
      return (
        <div
          key={boxId}
          className="bj-phone-view__mini-hand-shell"
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
              <div className="bj-phone-view__cards-placeholder" aria-hidden="true" />
            </div>
            <div className="bj-phone-view__hand-meta">
              <div
                className="ds-badge ds-badge--total bj-phone-view__total bj-phone-view__total--hero bj-phone-view__total--placeholder"
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
    const joinTile = (
      <button
        type="button"
        className="bj-phone-view__mini-hand bj-phone-view__mini-hand--empty"
        onClick={() => onClaimSlot(slotNumber)}
        aria-label={`Join box ${slotNumber}`}
      >
        <span className="bj-phone-view__mini-hand-box">Box {slotNumber}</span>
        <span className="bj-phone-view__mini-hand-name">Join</span>
      </button>
    );

    if (bettingMainStage && bettingOpen) {
      return (
        <div
          key={`mini-empty-${slotNumber}`}
          className="bj-phone-view__mini-hand-shell"
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

    const actions = getInsuranceActionsForController(gameState, round, controllerLabel);

    if (actions.length === 0) {
      return null;
    }

    return (
      <div className="bj-phone-view__phase-actions bj-phone-view__phase-actions--insurance" aria-live="polite">
        {actions.map(({ playerId, maxBet, canAfford, slotNumber }) => (
          <div key={playerId} className="bj-phone-view__ins-row">
            <span className="bj-phone-view__ins-label">
              Box {slotNumber ?? "?"} — up to {maxBet}c
              {!canAfford && " (not enough chips)"}
            </span>
            <button
              type="button"
              className={[
                "ds-btn",
                "ds-btn--secondary",
                "bj-phone-view__ins-btn",
                canAfford ? "bj-phone-view__extra-btn--legal" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={!canAfford}
              onClick={() => onTakeInsurance?.(playerId)}
            >
              Insure {maxBet}
            </button>
            <button
              type="button"
              className="ds-btn ds-btn--ghost bj-phone-view__ins-btn"
              onClick={() => onDeclineInsurance?.(playerId)}
            >
              No thanks
            </button>
          </div>
        ))}
      </div>
    );
  }

  function renderEvenMoneyActions() {
    if (!evenMoneyActive || !evenMoneyHandKey) {
      return null;
    }

    if (!canCallEvenMoney) {
      return null;
    }

    return (
      <div className="bj-phone-view__phase-actions bj-phone-view__phase-actions--even-money" aria-live="polite">
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
              <div className="bj-phone-view__cards-placeholder" aria-hidden="true" />
            </div>
            <div className="bj-phone-view__hand-meta">
              <div
                className="ds-badge ds-badge--total bj-phone-view__total bj-phone-view__total--hero bj-phone-view__total--placeholder"
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

    if (!stitchedCardsVisible) {
      return renderPlayHeroPlaceholder();
    }

    const heroBusted = hand?.actionStatus === 'busted';

    return (
      <div className="bj-phone-view__hand">
        {heroBusted && (
          <span className="bj-phone-view__bust-label" aria-label="Busted">
            BUST
          </span>
        )}
        <div className="bj-phone-view__hero-stage">
          <div className="bj-phone-view__hero-center">
            <div className="bj-phone-view__cards-slot">
              {cardIds.length > 0 ? (
                <div className="bj-phone-view__cards bj-phone-view__cards--fan bj-phone-view__cards--stitched">
                  {cardIds.map((id, i) => (
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
                <div className="bj-phone-view__cards-placeholder" aria-hidden="true" />
              )}
            </div>
            <div className="bj-phone-view__hand-meta">
              <div className="ds-badge ds-badge--total bj-phone-view__total bj-phone-view__total--hero">
                Total {value}
              </div>
            </div>
            {renderHeroInlineActions()}
          </div>
        </div>
      </div>
    );
  }

  function renderHeroInlineActions() {
    if (!showSideControls) {
      return null;
    }

    const canDoubleNow =
      isActiveTurn &&
      turnHandKey &&
      blackjackSettings.allowDoubleDown &&
      canDoubleBlackjackForState(gameState, turnHandKey);
    const canSplitNow =
      isActiveTurn &&
      turnHandKey &&
      blackjackSettings.allowSplit &&
      deck &&
      canSplitBlackjackForState(gameState, turnHandKey);
    const showDouble = blackjackSettings.allowDoubleDown;
    const showSplit = blackjackSettings.allowSplit && Boolean(deck);
    const showAid = blackjackFlowSettings.adviceEnabled;

    return (
      <div className="bj-phone-view__hero-actions" aria-label="Player actions">
        <div className="bj-phone-view__hero-actions-primary">
          <button
            type="button"
            className={[
              "bj-phone-view__hero-actions-btn",
              "bj-phone-view__hero-actions-btn--stand",
              "ds-btn",
              "ds-btn--stand",
              isActiveTurn ? "bj-phone-view__hero-actions-btn--live" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={!isActiveTurn || !canStand}
            onClick={handleStayClick}
          >
            Stand
          </button>
          <button
            type="button"
            className={[
              "bj-phone-view__hero-actions-btn",
              "bj-phone-view__hero-actions-btn--hit",
              "ds-btn",
              "ds-btn--hit",
              isActiveTurn ? "bj-phone-view__hero-actions-btn--live" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={!isActiveTurn || !canHit}
            onClick={handleHitClick}
          >
            Hit
          </button>
        </div>
        {(showDouble || showSplit || showAid) && (
          <div className="bj-phone-view__hero-actions-extras">
            {showDouble ? (
              <button
                type="button"
                className={[
                  "bj-phone-view__hero-actions-btn",
                  "bj-phone-view__hero-actions-btn--extra",
                  canDoubleNow ? "bj-phone-view__hero-actions-btn--legal" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={!canDoubleNow}
                onClick={() => turnHandKey && onDouble(turnHandKey)}
              >
                2×
              </button>
            ) : null}
            {showSplit ? (
              <button
                type="button"
                className={[
                  "bj-phone-view__hero-actions-btn",
                  "bj-phone-view__hero-actions-btn--extra",
                  canSplitNow ? "bj-phone-view__hero-actions-btn--legal" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={!canSplitNow}
                onClick={() => turnHandKey && onSplit(turnHandKey)}
              >
                Split
              </button>
            ) : null}
            {showAid ? (
              <button
                type="button"
                className="bj-phone-view__hero-actions-btn bj-phone-view__hero-actions-btn--extra bj-phone-view__hero-actions-btn--aid"
                onClick={handleAid}
              >
                AID
              </button>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  function renderActionBar() {
    const canDoubleNow =
      isActiveTurn &&
      turnHandKey &&
      blackjackSettings.allowDoubleDown &&
      canDoubleBlackjackForState(gameState, turnHandKey);
    const canSplitNow =
      isActiveTurn &&
      turnHandKey &&
      blackjackSettings.allowSplit &&
      deck &&
      canSplitBlackjackForState(gameState, turnHandKey);
    const showDouble = blackjackSettings.allowDoubleDown;
    const showSplit = blackjackSettings.allowSplit && Boolean(deck);
    const showAid = blackjackFlowSettings.adviceEnabled;

    if (showSideControls || bettingMainStage) {
      return (
        <div
          className="bj-phone-view__action-bar bj-phone-view__action-bar--play-placeholder"
          aria-hidden="true"
        />
      );
    }

    return (
      <div className="bj-phone-view__action-bar" aria-label="Player actions">
        <div className="bj-phone-view__action-bar-primary">
          <span className="bj-phone-view__action-bar-spacer" aria-hidden="true" />
        </div>
        <div className="bj-phone-view__action-bar-secondary">
          {showDouble ? (
            <button
              type="button"
              className={[
                "bj-phone-view__action-bar-extra",
                "bj-phone-view__action-btn--tappable",
                canDoubleNow ? "bj-phone-view__action-bar-extra--legal" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={!canDoubleNow}
              onClick={() => turnHandKey && onDouble(turnHandKey)}
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
                "bj-phone-view__action-btn--tappable",
                canSplitNow ? "bj-phone-view__action-bar-extra--legal" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={!canSplitNow}
              onClick={() => turnHandKey && onSplit(turnHandKey)}
            >
              Split
            </button>
          ) : (
            <span className="bj-phone-view__action-bar-extra bj-phone-view__action-bar-extra--placeholder" aria-hidden="true" />
          )}
          {showAid ? (
            <button
              type="button"
              className="bj-phone-view__action-bar-extra bj-phone-view__action-btn--tappable bj-phone-view__action-bar-extra--aid"
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

  return (
    <div className="bj-phone-view">
      {!bettingMainStage && renderInsuranceActions()}
      {!bettingMainStage && renderEvenMoneyActions()}

      <div
        className={[
          "bj-phone-view__slot",
          "bj-phone-view__slot--stage",
          bettingMainStage ? "bj-phone-view__slot--stage-betting" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
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

      <div className="bj-phone-view__slot bj-phone-view__slot--actions">
        {renderActionBar()}
      </div>

      <div className="bj-phone-view__slot bj-phone-view__slot--boxes">
        {renderMiniBoxesRow()}
      </div>
    </div>
  );
}
