import type { ComponentProps } from 'react';
import { DealerBlock } from './DealerBlock';
import { SXM_LAYOUT, sxmSectionProps } from './sxmLayoutContract';
import { TABLE_UX } from './tableUxContract';

export type BlackjackDealerAreaProps = ComponentProps<typeof DealerBlock>;

/** Canonical dealer zone — same wrapper in Full Table and Card View. */
export function BlackjackDealerArea(props: BlackjackDealerAreaProps) {
  return (
    <div className={`bj-table-zone ${TABLE_UX.tableZoneDealer}`}>
      <DealerBlock {...props} />
    </div>
  );
}

export function BlackjackDealerAreaSection(props: BlackjackDealerAreaProps) {
  return (
    <div {...sxmSectionProps(SXM_LAYOUT.dealerZone, 'dealer-block')}>
      <DealerBlock {...props} />
    </div>
  );
}
