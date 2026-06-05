export function createEmptyLedger(sessionId) {
    return {
        sessionId,
        entries: [],
    };
}
