# Change Summary — Mobile chip taps + invite auth resume

## 1. Files changed

- **Chip placement:** `src/components/tapSelect.ts`, `src/components/chipTapPlacement.ts`, `src/components/BlackjackPanel.tsx`, `src/components/ChipStack.tsx`, `src/components/ChipStack.css`, `src/components/BlackjackTrayRow.tsx`, `src/styles/bj-table-shared.css`, `src/components/tableUxContract.ts`.
- **Invite auth:** `server/src/auth/pendingInviteCookie.ts`, `server/src/auth/inviteAuthLog.ts`, `server/src/auth/routes.ts`, `server/src/tables/inviteAcceptHttp.ts`, `server/src/tables/routes.ts`, `server/src/tables/service.ts`, `src/auth/inviteAuthResume.ts`, `src/AppRoot.tsx`, `src/screens/LoginScreen.tsx`.
- **Docs:** `docs/SXM_MASTER_SPEC.md`, `docs/CHANGE_LOG.md`.
- **Script:** `package.json` (`test:people-invite` now includes `inviteLoginRedirect.test.ts`).

## 2. Tests added / updated

- `src/components/tapSelect.test.ts` — one gesture = one fire; rapid second tap still fires; scroll slop ignored.
- `src/components/chipTapPlacement.test.ts` — armed denom, repeat box, other box, betting locked, no denom.
- `src/components/boxHitArea.test.ts` — hit-area min 44px / touch-action; children do not steal taps.
- `src/auth/inviteAuthResume.test.ts`, `src/AppRoot.inviteAuth.test.tsx`, `src/auth/loginScreen.test.tsx` — returnTo survives login/magic.
- `server/tests/inviteLoginRedirect.test.ts` — one auth cycle, matching member, wrong email, cookie-miss resume, accepted invite, absolute production callback.

## 3. Validation run

- **Ownership:** `npm run test:ownership` — run, 28 passed.
- **Layout target:** `npm run test:layout:target` — run, 53 passed.
- **Blackjack engine:** `npm run test:blackjack:engine` — run, 344 passed.
- **People / invites:** `npm run test:people-invite` — run, 46 passed.
- **Build:** `npm run build` — run, passed (pre-existing chunk-size warning only).
- **Extra targeted:** tapSelect, chipTapPlacement, inviteAuthResume, boxHitArea, boxSelection, repeatChipStacking, loginScreen, AppRoot render/invite — passed.
- **Full `npm test`:** skipped per `.cursorrules`.

## 4. Architecture impact

- No new Blackjack layout route or box redesign. Tray click still places on the current target (desktop). Box tap now also places when a denomination is armed.
- Invite destination now survives auth via `returnTo=/join-table?token=…` (plus the existing pending-invite cookie). AppRoot no longer auto-accepts while unauthenticated.
- Email match, disabled-person, and duplicate-account checks are unchanged.

## 5. Deploy readiness

- Targeted gates and build passed. Not committed.
- Manual smoke still needed on a phone: chip taps on labels/value/stake; invite link as logged-out matching email (one magic cycle to table); already-logged-in matching email; wrong email blocked.
