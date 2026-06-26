import {
  useEffect,
  type CSSProperties,
} from "react";

import type { GameState } from "../types";

import type { BlackjackProtocolPhase } from "../engine/blackjack/protocol";

import {
  parseBlackjackHandKey,
} from "../engine/blackjack";

import { getCardById } from "../engine/deck";

import { getPlayerInitials } from "../storage/profileStorage";
import { resolveViewerPersonIdForTable } from "./viewerIdentity";
import type { AuthUser } from "../api/client";

import {
  resolveViewerActionPermission,
} from "./blackjackActionContract";
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
} from "./blackjackViewPhase";
import { shouldShowBoxHandResultMarkers } from "./boxHandStatusDisplay";
import {
  cardAreaOutcomeMarkerClass,
  cardAreaOutcomeMarkerText,
  cardAreaOutcomeStackBadgeText,
  cardAreaOutcomeUsesStackBadge,
} from "./cardAreaOutcomeDisplay";
import {
  createUiRevealContext,
  resolveGatedCardAreaOutcomeMarker,
} from "./blackjackUiRenderContract";
import { getDisplayedHandValue } from "./blackjackDealingContract";

import { type DeviceView } from "./tableViewContract";
import { isVerboseDevLogging } from "../utils/devFlags";

import { PlayingCard } from "./PlayingCard";

import { SXM_LAYOUT, sxmSectionProps } from "./sxmLayoutContract";

import "./BlackjackCardView.css";

interface BlackjackCardViewProps {
  /** Display state (may mask card visibility during natural dealing). */
  gameState: GameState;
  /** Authoritative engine state for hand keys, totals, and hero visibility. */
  logicalGameState?: GameState;
  deviceView?: DeviceView;
  /** Render only cards, only hero value, or combined (legacy). */
  segment?: 'cards' | 'value' | 'all';
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
  /** @deprecated Gameplay actions use shell action panel. */
  onStay?: (handKey: string) => void;
  /** @deprecated Gameplay actions use shell action panel. */
  onCard?: (handKey: string) => void;
  /** @deprecated View toggle lives in table toolbar. */
  onBack: () => void;
  viewerPersonId?: string | null;
  onlineTableId?: string | null;
  viewerAuth?: Pick<AuthUser, 'email' | 'displayName'> | null;
}

/** Card View hero cards area — rendered inside the shared table layout shell. */
export function BlackjackCardView({
  gameState,
  logicalGameState: logicalGameStateProp,
  deviceView = "mobile",
  segment = "all",
  focusBoxId,
  activeBoxId,
  heroHandKeyOverride = null,
  handHoldActive: _handHoldActive = false,
  showHoleHidden: _showHoleHidden,
  protocolPhase,
  cardRevealComplete: _cardRevealComplete = true,
  activeHandRevealComplete: _activeHandRevealComplete = true,
  bettingOpen: _bettingOpen,
  gameEnded,
  onBack: _onBack,
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

  const bettingMainStage = showBettingMainStage(protocolPhase, gameEnded);
  const insuranceActive = showInsuranceControls(protocolPhase, round);
  const evenMoneyActive = showEvenMoneyControls(protocolPhase, round);
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
  const uiRevealContext = createUiRevealContext(
    logicalGameState,
    gameState,
    _cardRevealComplete,
  );
  const heroOutcomeMarker =
    heroHandKey && logicalHand
      ? resolveGatedCardAreaOutcomeMarker(uiRevealContext, {
          showResults: showCardAreaResults,
          outcome: heroOutcome,
          actionStatus: logicalHand.actionStatus,
          handKey: heroHandKey,
          handTotal: heroDisplayValue,
        })
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
    if (!isVerboseDevLogging()) {
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

      disabledReason,
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

    disabledReason,
  ]);

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

  function renderBettingHeroPlaceholder() {
    const cardsBand = (
      <div className="bj-phone-view__cards-slot" data-layout-band="hero-cards">
        <div
          {...sxmSectionProps(SXM_LAYOUT.heroCards, 'bj-phone-view__cards-placeholder')}
          aria-hidden="true"
        />
      </div>
    );
    const valueBand = (
      <div className="bj-phone-view__hand-meta" data-layout-band="hero-value">
        <div
          {...sxmSectionProps(
            SXM_LAYOUT.handTotal,
            'ds-badge ds-badge--total bj-phone-view__total bj-phone-view__total--hero',
            'bj-phone-view__total--placeholder',
          )}
          aria-hidden="true"
        >
          &nbsp;
        </div>
      </div>
    );
    if (segment === 'cards') {
      return (
        <div className="bj-phone-view__hand bj-phone-view__hand--waiting">
          <div className="bj-phone-view__hero-stage">
            <div className="bj-phone-view__hero-center">{cardsBand}</div>
          </div>
        </div>
      );
    }
    if (segment === 'value') {
      return (
        <div className="bj-phone-view__hand bj-phone-view__hand--waiting">
          <div className="bj-phone-view__hero-stage">
            <div className="bj-phone-view__hero-center">{valueBand}</div>
          </div>
        </div>
      );
    }
    return (
      <div className="bj-phone-view__hand bj-phone-view__hand--waiting">
        <div className="bj-phone-view__hero-stage">
          <div className="bj-phone-view__hero-center">
            {cardsBand}
            {valueBand}
          </div>
        </div>
      </div>
    );
  }

  function renderPlayHeroPlaceholder() {
    return renderBettingHeroPlaceholder();
  }

  function renderHeroValueMeta() {
    const heroBusted = logicalHand?.actionStatus === 'busted';
    const heroNatural = logicalHand?.actionStatus === 'blackjack';

    return (
      <div
        className="bj-phone-view__hand-meta bj-phone-view__hand-meta--below-cards"
        data-layout-band="hero-value"
      >
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
              'bj-card-view__hero-value',
              'bj-player-hand-value--emphasis',
              heroNatural ? 'bj-phone-view__total--blackjack' : '',
              isActiveTurn && isPlayerPhase && !showCardAreaResults
                ? 'bj-phone-view__box-value--active-turn'
                : '',
            )}
          >
            {heroNatural ? 'Blackjack' : String(heroDisplayValue)}
          </div>
        ) : (
          <div
            {...sxmSectionProps(
              SXM_LAYOUT.handTotal,
              'ds-badge ds-badge--total bj-phone-view__total bj-phone-view__total--hero',
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
    );
  }

  function renderHeroCardsBand() {
    const showHeroStackBadge =
      deviceView === 'mobile' &&
      heroOutcomeMarker !== null &&
      (heroOutcomeMarker === 'blackjack' ||
        heroOutcomeMarker === 'bust' ||
        showCardAreaResults);

    return (
      <div className="bj-phone-view__cards-slot" data-layout-band="hero-cards">
        {heroCardIds.length > 0 ? (
          <div
            {...sxmSectionProps(
              SXM_LAYOUT.heroCards,
              'bj-phone-view__cards bj-phone-view__cards--fan bj-phone-view__cards--stitched',
            )}
            data-bj-hero-card-count={Math.min(heroCardIds.length, 6)}
          >
            {heroCardIds.map((id, i) => (
              <div
                key={`${heroHandKey}-${i}-${id}`}
                className={[
                  'bj-phone-view__card-wrap',
                  i >= 2 ? 'bj-phone-view__card-wrap--layered' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
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
            {showHeroStackBadge && cardAreaOutcomeUsesStackBadge(heroOutcomeMarker!) ? (
              <span
                className={[
                  cardAreaOutcomeMarkerClass(heroOutcomeMarker!),
                  'bj-card-outcome-marker--stack-badge',
                  'bj-card-view__hero-stack-badge',
                ].join(' ')}
                aria-hidden="true"
              >
                {cardAreaOutcomeStackBadgeText(heroOutcomeMarker!)}
              </span>
            ) : null}
          </div>
        ) : (
          <div
            {...sxmSectionProps(SXM_LAYOUT.heroCards, 'bj-phone-view__cards-placeholder')}
            aria-hidden="true"
          />
        )}
      </div>
    );
  }

  function renderStageContent() {
    if (protocolPhase === "banking" || gameEnded) {
      if (segment === 'value') {
        return null;
      }
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

    if (segment === 'cards') {
      return (
        <div className="bj-phone-view__hand">
          <div className="bj-phone-view__hero-stage">
            <div className="bj-phone-view__play-area">
              <div className="bj-phone-view__hero-center">{renderHeroCardsBand()}</div>
            </div>
          </div>
        </div>
      );
    }

    if (segment === 'value') {
      return (
        <div className="bj-phone-view__hand">
          <div className="bj-phone-view__hero-stage">
            <div className="bj-phone-view__play-area">
              <div className="bj-phone-view__hero-center">{renderHeroValueMeta()}</div>
            </div>
          </div>
        </div>
      );
    }

    const heroCenter = (
      <div className="bj-phone-view__hero-center">
        {renderHeroCardsBand()}
        {renderHeroValueMeta()}
      </div>
    );

    return (
      <div className="bj-phone-view__hand">
        <div className="bj-phone-view__hero-stage">
          <div className="bj-phone-view__play-area">
            {heroCenter}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bj-phone-view__axis">
      <div className="bj-phone-view__play-stack">
        <div className="bj-phone-view__stage">
          {bettingMainStage ? renderBettingHeroPlaceholder() : renderStageContent()}
        </div>
      </div>
    </div>
  );
}
