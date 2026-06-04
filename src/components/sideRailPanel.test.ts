import { describe, expect, it } from 'vitest';

import { toggleSideRailPanel } from './sideRailPanel';

describe('sideRailPanel toggle', () => {
  it('opens target when another panel is active', () => {
    expect(toggleSideRailPanel('thisTable', 'tableDetails')).toBe('tableDetails');
    expect(toggleSideRailPanel('tableDetails', 'thisTable')).toBe('thisTable');
  });

  it('closes when clicking the active panel again', () => {
    expect(toggleSideRailPanel('thisTable', 'thisTable')).toBeNull();
    expect(toggleSideRailPanel('tableDetails', 'tableDetails')).toBeNull();
  });

  it('opens from closed state', () => {
    expect(toggleSideRailPanel(null, 'thisTable')).toBe('thisTable');
    expect(toggleSideRailPanel(null, 'tableDetails')).toBe('tableDetails');
  });
});
