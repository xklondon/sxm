import type { BlackjackOutcome } from '../types/blackjack';
import type { BoxNetResultTone } from './boxBetResultDisplay';
import { mapOutcomeToHandResultStatus } from './boxHandStatusDisplay';

export type CardAreaOutcomeMarker = 'blackjack' | 'win' | 'bust' | 'even';

export function resolveCardAreaOutcomeMarker(
  showResults: boolean,
  outcome: BlackjackOutcome | undefined,
  actionStatus: string | undefined,
): CardAreaOutcomeMarker | null {
  if (actionStatus === 'blackjack' || outcome === 'blackjack-win') {
    return 'blackjack';
  }
  if (!showResults) {
    return null;
  }
  if (outcome === 'blackjack-push' || outcome === 'push') {
    return 'even';
  }
  const mapped = mapOutcomeToHandResultStatus(outcome);
  if (mapped === 'win') {
    return 'win';
  }
  if (mapped === 'bust') {
    return 'bust';
  }
  if (mapped === 'push') {
    return 'even';
  }
  if (actionStatus === 'busted') {
    return 'bust';
  }
  return null;
}

export function cardAreaOutcomeMarkerText(marker: CardAreaOutcomeMarker): string {
  switch (marker) {
    case 'blackjack':
      return 'BLACKJACK';
    case 'win':
      return '😎 WIN';
    case 'bust':
      return '💀 BUST';
    case 'even':
      return 'EVEN 🤷';
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
