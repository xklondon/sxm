# Card Dealer App — Scope Document / Spec 1.0

## 1. Product Concept

The Card Dealer App is a lightweight, fun, front-end-first card game platform for quick social games. The first supported games are:

1. Blackjack
2. Texas Hold’em

The app is not intended to be a real-money gambling platform, casino system, or sophisticated backend product. It is a casual table manager that lets a host create a game, add real or virtual players, shuffle and deal cards, manage bets, and keep a simple per-game ledger.

The core idea is:

> Every game is built around a simple ledger. The cards, bets, bank, wins, losses, and settlements all update that ledger.

The app should feel visual and playful: dragging chips, animated card dealing, flexible dealing modes, quick game setup, and easy use on desktop and mobile.

---

## 2. Primary Goals

### 2.1 MVP Goals

* Create a table/game session.
* Add real players manually.
* Add virtual players/bots.
* Choose a game type: Blackjack or Texas Hold’em.
* Assign one player as the bank/dealer/host, depending on game rules.
* Shuffle a virtual deck.
* Deal cards with animations.
* Allow players to bet using chip drag-and-drop and/or number input.
* Track all betting movements in a ledger.
* Resolve each round according to the selected game rules.
* Show each player’s current balance.
* Allow quick restart/new round.

### 2.2 Non-Goals for Spec 1.0

The first version should not include:

* Real-money betting.
* Payment processing.
* Complex user accounts.
* Sophisticated backend persistence.
* Anti-cheat systems.
* Multiplayer networking across different devices.
* Regulatory gambling functionality.
* Advanced AI gameplay agents.
* Production-grade authentication.

---

## 3. Target Users

### 3.1 Host

The host starts a game, adds players, chooses the game type, selects the bank/dealer, and controls game flow.

### 3.2 Real Player

A real player is a person sitting at the table or sharing the screen. They can be added by name and given a starting balance.

### 3.3 Virtual Player

A virtual player is a simple bot/player placeholder. In Spec 1.0, virtual players do not need advanced AI. They can use basic predefined behavior, such as:

* Conservative
* Normal
* Aggressive
* Random

---

## 4. Platform Approach

### 4.1 Front-End First

The app should be implemented as a front-end-first web app, ideally using:

* HTML/CSS/JavaScript for a very simple version, or
* React / Next.js for a more scalable version.

The interface should work on:

* Desktop browsers
* Android mobile browsers
* iOS Safari

### 4.2 AJAX / Dynamic Interface

The app should feel like a single-page app:

* No full-page reloads during play.
* Game state updates dynamically.
* Cards, bets, ledger, and balances update instantly.

### 4.3 Backend Philosophy

Spec 1.0 should avoid a heavy backend. Recommended options:

1. Local-only mode using browser storage.
2. Optional export/import of game state as JSON.
3. Optional lightweight backend later if multiplayer or saved accounts are needed.

For Spec 1.0, browser-local storage is enough.

---

## 5. Core Data Model

### 5.1 Game Session

Each game session contains:

* Game ID
* Game type: Blackjack or Texas Hold’em
* Created date/time
* Players
* Deck state
* Current round
* Bank/dealer player
* Ledger
* Game status: setup, active, round complete, finished

### 5.2 Player

Each player contains:

* Player ID
* Display name
* Player type: real or virtual
* Starting balance
* Current balance
* Current bet
* Current hand/cards
* Status: active, folded, busted, stood, all-in, out

### 5.3 Deck

The deck contains:

* Standard 52-card deck
* Optional future support for jokers/wildcards
* Shuffled order
* Dealt cards
* Remaining cards

### 5.4 Ledger

The ledger is the foundation of the app.

Each ledger entry contains:

* Entry ID
* Timestamp
* Round number
* Player ID
* Entry type
* Amount
* Balance before
* Balance after
* Description

Example entry types:

* Buy-in
* Bet placed
* Bet increased
* Win paid
* Loss collected
* Push/refund
* Side pot contribution
* Manual adjustment
* Bank transfer

---

## 6. Ledger Principle

The ledger should be treated as the source of truth for balances.

Balances can be displayed on the player cards, but they should be derived from ledger entries or reconciled against the ledger.

This prevents confusion such as:

* “Who won that hand?”
* “How much did the bank pay?”
* “Who owes the table?”
* “What happened in the last round?”

The app should include a simple Ledger View showing:

* Round
* Player
* Action
* Amount
* Balance change
* Current balance

---

## 7. Game 1 — Blackjack Scope

### 7.1 Blackjack Setup

* Select Blackjack.
* Add players.
* Choose the bank/dealer.
* Set starting balance per player.
* Set minimum and maximum bet.
* Shuffle deck.

### 7.2 Blackjack Round Flow

1. Players place bets.
2. Dealer deals two cards to each player.
3. Dealer receives cards according to selected rules.
4. Players choose actions:

   * Hit
   * Stand
   * Double down
   * Split, optional for later version
5. Dealer plays according to house rule.
6. App resolves outcome.
7. Ledger updates balances.
8. Round summary is shown.

### 7.3 Blackjack Rule Defaults

Default rules for Spec 1.0:

* Blackjack pays 3:2.
* Dealer stands on 17.
* Dealer hits below 17.
* Double down allowed.
* Split can be deferred to Spec 1.1.
* Insurance can be deferred.

---

## 8. Game 2 — Texas Hold’em Scope

### 8.1 Texas Hold’em Setup

* Select Texas Hold’em.
* Add players.
* Choose dealer button.
* Set small blind and big blind.
* Set starting stack per player.
* Shuffle deck.

### 8.2 Texas Hold’em Round Flow

1. Assign dealer button.
2. Post small blind and big blind.
3. Deal two hole cards to each player.
4. Pre-flop betting round.
5. Deal flop.
6. Flop betting round.
7. Deal turn.
8. Turn betting round.
9. Deal river.
10. River betting round.
11. Showdown.
12. Determine winner.
13. Update ledger and balances.
14. Move dealer button.

### 8.3 Poker Actions

Players can:

* Check
* Bet
* Call
* Raise
* Fold
* All-in, optional for later version

### 8.4 Hand Evaluation

For Spec 1.0, the app should include deterministic hand evaluation logic for standard Texas Hold’em.

Winning hands:

1. Royal flush
2. Straight flush
3. Four of a kind
4. Full house
5. Flush
6. Straight
7. Three of a kind
8. Two pair
9. One pair
10. High card

---

## 9. Betting UX

The betting interface should support two modes:

### 9.1 Drag Coins / Chips

Players can drag chips into the betting area.

Chip examples:

* 1
* 5
* 10
* 25
* 50
* 100

Dragging a chip visually adds it to the player’s bet.

### 9.2 Number Input

Players can also type an amount directly.

This is important for mobile, accessibility, and speed.

### 9.3 Confirm Bet

A bet is not final until confirmed.

Buttons:

* Add bet
* Clear bet
* Confirm bet

---

## 10. Card Dealing UX and Animation

The app should support multiple dealing styles.

### 10.1 Animation Modes

1. Classic slide from deck to player.
2. Flip animation.
3. Fast deal.
4. Slow cinematic deal.
5. Mix mode: randomize between supported animations.

### 10.2 User Control

The host can choose:

* Animation mode
* Animation speed
* Sound on/off, optional

### 10.3 Mobile Considerations

Animations must be lightweight and should not make the game feel slow on mobile.

A reduced-motion option should be available later.

---

## 11. AI Role

### 11.1 Important Decision

The actual game rules should not be controlled by live AI during gameplay in Spec 1.0.

Reason:

* Card games require deterministic, auditable rules.
* AI output may be inconsistent.
* AI calls add cost and latency.
* AI could produce invalid rule decisions.
* For quick games, local rule logic is better.

### 11.2 Recommended AI Use

AI should be integrated as an assistant layer, not as the core game engine.

Good AI use cases:

* Generate a rulebook for a custom poker variation.
* Explain game rules in simple language.
* Suggest new game variations.
* Create names and descriptions for game modes.
* Convert a human rule description into a structured draft.
* Help the host resolve disputes by explaining rules.
* Generate fun table commentary.
* Generate bot personalities.

### 11.3 Rule Engine vs AI Assistant

The core engine should remain deterministic.

Recommended architecture:

* Static deterministic rule engine for active games.
* AI assistant for drafting, explaining, or proposing new variants.
* Human host approves any new variant before it is added.

---

## 12. Custom Game / Variant System

The long-term vision is to allow new card games or poker variants to be added.

### 12.1 Spec 1.0

Spec 1.0 should only support Blackjack and Texas Hold’em as playable games.

### 12.2 Spec 1.1 / Later

Later versions can include a “Create New Game Variant” feature.

Flow:

1. Host describes a game variation.
2. AI generates a draft rulebook.
3. AI outputs structured rule settings.
4. Host reviews and edits.
5. The app saves the variation.
6. The variation becomes selectable as a new game.

### 12.3 Safety Constraint

AI-generated variants should not execute arbitrary code.

Instead, they should map to a controlled rule schema, for example:

* Number of cards per player
* Betting rounds
* Community cards yes/no
* Wildcards yes/no
* Hand ranking system
* Dealer/bank role
* Win resolution method

---

## 13. Suggested Technical Architecture

### 13.1 Front End

Recommended stack:

* React or Next.js
* CSS animations or Framer Motion
* Local browser state
* LocalStorage or IndexedDB for saved games

### 13.2 Game Engine

The game engine should be written as pure JavaScript/TypeScript functions.

Core modules:

* Deck module
* Shuffle module
* Player module
* Ledger module
* Blackjack rules module
* Poker rules module
* Hand evaluator module
* Animation controller

### 13.3 Optional AI Module

AI module should be separate:

* Rulebook generator
* Variant creator
* Table commentator
* Help/explain rules

This keeps gameplay cheap, fast, and reliable.

---

## 14. MVP Screens

### 14.1 Home / Start Screen

* New Game
* Load Previous Game
* Settings

### 14.2 Game Setup Screen

* Select game: Blackjack / Texas Hold’em
* Add player
* Add virtual player
* Set starting balance
* Choose bank/dealer
* Set blinds or betting limits
* Start game

### 14.3 Table Screen

* Central deck
* Community cards, for poker
* Dealer/bank indicator
* Player cards around table
* Player balances
* Current pot
* Betting controls
* Deal button
* Next action prompt

### 14.4 Ledger Screen / Panel

* Current balances
* Round history
* Betting movements
* Win/loss settlements
* Manual adjustment option

### 14.5 AI Assistant Screen / Panel

* Explain rules
* Generate variation idea
* Draft rulebook
* Suggest table commentary

---

## 15. MVP Build Phases

### Phase 1 — Core Table and Ledger

* Create game session.
* Add players.
* Add virtual players.
* Assign starting balances.
* Create ledger.
* Display balances.

### Phase 2 — Deck and Dealing

* Create 52-card deck.
* Shuffle deck.
* Deal cards.
* Display card animations.

### Phase 3 — Blackjack

* Add Blackjack rules.
* Add betting.
* Add hit/stand/double.
* Resolve dealer/player outcome.
* Update ledger.

### Phase 4 — Texas Hold’em

* Add blinds.
* Deal hole cards and community cards.
* Add betting rounds.
* Add hand evaluator.
* Resolve winners.
* Update ledger.

### Phase 5 — UX Polish

* Chip dragging.
* Multiple deal animations.
* Mobile responsiveness.
* Sound effects, optional.
* Round summary.

### Phase 6 — AI Assistant

* Add rule explanation.
* Add poker variant rulebook generator.
* Add optional table commentary.

---

## 16. Key Product Decision

For Spec 1.0, the app should not rely on AI to control live gameplay.

Best approach:

* Deterministic code handles cards, bets, and win/loss resolution.
* AI assists with creativity, explanation, and future game variations.

This gives the app the right balance:

* Cheap to run
* Fast to play
* Reliable game outcomes
* Fun AI-enhanced features later

---

## 17. Spec 1.0 Summary

The Card Dealer App is a lightweight, mobile-friendly front-end card table for casual games. It starts with Blackjack and Texas Hold’em, supports real and virtual players, visual betting, animated dealing, and a ledger-based balance system.

The ledger is the core foundation. Every chip movement, bet, win, loss, refund, and manual adjustment should be recorded.

AI should be included as an assistant layer, especially for rulebooks, custom variations, commentary, and explanations — but not as the live gameplay controller in Spec 1.0.
