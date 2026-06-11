/**
 * IOU Wallet new-IOU handoff URL builder.
 *
 * Contract (query params for https://iou-wallet.com/new):
 * - counterpartyEmail — other party in the debt
 * - title — wager description
 * - message — fixed game context line
 * - type — `cash` | `personal` (derived from wager text)
 * - cryptoSettlement — `false` (no crypto settlement)
 *
 * Intentionally omits due date and interest rates.
 * No API integration — user must click to open the prefilled form.
 */
export const IOU_WALLET_NEW_BASE_URL = 'https://iou-wallet.com/new';
export const IOU_GAME_MESSAGE = 'from our game on sxm challenge.';
const CASH_WAGER_PATTERN = /(?:\$|€|£|¥|usd|eur|gbp|cash|money|dollar|euro|pound|bucks|\d+\s*(?:usd|eur|gbp))/i;
export function detectIouTypeFromWager(wager) {
    const trimmed = wager.trim();
    if (!trimmed) {
        return 'personal';
    }
    return CASH_WAGER_PATTERN.test(trimmed) ? 'cash' : 'personal';
}
/** Build IOU Wallet /new URL with documented query-param prefill. */
export function buildIouWalletNewUrl(params) {
    const url = new URL(IOU_WALLET_NEW_BASE_URL);
    url.searchParams.set('counterpartyEmail', params.counterpartyEmail.trim());
    url.searchParams.set('title', params.title.trim());
    url.searchParams.set('message', params.message?.trim() || IOU_GAME_MESSAGE);
    url.searchParams.set('type', params.type);
    url.searchParams.set('cryptoSettlement', 'false');
    return url.toString();
}
