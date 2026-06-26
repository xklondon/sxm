# Poker 0 — Canonical Layout

## Authoritative specification

The file `reference-ui/Poker/Poker 0/Poker0Cannonical_Layout.png` is the **only** authoritative Poker layout specification.

Legacy (deprecated): stitch High Roller redesign, absolute seat offsets, pot/deal in felt center, permanent chat rail, pre-Poker0 cloth arc SVG.

## Production route

`TableScreen → PokerPanel → PokerTableShell → PokerTableLayout` — code under `src/games/poker/**` only.

## Responsive variants

Desktop landscape (default), mobile portrait (`max-width: 720px` portrait), mobile landscape (`max-width: 720px` landscape). One screen, no gameplay scroll.

## Header

Left: table name + Playing for text. Center band: POT | BLINDS | Deal Cards. Right: This Table.

## Felt

Symmetric oval, gold border, embossed **table name** at center (not SXM Poker).

## Seats

CSS grid ring for 2 / 4 / 6 / 9 players. Seat card: avatar, name, stack, chip bars, D/SB/BB/ALL IN/WIN badges.

## Community

FLOP / TURN / RIVER rows in felt center.

## Action bar

Buttons, then chip presets, then amount. Sticky bottom on mobile.

## This Table

Desktop right panel; mobile bottom sheet. Chat inside panel only.

## Contract

`poker0LayoutContract.ts`, `poker0SeatLayout.ts`, `pokerTemplateContract.ts`.
