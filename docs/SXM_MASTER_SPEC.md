# SXM Master Specification

**Single source of truth for SXMCards / SXM Casino.**

This document describes the **current working implementation** in the repository. Historical specs, phased plans, and abandoned designs are archived under `docs/archive/`.

**Last verified:** 2026-06-10

---

## 1. Product Overview

SXM Casino (SXMCards) is a casual card-and-dice table app for friends. Players use **virtual chips only** — not real-money gambling.

| Mode | Flag | Behavior |
|------|------|----------|
| **Online** | `VITE_ONLINE_MODE=true` (production default) | Magic-link auth, hosted tables, WebSocket sync, Postgres for identity |
| **Offline** | `VITE_ONLINE_MODE=false` | Single-browser local play; state in React + localStorage |

**Game categories**

| Category | Games | Creation UX | Online multiplayer |
|----------|-------|-------------|-------------------|
| **Cards** | Blackjack (default), Texas Hold'em | Blackjack via `TableStakePanel` Cards tab | Blackjack ✅ · Hold'em ❌ |
| **Dice** | Zilch | `TableStakePanel` Dice tab | Zilch ✅ |

**Hard prohibitions:** No payments, wallets, deposits, cash-out, or real-money language.

**Vocabulary:** chips, ledger, table balance, friends, buy-in, settlement, round.

---

## 2. Authentication

### Magic link flow

1. User submits email → `POST /api/auth/request-magic-link`
2. Server validates eligibility (`canRequestMagicLink`), rate-limits resend, stores token (15 min TTL)
3. Email sent in production; dev returns `devLink` in API response
4. User opens `GET /api/auth/verify?token=…&remember=0|1` → session cookie set → redirect `/` or `/?newTable=1`

**Key files:** `server/src/auth/service.ts`, `server/src/auth/routes.ts`, `server/src/auth/tokens.ts`

### Session

- HMAC-SHA256 signed cookie (`sxmcards_session`, configurable)
- Bearer header also accepted
- `GET /api/auth/me` returns user + permissions from Person record
- `POST /api/auth/logout` clears cookie

### Eligibility (`INVITE_ONLY_MODE`, default `true`)

| Who | Can request magic link |
|-----|------------------------|
| `ROOT_USER_EMAIL` | Always |
| Person with `canLogin` + status `active` or `invited` | Yes |
| Unknown email when `INVITE_ONLY_MODE=false` | Yes |
| Everyone else | No |

### Client boot

`AppRoot.tsx` fetches `/api/auth/me` when online. Unauthenticated users on protected routes → `/login`.

---

## 3. People & Invitations

### People directory (Postgres)

- **API:** `GET/POST/PATCH /api/people`, `POST …/send-invite`
- **UI:** `PeopleScreen` (root/admin only)
- **Fields:** `status` (`invited` | `active` | `disabled`), `role`, `canLogin`, `canOwnTables`, `canPlay`, `canInvite`
- Creating a person triggers a magic-link invite automatically

**Key files:** `server/src/people/service.ts`, `src/screens/PeopleScreen.tsx`

### Table invites (online)

- Server: `TableService.createInvite`, `invitePersonByEmail`, `acceptInviteByToken`
- Persisted: `TableInvite` in Postgres
- Accept: `GET /api/tables/invites/accept?token=…` → session + redirect `/?table={id}`
- Client deep link: `/join-table?…` → `JoinTableCurtain`

### Table invites (offline)

- `createTableInvite()` stores invites in `tableMeta.invites` (device-local)
- Magic link format: `/join-table?tableId={sessionId}&inviteId={uuid}&token={opaque}`

### Join requests (“Knock”)

- Non-members request access: `POST /api/tables/:id/request-access`
- Host approve/deny: API exists; **no host UI yet**
- Client: `ActiveTablesList` shows Join / Knock / Pending

---

## 4. Table Lifecycle

### Online (server-authoritative)

| Event | Implementation |
|-------|----------------|
| **Create** | `POST /api/tables` → bare blackjack `GameState`, host member, bot bank |
| **Configure** | `configureTable` action applies stake setup |
| **Play** | `POST /api/tables/:id/actions` → version check → engine → `table:update` broadcast |
| **Join** | Invite token or `POST /api/tables/join` → seat + box assignment |
| **Load** | `GET /api/tables/:id` (member only); URL `?table=` boot |
| **Leave** | Client clears active table id; optional local save — **no server `leaveTable` applied** |
| **Reset** | `resetTable` action → `applyTableResetSetup` |

Active table `GameState` lives **in-memory per server process** even when Postgres is configured. Server restart loses in-flight tables; people/auth survive in Postgres.

### Offline (local)

- State mutated via `onGameStateChange` in React
- Save/load: `src/storage/gameStorage.ts`
- Reset: `TableStakePanel` mode `reset` + `applyTableResetSetup`

### Intentional behavior

**Last table is not auto-opened on reload.** User must explicitly Load or Join.

---

## 5. New Table Flow

**Primary UX (online):** `EntryLobbyScreen` → slide-out → `TableStakePanel` mode `new`.

**Alternate paths:**

| Path | Trigger | Shell |
|------|---------|-------|
| Lobby | “Open New Table” | `EntryLobbySlideOut` + `TableStakePanel` |
| Offline start | `StartScreen` “New Game” | Felt overlay (`showStakeSetup: true`) |
| In-table nav | Menu “Start New Table” | Felt overlay |
| Online nav (not on table) | Menu “Start New Table” | `handleNewOnlineGame()` → bare table + setup overlay |

### Staged flow (`TableStakePanel`, mode `new`)

**Cards — Blackjack (3 stages)**

1. **Game:** Cards vs Dice tabs; protocol picker on Cards tab → **Continue**
2. **Mode:** Practice vs Challenge (tap advances) → **configure**
3. **Configure:**
   - **Practice:** table name, starting chips, advanced deal settings → **Start Table**
   - **Challenge:** table name, wager, invite emails, chips, bank selection → **Start Table**

**Dice — Zilch (2 stages)**

1. **Game:** Dice tab selected → **Continue**
2. **Configure:** game mode (target points / fixed rounds), dice animation → **Start Table**

### Online confirm

- Lobby: `onConfirmNewTable` → `createOnlineTable` + `configureTable` + optional challenge email invites
- In-table: `onlineDispatch('configureTable', payload)`

### Not in creation flow

- Texas Hold'em (engine exists; no `TableStakePanel` option)
- `GameSetupScreen` (dead route — `screen === 'setup'` never set)

### Reset / New Game

`TableStakePanel` mode `reset` with variants `newGame` | `resetTable` — two-column desktop grid, full stake/bank/protocol controls. Opened from `BlackjackPanel` ended-game flow or Table Details reset.

---

## 6. Join Table Flow

**Online lobby:** “Join a Table” → `ActiveTablesList`

| Access | Action |
|--------|--------|
| `open` / `join` | **Join** → `onOpenTable(tableId)` |
| `request` | **Knock** → `requestTableAccess` |
| `pending` | **Pending** (disabled) |

**Invite link:** `/join-table?…` → `JoinTableCurtain` → validate → join table.

**Offline:** Join curtain parses URL; no cross-device sync.

---

## 7. Load Table Flow

**Online lobby:** “Load a Table” → `LoadTableList`

| Source | Description |
|--------|-------------|
| `stored-online` | Last `localStorage` table id (explicit **ReOpen**) |
| `online` | Member tables with `access === 'open'` from `fetchMyTables` |
| `local` | Archived saves from `listSavedGames()` |

Row click expands details; **ReOpen** button required (no load-on-click).

**Offline:** `StartScreen` “Load Previous Game” is **disabled** (stub). Use lobby Load when online; offline uses saved games list in engine storage when wired.

**Nav “Load Table”:** If on table screen, loads local save; if online with active id, refetches server state.

---

## 8. Blackjack Protocol

### Architecture

| Layer | Role |
|-------|------|
| **Engine** | `src/engine/blackjack/` — deterministic, no React |
| **Protocol** | Declarative preset via `GameState.blackjackProtocolId` |
| **Canonical reducer** | `applyBlackjackActionToState` — used online and offline |
| **UI** | `BlackjackPanel` — Full Table + Card View |

### Built-in presets

| ID | Name | Notes |
|----|------|-------|
| `las-vegas-house` | Las Vegas Protocol | Default; 6 decks, S17, 3:2, insurance, double any two |
| `european-shoe` | European Shoe | 6 decks, no insurance, hole card at bank turn |
| `classic-home` | Classic Home Table | 2 decks, even-money naturals |

**Rule adapter:** `src/engine/blackjack/protocols/activeRules.ts` — single source for double/split/insurance/dealer draw/bet validation.

### Phases

Protocol-driven phases via `getBlackjackProtocolPhase`. Betting → deal → player turns → insurance/even-money (when offered) → bank draw → settlement → next round.

### Online actions (blackjack)

`shuffleToStart`, `dealCards`, `hit`, `stand`, `double`, `split`, `takeInsurance`, `declineInsurance`, `takeEvenMoney`, `waitFor3to2`, `nextRound`, plus table ops (`placeBet`, `assignBox`, etc.)

Server resolves `activeHandKey`; client-sent `handKey` on hit/stand/double/split is **ignored** online.

---

## 9. Texas Hold'em Protocol

### Status: offline engine + UI only

| Component | Status |
|-----------|--------|
| Engine | `src/engine/holdem/` — betting, streets, hand evaluation |
| UI | `HoldemPanel` in `TableScreen` when `isHoldemTable` |
| Creation | Only via saved state with `gameType: 'texas-holdem'` |
| Online | **No holdem actions** in `TABLE_ACTIONS` or `authority.ts` |
| `TableStakePanel` | **Not offered** |

Hold'em has its own Full/Card view toggle in `TableScreen` (separate from blackjack view contract).

---

## 10. Zilch Protocol

### Status: fully implemented (online + offline)

| Component | Path |
|-----------|------|
| Engine | `src/engine/zilch/` — `zilchEngine`, `zilchScoring`, `applyZilchAction` |
| Setup | `zilchTableSetup.ts`, `createNewZilchTable()` |
| UI | `ZilchPanel` + `useZilchTableFlow` |
| Mobile | Optional shake-to-roll (`useDeviceShake`, 3+ seconds) |

### Game modes

- **Target points:** first to N points wins
- **Fixed rounds:** most points after N rounds per player

### Online actions

`zilchStartGame`, `zilchRandomiseStarter`, `zilchConfirmStarter`, `zilchRollDice`, `zilchCompleteRoll`, `zilchKeepCombination`, `zilchBankTurn`, `zilchQuitTurn`

### Authority

Host for start/randomise/confirm starter; current turn player for gameplay actions.

---

## 11. Ledger System

### Table ledger (in-session)

- **Source of truth** for chip balances during play
- Append-only entries on `GameState.ledger`
- `deriveAllBalancesFromLedger` for display
- Canonical allocation: `allocateChipsToBankrollOwner` in `src/engine/session/allocation.ts`

**Entry types:** `bet-placed`, `win-paid`, `push-refund`, `loss-collected`, `bank-transfer`, buy-in/adjustment reasons, etc.

### Personal score ledger (challenge games)

- Tracks wager outcomes across ended challenge tables
- Stored in **localStorage** (`scoreLedgerStorage.ts`)
- Added via `addGameToPersonalLedger` action when `gameStatus === 'ended'` and challenge mode
- UI: `ScoreLedgerModal` in app menu

### Table modes

| Mode | Bank | Wager |
|------|------|-------|
| **Practice** | Dealer bot | None (stake description: "Practice") |
| **Challenge** | Self, invited player, or dealer | Required stake description + invites (online) |

---

## 12. User Roles

### Person roles (`PersonRole`)

`root`, `admin`, `host`, `player`, `guest`

### Default permission matrix

| Role | canLogin | canOwnTables | canPlay | canInvite |
|------|----------|--------------|---------|-----------|
| root / admin / host | ✓ | ✓ | ✓ | ✓ |
| player | ✓ | ✗ | ✓ | ✗ |
| guest | ✓ | ✗ | ✗ | ✗ |

### Special cases

- `ROOT_USER_EMAIL` → full powers even before Person row exists
- **People admin:** root email OR person role `root`/`admin`
- **Table creation:** server `assertCanOwnTables` + UI disables when `!canOwnTables` online
- **Offline:** `canOwnTables` defaults true when not online

### Table-level admin (`AdminPanel`)

Blackjack tables only. Owner toggles (mostly UI-enforced locally):

- Invited players can invite others
- Invited players can start tables
- Owner only — assign chips
- Owner only — change protocol
- Owner only — change design

`assignChips` is enforced server-side via `canUserAssignChips`; other toggles are primarily client-side.

---

## 13. Mobile UX Rules

**Device boundary:** `MOBILE_MAX_WIDTH = 720` (`src/styles/mobileLayoutContract.ts`, `useIsMobileViewport.ts`). JS and CSS must agree.

### Blackjack view contract

Scoped under view root classes (`tableViewContract.ts`):

- `bj-view-full-desktop`, `bj-view-card-desktop`, `bj-view-full-mobile`, `bj-view-card-mobile`

**View mode is client-local** — never sourced from server `gameState` (socket updates must not flip Card View back to Full Table).

### Mobile invariants

- Same canonical components as desktop (`BlackjackPanel`, `BlackjackCardView`, shared selectors)
- Only CSS/layout wrappers differ — no mobile-only gameplay branches
- Mobile Full Table = compressed felt; This Table stacked below felt
- Mobile Card View = stitched cards, ordered boxes, horizontal This Table bar
- “Use Card View” fallback only below `ULTRA_NARROW_MAX_WIDTH` (< 360px)
- No horizontal page scroll on table views

### Modals / setup (mobile)

`src/styles/mobile-modals.css` — bottom-aligned overlays at ≤720px with scrollable bodies and safe-area padding.

### Zilch mobile

Shake-to-roll optional. Primary action label: **Dice** (roll).

### Blackjack presentation (Full Table + Card View)

**Player box stability:** Slot-row boxes reserve fixed stake (`--bj-full-table-stake-min-height`) and composition height so adding chips/tokens does not reflow box width or row height.

**Active turn highlight:** Shared class `bj-box--turn` on the active player box in both Full Table and Card View (subtle `bj-turn-pulse` animation). Betting selection uses `bj-box--selected` + `bj-phone-view__bet-chip--pulse` only.

**Card View layout:**

- Hero card size uses responsive `clamp()` tokens (`--bj-card-hero-card-width`, `--bj-card-hero-card-max-height`) on mobile and desktop.
- Hand total appears **above** hero cards (`bj-phone-view__hand-meta--above-cards`) and on each player box tile.
- Mobile Card View shows vertical **Stay** / **Hit me** side indicators beside the hero (`bj-phone-view__side-action`).
- Clean natural blackjack shows **Blackjack** label with `bj-hero-blackjack-pulse` — not used for even-money (1:1) offers.

**Card View bust delay:** When a hand busts, hero stays on that box for `CARD_VIEW_BUST_HOLD_MS` (2000ms) via `useCardViewBustHold` before following the next active box. Game state/protocol advance immediately; only presentation is held.

**Dealer info layout (all views):**

- **Bank Total** (chip balance) stays in the felt info row (`TableInfoBar` variant `felt`).
- **Bank Hand** (visible dealer hand value) renders under dealer cards (`TableInfoBar` variant `dealer`) — never inline beside Bank Total.

**Command text (canonical player turn):**

```
Box [n], [name], your turn.
Bank has [up-card or total] against your [score].
Options: Hit, Stay, Double one card, Split.  (valid options only)
```

- Use **Stay** in command copy (action buttons may still say Stand where protocol-named).
- No sentimental/random phrasing.
- Natural blackjack: `Box [n], Blackjack.` only for `actionStatus === 'blackjack'`.

---

## 14. Desktop UX Rules

- Desktop Full Table is the layout reference — Card View CSS must not affect it
- Desktop Card View: ordered box row in betting; active hero in play
- Entry lobby: `EntryLobbySlideOut` renders as right drawer (≥721px)
- Table stake overlay: centered modal on felt (when not inside lobby drawer)
- Debug attributes on table root: `data-view-mode`, `data-device-view`, `data-phase`

---

## 15. Shared Layout Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Screens (React) — EntryLobby, TableScreen, People      │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Components — BlackjackPanel, ZilchPanel, TableStake    │
└──────────────────────────┬──────────────────────────────┘
                           │ dispatches actions (online) or mutates (offline)
┌──────────────────────────▼──────────────────────────────┐
│  Pure engine (TypeScript) — blackjack, zilch, holdem    │
└──────────────────────────┬──────────────────────────────┘
                           │ online only
┌──────────────────────────▼──────────────────────────────┐
│  Server — authority.ts → applyTableAction → store       │
└─────────────────────────────────────────────────────────┘
```

### Blackjack shell zones (canonical)

`BlackjackTableLayoutShell`: dealer → command → cards → actions → player boxes → chip tray.

**CSS sources:** `bj-table-shared.css` (shell), `bj-card-layout.css` (cards inner), `BlackjackPanel.css` (chrome), `BlackjackCardView.css` (card view), `DealerBlock.css`, `ChipStack.css`, `bj-felt-skins.css`.

### Game routing (`TableScreen`)

- `isBlackjackTable` → `BlackjackPanel`
- `isZilchTable` → `ZilchPanel`
- `isHoldemTable` → `HoldemPanel`
- `TableStakePanel` overlay when `showStakeSetup || resetSetupOpen`

---

## 16. State Management

### Offline

- React state in `App.tsx` → `onGameStateChange`
- No socket; no version checks
- Local effects: auto-stand, bank draw animation, natural deal pacing, next round

### Online

- **Mutations only via** `POST /api/tables/:id/actions` when `onlineDispatch` present
- **No local gameplay mutation** when online (panels early-return local effects)
- Socket.IO: `table:subscribe` → `table:update`; fallback poll 15s
- Optimistic concurrency on `version`; stale → refetch + retry message
- Viewer identity: `memberPersonId` from bootstrap + profile viewer map

### Action eligibility (blackjack UI)

Shared selectors only — no per-view independent logic:

- `getActionableHandForView`
- `getBlackjackRoundPhase`
- `allowsBettingActions` (`blackjackViewPhase.ts`)

### Online/offline parity

Same engine functions must produce identical final game state. Allowed differences: transport, animation pacing only.

`resolveBankAuto: true` on server resolves bank + settlement in one action; offline animates bank draw client-side to the same end state.

---

## 17. Persistence

| Data | Store |
|------|-------|
| Users, People, MagicLinks, TableInvites, AuditLog | Postgres (when `DATABASE_URL` set) |
| Active table GameState, members, join requests | In-memory per process |
| No `DATABASE_URL` | Full memory store (dev/test) |
| Online table id hint | `localStorage` — not auto-resumed |
| Offline saved games | `localStorage` |
| Profile, settings, score ledger, view prefs | `localStorage` |
| Pending join params | `sessionStorage` |

---

## 18. Email & Magic Links

### Providers

Auto-select Resend vs SMTP from env. Production requires configured email.

### Email types

| Type | Behavior |
|------|----------|
| Magic link (login) | Production: sent; Dev: logged + `devLink` in response |
| Table invite | Attempted when configured; fails if email not configured |
| People invite | Triggered on `POST /api/people` create |

### URL origin

All links use `getEffectivePublicOrigin()` / `PUBLIC_ORIGIN`. In dev, `DEV_PUBLIC_ORIGIN=auto` detects LAN IP. **No localhost in links sent to phones.**

Aligned env keys: `PUBLIC_ORIGIN`, `CORS_ORIGIN`, `VITE_API_URL`, `VITE_TABLE_HOST`.

---

## 19. Multiplayer Rules

Enforced in `server/src/tables/authority.ts` before `applyTableAction`:

| Rule | Detail |
|------|--------|
| Betting | Phase `betting`, not locked; any seated member may place chips |
| Player turns | Box owner for active `activeHandKey` only |
| Host-only | shuffle, deal, nextRound, configureTable, resetTable, zilch host actions |
| Insurance | Box caller for specific hand |
| Zilch | `currentPlayerId === ctx.personId` |
| assignChips | `canUserAssignChips` (table admin + owner rules) |
| Personal ledger | Game ended, not already added |

**Not implemented:** Hold'em authority (no actions exist).

---

## 20. Open Items

Tracked future work — **not yet implemented:**

| Item | Notes |
|------|-------|
| **Admin game activation** | Global toggle to enable/disable games (e.g. Zilch on/off). Today Zilch is always in `TableStakePanel` Dice tab; Hold'em is effectively off (no creation path). Target: People/root admin or deployment config. |
| **Join request host UI** | Approve/deny API exists; no host-facing UI |
| **Texas Hold'em online** | Engine offline-only; needs `TABLE_ACTIONS`, authority, creation UX |
| **`leaveTable` server action** | Listed in `TABLE_ACTIONS` but not applied in `applyAction.ts` |
| **Table admin toggles online** | Most `AdminPanel` settings UI-only; only `assignChips` fully server-enforced |
| **`GameSetupScreen`** | Dead route — remove or repurpose |
| **`StartScreen` stubs** | Load Previous Game / Settings disabled |
| **`TableStakePanel.css` import** | Stylesheet exists but is not imported in component — panel relies on global + mobile-modals rules |

### Documentation process

Every significant feature change must update:

1. **`docs/SXM_MASTER_SPEC.md`** (this file)
2. **`docs/CHANGE_LOG.md`**

before the work is considered complete. See `.cursorrules`.

---

## Quick reference — key files

| Area | Path |
|------|------|
| Client app shell | `src/App.tsx`, `src/AppRoot.tsx` |
| Lobby | `src/screens/EntryLobbyScreen.tsx` |
| Table setup | `src/components/TableStakePanel.tsx` |
| Table play | `src/screens/TableScreen.tsx` |
| BJ engine | `src/engine/blackjack/applyBlackjackAction.ts` |
| Zilch engine | `src/engine/zilch/` |
| Hold'em engine | `src/engine/holdem/` |
| Server actions | `server/src/tables/applyAction.ts`, `authority.ts` |
| Auth | `server/src/auth/` |
| People | `server/src/people/` |
| Store | `server/src/store/` |

## Related operational docs (not competing specs)

| Doc | Purpose |
|-----|---------|
| `README.md` | Quick start |
| `DEPLOYMENT.md` | AWS production layout |
| `RAILWAY_DEPLOY.md` | Railway deploy |
| `docs/qa-blackjack-checklist.md` | Manual QA smoke tests |
| `docs/magic8-content.md` | Magic 8 Ball content authoring |
| `.cursorrules` | Engineering guardrails |

Historical and superseded documents: `docs/archive/`
