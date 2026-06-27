import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ZilchGameState } from '../../engine/dice/zilch';
import { canKeepSelectedDice } from '../../engine/dice/zilch';
import { ZilchDiceArea } from './ZilchDiceArea';
import { ZilchPlayControls } from './ZilchPlayControls';
import {
  ZILCH_GATHER_MS,
  ZILCH_LANDED_MS,
  ZILCH_THROW_MS,
  type ZilchDiceUiPhase,
} from './zilchDiceAnimation';

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
  const throwStartedAtRef = useRef<number | null>(null);

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
      throwStartedAtRef.current = Date.now();
      setDiceUiPhase('throwing');
      return;
    }

    if (zilch.phase !== 'awaiting-keep-selection' || !showValues) {
      throwStartedAtRef.current = null;
      setDiceUiPhase('idle');
      return;
    }

    if (throwStartedAtRef.current === null) {
      setDiceUiPhase('landed');
      const tGather = window.setTimeout(() => setDiceUiPhase('gather'), ZILCH_LANDED_MS);
      const tOrdered = window.setTimeout(() => {
        setDiceUiPhase('ordered');
      }, ZILCH_LANDED_MS + ZILCH_GATHER_MS);
      return () => {
        window.clearTimeout(tGather);
        window.clearTimeout(tOrdered);
      };
    }

    const startedAt = throwStartedAtRef.current;
    const throwRemaining = Math.max(0, ZILCH_THROW_MS - (Date.now() - startedAt));

    const tLanded = window.setTimeout(() => setDiceUiPhase('landed'), throwRemaining);
    const tGather = window.setTimeout(
      () => setDiceUiPhase('gather'),
      throwRemaining + ZILCH_LANDED_MS,
    );
    const tOrdered = window.setTimeout(() => {
      setDiceUiPhase('ordered');
      throwStartedAtRef.current = null;
    }, throwRemaining + ZILCH_LANDED_MS + ZILCH_GATHER_MS);

    return () => {
      window.clearTimeout(tLanded);
      window.clearTimeout(tGather);
      window.clearTimeout(tOrdered);
    };
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
