# Change Summary — Table invite login redirect fix

## Problem

Invite email link (`/api/tables/invites/accept?token=…`) previously auto-accepted and provisioned a session without requiring login. When the session cookie did not persist (origin mismatch, new browser, etc.), the user landed on the generic login/lobby and never reached the invited table. Magic-link verify always redirected to `/` with no invite resume.

## Root cause

1. Accept route consumed the invite and created a session before the user authenticated via magic link.
2. No server-side pending invite storage — only fragile client `sessionStorage` on `/join-table` paths.
3. `/api/auth/verify` had no pending-invite handling after session creation.

## Fix (invite/auth redirect only)

### Server

- **`server/src/auth/pendingInviteCookie.ts`** — `sxm_pending_invite_token` HttpOnly cookie (15 min, SameSite=Lax, Secure in production); `safeReturnTo` helper.
- **`server/src/tables/inviteAcceptHttp.ts`** — shared redirect helpers; atomic `Set-Cookie` arrays (clear pending + session together).
- **`GET /api/tables/invites/accept`** — authenticated matching email → accept + table redirect; otherwise → pending cookie + `/login?invitedEmail=…` (invite not consumed).
- **`GET /api/auth/verify`** — after session: pending cookie → accept invite → clear cookie → `/?table={id}`; else lobby (or validated `returnTo`).
- **`POST /api/auth/request-magic-link`** — optional same-origin `returnTo` preserved on verify URL.

### Client

- **`AppRoot.tsx`** — read `invitedEmail` / `inviteTableName` from login query after accept redirect.
- **`LoginScreen.tsx` / `client.ts`** — pass `returnTo` to magic-link request when present.

## Canonical flow

1. Click invite accept link.
2. If authenticated (email matches) → join table → redirect `/?table={id}`.
3. If not → pending cookie → login with invite context.
4. Magic-link verify → accept from cookie → redirect to table.
5. Invalid/expired → `/?inviteError=…`.

## Validation

```text
npx vitest run server/tests/inviteLoginRedirect.test.ts server/tests/inviteFlow.test.ts  → 15/15
npx vitest run server/tests/tableActions.test.ts -t "invite"                             → 8/9 invite HTTP tests pass*
npm run build                                                                          → success
```

\*Pre-existing service-level reuse test expects `/already used/` but engine returns “Invite expired or invalid.” for accepted invites — unchanged.

## Spec discipline

Updated `docs/SXM_MASTER_SPEC.md` (Table invites online) and `docs/CHANGE_LOG.md`.
