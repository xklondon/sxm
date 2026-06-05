import { bankTurn, completeDiceRoll, confirmStarter, createInitialZilchState, keepCombination, randomiseStarter, rollDice, } from './zilchEngine';
export const ZILCH_GAMEPLAY_ACTIONS = [
    'zilchRandomiseStarter',
    'zilchConfirmStarter',
    'zilchRollDice',
    'zilchCompleteRoll',
    'zilchKeepCombination',
    'zilchBankTurn',
    'zilchQuitTurn',
];
export function isZilchGameplayAction(action) {
    return ZILCH_GAMEPLAY_ACTIONS.includes(action);
}
export function applyZilchActionToState(state, action, payload = {}) {
    if (!state.zilch) {
        throw new Error('No Zilch game in progress');
    }
    const settings = state.zilchSettings;
    let zilch = state.zilch;
    switch (action) {
        case 'zilchRandomiseStarter':
            zilch = randomiseStarter(zilch);
            break;
        case 'zilchConfirmStarter':
            zilch = confirmStarter(zilch);
            break;
        case 'zilchRollDice':
            zilch = rollDice(zilch, settings);
            break;
        case 'zilchCompleteRoll':
            zilch = completeDiceRoll(zilch);
            break;
        case 'zilchKeepCombination': {
            const combinationId = String(payload.combinationId ?? '');
            if (!combinationId) {
                throw new Error('combinationId required');
            }
            zilch = keepCombination(zilch, combinationId);
            break;
        }
        case 'zilchBankTurn':
            zilch = bankTurn(zilch);
            break;
        case 'zilchQuitTurn':
            zilch = bankTurn(zilch);
            break;
        default:
            throw new Error(`Unknown Zilch action: ${action}`);
    }
    return { ...state, zilch };
}
export function startZilchGameOnState(state, playerIds, settings) {
    return {
        ...state,
        zilch: createInitialZilchState(playerIds, settings),
        zilchSettings: settings,
        tableMeta: {
            ...state.tableMeta,
            gameCategory: 'dice',
            diceGame: 'zilch',
            protocolLocked: true,
        },
    };
}
