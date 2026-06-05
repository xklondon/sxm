/** Honor-system wager label from table agreement (e.g. "$5", "dinner") — not chip count. */
export function getTableWagerDisplay(state) {
    const stake = state.tableMeta.agreement?.stakeDescription?.trim();
    return stake && stake.length > 0 ? stake : 'Friendly game';
}
