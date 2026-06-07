import {
  MOBILE_LAYOUT_MEDIA,
  isMobileLayoutViewport,
} from '../styles/mobileLayoutContract';

const noop = () => {};

export type SimulatedViewport = {
  width: number;
  height: number;
  coarsePointer?: boolean;
};

export function createMobileLayoutMatchMedia(getViewport: () => SimulatedViewport) {
  return (query: string) => {
    const { width, height, coarsePointer = true } = getViewport();
    const matches =
      query === MOBILE_LAYOUT_MEDIA || query.includes('pointer: coarse')
        ? isMobileLayoutViewport(width, height, { coarsePointer })
        : (() => {
            const m = /max-width:\s*(\d+)/.exec(query);
            const max = m ? Number(m[1]) : Number.POSITIVE_INFINITY;
            return width <= max;
          })();

    return {
      matches,
      media: query,
      addEventListener: noop,
      removeEventListener: noop,
      addListener: noop,
      removeListener: noop,
      onchange: null,
      dispatchEvent: () => false,
    };
  };
}
