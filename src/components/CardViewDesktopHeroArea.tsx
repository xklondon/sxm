import type { CSSProperties } from 'react';
import type { GameState } from '../types';
import type { BlackjackProtocolPhase } from '../engine/blackjack/protocol';
import { orderedHandKeys, parseBlackjackHandKey } from '../engine/blackjack';
import { getCardById } from '../engine/deck';
import { getPlayerInitials } from '../storage/profileStorage';
import type { AuthUser } from '../api/client';
import {
  getCardViewHeroBoxId,
  getCardViewHeroHandKey,
  showHeroPlayerCards,
} from './blackjackViewPhase';
import { shouldShowBoxHandResultMarkers } from './boxHandStatusDisplay';
import {
  cardAreaOutcomeMarkerClass,
  cardAreaOutcomeMarkerText,
} from './cardAreaOutcomeDisplay';
import {
  createUiRevealContext,
  resolveGatedCardAreaOutcomeMarker,
} from './blackjackUiRenderContract';
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
  cardRevealComplete?: boolean;
  viewerPersonId?: string | null;
  onlineTableId?: string | null;
  viewerAuth?: Pick<AuthUser, 'email' | 'displayName'> | null;
}

/**
 * Desktop Card View hero column — active hand cards only inside cards area.
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
  cardRevealComplete = true,
  viewerPersonId: _viewerPersonIdProp,
  onlineTableId: _onlineTableId = null,
  viewerAuth: _viewerAuth = null,
}: CardViewDesktopHeroAreaProps) {
  const logicalGameState = logicalGameStateProp ?? gameState;
  const { session, players, deck, blackjack: round } = gameState;
  const logicalRound = logicalGameState.blackjack;

  const heroBoxId = getCardViewHeroBoxId(protocolPhase, activeBoxId, null, focusBoxId ?? null);
  const heroHandKey = getCardViewHeroHandKey(
    protocolPhase,
    logicalRound,
    heroBoxId,
    heroHandKeyOverride,
  );

  const logicalHand =
    heroHandKey && logicalRound?.playerHands[heroHandKey]
      ? logicalRound.playerHands[heroHandKey]
      : undefined;
  const visualHand =
    heroHandKey && round?.playerHands[heroHandKey] ? round.playerHands[heroHandKey] : undefined;

  const logicalCardIds = (logicalHand?.cardIds ?? []).filter((id) => id.length > 0);
  const visualCardIds = (visualHand?.cardIds ?? []).filter((id) => id.length > 0);
  const heroCardIds = visualCardIds.length > 0 ? visualCardIds : logicalCardIds;
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
    cardRevealComplete,
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
    const lines = round
      ? orderedHandKeys(session, round)
          .filter((key) => results[key] !== undefined)
          .map((key) => [key, results[key]!] as const)
      : [];

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
        ) : null}
      </div>
    );
  }

  /* Betting / round-complete — cloth/title only; no hero bands in cards area. */
  if (protocolPhase === 'betting' || protocolPhase === 'round-complete') {
    return null;
  }

  if (protocolPhase === 'banking' || gameEnded) {
    return <div className="bj-card-desktop-hero">{renderSettleResults()}</div>;
  }

  if (!heroCardsVisible) {
    return (
      <div className="bj-card-desktop-hero">
        {renderHeroCardsBand()}
      </div>
    );
  }

  return (
    <div className="bj-card-desktop-hero">
      {renderHeroCardsBand()}
    </div>
  );
}
