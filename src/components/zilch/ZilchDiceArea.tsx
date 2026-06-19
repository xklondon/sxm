import type { CSSProperties } from 'react';
import type { ZilchDie, ZilchGameState } from '../../engine/dice/zilch';
import { canKeepCombination } from '../../engine/dice/zilch';
import { dieThrowStyle } from '../zilchPlayerDisplay';

interface ZilchDiceAreaProps {
  zilch: ZilchGameState;
  rolling: boolean;
  showValues: boolean;
  animSeed: number;
  controlsDisabled: boolean;
  starterSpinActive: boolean;
  randomiserIndex: number;
  playerOrder: string[];
  playerNames: Record<string, string>;
  onKeepCombination: (combinationId: string) => void;
}

function placeholderDice(): ZilchDie[] {
  return Array.from({ length: 6 }, (_, i) => ({
    id: `rolling-${i}`,
    value: 1,
    isAvailable: true,
    isKept: false,
  }));
}

export function ZilchDiceArea({
  zilch,
  rolling,
  showValues,
  animSeed,
  controlsDisabled,
  starterSpinActive,
  randomiserIndex,
  playerOrder,
  playerNames,
  onKeepCombination,
}: ZilchDiceAreaProps) {
  const diceToRender =
    rolling && zilch.dice.length > 0
      ? zilch.dice
      : rolling
        ? placeholderDice()
        : zilch.dice;

  return (
    <>
        {starterSpinActive && (
          <div
            className="zilch-panel__randomiser zilch-panel__randomiser--spin"
            aria-live="polite"
          >
            {playerNames[playerOrder[randomiserIndex] ?? ''] ?? '…'}
          </div>
        )}

        <div className="zilch-table__roll-zone" aria-label="Dice on table">
          {diceToRender.map((die, index) => (
            <div
              key={die.id}
              className={`zilch-die${rolling ? ' zilch-die--throw' : ''}${
                die.isKept ? ' zilch-die--kept' : ''
              }`}
              style={
                rolling
                  ? (dieThrowStyle(index, animSeed + index) as CSSProperties)
                  : undefined
              }
            >
              {rolling ? '?' : showValues ? die.value : '?'}
            </div>
          ))}
          {diceToRender.length === 0 && zilch.phase === 'player-turn' && !rolling && (
            <span className="zilch-table__hint">Press Dice to roll</span>
          )}
        </div>

        {zilch.keptDice.length > 0 && (
          <div className="zilch-table__kept" aria-label="Kept dice">
            {zilch.keptDice.map((g) => (
              <span key={g.id} className="zilch-table__kept-chip">
                {g.label} (+{g.score})
              </span>
            ))}
          </div>
        )}

        {showValues && zilch.availableCombinations.length > 0 && (
          <div className="zilch-table__combos" aria-label="Scoring options">
            {zilch.availableCombinations.map((combo) => (
              <button
                key={combo.id}
                type="button"
                className="zilch-table__combo-btn secondary"
                onClick={() => onKeepCombination(combo.id)}
                disabled={controlsDisabled || !canKeepCombination(zilch)}
              >
                {combo.label} ({combo.score})
              </button>
            ))}
          </div>
        )}
    </>
  );
}
