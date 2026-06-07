import type { BlackjackPlayerBoxInfo } from './blackjackPlayerBoxInfo';

/** Shared player-box header row — Full Table arc seats and Card View mini boxes. */
export function BlackjackPlayerBoxHead({
  boxLabel,
  callerDisplayName,
}: Pick<BlackjackPlayerBoxInfo, 'boxLabel' | 'callerDisplayName'>) {
  return (
    <span className="bj-phone-view__mini-hand-head">
      <span className="bj-phone-view__mini-hand-box">{boxLabel}</span>
      <span className="bj-phone-view__mini-hand-name">{callerDisplayName}</span>
    </span>
  );
}

export {
  BlackjackActionsZone,
  BlackjackCardsAreaZone,
  BlackjackCommandZone,
  BlackjackPlayerBoxesZone,
} from './blackjackViewZones';
