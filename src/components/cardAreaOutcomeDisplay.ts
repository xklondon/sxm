import type { BlackjackOutcome } from '../types/blackjack';
import type { BoxNetResultTone } from './boxBetResultDisplay';

export type CardAreaOutcomeMarker = 'blackjack' | 'win' | 'bust' | 'even';

/** Visible hand total — used to distinguish bust from a normal loss. */
export function isHandTotalBust(handTotal: number | null | undefined): boolean {
  return handTotal !== null && handTotal !== undefined && handTotal > 21;
}

export function resolveCardAreaOutcomeMarker(
  showResults: boolean,
  outcome: BlackjackOutcome | undefined,
  actionStatus: string | undefined,
  handTotal?: number | null,
): CardAreaOutcomeMarker | null {
  if (actionStatus === 'blackjack' || outcome === 'blackjack-win') {
    return 'blackjack';
  }

  if (actionStatus === 'busted' || isHandTotalBust(handTotal)) {
    return 'bust';
  }

  if (!showResults) {
    return null;
  }

  if (outcome === 'blackjack-push' || outcome === 'push') {
    return 'even';
  }
  if (outcome === 'win') {
    return 'win';
  }

  return null;
}

export function cardAreaOutcomeMarkerText(marker: CardAreaOutcomeMarker): string {
  switch (marker) {
    case 'blackjack':
      return '★ BJ';
    case 'win':
      return '😎 WIN';
    case 'bust':
      return '💀 BUST';
    case 'even':
      return 'EVEN';
  }
}

export function cardAreaOutcomeMarkerClass(marker: CardAreaOutcomeMarker): string {
  return `bj-card-outcome-marker bj-card-outcome-marker--${marker}`;
}

export function cardAreaOutcomeToneFromMarker(
  marker: CardAreaOutcomeMarker | null,
): BoxNetResultTone | null {
  if (!marker) {
    return null;
  }
  switch (marker) {
    case 'win':
    case 'blackjack':
      return 'win';
    case 'bust':
      return 'loss';
    case 'even':
      return 'even';
  }
}
