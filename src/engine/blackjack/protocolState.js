import { applyProtocolToStateFields, getBlackjackProtocolOrDefault, listBlackjackProtocolPresets, } from './index';
import { canUserChangeProtocol } from '../table/adminControls';
import { isCustomProtocolId } from '../protocols/customProtocolTypes';
import { findCustomProtocolByStorageId, loadCustomProtocols, } from '../../storage/customProtocolStorage';
import { resolveCustomProtocolToPreset } from '../protocols/customProtocolBuilder';
export function getBlackjackProtocolForState(state) {
    const id = state.blackjackProtocolId;
    if (id && isCustomProtocolId(id)) {
        const custom = findCustomProtocolByStorageId(id);
        if (custom) {
            return resolveCustomProtocolToPreset(custom);
        }
    }
    return getBlackjackProtocolOrDefault(id);
}
export function listAllBlackjackProtocolsForSelector() {
    return [
        ...listBlackjackProtocolPresets(),
        ...loadCustomProtocols().map(resolveCustomProtocolToPreset),
    ];
}
export function setBlackjackProtocolOnState(state, protocolId, personName) {
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
export function lockProtocolOnState(state) {
    if (state.tableMeta.protocolLocked) {
        return state;
    }
    return {
        ...state,
        tableMeta: { ...state.tableMeta, protocolLocked: true },
    };
}
export function getVisibleDealerCardIds(state) {
    const round = state.blackjack;
    if (!round) {
        return [];
    }
    const ids = round.dealerCardIds.filter(Boolean);
    const protocol = getBlackjackProtocolForState(state);
    if (protocol.dealingRules.showDealerHoleCardDuringPlay) {
        return ids;
    }
    const revealSecond = round.status === 'bank-turn' ||
        round.status === 'banking' ||
        round.status === 'resolved';
    if (!revealSecond && ids.length > 1) {
        return ids.slice(0, 1);
    }
    return ids;
}
