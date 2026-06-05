export function createPlayer(id, displayName, playerType, startingBalance, virtualStyle, controllerName, role = 'person', bankrollOwnerId) {
    const trimmed = displayName.trim();
    return {
        id,
        displayName: trimmed,
        controllerName: (controllerName?.trim() || trimmed),
        role,
        bankrollOwnerId,
        playerType,
        virtualStyle: playerType === 'virtual' ? (virtualStyle ?? 'normal') : undefined,
        startingBalance,
        currentBet: 0,
        cardIds: [],
        status: 'active',
    };
}
