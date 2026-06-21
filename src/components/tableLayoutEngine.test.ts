import { describe, expect, it } from 'vitest';
import {
  CSS_OWNERSHIP,
  FORBIDDEN_ZONE_MOVER_DECLARATIONS,
  LAYOUT_MODES,
  LAYOUT_MODE_SPECS,
  LAYOUT_ZONES,
  LAYOUT_ZONE_CLASS,
  LAYOUT_ZONE_GRID_ROWS,
  SHELL_OWNED_ZONE_CLASSES,
  TABLE_LAYOUT_ENGINE_VERSION,
  getLayoutModeSpec,
  getLayoutModeSpecFor,
  resolveLayoutMode,
} from './tableLayoutEngine';

describe('tableLayoutEngine — canonical zone contract', () => {
  it('defines the seven canonical zones in fixed order', () => {
    expect(LAYOUT_ZONES).toEqual([
      'bankInfo',
      'dealer',
      'command',
      'cards',
      'actions',
      'boxes',
      'tray',
    ]);
  });

  it('exposes a versioned engine marker', () => {
    expect(TABLE_LAYOUT_ENGINE_VERSION).toMatch(/^table-layout-engine-/);
  });

  it('maps every zone to a grid-row name and a DOM class', () => {
    for (const zone of LAYOUT_ZONES) {
      expect(LAYOUT_ZONE_GRID_ROWS[zone]).toBeTruthy();
      expect(LAYOUT_ZONE_CLASS[zone]).toBeTruthy();
    }
  });
});

describe('tableLayoutEngine — four modes share one structure', () => {
  it('declares exactly the four canonical modes', () => {
    expect(LAYOUT_MODES).toEqual(['desktopFull', 'desktopCard', 'mobileFull', 'mobileCard']);
  });

  it('all four modes use the SAME zone names in the SAME order', () => {
    for (const mode of LAYOUT_MODES) {
      expect(getLayoutModeSpec(mode).zoneOrder).toEqual(LAYOUT_ZONES);
    }
  });

  it('all phases keep the same zone order (phase-invariant rows = all zones)', () => {
    for (const mode of LAYOUT_MODES) {
      expect(getLayoutModeSpec(mode).phaseInvariantRows).toEqual(LAYOUT_ZONES);
    }
  });

  it('boxes baseline is identical (phase-invariant) across every mode', () => {
    const baselines = LAYOUT_MODES.map((m) => getLayoutModeSpec(m).boxesBaseline);
    expect(new Set(baselines)).toEqual(new Set(['directly-above-tray']));
  });

  it('cards is the single stretch zone; cards cannot own boxes/tray placement', () => {
    for (const mode of LAYOUT_MODES) {
      const spec = getLayoutModeSpec(mode);
      expect(spec.stretchZone).toBe('cards');
      // boxes + tray are fixed (owned by the shell), never the stretch zone.
      expect(spec.fixedZones).toContain('boxes');
      expect(spec.fixedZones).toContain('tray');
      expect(spec.fixedZones).not.toContain('cards');
      expect(spec.stretchZone).not.toBe('boxes');
      expect(spec.stretchZone).not.toBe('tray');
    }
  });

  it('cards overflow is visible in every mode (card tops/fans read outside the band)', () => {
    for (const mode of LAYOUT_MODES) {
      expect(getLayoutModeSpec(mode).overflow.cards).toBe('visible');
    }
  });

  it('full modes host the table card stack; card modes host the hero fan', () => {
    expect(getLayoutModeSpec('desktopFull').cardsAreaMode).toBe('table');
    expect(getLayoutModeSpec('mobileFull').cardsAreaMode).toBe('table');
    expect(getLayoutModeSpec('desktopCard').cardsAreaMode).toBe('hero');
    expect(getLayoutModeSpec('mobileCard').cardsAreaMode).toBe('hero');
  });

  it('every mode names the shell file as its shell-geometry owner', () => {
    for (const mode of LAYOUT_MODES) {
      expect(getLayoutModeSpec(mode).shellOwnerCss).toBe(CSS_OWNERSHIP.shellGeometry);
    }
  });
});

describe('tableLayoutEngine — mode resolution', () => {
  it('resolves device + view to the correct mode', () => {
    expect(resolveLayoutMode('desktop', 'full')).toBe('desktopFull');
    expect(resolveLayoutMode('desktop', 'card')).toBe('desktopCard');
    expect(resolveLayoutMode('mobile', 'full')).toBe('mobileFull');
    expect(resolveLayoutMode('mobile', 'card')).toBe('mobileCard');
  });

  it('getLayoutModeSpecFor matches getLayoutModeSpec(resolveLayoutMode(...))', () => {
    expect(getLayoutModeSpecFor('mobile', 'card')).toBe(LAYOUT_MODE_SPECS.mobileCard);
  });
});

describe('tableLayoutEngine — ownership rules', () => {
  it('names a single shell-geometry owner', () => {
    expect(CSS_OWNERSHIP.shellGeometry).toBe('src/styles/bj-blackjack-table-shell.css');
  });

  it('lists the zone-mover declarations children must not use on a zone wrapper', () => {
    expect(FORBIDDEN_ZONE_MOVER_DECLARATIONS).toContain('margin-top: auto');
    expect(FORBIDDEN_ZONE_MOVER_DECLARATIONS).toContain('translateY');
  });

  it('shell-owned zone classes cover all seven zones', () => {
    expect(SHELL_OWNED_ZONE_CLASSES).toHaveLength(LAYOUT_ZONES.length);
    expect(SHELL_OWNED_ZONE_CLASSES).toContain('bj-table-zone--boxes');
    expect(SHELL_OWNED_ZONE_CLASSES).toContain('bj-table-zone--bottom');
  });
});
