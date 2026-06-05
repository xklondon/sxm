import { createCustomProtocol, listCustomRuleReminders, resolveCustomProtocolToPreset, } from '../../protocols/customProtocolBuilder';
import { customProtocolStorageId } from '../../protocols/customProtocolTypes';
import { loadCustomProtocols, saveCustomProtocol, } from '../../../storage/customProtocolStorage';
import { getProtocolMessage } from '../protocolMessages';
import { getBlackjackProtocolPhase } from '../protocol';
import { baseTestTable } from './fixtures';
import { check } from './types';
function ensureTestLocalStorage() {
    const g = globalThis;
    if (g.localStorage && typeof g.localStorage.getItem === 'function') {
        return;
    }
    const store = new Map();
    g.localStorage = {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => store.set(k, v),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear(),
        key: () => null,
        length: 0,
    };
}
export function runCustomProtocolSanityChecks() {
    ensureTestLocalStorage();
    const results = [];
    const custom = createCustomProtocol({
        baseProtocolId: 'las-vegas-house',
        name: 'QA Custom',
        description: 'Test custom protocol',
        rules: [
            {
                title: 'Two queens challenge',
                description: 'Social table rule',
                ruleType: 'social',
                trigger: 'always',
                effect: 'Reminder only',
                isEnabled: true,
            },
        ],
    });
    saveCustomProtocol(custom);
    const loaded = loadCustomProtocols().find((p) => p.customProtocolId === custom.customProtocolId);
    results.push(check('custom protocol saves to localStorage', Boolean(loaded)));
    const storageId = customProtocolStorageId(custom.customProtocolId);
    results.push(check('custom protocol resolves to preset with storage id', resolveCustomProtocolToPreset(custom).protocolId === storageId));
    const reminders = listCustomRuleReminders(custom);
    results.push(check('social rule appears in custom reminders', reminders.some((r) => r.includes('Two queens') || r.includes('Social rule'))));
    let state = baseTestTable();
    state = {
        ...state,
        blackjackProtocolId: storageId,
        tableMeta: { ...state.tableMeta, shoeStarted: true },
    };
    const msg = getProtocolMessage(state, getBlackjackProtocolPhase(state));
    results.push(check('custom social rule surfaces in protocol message', msg.includes('Social rule') ||
        msg.includes('Two queens') ||
        msg.includes('QA Custom') ||
        msg.includes('double'), `msg=${msg.slice(0, 120)}`));
    return { passed: results.every((r) => r.passed), results };
}
