import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { ZilchDie, ZilchGameState } from '../../engine/dice/zilch';
import { canKeepCombination, getSelectableDiceIds, isTurnoverRoll } from '../../engine/dice/zilch';
import {
  dieThrowStyle,
  landedScatterStyle,
  orderedRowStyle,
} from '../zilchPlayerDisplay';
import {
  selectionEnabledForPhase,
  type ZilchDiceUiPhase,
} from './zilchDiceAnimation';
import { DieFace } from './DieFace';

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
  const [gatherActive, setGatherActive] = useState(false);
  const selectableIds = useMemo(() => new Set(getSelectableDiceIds(zilch)), [zilch]);

  const visualThrowing = diceUiPhase === 'throwing' || rolling;
  const diceToRender =
    visualThrowing && zilch.dice.length > 0
      ? zilch.dice
      : visualThrowing
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
    selectionEnabledForPhase(diceUiPhase);
  const turnover = isTurnoverRoll(zilch);

  useEffect(() => {
    if (diceUiPhase !== 'gather') {
      setGatherActive(false);
      return;
    }
    setGatherActive(false);
    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setGatherActive(true));
    });
    return () => window.cancelAnimationFrame(raf);
  }, [diceUiPhase, zilch.rollNumberInTurn]);

  function toggleDieSelection(die: ZilchDie) {
    if (!canSelect || die.isKept || !selectableIds.has(die.id)) {
      return;
    }
    onSelectedDiceIdsChange(
      selectedDiceIds.includes(die.id)
        ? selectedDiceIds.filter((id) => id !== die.id)
        : [...selectedDiceIds, die.id],
    );
  }

  function renderDie(die: ZilchDie, index: number, interactive: boolean) {
    const isSelectable = selectableIds.has(die.id);
    const isSelected = selectedDiceIds.includes(die.id);
    const dieCount = activeDice.length || 6;
    const showFaceValues = !visualThrowing && showValues;

    let pathStyle: CSSProperties | undefined;
    if (visualThrowing) {
      pathStyle = dieThrowStyle(index, animSeed + index, dieCount) as CSSProperties;
    } else if (diceUiPhase === 'landed' || diceUiPhase === 'gather' || diceUiPhase === 'ordered') {
      pathStyle = {
        ...(landedScatterStyle(index, animSeed + index, dieCount) as CSSProperties),
        ...(diceUiPhase === 'gather' || diceUiPhase === 'ordered'
          ? (orderedRowStyle(index, dieCount) as CSSProperties)
          : {}),
      };
    }

    const pathClass = [
      'zilch-die__path',
      visualThrowing ? 'zilch-die__path--throw' : '',
      diceUiPhase === 'landed' ? 'zilch-die__path--landed' : '',
      diceUiPhase === 'gather' ? 'zilch-die__path--gather' : '',
      diceUiPhase === 'gather' && gatherActive ? 'zilch-die__path--gathering' : '',
      diceUiPhase === 'ordered' ? 'zilch-die__path--ordered' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const dieClass = [
      'zilch-die',
      visualThrowing ? 'zilch-die--throw' : '',
      die.isKept ? 'zilch-die--kept' : '',
      isSelected ? 'zilch-die--selected' : '',
      interactive && isSelectable ? 'zilch-die--selectable' : 'zilch-die--frozen',
    ]
      .filter(Boolean)
      .join(' ');

    const face = (
      <DieFace value={die.value} rolling={visualThrowing || !showFaceValues} />
    );

    if (interactive && isSelectable) {
      return (
        <div key={die.id} className={pathClass} style={pathStyle}>
          <button
            type="button"
            className={dieClass}
            onClick={() => toggleDieSelection(die)}
            aria-pressed={isSelected}
            aria-label={`Select die ${die.value}`}
          >
            {face}
          </button>
        </div>
      );
    }

    return (
      <div key={die.id} className={pathClass} style={pathStyle}>
        <div
          className={dieClass}
          role="img"
          aria-label={die.isKept ? `Kept die ${die.value}` : `Die ${die.value}, not scoring`}
        >
          {face}
        </div>
      </div>
    );
  }

  const rollZoneClass = [
    'zilch-table__roll-zone',
    visualThrowing ? 'zilch-table__roll-zone--throwing' : '',
    diceUiPhase === 'landed' ? 'zilch-table__roll-zone--landed' : '',
    diceUiPhase === 'gather' ? 'zilch-table__roll-zone--gather' : '',
    diceUiPhase === 'ordered' ? 'zilch-table__roll-zone--ordered' : '',
    !visualThrowing && activeDice.length > 0 && diceUiPhase === 'idle'
      ? 'zilch-table__roll-zone--settled'
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="zilch-felt-center zilch-felt-center--play" data-testid="zilch-felt-center">
      {turnover && !visualThrowing && (
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
          {activeDice.length === 0 && zilch.phase === 'player-turn' && !visualThrowing && !turnover && (
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

export type { ZilchDiceUiPhase };
