# Multiplayer & invite roadmap

SXMCards is a **local friends-table app** today. Invites and join links are scaffolded for a future hosted mode — not live yet.

## Current MVP (Phase 26)

- Invite record stored in `GameState.tableMeta.invites` (device-local)
- Magic link generated on this device:
  `/join-table?tableId={sessionId}&inviteId={uuid}&token={opaque}`
- **mailto** and **copy link** only — no backend email delivery
- **No real online table sync** — each device has its own `GameState`
- `JoinTableCurtain` parses URL params and shows “join coming online next”

## Next architecture (requires backend)

1. **Table hosted behind a join curtain**
   - Host creates table → server assigns `tableId`
   - Invites include `email`, `inviteId`, `token`

2. **Magic link flow**
   - User opens link on their device
   - Join curtain: enter/display name, confirm email
   - Server validates token + invite status
   - Shared game state (WebSocket or poll) — **explicitly out of MVP scope until requested**

3. **Identifiers**
   - `tableId` — session/table instance
   - `inviteId` — invite record
   - `token` — opaque validation secret
   - `email` — invited person (honor system locally; verified server-side later)

## What we are not building in MVP

- Authentication / accounts
- Payments, wallets, deposits, cash-out
- Real-money processing
- Hold'em redesign

## Related docs

- [protocol-engine.md](./protocol-engine.md) — rule protocols & custom builder
- [qa-blackjack-checklist.md](./qa-blackjack-checklist.md) — manual smoke tests
