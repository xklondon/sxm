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
  getVisibleDealerCardIds,
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
  getCardViewBoxStatus,
  getCardViewHeroBoxId,
  getCardViewHeroHandKey,
  getMyPendingInsurancePlayerIds,
  isBankPhase,
  isBettingPhase,
  isDealingPhase,
  isPlayerTurnPhase,
  showBettingMainStage,
  showEvenMoneyControls,
  showInsuranceControls,
  showStitchedActionControls,
  showStitchedPlayerCards,
} from "./blackjackViewPhase";

import { insuranceBetMax } from "../engine/blackjack";

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
  onBack: () => void;
}

const SWIPE_THRESHOLD = 48;

export function BlackjackCardView({
  gameState,
  focusBoxId,
  activeBoxId,
  showHoleHidden,
  protocolPhase,
  bettingOpen,
  gameEnded,
  onSelectBox,
  onClaimSlot,
  onClearStake,
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
  onBack,
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

  const dealerCards = round && deck ? getVisibleDealerCardIds(gameState) : [];

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
  const heroSlotNum = heroBoxId ? session.boxSlotNumbers?.[heroBoxId] : null;
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

  const isActiveTurn =
    isPlayerPhase &&
    turnHandKey !== null &&
    heroBoxId !== null &&
    turnBoxId === heroBoxId &&
    isCaller;

  const activeSlotNum = turnBoxId
    ? session.boxSlotNumbers?.[turnBoxId]
    : null;

  /** Card ids from engine hand only — no local card state. */

  const cardIds = (hand?.cardIds ?? []).filter((id) => id.length > 0);

  const cards = deck ? cardsFromIds(deck, cardIds) : [];

  const { value } = getBlackjackHandValue(cards);

  const slots = [...gameState.tableMeta.boxSlots].sort(
    (a, b) => a.slotNumber - b.slotNumber,
  );

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
    const wager = bettingMainStage ? openStake : (boxHand?.currentBet ?? openStake);
    const isTurnBox = boxId === heroBoxId;
    const isActiveBox = isPlayerPhase && boxId === activeBoxId;
    const status = getCardViewBoxStatus(
      protocolPhase,
      gameEnded,
      round,
      handKey,
      openStake,
      isTurnBox && isPlayerPhase,
    );
    const valueLabel = getBoxCardValueLabel(miniTotal, status);
    const playerName =
      players[boxId]?.controllerName?.trim() ||
      players[boxId]?.displayName ||
      "Player";
    const initials = getPlayerInitials(playerName);

    return (
      <button
        key={boxId}
        type="button"
        className={getBoxCardClassName(isActiveBox)}
        onClick={() => onSelectBox(boxId)}
        aria-label={`Box ${slotNumber} ${formatCardViewBoxStatus(status)}`}
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
          <span className="bj-phone-view__mini-hand-name">{initials ?? playerName}</span>
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
          {wager > 0 && <span>W {wager}c</span>}
          <span className={`bj-phone-view__mini-hand-status bj-phone-view__mini-hand-status--${status}`}>
            {formatCardViewBoxStatus(status)}
          </span>
        </span>
      </button>
    );
  }

  function renderBetBox(
    slotNumber: number,
    boxId: string | null,
    size: "main" | "small",
  ) {
    const stake = boxId ? getStakeForBox(gameState, boxId) : 0;

    const chips = boxId ? getStakeChipsForBox(gameState, boxId) : [];

    const initials = boxId
      ? getPlayerInitials(players[boxId]?.controllerName ?? "")
      : null;

    const isSelected = boxId === selectedId;
    const isMain = size === "main";

    return (
      <div
        key={`${slotNumber}-${size}`}
        className={[
          "bj-phone-view__bet-chip-wrap",
          isMain ? "bj-phone-view__bet-chip-wrap--main" : "bj-phone-view__bet-chip-wrap--small",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div
          className={[
            "bj-phone-view__bet-chip",
            boxId
              ? "bj-phone-view__bet-chip--owned"
              : "bj-phone-view__bet-chip--open",
            isSelected ? "bj-phone-view__bet-chip--sel" : "",
            isMain ? "bj-phone-view__bet-chip--hero" : "bj-phone-view__bet-chip--mini",
            getBetBoxPulseClassName(bettingOpen, Boolean(boxId)),
          ]
            .filter(Boolean)
            .join(" ")}
          onDragOver={
            bettingOpen
              ? (e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }
              : undefined
          }
          onDrop={
            bettingOpen
              ? (e) => onSlotChipDrop(slotNumber, boxId, e)
              : undefined
          }
        >
          <button
            type="button"
            className="bj-phone-view__bet-chip-btn"
            onClick={() =>
              boxId ? onSelectBox(boxId) : onClaimSlot(slotNumber)
            }
          >
            {initials ?? (boxId ? "·" : "+")}
          </button>

          {isMain && boxId && (
            <span className="bj-phone-view__bet-box-label">
              Box {slotNumber}
              {isSelected ? " · betting" : ""}
            </span>
          )}

          {!isMain && (
            <span className="bj-phone-view__bet-box-label bj-phone-view__bet-box-label--mini">
              {boxId ? `Box ${slotNumber}` : "Join"}
            </span>
          )}

          {stake > 0 && bettingOpen && boxId && (
            <>
              <span className="bj-phone-view__bet-stake">{stake}</span>
              <StakeChips
                chips={chips}
                variant="bet"
                removable
                onRemoveTopChip={() => onRemoveLastChip(boxId)}
              />
              <button
                type="button"
                className="bj-phone-view__bet-clear"
                onClick={() => onClearStake(boxId)}
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  function renderBettingStage() {
    const mainSlot =
      (heroBoxId ? slots.find((s) => s.playerId === heroBoxId) : null) ??
      slots.find((s) => s.playerId) ??
      slots[Math.floor(slots.length / 2)]!;
    const otherSlots = slots.filter((s) => s.slotNumber !== mainSlot.slotNumber);

    return (
      <div className="bj-phone-view__betting-stage">
        {renderBetBox(mainSlot.slotNumber, mainSlot.playerId, "main")}
        <div className="bj-phone-view__bet-secondary-row">
          {otherSlots.map((s) => renderBetBox(s.slotNumber, s.playerId, "small"))}
        </div>
      </div>
    );
  }

  function renderMiniBoxesRow() {
    const joined = slots.filter((s) => s.playerId);
    const mini = joined.filter((s) => s.playerId !== heroBoxId);
    if (mini.length === 0) {
      return null;
    }
    return (
      <div className="bj-phone-view__mini-row">
        {mini.map((s) => renderMiniHandBox(s.slotNumber, s.playerId!))}
      </div>
    );
  }

  function renderInsuranceActions() {
    if (!insuranceActive || !round) {
      return null;
    }

    const myPending = getMyPendingInsurancePlayerIds(gameState, round, controllerLabel);

    if (myPending.length === 0) {
      return (
        <p className="bj-phone-view__phase-actions bj-phone-view__phase-actions--wait">
          Dealer shows Ace — waiting for insurance decisions…
        </p>
      );
    }

    return (
      <div className="bj-phone-view__phase-actions bj-phone-view__phase-actions--insurance" aria-live="polite">
        <p className="bj-phone-view__phase-actions-label">Dealer shows Ace — insurance pays 2:1</p>
        {myPending.map((pid) => {
          const hand = round.playerHands[`${pid}:0`];
          const maxIns = hand ? insuranceBetMax(hand.currentBet) : 0;
          const slotNum = session.boxSlotNumbers?.[pid];
          return (
            <div key={pid} className="bj-phone-view__ins-row">
              <span className="bj-phone-view__ins-label">
                Box {slotNum ?? "?"} — up to {maxIns}c
              </span>
              <button
                type="button"
                className="ds-btn ds-btn--secondary bj-phone-view__ins-btn"
                onClick={() => onTakeInsurance?.(pid)}
              >
                Insure {maxIns}
              </button>
              <button
                type="button"
                className="ds-btn ds-btn--ghost bj-phone-view__ins-btn"
                onClick={() => onDeclineInsurance?.(pid)}
              >
                No thanks
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  function renderEvenMoneyActions() {
    if (!evenMoneyActive || !evenMoneyHandKey) {
      return null;
    }

    const { playerId } = parseBlackjackHandKey(evenMoneyHandKey);
    const slotNum = session.boxSlotNumbers?.[playerId];

    if (!canCallEvenMoney) {
      return (
        <p className="bj-phone-view__phase-actions bj-phone-view__phase-actions--wait">
          Box {slotNum ?? "?"} — even-money decision pending…
        </p>
      );
    }

    return (
      <div className="bj-phone-view__phase-actions bj-phone-view__phase-actions--even-money" aria-live="polite">
        <p className="bj-phone-view__phase-actions-label">Dealer may have blackjack. Take 1:1 now?</p>
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

  function renderStageContent() {
    if (insuranceActive && dealerCards.length > 0) {
      return (
        <div className="bj-phone-view__bank-hero">
          <div className="bj-phone-view__cards bj-phone-view__cards--bank">
            {dealerCards.map((id, i) =>
              renderHugeCard(id, showHoleHidden && i === 1, "bank", `bank-${i}-${id}`),
            )}
          </div>
        </div>
      );
    }

    if (isBettingPhase(protocolPhase)) {
      return null;
    }

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

    if (
      (isBankPhase(protocolPhase) || isDealingPhase(protocolPhase)) &&
      dealerCards.length > 0
    ) {
      return (
        <div className="bj-phone-view__bank-hero">
          <div className="bj-phone-view__cards bj-phone-view__cards--bank">
            {dealerCards.map((id, i) =>
              renderHugeCard(
                id,
                showHoleHidden && i === 1,
                "bank",
                `bank-${i}-${id}`,
              ),
            )}
          </div>
        </div>
      );
    }

    if (!stitchedCardsVisible) {
      return null;
    }

    return (
      <div className="bj-phone-view__hand">
        <div className="bj-phone-view__hero-actions">
          <div className="ds-badge ds-badge--total bj-phone-view__total bj-phone-view__total--hero">
            Total {value}
          </div>

          {isActiveTurn && turnHandKey && (
            <div className="bj-phone-view__extras bj-phone-view__extras--hero">
              {blackjackSettings.allowDoubleDown && (
                <button
                  type="button"
                  className="bj-phone-view__extra-btn bj-phone-view__action-btn--tappable"
                  disabled={!canDoubleBlackjackForState(gameState, turnHandKey)}
                  onClick={() => onDouble(turnHandKey)}
                >
                  2×
                </button>
              )}

              {blackjackSettings.allowSplit && deck && (
                <button
                  type="button"
                  className="bj-phone-view__extra-btn bj-phone-view__action-btn--tappable"
                  disabled={!canSplitBlackjackForState(gameState, turnHandKey)}
                  onClick={() => onSplit(turnHandKey)}
                >
                  Split
                </button>
              )}

              {blackjackFlowSettings.adviceEnabled && (
                <button
                  type="button"
                  className="bj-phone-view__extra-btn bj-phone-view__action-btn--tappable"
                  onClick={handleAid}
                >
                  Ask AID
                </button>
              )}
            </div>
          )}
        </div>

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

        {hand && hand.currentBet > 0 && (
          <div className="bj-phone-view__wager-badge">
            <span className="bj-phone-view__wager-label">Wager</span>
            <span className="bj-phone-view__wager-amount">{hand.currentBet}c</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bj-phone-view">
      <header className="bj-phone-view__card-bar">
        {heroBoxId && heroSlotNum && !bettingMainStage && (
          <span className="bj-phone-view__hero-label">
            Box {heroSlotNum} · {formatCardViewBoxStatus(
              getCardViewBoxStatus(
                protocolPhase,
                gameEnded,
                round,
                heroHandKey ?? `${heroBoxId}:0`,
                getStakeForBox(gameState, heroBoxId),
                isActiveTurn,
              ),
            )}
          </span>
        )}
        <button
          type="button"
          className="ds-btn ds-btn--ghost bj-phone-view__table-btn"
          onClick={onBack}
          aria-label="Full table view"
        >
          Full Table
        </button>
      </header>

      {bettingMainStage ? (
        renderBettingStage()
      ) : (
        <>
          {renderInsuranceActions()}
          {renderEvenMoneyActions()}

          <div
            className={`bj-phone-view__play-area${showSideControls ? " bj-phone-view__play-area--controls" : ""}`}
          >
            {showSideControls && (
              <button
                type="button"
                className={[
                  "bj-phone-view__side-btn",
                  "bj-phone-view__side-btn--stay",
                  "ds-btn",
                  "ds-btn--stand",
                  isActiveTurn ? "bj-phone-view__side-btn--live" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={!isActiveTurn || !canStand}
                title={
                  !isActiveTurn || !canStand
                    ? (disabledReason ?? "")
                    : "Stay — swipe left"
                }
                aria-label={
                  !isActiveTurn || !canStand
                    ? `Stay disabled: ${disabledReason}`
                    : "Stay"
                }
                onClick={handleStayClick}
              >
                <span className="bj-phone-view__side-label">Stand</span>
              </button>
            )}

            <div
              className="bj-phone-view__stage"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {renderStageContent()}

              {swipeHint && (
                <p className="bj-phone-view__swipe-hint">{swipeHint}</p>
              )}

              {aidTip && <p className="bj-phone-view__aid">{aidTip}</p>}
            </div>

            {showSideControls && (
              <button
                type="button"
                className={[
                  "bj-phone-view__side-btn",
                  "bj-phone-view__side-btn--hit",
                  "ds-btn",
                  "ds-btn--hit",
                  isActiveTurn ? "bj-phone-view__side-btn--live" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={!isActiveTurn || !canHit}
                title={
                  !isActiveTurn || !canHit
                    ? (disabledReason ?? "")
                    : "Hit me — swipe right"
                }
                aria-label={
                  !isActiveTurn || !canHit
                    ? `Hit disabled: ${disabledReason}`
                    : "Hit me"
                }
                onClick={handleHitClick}
              >
                <span className="bj-phone-view__side-label">Hit me</span>
              </button>
            )}
          </div>

          {renderMiniBoxesRow()}
        </>
      )}
    </div>
  );
}
