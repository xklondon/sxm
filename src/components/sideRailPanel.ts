/** Mutually exclusive felt-adjacent panels (This Table vs Table Details). */
export type SideRailPanel = 'thisTable' | 'tableDetails' | null;

export function toggleSideRailPanel(
  current: SideRailPanel,
  target: 'thisTable' | 'tableDetails',
): SideRailPanel {
  return current === target ? null : target;
}
