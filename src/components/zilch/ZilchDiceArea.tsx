import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { ZilchDie, ZilchGameState } from '../../engine/dice/zilch';
import {
  canKeepCombination,
  canKeepSelectedDice,
  findCombinationForSelection,
  isDieScoringSelectable,
  isTurnoverRoll,
  selectionHintForDice,
} from '../../engine/dice/zilch';
import { dieThrowStyle } from '../zilchPlayerDisplay';
import { DieFace } from './DieFace';
import { ZilchActions } from './ZilchActions';

interface ZilchDiceAreaProps {
  zilch: ZilchGameState;
  rolling: boolean;
  showValues: boolean;
  animSeed: number;
  controlsDisabled: boolean;
  onKeepAndRoll: (combinationId: string) => void;
  onRollDice: () => void;
  onBank: () => void;
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
  onKeepAndRoll,
  onRollDice,
  onBank,
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

  function toggleDieSelection(die: ZilchDie) {
    if (!canSelect || die.isKept) {
      return;
    }
    if (!isDieScoringSelectable(die, zilch.availableCombinations)) {
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

  function handleKeepAndRollClick() {
    const combo = findCombinationForSelection(zilch, selectedDiceIds);
    if (!combo) {
      return;
    }
    onKeepAndRoll(combo.id);
    setSelectedDiceIds([]);
  }

  const selectionHint = selectionHintForDice(zilch, selectedDiceIds, canSelect);

  function renderDie(die: ZilchDie, index: number, selectable: boolean) {
    const isSelected = selectedKey === selectionKey([die.id]) || selectedDiceIds.includes(die.id);
    const scoringSelectable = isDieScoringSelectable(die, zilch.availableCombinations);
    const invalidSelected = isSelected && selectedDiceIds.length > 0 && !canKeepSelected;
    return (
      <button
        key={die.id}
        type="button"
        className={`zilch-die${rolling ? ' zilch-die--throw' : ''}${
          die.isKept ? ' zilch-die--kept' : ''
        }${isSelected ? ' zilch-die--selected' : ''}${
          invalidSelected ? ' zilch-die--invalid' : ''
        }${selectable && scoringSelectable && !die.isKept ? ' zilch-die--selectable' : ''}${
          selectable && !die.isKept && !scoringSelectable ? ' zilch-die--non-scoring' : ''
        }`}
        style={
          rolling
            ? (dieThrowStyle(index, animSeed + index) as CSSProperties)
            : undefined
        }
        onClick={() => toggleDieSelection(die)}
        disabled={!selectable || die.isKept || !scoringSelectable}
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

  return (
    <div className="zilch-felt-center" data-testid="zilch-felt-center">
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

      {selectionHint && (
        <p className="zilch-table__selection-hint" role="status">
          {selectionHint}
        </p>
      )}

      <ZilchActions
        zilch={zilch}
        rolling={rolling}
        controlsDisabled={controlsDisabled}
        canKeepAndRoll={canKeepSelected}
        onKeepAndRoll={handleKeepAndRollClick}
        onRollDice={onRollDice}
        onBank={onBank}
      />
    </div>
  );
}
