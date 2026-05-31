# Blackjack QA smoke checklist

Manual smoke test for local friends-table Blackjack after protocol/design/dealing changes. Run after engine tests (`npm run test`).

## Setup

- [ ] Start app (`npm run dev`)
- [ ] New table → stake panel appears
- [ ] Choose **rule protocol** (Las Vegas house / European Shoe / Classic Home)
- [ ] Confirm summary matches selected preset
- [ ] Choose **design template** in table settings (Premium Casino / Stitch Mobile / Classic Felt)
- [ ] Root theme class updates (`theme-*` on `<html>`)
- [ ] Assign chips / starting buy-in completes
- [ ] Claim one or more boxes (same person can claim multiple)

## Betting & deal

- [ ] Place bets on one box
- [ ] Same person bets on a second box — bankroll is shared
- [ ] Shuffle → deal with **natural** dealing mode (Settings)
- [ ] Cards appear one at a time with visible delay
- [ ] Deal order: boxes right-to-left, then bank, second pass
- [ ] Protocol locks after first deal (cannot change preset mid-round)

## Player phase

- [ ] Hit / Stay / Double / Split respect protocol (e.g. no insurance on European)
- [ ] AID shows protocol name in advice line
- [ ] Double gives one card then auto-stands
- [ ] Split creates two hands with matching bets

## Bank & payout

- [ ] Bank draw (auto or manual per settings)
- [ ] Payout settles to **person** bankroll, not per-box ledger
- [ ] Push returns stake; win adds winnings; loss keeps bet deducted
- [ ] Natural blackjack pays per protocol (3:2 vs 1:1)
- [ ] Insurance only when dealer Ace + Las Vegas protocol

## Round flow

- [ ] Next Round clears hands, opens betting, same shoe
- [ ] Save game → reload → state restores (protocol, stakes, bankrolls)
- [ ] Start New Game allows new protocol choice

## Invite & admin

- [ ] Invite modal creates magic link (`/join-table?tableId=...&inviteId=...&token=...`)
- [ ] Copy link and mailto work (no backend email)
- [ ] Admin panel toggles visible to owner
- [ ] Owner-only assign chips / protocol / design enforced when toggled on

## Debug (optional)

- [ ] Settings → **Show debug panel**
- [ ] Panel shows protocol, phase, active hand, eligible boxes, accounts, stakes

## Engine regression (automated)

```bash
npm run test
npm run build
npm run lint
```

All should pass before release.
