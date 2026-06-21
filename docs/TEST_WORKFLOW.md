# Test workflow guardrails

**Before architecture, layout, auth, invite, or game-flow changes:** read [`.cursorrules`](../.cursorrules) and [`docs/SXM_ARCHITECTURE.md`](./SXM_ARCHITECTURE.md).

Cursor agent sessions slow down when broad test commands hang or run for hours. Useful Vitest + build time for layout patches is on the order of **~90 seconds**; **shell waits** on piped or full-suite runs dominate wall-clock time.

Use the scripts below instead of ad-hoc `npm test` / `npx vitest run src` inside agent loops.

## Scripts

| Script | Purpose | Typical duration |
|--------|---------|------------------|
| `npm run test:ownership` | Production route + CSS cascade ownership smoke | ~2–5 s |
| `npm run test:layout:target` | Four core Full Table layout contract tests (52 cases) | ~10–25 s |
| `npm run test:blackjack:layout` | Extended blackjack layout + shell contract batch (175 cases) | ~20–40 s |
| `npm run test:blackjack:engine` | `src/engine/blackjack` unit tests | varies |
| `npm run test:people-invite` | People admin + invite flow server tests | ~10–30 s |
| `npm run check:patch` | Pre-commit: targeted layout tests + production build | ~60–90 s |
| `npm run check:deploy` | Pre-deploy: **full** `npm test` + build (run manually, not in agent loop) | minutes |

## When to run what

### During a patch (Cursor / local iteration)

Run **only tests for the area you touched**:

| Area | Command |
|------|---------|
| Route / CSS ownership | `npm run test:ownership` |
| Full Table layout / CSS contracts | `npm run test:layout:target` |
| Broader blackjack layout regressions | `npm run test:blackjack:layout` |
| Blackjack engine / round flow | `npm run test:blackjack:engine` |
| People / invite / auth server | `npm run test:people-invite` |
| Quick layout ownership smoke | `npm run test:layout:fast` (existing) |

Do **not** run full `npm test` or `npx vitest run src` inside a Cursor agent loop.

### Before commit

```bash
npm run check:patch
```

Runs `test:layout:target` + `npm run build`. Expand to `test:blackjack:layout` or area-specific scripts if your diff touches those files.

### Change Summary validation (required every Cursor task)

Every task must end with an updated **`ChangeSummary.md`** reporting: files changed, tests added/updated, validation run (each tier executed or skipped with reason), architecture impact, deploy readiness.

| Tier | Command | Run when |
|------|---------|----------|
| Ownership | `npm run test:ownership` | layout, routing, imports, CSS ownership, auth, people, invites, table flow, game over, render path |
| Layout | `npm run test:layout:target` | Full Table layout / CSS contracts |
| Blackjack layout | `npm run test:blackjack:layout` | Broader blackjack layout batch touched |
| People / invites | `npm run test:people-invite` | people / invite / auth server |
| Build | `npm run build` | substantive code changes |

Do **not** mark a task complete without listing which commands ran.

### Before deploy (manual, outside agent loop)

```bash
npm run check:deploy
```

Equivalent to `npm test && npm run build`. Run locally or in CI — not during iterative agent sessions.

## Shell rules (Windows / PowerShell)

1. **Do not pipe** `npm test` through `Select-Object -Last N`. Piping buffers stdout until the process exits; hung Vitest runs appear to “hang forever” and block the shell.
2. **Do not** run `npx vitest run src` as a default validation step — it pulls in slow/render-heavy suites and duplicate work.
3. If a test command shows **no new output for ~2 minutes**, stop waiting:
   ```powershell
   .\scripts\kill-node.ps1
   ```
   Then re-run a **targeted** script from the table above.
4. Prefer explicit file paths (as in `test:layout:target`) over unbounded directory globs in agent sessions.

## Stale Node processes

`scripts/kill-node.ps1` runs `taskkill /F /IM node.exe`. This stops **all** Node processes on the machine (dev server, Vitest, Prisma, etc.). Use only when tests are stuck — then restart `npm run dev` if needed.

## Full suite

`npm test` remains the canonical full suite. Reserve it for pre-deploy (`check:deploy`) and CI — not for layout patch iteration.
