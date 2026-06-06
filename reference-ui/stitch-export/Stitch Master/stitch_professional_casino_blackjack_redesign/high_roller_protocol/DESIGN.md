---
name: High Roller Protocol
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#20201f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c0c9c2'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8a938c'
  outline-variant: '#414943'
  surface-tint: '#a0d1b7'
  primary: '#a0d1b7'
  on-primary: '#033825'
  primary-container: '#0a3d2a'
  on-primary-container: '#78a88f'
  inverse-primary: '#396752'
  secondary: '#e9c349'
  on-secondary: '#3c2f00'
  secondary-container: '#af8d11'
  on-secondary-container: '#342800'
  tertiary: '#c6c6c7'
  on-tertiary: '#2f3131'
  tertiary-container: '#333535'
  on-tertiary-container: '#9c9d9e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#bbeed2'
  primary-fixed-dim: '#a0d1b7'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#204f3b'
  secondary-fixed: '#ffe088'
  secondary-fixed-dim: '#e9c349'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#574500'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353535'
typography:
  display-gold:
    fontFamily: Libre Caslon Text
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: 0.05em
  headline-table:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: 0.1em
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  card-rank:
    fontFamily: Libre Caslon Text
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  table-padding: 2rem
  gutter-md: 1rem
  card-overlap: -40px
  sidebar-width: 320px
  action-bar-height: 80px
---

## Brand & Style
The design system is engineered to evoke the exclusive atmosphere of a private Las Vegas high-stakes lounge. The brand personality is authoritative, sophisticated, and technically precise. It balances the tactile heritage of physical gaming with the efficiency of a professional digital interface.

The design style is **Corporate Modern with Tactile Accents**. It utilizes a structured, dark-mode foundation to minimize eye strain during long sessions, punctuated by metallic gold highlights and realistic card/chip rendering to ground the digital experience in reality. The aesthetic communicates reliability and "house" prestige.

## Colors
The palette is dominated by **Forest Green (#0a3d2a)**, representing the traditional felt table, which serves as the primary surface color. 

- **Primary Accent:** Metallic Gold (#d4af37) is reserved for high-priority UI elements, call-to-action borders, and branding to signify luxury and high stakes.
- **Surface & Neutrals:** Deep charcoal and black are used for sidebar containers and background overlays to provide depth and focus on the play area.
- **Functional White:** Pure white (#ffffff) is used exclusively for playing card faces and critical typography to ensure maximum legibility against the dark felt.

## Typography
The typography strategy employs a dual-font system to balance tradition and utility.

- **The Heritage Tier (Libre Caslon Text):** Used for branding, table headers, and playing card ranks. It provides the "Old Vegas" elegance. Headlines in this face often utilize a subtle gold gradient or high-contrast white.
- **The Utility Tier (Manrope):** A clean, modern sans-serif used for all functional UI, betting amounts, and player names. Its geometric clarity ensures readability at all scales.
- **The Data Tier (JetBrains Mono):** Used for "Bank" totals, "House Rules" text, and system logs. The monospaced nature reinforces the feeling of a precise, fair, and calculated gaming protocol.

## Layout & Spacing
The system utilizes a **Fixed Vertical Architecture** to prevent any visual shifting during critical play cycles. 

- **Primary Stage:** A central, fixed-aspect ratio container for the dealer and player cards.
- **Control Layer:** A dedicated bottom-anchored action bar for "Hit," "Stand," and "Double" buttons, ensuring they never move relative to the user's hand.
- **Information Sidebar:** A right-aligned fixed panel (320px) for table statistics, player lists, and balance management.
- **Grid:** A 12-column internal grid within the table area defines the 7 standard betting positions ("Boxes"). Each box is a fixed anchor point to ensure chip stacks and cards align perfectly regardless of screen width.

## Elevation & Depth
Depth is achieved through **Tonal Layering and Inner Glows** rather than traditional drop shadows, mimicking the focused lighting of a casino table.

- **The Table:** The lowest layer, using a subtle radial gradient (center-light to edge-dark) to create a "spotlight" effect on the cards.
- **Cards & Chips:** These elements use crisp, 2px ambient shadows to appear physically resting on the felt. Cards use a slight "stacking" elevation when multiple hits are taken.
- **Active State:** The currently active player box or button is highlighted with a gold outer glow (`drop-shadow: 0 0 12px rgba(212, 175, 55, 0.6)`), creating a "lit" effect that draws immediate attention.
- **Modals:** Use a heavy backdrop blur (12px) over the green felt to isolate settings or profile views without losing the immersive context.

## Shapes
The shape language is **Soft (0.25rem)**, moving away from aggressive sharp corners to reflect the rounded edges of playing cards and the organic curves of a poker table.

- **Cards:** Use a specific `rounded-lg` (0.5rem) to match standard physical playing card dimensions.
- **Action Buttons:** Utilize a pill-shaped (rounded-full) geometry to make them feel "squishy" and tappable.
- **Chips:** Always perfect circles with a subtle 3D inner-bevel effect to represent physical thickness.
- **Containers:** UI panels and sidebars use the base `rounded-sm` (0.25rem) to maintain a professional, structural feel.

## Components
- **Action Buttons:** The primary "Hit" button is Gold (#d4af37) with black text. Secondary actions ("Stand", "Split") use semi-transparent dark borders with white text.
- **Playing Cards:** High-contrast white backgrounds with oversized pips. The back-of-card design should feature a gold-on-dark-green geometric pattern.
- **Betting Chips:** Color-coded by value (e.g., White=$1, Red=$5, Green=$25, Black=$100). When stacked, chips should show a staggered vertical offset to indicate quantity.
- **Player Boxes:** Transparent containers with dashed "Gold" or "White" borders indicating available betting spots. Active boxes switch to a solid gold border with a pulse animation.
- **Input Fields:** Dark-themed with gold focus states. All numerical inputs (bets) should include "Quick-Bet" chips for fast interaction.
- **Status Badges:** "Blackjack" or "Bust" banners should appear centered over the card hand with an elegant fade-in animation, using serif display typography.