# Blackjack Intel — Source Notes

AID (Advice In Dealer) uses **structured knowledge** extracted from reference material — not raw PDF text or verbatim copyrighted passages.

## Sources

### Peytaví (six-deck focus)

Contributions to `src/engine/blackjack/aid/blackjackIntel.ts`:

- Six-deck basic strategy framing (hard, soft, pairs, doubles)
- Probability concepts for dealer up-cards and player totals
- Hi-Lo counting basics (running count, true count, ten-rich shoe)
- Insurance as a side bet with negative expectation at even money

### Wong (generic basic strategy & counting)

Contributions:

- Standard multi-deck basic strategy tables (hit/stand/double/split)
- Pair splitting rules (e.g. always split 8s, never split 10s)
- Double-down guidance (e.g. 11 vs most up-cards)
- Insurance decline under basic strategy; take only with strong count
- Dealer up-card strength (weak 2–6 vs strong 7–Ace)

## How AID uses this material

| Layer | Role |
|-------|------|
| `protocols/lasVegasProtocol.ts` | Single source of truth for rules, payouts, and allowed actions |
| `aid/blackjackIntel.ts` | Concise English fact summaries (hard/soft/pairs/doubles/insurance/Hi-Lo/warnings) |
| `aid/strategyLookup.ts` | Deterministic basic-strategy table lookup |
| `aid/aidReasoner.ts` | Combines hand state, protocol actions, strategy, and intel into structured advice |

AID does **not** call external LLM APIs. Reasoning is local and deterministic. A future phase may add optional LLM commentary over the same intel file.

## Extraction policy

- Facts are paraphrased into short summaries
- No long copied passages from copyrighted works
- Strategy numbers follow widely published basic strategy for S17, 3:2, DAS
- Warnings and fun lines are original app copy for tone, not source quotes

## Related files

- `src/engine/blackjack/protocols/types.ts` — variant-ready protocol model
- `src/engine/blackjack/protocols/lasVegasProtocol.ts` — active Las Vegas standard
- `docs/` — this note only; gameplay docs live in engine modules
