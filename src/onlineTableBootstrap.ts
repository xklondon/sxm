import { sanitizeOnlineTableId } from './onlineTableStorage';

/** Prefer in-app active id; boot uses URL-only table id (no localStorage auto-resume). */
export function resolveEffectiveOnlineTableId(
  activeTableId: string | null,
  dismissStoredTable: boolean,
  bootTableId: string | null,
): string | null {
  const active = sanitizeOnlineTableId(activeTableId);
  if (active) {
    return active;
  }
  if (dismissStoredTable) {
    return null;
  }
  return sanitizeOnlineTableId(bootTableId);
}
