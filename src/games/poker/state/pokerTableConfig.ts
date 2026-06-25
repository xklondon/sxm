/** @deprecated Import from `../../../types/poker` — re-export for poker UI module compatibility. */
export type {
  PokerProtocol,
  PokerTableMode,
  PokerTableConfig,
} from '../../../types/poker';

export {
  createDefaultPokerTableConfig,
  validatePokerBlinds,
} from '../../../types/poker';

export { canEditHoldemBlinds as canEditPokerBlinds } from '../../../engine/holdem/holdemSelectors';
