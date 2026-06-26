interface PokerShowdownCopyProps {
  winningHandLabel?: string;
  payoutSummary?: string[];
  sidePotCount?: number;
}

/** Showdown / payout copy — felt center only (no pot or deal controls). */
export function PokerShowdownCopy({
  winningHandLabel,
  payoutSummary = [],
  sidePotCount = 0,
}: PokerShowdownCopyProps) {
  const hasCopy =
    Boolean(winningHandLabel) || payoutSummary.length > 0 || sidePotCount > 1;
  if (!hasCopy) {
    return null;
  }

  return (
    <div className="poker-hr-showdown" data-testid="poker-felt-showdown" aria-label="Showdown">
      {winningHandLabel ? (
        <p className="poker-hr-showdown__hand">Winning hand: {winningHandLabel}</p>
      ) : null}
      {sidePotCount > 1 ? (
        <p className="poker-hr-showdown__side">{sidePotCount} side pots</p>
      ) : null}
      {payoutSummary.length > 0 ? (
        <ul className="poker-hr-showdown__payouts" aria-label="Pot payouts">
          {payoutSummary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
