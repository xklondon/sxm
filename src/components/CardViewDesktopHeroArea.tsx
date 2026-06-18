import type { CSSProperties } from 'react';
import type { GameState } from '../types';
import type { BlackjackProtocolPhase } from '../engine/blackjack/protocol';
import { parseBlackjackHandKey } from '../engine/blackjack';
import { getCardById } from '../engine/deck';
import { getPlayerInitials } from '../storage/profileStorage';
import { resolveViewerPersonIdForTable } from './viewerIdentity';
import type { AuthUser } from '../api/client';
import { resolveViewerActionPermission } from './blackjackActionContract';
import {
  getCardViewHeroBoxId,
  getCardViewHeroHandKey,
  showHeroPlayerCards,
  isPlayerTurnPhase,
} from './blackjackViewPhase';
import { shouldShowBoxHandResultMarkers } from './boxHandStatusDisplay';
import {
  cardAreaOutcomeMarkerClass,
  cardAreaOutcomeMarkerText,
  resolveCardAreaOutcomeMarker,
} from './cardAreaOutcomeDisplay';
import { getDisplayedHandValue } from './blackjackDealingContract';
import { PlayingCard } from './PlayingCard';
import { SXM_LAYOUT, sxmSectionProps } from './sxmLayoutContract';
import '../styles/bj-card-desktop-hero-area.css';

export interface CardViewDesktopHeroAreaProps {
  gameState: GameState;
  logicalGameState?: GameState;
  focusBoxId?: string;
  activeBoxId: string | null;
  heroHandKeyOverride?: string | null;
  protocolPhase: BlackjackProtocolPhase;
  gameEnded: boolean;
  viewerPersonId?: string | null;
  onlineTableId?: string | null;
  viewerAuth?: Pick<AuthUser, 'email' | 'displayName'> | null;
}

/**
 * Desktop Card View hero column — cards + value inside cards area only.
 * Hit/Stay render in shared shell BlackjackActionsZone (same as Full Table).
 */
export function CardViewDesktopHeroArea({
  gameState,
  logicalGameState: logicalGameStateProp,
  focusBoxId,
  activeBoxId,
  heroHandKeyOverride = null,
  protocolPhase,
  gameEnded,
  viewerPersonId: viewerPersonIdProp,
  onlineTableId = null,
  viewerAuth = null,
}: CardViewDesktopHeroAreaProps) {
  const logicalGameState = logicalGameStateProp ?? gameState;
  const { players, deck, blackjack: round } = gameState;
  const logicalRound = logicalGameState.blackjack;
  const isPlayerPhase = isPlayerTurnPhase(protocolPhase);

  const heroBoxId = getCardViewHeroBoxId(protocolPhase, activeBoxId, null, focusBoxId ?? null);
  const heroHandKey = getCardViewHeroHandKey(
    protocolPhase,
    logicalRound,
    heroBoxId,
    heroHandKeyOverride,
  );

  const viewerPersonId =
    viewerPersonIdProp ??
    resolveViewerPersonIdForTable(logicalGameState, onlineTableId, viewerAuth);

  const actionPermission = resolveViewerActionPermission(logicalGameState, viewerPersonId, {
    cardViewHeroBoxId: heroBoxId,
  });
  const isActiveTurn = actionPermission.canAct;

  const logicalHand =
    heroHandKey && logicalRound?.playerHands[heroHandKey]
      ? logicalRound.playerHands[heroHandKey]
      : undefined;
  const visualHand =
    heroHandKey && round?.playerHands[heroHandKey] ? round.playerHands[heroHandKey] : undefined;

  const heroCardIds = (visualHand?.cardIds ?? []).filter((id) => id.length > 0);
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
          heroDisplayValue,
        )
      : null;

  const heroCardsVisible = showHeroPlayerCards(
    protocolPhase,
    gameEnded,
    (logicalHand?.cardIds ?? []).filter((id) => id.length > 0).length,
  );

  function renderHeroCard(cardId: string, index: number) {
    if (!deck) {
      return null;
    }
    const card = getCardById(deck, cardId);
    if (!card) {
      return null;
    }
    return (
      <PlayingCard
        key={`${heroHandKey}-${index}-${cardId}`}
        card={card}
        compact={false}
        faceDown={false}
        animationMode="slide"
        className="ds-card ds-card--hero bj-card-desktop-hero__card"
      />
    );
  }

  function renderSettleResults() {
    const results = round?.resultMessages ?? {};
    const lines = Object.entries(results).filter(([key]) => key !== '__round__').slice(0, 4);

    return (
      <div className="bj-card-desktop-hero__results">
        {lines.length === 0 ? (
          <p>Payout complete.</p>
        ) : (
          lines.map(([key, msg]) => {
            const { playerId } = parseBlackjackHandKey(key);
            const ini = getPlayerInitials(players[playerId]?.controllerName ?? '');
            return (
              <p key={key} className="bj-card-desktop-hero__result-line">
                {ini ?? 'Box'}: {msg}
              </p>
            );
          })
        )}
      </div>
    );
  }

  function renderHeroCardsBand() {
    return (
      <div className="bj-card-desktop-hero__cards" data-layout-band="hero-cards">
        {heroCardIds.length > 0 ? (
          <div
            {...sxmSectionProps(SXM_LAYOUT.heroCards, 'bj-card-desktop-hero__fan')}
          >
            {heroCardIds.map((id, i) => (
              <div
                key={`${heroHandKey}-${i}-${id}`}
                className={[
                  'bj-card-desktop-hero__card-wrap',
                  i >= 2 ? 'bj-card-desktop-hero__card-wrap--layered' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ '--card-i': i } as CSSProperties}
              >
                {renderHeroCard(id, i)}
              </div>
            ))}
          </div>
        ) : (
          <div
            {...sxmSectionProps(SXM_LAYOUT.heroCards, 'bj-card-desktop-hero__cards-placeholder')}
            className="bj-card-desktop-hero__cards-placeholder"
            aria-hidden="true"
          />
        )}
      </div>
    );
  }

  function renderHeroValueBand() {
    const heroBusted = logicalHand?.actionStatus === 'busted';
    const heroNatural = logicalHand?.actionStatus === 'blackjack';

    return (
      <div className="bj-card-desktop-hero__value" data-layout-band="hero-value">
        {heroOutcomeMarker ? (
          <span
            className={[
              cardAreaOutcomeMarkerClass(heroOutcomeMarker),
              'bj-card-desktop-hero__outcome',
            ].join(' ')}
            aria-hidden="true"
          >
            {cardAreaOutcomeMarkerText(heroOutcomeMarker)}
          </span>
        ) : heroDisplayValue !== null ? (
          <div
            {...sxmSectionProps(
              SXM_LAYOUT.handTotal,
              'ds-badge ds-badge--total bj-card-view__hero-value bj-card-desktop-hero__value-badge',
              'bj-player-hand-value--emphasis',
              heroNatural ? 'bj-card-desktop-hero__value-badge--blackjack' : '',
              isActiveTurn && isPlayerPhase && !showCardAreaResults
                ? 'bj-card-desktop-hero__value-badge--active-turn'
                : '',
            )}
          >
            {heroNatural ? 'Blackjack' : String(heroDisplayValue)}
          </div>
        ) : (
          <div
            {...sxmSectionProps(
              SXM_LAYOUT.handTotal,
              'ds-badge ds-badge--total bj-card-desktop-hero__value-badge bj-card-desktop-hero__value-placeholder',
            )}
            aria-hidden="true"
          >
            &nbsp;
          </div>
        )}
        {heroBusted ? (
          <span className="bj-card-desktop-hero__bust-label" aria-label="Busted">
            BUST
          </span>
        ) : null}
      </div>
    );
  }

  function renderHeroBody() {
    if (protocolPhase === 'banking' || gameEnded) {
      return renderSettleResults();
    }

    if (!heroCardsVisible) {
      return (
        <>
          {renderHeroCardsBand()}
          {renderHeroValueBand()}
        </>
      );
    }

    return (
      <>
        {renderHeroCardsBand()}
        {renderHeroValueBand()}
      </>
    );
  }

  return (
    <div className="bj-card-desktop-hero">
      {renderHeroBody()}
    </div>
  );
}
