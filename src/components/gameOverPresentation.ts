import type { GameState } from '../types';
import { getMagic8Wisdom } from '../content/magic8';
import { buildGameOverSummary } from '../engine/scoreLedger/scoreLedger';
import {
  resolveWinnerDisplayName,
} from '../engine/scoreLedger/challengeBankDisplay';

export type GameOverVisualTone = 'happy' | 'sad' | 'neutral';

/** Admin-extensible game-over visuals (glyph-only — no external assets). */
export interface GameOverVisual {
  id: string;
  tone: GameOverVisualTone;
  glyph: string;
  label: string;
}

export const GAME_OVER_VISUALS: GameOverVisual[] = [
  { id: 'happy-chips', tone: 'happy', glyph: '🎉', label: 'Victory dance' },
  { id: 'happy-star', tone: 'happy', glyph: '⭐', label: 'Star turn' },
  { id: 'happy-smile', tone: 'happy', glyph: '😎', label: 'Cool winner' },
  { id: 'sad-card', tone: 'sad', glyph: '🃏', label: 'Tough beat' },
  { id: 'sad-rain', tone: 'sad', glyph: '🌧️', label: 'Rainy felt' },
  { id: 'sad-bust', tone: 'sad', glyph: '💀', label: 'Busted dreams' },
  { id: 'neutral-ball', tone: 'neutral', glyph: '🎱', label: 'Eight ball' },
  { id: 'neutral-table', tone: 'neutral', glyph: '🎲', label: 'Table luck' },
];

export interface GameOverPresentationModel {
  title: 'Game Over';
  visual: GameOverVisual;
  winnerLine: string;
  resultLine: string;
  roundsLine: string;
  magic8Line: string;
  rawSummary: string;
}

function visualsForTone(tone: GameOverVisualTone): GameOverVisual[] {
  const pool = GAME_OVER_VISUALS.filter((entry) => entry.tone === tone);
  return pool.length > 0 ? pool : GAME_OVER_VISUALS.filter((entry) => entry.tone === 'neutral');
}

export function pickGameOverVisual(viewerOutcome: boolean | null): GameOverVisual {
  const tone: GameOverVisualTone =
    viewerOutcome === true ? 'happy' : viewerOutcome === false ? 'sad' : 'neutral';
  const pool = visualsForTone(tone);
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] ?? GAME_OVER_VISUALS[0]!;
}

function resolveViewerOutcome(state: GameState, viewerPersonId: string | null): boolean | null {
  const winnerId = state.tableMeta.winnerId;
  if (!winnerId || !viewerPersonId) {
    return null;
  }
  return winnerId === viewerPersonId;
}

function resolveWinnerLine(state: GameState, summaryMessage: string): string {
  const winnerId = state.tableMeta.winnerId;
  if (winnerId) {
    return `${resolveWinnerDisplayName(state, winnerId)} won.`;
  }
  const firstLine = summaryMessage.split('\n').find((line) => line.trim())?.trim();
  if (firstLine && /bust|fractional|winner|won/i.test(firstLine)) {
    return firstLine.replace(/^GAME OVER\s*/i, '').trim();
  }
  return 'Final result recorded.';
}

function resolveResultLine(state: GameState, summaryMessage: string): string {
  const { entry } = buildGameOverSummary(state);
  if (entry?.owedDescription) {
    return entry.owedDescription;
  }
  const wager = state.tableMeta.agreement?.stakeDescription?.trim();
  if (wager) {
    return `Wager: ${wager}`;
  }
  const totals = summaryMessage
    .split('\n')
    .find((line) => line.startsWith('Final chips:') || line.includes('Final totals'));
  return totals?.trim() || summaryMessage.split('\n')[0]?.trim() || 'Thanks for playing.';
}

export function buildGameOverPresentationModel(
  state: GameState,
  summaryMessage: string,
  viewerPersonId: string | null,
  magic8Answer?: string | null,
): GameOverPresentationModel {
  const rounds = Math.max(1, state.session.currentRound || 1);
  const magic8Line =
    magic8Answer?.trim() ||
    getMagic8Wisdom({ gameType: 'blackjack', includeRare: true });

  return {
    title: 'Game Over',
    visual: pickGameOverVisual(resolveViewerOutcome(state, viewerPersonId)),
    winnerLine: resolveWinnerLine(state, summaryMessage),
    resultLine: resolveResultLine(state, summaryMessage),
    roundsLine: `${rounds} round${rounds === 1 ? '' : 's'} played`,
    magic8Line,
    rawSummary: summaryMessage,
  };
}
