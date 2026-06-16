import { BlackjackActionPanel, type BlackjackActionPanelProps } from './BlackjackActionPanel';

export type BlackjackActionRowScale = 'full-table' | 'card-view';

export interface BlackjackActionRowProps extends BlackjackActionPanelProps {
  scale?: BlackjackActionRowScale;
}

/**
 * Canonical action row — Full Table and Card View share this component only.
 * View CSS scales via shell view root; no duplicate Stay/Hit render path.
 */
export function BlackjackActionRow({ scale = 'full-table', variant, ...props }: BlackjackActionRowProps) {
  const resolvedVariant = variant ?? (scale === 'card-view' ? 'card' : 'table');
  return (
    <div className="bj-action-row" data-layout-band="action-row" data-action-row-scale={scale}>
      <BlackjackActionPanel variant={resolvedVariant} {...props} />
    </div>
  );
}
