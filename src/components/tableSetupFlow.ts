import type { GameState } from '../types';
import { switchGameType } from '../engine/session/table';

export type SetupEntryPoint = 'root' | 'menu-new-table' | 'reset-table';

export type SetupStep = 'category' | 'mode' | 'settings';

export type GameCategory = 'cards' | 'dice';
export type GameMode = 'practice' | 'challenge';
export type CardGame = 'blackjack';
export type DiceGame = 'zilch';

export type SetupDraft = {
  entryPoint: SetupEntryPoint;
  step: SetupStep;
  category: GameCategory | null;
  mode: GameMode | null;
  cardGame: CardGame | null;
  diceGame: DiceGame | null;
};

export function createFreshSetupDraft(entryPoint: SetupEntryPoint): SetupDraft {
  return {
    entryPoint,
    step: 'category',
    category: null,
    mode: null,
    cardGame: null,
    diceGame: null,
  };
}

export function selectCategoryCards(draft: SetupDraft): SetupDraft {
  return {
    ...draft,
    category: 'cards',
    cardGame: 'blackjack',
    diceGame: null,
    step: 'mode',
  };
}

export function selectCategoryDice(draft: SetupDraft): SetupDraft {
  return {
    ...draft,
    category: 'dice',
    diceGame: 'zilch',
    cardGame: null,
    step: 'mode',
  };
}

export function selectMode(draft: SetupDraft, mode: GameMode): SetupDraft {
  return {
    ...draft,
    mode,
    step: 'settings',
  };
}

export function goBackFromMode(draft: SetupDraft): SetupDraft {
  return {
    ...draft,
    step: 'category',
    category: null,
    mode: null,
    cardGame: null,
    diceGame: null,
  };
}

export function goBackFromSettings(draft: SetupDraft): SetupDraft {
  return {
    ...draft,
    step: 'mode',
    mode: null,
  };
}

export function resolveSetupGameType(
  draft: SetupDraft,
): 'blackjack' | 'zilch' | null {
  if (draft.category === 'dice' && draft.diceGame === 'zilch') {
    return 'zilch';
  }
  if (draft.category === 'cards' && draft.cardGame === 'blackjack') {
    return 'blackjack';
  }
  return null;
}

export function isZilchSetupDraft(draft: SetupDraft): boolean {
  return resolveSetupGameType(draft) === 'zilch';
}

export function isBlackjackSetupDraft(draft: SetupDraft): boolean {
  return resolveSetupGameType(draft) === 'blackjack';
}

/** Strip opposing game identity before applying setup confirm. */
export function prepareTableStateForSetupConfirm(
  state: GameState,
  draft: SetupDraft,
): GameState {
  const gameType = resolveSetupGameType(draft);
  if (gameType === 'zilch') {
    return {
      ...switchGameType(state, 'zilch'),
      blackjack: null,
      holdem: null,
      zilch: null,
      tableMeta: {
        ...state.tableMeta,
        gameCategory: 'dice',
        diceGame: 'zilch',
        cardGame: undefined,
      },
    };
  }
  if (gameType === 'blackjack') {
    return {
      ...switchGameType(state, 'blackjack'),
      zilch: null,
      holdem: null,
      tableMeta: {
        ...state.tableMeta,
        gameCategory: 'cards',
        cardGame: 'blackjack',
        diceGame: undefined,
      },
    };
  }
  return state;
}

export function setupPayloadGameCategory(draft: SetupDraft): GameCategory | undefined {
  return draft.category ?? undefined;
}

export function setupPayloadGameType(draft: SetupDraft): 'blackjack' | 'zilch' | undefined {
  const resolved = resolveSetupGameType(draft);
  return resolved ?? undefined;
}
