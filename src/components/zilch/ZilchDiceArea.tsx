import { type CSSProperties } from 'react';
import type { ZilchDie, ZilchGameState } from '../../engine/dice/zilch';
import {
  canKeepCombination,
  isDieScoringSelectable,
  isTurnoverRoll,
} from '../../engine/dice/zilch';
import { dieThrowStyle, landedScatterStyle } from '../zilchPlayerDisplay';
import { DieFace } from './DieFace';

export type ZilchDiceUiPhase = 'idle' | 'rolling' | 'landed' | 'ordered';

interface ZilchDiceAreaProps {
  zilch: ZilchGameState;
  rolling: boolean;
  showValues: boolean;
  animSeed: number;
  controlsDisabled: boolean;
  diceUiPhase: ZilchDiceUiPhase;
  selectedDiceIds: string[];
  onSelectedDiceIdsChange: (ids: string[]) => void;
  zilchRevealCountdown?: number;
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
  diceUiPhase,
  selectedDiceIds,
  onSelectedDiceIdsChange,
  zilchRevealCountdown = 0,
}: ZilchDiceAreaProps) {
  const diceToRender =
    rolling && zilch.dice.length > 0
      ? zilch.dice
      : rolling
        ? placeholderDice()
        : zilch.dice;

  const activeDice = diceToRender.filter((die) => !die.isKept);
  const keptOnTable = diceToRender.filter((die) => die.isKept);
  const isZilchReveal = zilch.phase === 'zilch-reveal';
  const canSelect =
    canKeepCombination(zilch) &&
    showValues &&
    !controlsDisabled &&
    !isZilchReveal &&
    diceUiPhase === 'ordered';
  const turnover = isTurnoverRoll(zilch);

  function toggleDieSelection(die: ZilchDie) {
    if (!canSelect || die.isKept) {
      return;
    }
    if (!isDieScoringSelectable(die, zilch.availableCombinations)) {
      return;
    }
    onSelectedDiceIdsChange(
      selectedDiceIds.includes(die.id)
        ? selectedDiceIds.filter((id) => id !== die.id)
        : [...selectedDiceIds, die.id],
    );
  }

  function renderDie(die: ZilchDie, index: number, selectable: boolean) {
    const isSelected = selectedDiceIds.includes(die.id);
    const scoringSelectable = isDieScoringSelectable(die, zilch.availableCombinations);
    const dieCount = activeDice.length || 6;
    const scattered = diceUiPhase === 'landed';
    const ordered = diceUiPhase === 'ordered';

    let pathStyle: CSSProperties | undefined;
    if (rolling) {
      pathStyle = dieThrowStyle(index, animSeed + index, dieCount) as CSSProperties;
    } else if (scattered) {
      pathStyle = landedScatterStyle(index, animSeed + index, dieCount) as CSSProperties;
    }

    return (
      <div
        key={die.id}
        className={`zilch-die__path${
          rolling ? ' zilch-die__path--throw' : scattered ? ' zilch-die__path--landed' : ' zilch-die__path--settled'
        }${ordered ? ' zilch-die__path--ordered' : ''}`}
        style={pathStyle}
      >
        <button
          type="button"
          className={`zilch-die${rolling ? ' zilch-die--throw' : ''}${
            die.isKept ? ' zilch-die--kept' : ''
          }${isSelected ? ' zilch-die--selected' : ''}${
            selectable && scoringSelectable && !die.isKept ? ' zilch-die--selectable' : ''
          }${selectable && !die.isKept && !scoringSelectable ? ' zilch-die--non-scoring' : ''}`}
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
      </div>
    );
  }

  const rollZoneClass = [
    'zilch-table__roll-zone',
    rolling ? 'zilch-table__roll-zone--throwing' : '',
    diceUiPhase === 'landed' ? 'zilch-table__roll-zone--landed' : '',
    diceUiPhase === 'ordered' ? 'zilch-table__roll-zone--ordered' : '',
    !rolling && activeDice.length > 0 && diceUiPhase === 'idle' ? 'zilch-table__roll-zone--settled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="zilch-felt-center zilch-felt-center--play" data-testid="zilch-felt-center">
      {turnover && !rolling && (
        <p className="zilch-table__turnover" role="status">
          Turnover — roll all 6 dice again
        </p>
      )}

      {isZilchReveal && (
        <p className="zilch-table__zilch-reveal" role="status">
          <strong>ZILCH</strong> — no scoring dice. Turn score lost.
          {zilchRevealCountdown > 0 && (
            <span className="zilch-table__zilch-reveal-countdown">
              {' '}
              Next player in {zilchRevealCountdown}…
            </span>
          )}
        </p>
      )}

      <div
        className="zilch-table__throw-oval"
        data-testid="zilch-throw-oval"
        data-dice-ui-phase={diceUiPhase}
      >
        <div className={rollZoneClass} aria-label="Dice on table">
          {activeDice.map((die, index) => renderDie(die, index, canSelect))}
          {activeDice.length === 0 && zilch.phase === 'player-turn' && !rolling && !turnover && (
            <span className="zilch-table__hint">Press Roll Dice to throw</span>
          )}
        </div>
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
  );
}
