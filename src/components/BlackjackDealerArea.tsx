import type { ComponentProps } from 'react';
import { DealerBlock } from './DealerBlock';

export type BlackjackDealerAreaProps = ComponentProps<typeof DealerBlock>;

/** Canonical dealer zone — same wrapper in Full Table and Card View. */
export function BlackjackDealerArea(props: BlackjackDealerAreaProps) {
  return (
    <div className="bj-dealer-area">
      <DealerBlock {...props} />
    </div>
  );
}
