# Magic 8 Ball content repository

Magic 8 Ball wisdom lives in JSON data files under `src/content/magic8/`.  
**Do not add or edit wisdom strings in React components or engine code** — update the JSON files only.

## Files

| File | Purpose |
|------|---------|
| `wisdom.global.json` | Universal wisdom shown on any screen (login, all games). |
| `wisdom.blackjack.json` | Blackjack-specific lines. |
| `wisdom.poker.json` | Poker-specific lines (Hold'em and future poker tables). |
| `wisdom.zilch.json` | Zilch / dice-table lines. |
| `wisdom.rare.json` | Surprising, uncommon lines (low pull rate). |

Each file is a **JSON array of strings**:

```json
[
  "Your new wisdom line here.",
  "Another line."
]
```

## Adding or editing wisdoms

1. Open the pool file that fits the message (see table above).
2. Add a new string to the array, or edit an existing string.
3. Keep entries short enough for the Dynamic Text area (roughly one sentence).
4. Save the file — no TypeScript or component changes are required.
5. Run `npm test` if you want to verify the loader still passes.

Tips:

- Prefer plain ASCII quotes in JSON, or escape double quotes inside strings (`\"`).
- Trailing commas are not allowed in JSON.
- Empty strings are ignored by the loader.

## How selection works

The loader API is `getMagic8Wisdom()` in `src/content/magic8/index.ts`:

```ts
getMagic8Wisdom({
  gameType,      // optional: 'blackjack' | 'poker' | 'zilch'
  includeRare, // default true
  previousAnswer // optional: avoids immediate repeat
})
```

On each shake, the loader:

1. Rolls weighted pool access: **70% global**, **25% game-specific**, **5% rare**.
2. Picks one random entry from the chosen pool.
3. Skips the immediately previous answer when another option exists in that pool.
4. Falls back to other pools if the chosen pool is empty.
5. Returns a single string (never an object).

When `gameType` is omitted (e.g. login), the 25% game-specific weight falls through to **global**.

## Game-specific wisdoms

Pass `gameType` from the table context:

- Blackjack table → `gameType: 'blackjack'`
- Poker table → `gameType: 'poker'` (when wired)
- Zilch table → `gameType: 'zilch'` (when wired)

Game files should feel native to that game (table slang, phase hints, in-jokes) without breaking engine rules or implying real-money outcomes.

## Rare wisdoms

`wisdom.rare.json` is the **5% surprise pool**. Entries should feel genuinely unexpected — odd, funny, or surreal — not routine table advice.

Rare lines can reference any game tone; they are not tagged per game. Keep the pool small and curated so repeats stay special.

Set `includeRare: false` only if a future surface needs to disable rare pulls (e.g. a restricted preview mode).

## Future admin-managed content

The JSON layout is intentionally simple for hand editing today. A future admin UI can:

- Read/write the same files or sync to equivalent records (`id`, `text`, `pool`, `enabled`, `weight`).
- Replace `listMagic8WisdomPools()` consumers for preview and validation.
- Keep `getMagic8Wisdom()` as the runtime API so components stay unchanged.

Until then, **developers edit JSON only** — no deploy-time code changes for new wisdom.
