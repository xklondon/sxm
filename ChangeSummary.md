# Change Summary — people.test.ts timeout fix

## Root cause

`requestMagicLink` was **not** hanging on email or SMTP. The mailer mock was already working (dev `devLink` logged, no network send).

The timeouts came from **test harness overhead**:
- `afterEach` called `vi.resetModules()` after every test
- `setupServices()` called `vi.resetModules()` again + 4 sequential dynamic imports before each test
- First test in the file paid ~12–15s cold module load; under full-suite CPU contention this exceeded the 15s default timeout

## Fix

`server/tests/people.test.ts` only:
- Removed `vi.resetModules()` from `afterEach`
- Added `loadServiceModules()` cache — reset/re-import only when env key changes (`rootEmail|inviteOnly|nodeEnv`)
- Parallel `Promise.all` for the four service imports on cold load
- `beforeAll` sets default dev env once
- Mailer mock unchanged; production email path untouched

## Result

```
npx vitest run server/tests/people.test.ts --reporter=verbose
→ 13/13 passed in ~9.4s (first magic-link test ~6.2s, second ~41ms)
```

## Product code

No changes.

**Spec discipline:** test-infra only — SXM_MASTER_SPEC.md / CHANGE_LOG.md not updated.
