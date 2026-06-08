---
name: High Roller Protocol
colors:
  surface: '#041710'
  surface-dim: '#041710'
  surface-bright: '#293d35'
  surface-container-lowest: '#01110b'
  surface-container-low: '#0b1f18'
  surface-container: '#10231c'
  surface-container-high: '#1a2e26'
  surface-container-highest: '#253931'
  on-surface: '#d1e8dc'
  on-surface-variant: '#bfc9c1'
  inverse-surface: '#d1e8dc'
  inverse-on-surface: '#21342c'
  outline: '#8a938c'
  outline-variant: '#404943'
  surface-tint: '#95d4b3'
  primary: '#95d4b3'
  on-primary: '#003824'
  primary-container: '#2d6a4f'
  on-primary-container: '#a8e7c5'
  inverse-primary: '#2c694e'
  secondary: '#ffb3ae'
  on-secondary: '#68000b'
  secondary-container: '#950717'
  on-secondary-container: '#ff9e98'
  tertiary: '#e9c349'
  on-tertiary: '#3c2f00'
  tertiary-container: '#cca72f'
  on-tertiary-container: '#4e3d00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#b1f0ce'
  primary-fixed-dim: '#95d4b3'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#0e5138'
  secondary-fixed: '#ffdad7'
  secondary-fixed-dim: '#ffb3ae'
  on-secondary-fixed: '#410004'
  on-secondary-fixed-variant: '#920415'
  tertiary-fixed: '#ffe088'
  tertiary-fixed-dim: '#e9c349'
  on-tertiary-fixed: '#241a00'
  on-tertiary-fixed-variant: '#574500'
  background: '#041710'
  on-background: '#d1e8dc'
  surface-variant: '#253931'
typography:
  display-lg:
    fontFamily: Libre Caslon Text
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: 0.02em
  headline-lg:
    fontFamily: Libre Caslon Text
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.02em
  headline-lg-mobile:
    fontFamily: Libre Caslon Text
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-sm:
    fontFamily: Space Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.0'
    letterSpacing: 0.1em
spacing:
  unit: 4px
  gutter: 24px
  margin: 32px
  container-max: 1280px
---

## Brand & Style

The design system is an ultra-premium, high-stakes digital environment inspired by the tactile sophistication of elite casino floors. It leverages a **Tactile / Modern** aesthetic, blending the physical richness of heritage gaming tables with the precision of a contemporary fintech protocol. 

The atmosphere is exclusive, hushed, and high-contrast. It targets sophisticated users who value both the legacy of the "grand casino" and the efficiency of modern systems. Every interaction should feel like a calculated move on a professional felt surface—deliberate, weighted, and prestigious.

## Colors

The palette is derived directly from classic table gaming.
- **Primary (Casino Felt):** A deep, saturated hunter green that serves as the foundation. In the UI, use a subtle noise texture or grain to simulate the matte "nap" of high-quality felt.
- **Secondary (Bet Red):** A punchy, authoritative red used for warnings, high-priority actions, and traditional "dealer" notations.
- **Tertiary (Brass/Gold):** Inspired by the metallic accents of table hardware and card edging. Used for accents, thin borders, and success states.
- **Neutral (Midnight):** An almost-black deep green used for background surfaces and containers to maintain a moody, focused dark mode.

## Typography

This design system uses a tri-font hierarchy to balance heritage and utility:
- **Display & Headlines:** *Libre Caslon Text* provides the "Black Jack" table-print aesthetic. It should be used for major titles, often in secondary red or tertiary gold.
- **Body:** *Hanken Grotesk* ensures maximum readability for complex data and protocol terms, providing a clean, modern contrast to the serif headings.
- **Technical Labels:** *Space Mono* is used for data values, transaction IDs, and status labels, echoing the precise nature of ledger entries and odds-making.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy, centering content to create a focused "tabletop" feel.
- **Desktop:** 12-column grid with generous 24px gutters. Use wide margins to simulate the empty space around a gaming table.
- **Mobile:** 4-column grid with 16px margins.
- **Rhythm:** Spacing should be airy and deliberate. Elements are grouped in "sectors" (like betting boxes) rather than continuous streams of information. Use vertical spacing to create a sense of hierarchy, prioritizing the central "play area."

## Elevation & Depth

Depth is achieved through **Tonal Layers** and **Low-Contrast Outlines** rather than aggressive shadows.
- **Surface:** The base layer is the Primary green felt. 
- **Containers:** Use subtle dark-tints of the Neutral color with 10% opacity to create "recessed" areas.
- **Outlines:** All interactive boxes and containers utilize 1px or 2px solid borders in Tertiary gold or Secondary red, directly mimicking the printed lines on a card table.
- **Overlays:** Modals and tooltips use a deep backdrop blur to simulate focus, as if looking through a crystal glass on the table.

## Shapes

The design system embraces **Sharp (0)** geometry. To mirror the precise "betting boxes" and card shapes of a professional casino floor, all containers, buttons, and inputs utilize 0px border radii. This creates a rigorous, architectural feel that distinguishes the protocol from softer, consumer-grade apps.

## Components

- **Buttons:** Sharp-edged with 2px borders. Primary buttons use a gold border with gold text; destructive/high-stakes buttons use red. No fill by default; fill on hover to create a "highlighted" effect.
- **Cards/Boxes:** Defined by the "Table Outline" style—1px gold or white borders on the green felt background. Headlines within cards should be centered and uppercase.
- **Inputs:** Simple underlined fields or full sharp boxes. The focus state should transition the border from a dim neutral to a vibrant tertiary gold.
- **Chips/Status:** Circular elements (the only rounded exception) to represent tokens or status, using high-contrast fills of red, green, or black to mimic physical casino chips.
- **Data Tables:** No vertical dividers; use horizontal 1px lines in low-opacity gold to separate entries, ensuring the "felt" texture is visible between rows.