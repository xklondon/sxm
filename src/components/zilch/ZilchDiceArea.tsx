import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { ZilchDie, ZilchGameState } from '../../engine/dice/zilch';
import {
  canKeepCombination,
  canKeepSelectedDice,
  findCombinationForSelection,
  isDieScoringSelectable,
  isTurnoverRoll,
} from '../../engine/dice/zilch';
import { dieThrowStyle } from '../zilchPlayerDisplay';
import { DieFace } from './DieFace';

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
  children?: ReactNode;
}

function placeholderDice(): ZilchDie[] {
  return Array.from({ length: 6 }, (_, i) => ({
    id: `rolling-${i}`,
    value: 1,
    isAvailable: true,
    isKept: false,
  }));
}

function selectionKey(ids: string[]): string {
  return [...ids].sort().join(',');
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
  children,
}: ZilchDiceAreaProps) {
  const [selectedDiceIds, setSelectedDiceIds] = useState<string[]>([]);

  const selectionResetKey = `${zilch.rollNumberInTurn}:${zilch.phase}:${zilch.dice.map((d) => `${d.id}:${d.isKept}`).join('|')}`;

  useEffect(() => {
    setSelectedDiceIds([]);
  }, [selectionResetKey]);

  const diceToRender =
    rolling && zilch.dice.length > 0
      ? zilch.dice
      : rolling
        ? placeholderDice()
        : zilch.dice;

  const activeDice = diceToRender.filter((die) => !die.isKept);
  const keptOnTable = diceToRender.filter((die) => die.isKept);
  const canSelect = canKeepCombination(zilch) && showValues && !controlsDisabled;
  const canKeepSelected = canKeepSelectedDice(zilch, selectedDiceIds);
  const turnover = isTurnoverRoll(zilch);

  const selectedKey = useMemo(() => selectionKey(selectedDiceIds), [selectedDiceIds]);

  function selectCombination(diceIds: string[]) {
    setSelectedDiceIds(diceIds);
  }

  function toggleDieSelection(die: ZilchDie) {
    if (!canSelect || die.isKept) {
      return;
    }
    setSelectedDiceIds((prev) => {
      const next = prev.includes(die.id)
        ? prev.filter((id) => id !== die.id)
        : [...prev, die.id];
      const match = findCombinationForSelection(zilch, next);
      if (match) {
        return [...match.diceIds];
      }
      return next;
    });
  }

  const showInvalidSelectionHint =
    canSelect && selectedDiceIds.length > 0 && !canKeepSelected;

  function handleKeepSelected() {
    const combo = findCombinationForSelection(zilch, selectedDiceIds);
    if (!combo) {
      return;
    }
    onKeepCombination(combo.id);
    setSelectedDiceIds([]);
  }

  function renderDie(die: ZilchDie, index: number, selectable: boolean) {
    const isSelected = selectedKey === selectionKey([die.id]) || selectedDiceIds.includes(die.id);
    const scoringSelectable = isDieScoringSelectable(die, zilch.availableCombinations);
    const invalidSelected = isSelected && showInvalidSelectionHint;
    return (
      <button
        key={die.id}
        type="button"
        className={`zilch-die${rolling ? ' zilch-die--throw' : ''}${
          die.isKept ? ' zilch-die--kept' : ''
        }${isSelected ? ' zilch-die--selected' : ''}${
          invalidSelected ? ' zilch-die--invalid' : ''
        }${selectable && !die.isKept ? ' zilch-die--selectable' : ''}${
          selectable && !die.isKept && !scoringSelectable ? ' zilch-die--non-scoring' : ''
        }`}
        style={
          rolling
            ? (dieThrowStyle(index, animSeed + index) as CSSProperties)
            : undefined
        }
        onClick={() => toggleDieSelection(die)}
        disabled={!selectable || die.isKept}
        aria-pressed={isSelected}
        aria-label={
          rolling
            ? 'Rolling'
            : die.isKept
              ? `Kept die ${die.value}`
              : scoringSelectable
                ? `Select die ${die.value}`
                : `Die ${die.value}, not scoring`
        }
      >
        <DieFace value={die.value} rolling={rolling || !showValues} />
      </button>
    );
  }

  const showScoringOptions = showValues && zilch.availableCombinations.length > 0;

  return (
    <div className="zilch-play-grid">
      <div className="zilch-dice-zone">
        {starterSpinActive && (
          <div
            className="zilch-panel__randomiser zilch-panel__randomiser--spin"
            aria-live="polite"
          >
            {playerNames[playerOrder[randomiserIndex] ?? ''] ?? '…'}
          </div>
        )}

        {turnover && !rolling && (
          <p className="zilch-table__turnover" role="status">
            Turnover — roll all 6 dice again
          </p>
        )}

        <div className="zilch-table__roll-zone" aria-label="Dice on table">
          {activeDice.map((die, index) => renderDie(die, index, canSelect))}
          {activeDice.length === 0 && zilch.phase === 'player-turn' && !rolling && !turnover && (
            <span className="zilch-table__hint">Press Roll to throw dice</span>
          )}
        </div>

        {(keptOnTable.length > 0 || zilch.keptDice.length > 0) && (
          <div className="zilch-table__kept" aria-label="Kept this turn">
            <span className="zilch-table__kept-label">Kept this turn</span>
            <div className="zilch-table__kept-dice">
              {keptOnTable.map((die, index) => renderDie(die, index + 100, false))}
            </div>
            {zilch.keptDice.map((group) => (
              <span key={group.id} className="zilch-table__kept-chip">
                {group.label} (+{group.score})
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="zilch-options-zone">
        {showScoringOptions && (
          <div className="zilch-table__combos" aria-label="Scoring options">
            {zilch.availableCombinations.map((combo) => {
              const isSelected = selectedKey === selectionKey(combo.diceIds);
              return (
                <button
                  key={combo.id}
                  type="button"
                  className={`zilch-table__combo-btn secondary${isSelected ? ' zilch-table__combo-btn--selected' : ''}`}
                  onClick={() => selectCombination(combo.diceIds)}
                  disabled={controlsDisabled || !canKeepCombination(zilch)}
                  aria-pressed={isSelected}
                >
                  {combo.label} ({combo.score})
                </button>
              );
            })}
            <button
              type="button"
              className="zilch-table__keep-btn"
              onClick={handleKeepSelected}
              disabled={controlsDisabled || !canKeepSelected}
            >
              Keep selected dice
            </button>
            {showInvalidSelectionHint && (
              <p className="zilch-table__selection-hint" role="status">
                Select scoring dice only.
              </p>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
