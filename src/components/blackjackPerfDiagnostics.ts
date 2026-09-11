export interface BlackjackPerfTrace {
  markStateApplied(): void;
  finish(): void;
}

const BLACKJACK_PERF_ACTIONS = new Set([
  'dealCards',
  'dealNextCard',
  'hit',
  'stand',
  'double',
  'split',
  'takeInsurance',
  'declineInsurance',
  'takeEvenMoney',
  'waitFor3to2',
  'nextRound',
  'shuffleToStart',
]);

function perfEnabled(): boolean {
  try {
    return import.meta.env?.DEV === true && import.meta.env?.VITE_BLACKJACK_PERF === 'true';
  } catch {
    return false;
  }
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function afterRender(callback: () => void): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => callback());
    return;
  }
  setTimeout(callback, 0);
}

/** Development-only action latency trace. Enable with VITE_BLACKJACK_PERF=true. */
export function beginBlackjackPerfTrace(
  action: string,
  options: { serverRoundTrip?: boolean; tapAt?: number } = {},
): BlackjackPerfTrace {
  if (!BLACKJACK_PERF_ACTIONS.has(action) || !perfEnabled()) {
    return { markStateApplied() {}, finish() {} };
  }

  const handlerAt = nowMs();
  const tapToHandler =
    options.tapAt === undefined ? null : Math.max(0, handlerAt - options.tapAt);
  let stateAppliedAt: number | null = null;

  return {
    markStateApplied() {
      stateAppliedAt = nowMs();
    },
    finish() {
      const finishedAt = nowMs();
      const stateAt = stateAppliedAt ?? finishedAt;
      afterRender(() => {
        const renderedAt = nowMs();
        const format = (value: number | null) =>
          value === null ? 'n/a' : `${Math.round(value)}ms`;
        console.debug(
          `[blackjack-perf] action=${action}` +
            ` tapToHandler=${format(tapToHandler)}` +
            ` handlerToState=${format(stateAt - handlerAt)}` +
            ` stateToRender=${format(renderedAt - stateAt)}` +
            ` serverRoundTrip=${format(options.serverRoundTrip ? finishedAt - handlerAt : 0)}` +
            ` total=${format(renderedAt - handlerAt)}`,
        );
      });
    },
  };
}
