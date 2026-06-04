import { consumePendingTable } from './session/pendingTable';
import { writeStoredOnlineTableId } from './onlineTableStorage';

/** Remove ?table= from the address bar so AppRoot does not re-resolve a dead id. */
export function clearOnlineTableFromUrl(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of ['table', 'newTable']) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (changed) {
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, '', next);
  }
}

/** Drop persisted online table pointers after server restart or 404. */
export function clearStaleOnlineTableContext(): void {
  writeStoredOnlineTableId(null);
  consumePendingTable();
  clearOnlineTableFromUrl();
}
