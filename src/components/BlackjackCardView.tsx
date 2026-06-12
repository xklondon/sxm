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
  canHitBlackjack,
  canStandBlackjack,
  parseBlackjackHandKey,
} from "../engine/blackjack";

import { getCardById } from "../engine/deck";

import { getPlayerInitials } from "../storage/profileStorage";
import { resolveViewerPersonIdForTable } from "./viewerIdentity";
import type { AuthUser } from "../api/client";

import {
  getCardViewHeroBoxId,
  getCardViewHeroHandKey,
  showHeroPlayerCards,
  isBettingPhase,
  isDealingPhase,
  isPlayerTurnPhase,
  showBettingMainStage,
  showEvenMoneyControls,
  showInsuranceControls,
  canShowPlayerDecisionControls,
  resolveViewerActionPermission,
} from "./blackjackViewPhase";
import { shouldShowBoxHandResultMarkers } from "./boxHandStatusDisplay";
import {
  cardAreaOutcomeMarkerClass,
  cardAreaOutcomeMarkerText,
  resolveCardAreaOutcomeMarker,
} from "./cardAreaOutcomeDisplay";
import { getDisplayedHandValue } from "../engine/blackjack/dealing/cardRevealDisplay";

import { type DeviceView } from "./tableViewContract";
import { TABLE_UX } from "./tableUxContract";

import { PlayingCard } from "./PlayingCard";

import { SXM_LAYOUT, sxmSectionProps } from "./sxmLayoutContract";

import "./BlackjackCardView.css";

interface BlackjackCardViewProps {
  /** Display state (may mask card visibility during natural dealing). */
  gameState: GameState;
  /** Authoritative engine state for hand keys, totals, and hero visibility. */
  logicalGameState?: GameState;
  deviceView?: DeviceView;
  focusBoxId?: string;
  activeBoxId: string | null;
  /** Card View hand-hold — keep hero on completed bust/18+ hand before turn advance. */
  heroHandKeyOverride?: string | null;
  handHoldActive?: boolean;
  showHoleHidden: boolean;
  protocolPhase: BlackjackProtocolPhase;
  cardRevealComplete?: boolean;
  activeHandRevealComplete?: boolean;
  bettingOpen: boolean;
  gameEnded: boolean;
  onStay: (handKey: string) => void;
  onCard: (handKey: string) => void;
  /** @deprecated View toggle lives in table toolbar. */
  onBack: () => void;
  viewerPersonId?: string | null;
  onlineTableId?: string | null;
  viewerAuth?: Pick<AuthUser, 'email' | 'displayName'> | null;
}

const SWIPE_THRESHOLD = 48;

/** Card View hero cards area — rendered inside the shared table layout shell. */
export function BlackjackCardView({
  gameState,
  logicalGameState: logicalGameStateProp,
  deviceView = "mobile",
  focusBoxId,
  activeBoxId,
  heroHandKeyOverride = null,
  handHoldActive = false,
  showHoleHidden: _showHoleHidden,
  protocolPhase,
  cardRevealComplete = true,
  activeHandRevealComplete = true,
  bettingOpen: _bettingOpen,
  gameEnded,
  onStay,
  onCard,
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
  } = gameState;
  const logicalRound = logicalGameState.blackjack;

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
    null,
    focusBoxId ?? null,
  );
  const heroHandKey = getCardViewHeroHandKey(
    protocolPhase,
    logicalRound,
    heroBoxId,
    heroHandKeyOverride,
  );
  /** Hero box follows active turn in play, selected seat in betting. */

  const viewerPersonId =
    viewerPersonIdProp ??
    resolveViewerPersonIdForTable(logicalGameState, onlineTableId, viewerAuth);

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
    !handHoldActive &&
      isActiveTurn &&
      actionableHandKey &&
      round &&
      canHitBlackjack(round, actionableHandKey),
  );

  const canStand = Boolean(
    !handHoldActive &&
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

  const showCardAreaResults = shouldShowBoxHandResultMarkers({
    awaitingNextRound: logicalGameState.tableMeta.awaitingNextRound,
    protocolPhase,
    round: logicalRound,
  });
  const heroOutcome =
    heroHandKey !== null ? logicalRound?.outcomes?.[heroHandKey] : undefined;
  const heroOutcomeMarker =
    heroHandKey && logicalHand
      ? resolveCardAreaOutcomeMarker(
          showCardAreaResults,
          heroOutcome,
          logicalHand.actionStatus,
        )
      : null;
  const hideHeroValueOnMobile =
    deviceView === "mobile" &&
    heroOutcomeMarker !== null &&
    (heroOutcomeMarker === "blackjack" || showCardAreaResults);

  const heroCardsVisible = showHeroPlayerCards(
    protocolPhase,
    gameEnded,
    logicalCardIds.length,
  );
  const showSideControls =
    stitchedActionsActive && !evenMoneyActive && !insuranceActive;

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
        aria-label="Stay — swipe left"
      >
        <span className="bj-phone-view__side-action-icon" aria-hidden="true">
          ✋
        </span>
        <span className="bj-phone-view__side-action-label">Stay</span>
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
        <span className="bj-phone-view__side-action-icon" aria-hidden="true">
          ⊕
        </span>
        <span className="bj-phone-view__side-action-label">Hit me</span>
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
    const heroNatural = logicalHand?.actionStatus === 'blackjack';

    const heroCenter = (
      <div className="bj-phone-view__hero-center">
        <div className="bj-phone-view__hand-meta bj-phone-view__hand-meta--above-cards">
          {hideHeroValueOnMobile && heroOutcomeMarker ? (
            <span
              className={[
                cardAreaOutcomeMarkerClass(heroOutcomeMarker),
                'bj-card-view__hero-outcome',
              ].join(' ')}
              aria-hidden="true"
            >
              {cardAreaOutcomeMarkerText(heroOutcomeMarker)}
            </span>
          ) : heroDisplayValue !== null ? (
            <div
              {...sxmSectionProps(
                SXM_LAYOUT.handTotal,
                'ds-badge ds-badge--total bj-phone-view__total bj-phone-view__total--hero',
                TABLE_UX.cardViewTotalCompact,
                deviceView === 'mobile' ? 'bj-card-view__hero-value' : '',
                heroNatural ? 'bj-phone-view__total--blackjack' : '',
              )}
            >
              {heroNatural
                ? 'Blackjack'
                : deviceView === 'mobile'
                  ? String(heroDisplayValue)
                  : `Total ${heroDisplayValue}`}
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
          {heroBusted && !hideHeroValueOnMobile ? (
            <span className="bj-phone-view__bust-label bj-phone-view__bust-label--meta" aria-label="Busted">
              BUST
            </span>
          ) : null}
        </div>
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
        {deviceView === "mobile" && showSideControls && isActiveTurn && (
          <p className="bj-phone-view__swipe-guide" aria-hidden="true">
            ← Stay · Hit →
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

  return (
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
        </div>
      </div>
    </div>
  );
}
