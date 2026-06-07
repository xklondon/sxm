import type { ComponentProps, ReactNode } from 'react';
import { DealerBlock } from './DealerBlock';
import { SXM_LAYOUT, sxmSectionProps } from './sxmLayoutContract';
import { TABLE_UX } from './tableUxContract';

export type BlackjackDealerAreaProps = ComponentProps<typeof DealerBlock> & {
  /** Card View uses bare DealerBlock inside the card layout dealer slot. */
  variant?: 'table' | 'card';
};

/** Canonical dealer zone — bank cards, dealer action, optional inline command when not omitted. */
export function BlackjackDealerArea({ variant = 'table', ...props }: BlackjackDealerAreaProps) {
  if (variant === 'card') {
    return <DealerBlock {...props} />;
  }
  return (
    <div className={`bj-table-zone ${TABLE_UX.tableZoneDealer}`}>
      <DealerBlock {...props} />
    </div>
  );
}

/** Card View dealer slot — same DealerBlock contract without Full Table zone wrapper. */
export function BlackjackDealerAreaCardSlot({ children }: { children: ReactNode }) {
  return <div className={TABLE_UX.cardLayoutDealer}>{children}</div>;
}

export function BlackjackDealerAreaSection(props: BlackjackDealerAreaProps) {
  return (
    <div {...sxmSectionProps(SXM_LAYOUT.dealerZone, 'dealer-block')}>
      <DealerBlock {...props} />
    </div>
  );
}
