import type { GameState } from '../../types';
import type { PlayFlowAutoStand } from '../../storage/profileStorage';

export { PLAY_FLOW_OPTIONS } from '../../storage/profileStorage';

export function getPlayFlowForPerson(state: GameState, personId: string): PlayFlowAutoStand {
  return state.tableMeta.personPlayFlow?.[personId] ?? 'auto-18';
}

export function setPersonPlayFlow(
  state: GameState,
  personId: string,
  playFlow: PlayFlowAutoStand,
): GameState {
  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      personPlayFlow: {
        ...state.tableMeta.personPlayFlow,
        [personId]: playFlow,
      },
    },
  };
}

/** Minimum hand total that triggers auto-stand; null when manual. */
export function autoStandThreshold(playFlow: PlayFlowAutoStand): number | null {
  switch (playFlow) {
    case 'auto-18':
      return 18;
    case 'auto-19':
      return 19;
    case 'auto-20':
      return 20;
    case 'auto-21':
      return 21;
    default:
      return null;
  }
}

export function shouldAutoStandHandValue(
  playFlow: PlayFlowAutoStand,
  handTotal: number,
): boolean {
  const threshold = autoStandThreshold(playFlow);
  return threshold !== null && handTotal >= threshold;
}

/** Chip-tray hint format for insufficient balance during betting. */
export function formatInsufficientChipsMessage(available: number, need: number): string {
  return `Not enough chips — available ${available}, need ${need}`;
}

export function isInsufficientChipsMessage(message: string): boolean {
  return /not enough chips/i.test(message);
}
