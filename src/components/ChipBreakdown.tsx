import { breakdownChips, CHIP_VALUES } from './chipUtils';
import './ChipBreakdown.css';

interface ChipBreakdownProps {
  amount: number;
  compact?: boolean;
}

export function ChipBreakdown({ amount, compact = false }: ChipBreakdownProps) {
  const counts = breakdownChips(amount);
  const parts = CHIP_VALUES.filter((v) => counts[v] > 0).map(
    (v) => `${counts[v]}×${v}`,
  );
  if (parts.length === 0) {
    return <span className="chip-breakdown chip-breakdown--empty">0</span>;
  }
  return (
    <span className={`chip-breakdown${compact ? ' chip-breakdown--compact' : ''}`}>
      {parts.join(' ')}
    </span>
  );
}
