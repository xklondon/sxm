/** Front-end Blackjack pacing — not wired into rule resolution. */
export const BLACKJACK_UX = {
    /** Seconds for bet countdown after Play (timer mode). */
    betCountdownSeconds: 10,
    /** Delay between each card reveal during initial deal. */
    dealCardDelayMs: 550,
    /** Pause after full initial deal before player-turn UI. */
    dealRoundPauseMs: 350,
};
const PACE_MULTIPLIERS = {
    fast: 0.5,
    normal: 1,
    slow: 1.6,
};
export function dealDelaysForPace(pace = 'normal') {
    const m = PACE_MULTIPLIERS[pace];
    return {
        dealCardDelayMs: Math.round(BLACKJACK_UX.dealCardDelayMs * m),
        dealRoundPauseMs: Math.round(BLACKJACK_UX.dealRoundPauseMs * m),
    };
}
