import { sanitizeOnlineTableId } from './onlineTableStorage';
import { getPendingTable } from './session/pendingTable';

/** Prefer in-app active id so stale AppRoot props cannot re-trigger fetch loops. */
export function resolveEffectiveOnlineTableId(
  activeTableId: string | null,
  dismissStoredTable: boolean,
  onlineTableIdProp: string | null,
): string | null {
  const active = sanitizeOnlineTableId(activeTableId);
  if (active) {
    return active;
  }
  if (dismissStoredTable) {
    return null;
  }
  return sanitizeOnlineTableId(onlineTableIdProp) ?? sanitizeOnlineTableId(getPendingTable());
}
