import type { GameState } from '../../types';
import { log } from '../../utils/logger';

/**
 * True when the current viewer is the table owner/host and may run deal controls.
 * Does not infer from bank role, box ownership, or table mode.
 */
export function canCurrentUserDealTable(
  state: GameState,
  viewerPersonId: string | null | undefined,
): boolean {
  const ownerPersonId = state.tableMeta.ownerPersonId;
  if (!ownerPersonId || !viewerPersonId) {
    if (import.meta.env.DEV) {
      log.info('dealTablePermission', {
        ownerPersonId: ownerPersonId ?? null,
        viewerPersonId: viewerPersonId ?? null,
        canDeal: false,
        reason: !ownerPersonId ? 'owner-not-hydrated' : 'viewer-unknown',
      });
    }
    return false;
  }
  const canDeal = viewerPersonId === ownerPersonId;
  if (import.meta.env.DEV) {
    log.info('dealTablePermission', {
      ownerPersonId,
      viewerPersonId,
      canDeal,
    });
  }
  return canDeal;
}
