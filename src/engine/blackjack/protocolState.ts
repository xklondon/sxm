import type { GameState } from '../../types';
import {
  applyProtocolToStateFields,
  getBlackjackProtocolOrDefault,
  listBlackjackProtocolPresets,
} from './index';
import { canUserChangeProtocol } from '../table/adminControls';
import { isCustomProtocolId } from '../protocols/customProtocolTypes';
import {
  findCustomProtocolByStorageId,
  loadCustomProtocols,
} from '../../storage/customProtocolStorage';
import { resolveCustomProtocolToPreset } from '../protocols/customProtocolBuilder';
import type { BlackjackProtocol } from './protocols/types';

export function getBlackjackProtocolForState(state: GameState): BlackjackProtocol {
  const id = state.blackjackProtocolId;
  if (id && isCustomProtocolId(id)) {
    const custom = findCustomProtocolByStorageId(id);
    if (custom) {
      return resolveCustomProtocolToPreset(custom);
    }
  }
  return getBlackjackProtocolOrDefault(id);
}

export function listAllBlackjackProtocolsForSelector(): BlackjackProtocol[] {
  return [
    ...listBlackjackProtocolPresets(),
    ...loadCustomProtocols().map(resolveCustomProtocolToPreset),
  ];
}

export function setBlackjackProtocolOnState(
  state: GameState,
  protocolId: string,
  personName: string,
): GameState {
  if (!canUserChangeProtocol(state, personName)) {
    throw new Error('Protocol is locked or owner-only.');
  }
  const protocol = getBlackjackProtocolForState({ ...state, blackjackProtocolId: protocolId });
  const applied = applyProtocolToStateFields(protocol);
  return {
    ...state,
    blackjackProtocolId: protocolId,
    blackjackSettings: {
      ...applied.blackjackSettings,
      minBet: state.tableMeta.minimumBet ?? applied.blackjackSettings.minBet,
    },
  };
}

export function lockProtocolOnState(state: GameState): GameState {
  if (state.tableMeta.protocolLocked) {
    return state;
  }
  return {
    ...state,
    tableMeta: { ...state.tableMeta, protocolLocked: true },
  };
}

export function getVisibleDealerCardIds(state: GameState): string[] {
  const round = state.blackjack;
  if (!round) {
    return [];
  }
  const ids = round.dealerCardIds.filter(Boolean);
  const protocol = getBlackjackProtocolForState(state);
  if (protocol.dealingRules.showDealerHoleCardDuringPlay) {
    return ids;
  }
  const revealSecondFaceUp =
    round.status === 'bank-turn' ||
    round.status === 'banking' ||
    round.status === 'resolved' ||
    !round.dealerHoleHidden;
  if (!revealSecondFaceUp && ids.length > 1) {
    return ids;
  }
  return ids;
}
