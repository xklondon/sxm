import { DealerCommandArea } from './DealerBlock';
import { TABLE_UX } from './tableUxContract';

export interface BlackjackCommandBoxProps {
  commandMessage?: string | null;
  commandLines?: string[];
  gameEnded: boolean;
}

/** Canonical command text zone — shared by Full Table summary row and Card View. */
export function BlackjackCommandBox({
  commandMessage,
  commandLines = [],
  gameEnded,
}: BlackjackCommandBoxProps) {
  return (
    <div className={TABLE_UX.cardLayoutCommand}>
      <DealerCommandArea
        commandMessage={commandMessage}
        commandLines={commandLines}
        gameEnded={gameEnded}
      />
    </div>
  );
}
