export const MAX_TABLE_BOXES = 7;
export function resolveShowRoundSummaryOverlay(meta) {
    return meta.showRoundSummaryOverlay === true;
}
export function createEmptyBoxSlots() {
    return Array.from({ length: MAX_TABLE_BOXES }, (_, i) => ({
        slotNumber: i + 1,
        playerId: null,
        bankrollOwnerId: null,
        nativeAssignedPersonId: null,
        callerPersonId: null,
        passiveNames: [],
    }));
}
export function createDefaultTableMeta() {
    return {
        agreement: null,
        outcome: null,
        status: 'open',
        showStakeSetup: true,
        showBankerSetup: true,
        bankerSetup: {
            mode: 'unset',
            displayName: '',
            playerId: null,
            startBalance: 500,
        },
        boxSlots: createEmptyBoxSlots(),
        controllerName: '',
        owner: null,
        ownerPersonId: null,
        playerOrder: [],
        assignedBoxByPersonId: {},
        invites: [],
        protocolLocked: false,
        boxStakes: {},
        bettingLocked: false,
        shoeStarted: false,
        startingChipsEachSeat: 500,
        startingChipsBank: 500,
        minimumBet: 5,
        awaitingNextRound: false,
        showRoundSummaryOverlay: false,
        gameStatus: 'active',
        winnerId: null,
        endedAt: null,
        wagerVoucherStatus: 'not-created',
        tableNotice: null,
        joinHighlight: null,
    };
}
