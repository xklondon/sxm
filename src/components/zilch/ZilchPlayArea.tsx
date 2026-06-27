import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ZilchGameState } from '../../engine/dice/zilch';
import { canKeepSelectedDice } from '../../engine/dice/zilch';
import { ZilchDiceArea, type ZilchDiceUiPhase } from './ZilchDiceArea';
import { ZilchPlayControls } from './ZilchPlayControls';

const ORDER_DELAY_MS = 3000;

interface ZilchPlayAreaProps {
  zilch: ZilchGameState;
  rolling: boolean;
  showValues: boolean;
  animSeed: number;
  controlsDisabled: boolean;
  actionError?: string | null;
  onDismissError?: () => void;
  zilchRevealCountdown?: number;
  onKeepSelected: (diceIds: string[]) => void;
  onRollDice: () => void;
  onBank: () => void;
}

export function ZilchPlayArea({
  zilch,
  rolling,
  showValues,
  animSeed,
  controlsDisabled,
  actionError = null,
  onDismissError,
  zilchRevealCountdown = 0,
  onKeepSelected,
  onRollDice,
  onBank,
}: ZilchPlayAreaProps) {
  const [selectedDiceIds, setSelectedDiceIds] = useState<string[]>([]);
  const [diceUiPhase, setDiceUiPhase] = useState<ZilchDiceUiPhase>('idle');

  const selectionResetKey = `${zilch.rollNumberInTurn}:${zilch.phase}:${zilch.dice.map((d) => `${d.id}:${d.isKept}`).join('|')}`;

  useEffect(() => {
    setSelectedDiceIds([]);
  }, [selectionResetKey]);

  useEffect(() => {
    if (!actionError || !onDismissError) {
      return;
    }
    const timer = window.setTimeout(onDismissError, 2800);
    return () => window.clearTimeout(timer);
  }, [actionError, onDismissError]);

  useEffect(() => {
    if (rolling) {
      setDiceUiPhase('rolling');
      return;
    }
    if (zilch.phase === 'awaiting-keep-selection' && showValues) {
      setDiceUiPhase('landed');
      const timer = window.setTimeout(() => setDiceUiPhase('ordered'), ORDER_DELAY_MS);
      return () => window.clearTimeout(timer);
    }
    setDiceUiPhase('idle');
  }, [rolling, showValues, selectionResetKey, zilch.phase]);

  const canKeepSelected = useMemo(
    () => canKeepSelectedDice(zilch, selectedDiceIds),
    [zilch, selectedDiceIds],
  );

  const handleKeepSelected = useCallback(() => {
    if (!canKeepSelected || selectedDiceIds.length === 0) {
      return;
    }
    onKeepSelected([...selectedDiceIds]);
    setSelectedDiceIds([]);
  }, [canKeepSelected, onKeepSelected, selectedDiceIds]);

  return (
    <>
      <ZilchDiceArea
        zilch={zilch}
        rolling={rolling}
        showValues={showValues}
        animSeed={animSeed}
        controlsDisabled={controlsDisabled}
        diceUiPhase={diceUiPhase}
        selectedDiceIds={selectedDiceIds}
        onSelectedDiceIdsChange={setSelectedDiceIds}
        zilchRevealCountdown={zilchRevealCountdown}
      />
      <ZilchPlayControls
        zilch={zilch}
        rolling={rolling}
        controlsDisabled={controlsDisabled}
        canKeepSelected={canKeepSelected}
        diceUiPhase={diceUiPhase}
        actionError={actionError}
        onKeepSelected={handleKeepSelected}
        onRollDice={onRollDice}
        onBank={onBank}
      />
    </>
  );
}
