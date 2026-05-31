const PENDING_TABLE_KEY = 'sxmcards:pending-table';

export function rememberPendingTable(tableId: string): void {
  sessionStorage.setItem(PENDING_TABLE_KEY, tableId);
}

export function consumePendingTable(): string | null {
  const value = sessionStorage.getItem(PENDING_TABLE_KEY);
  if (value) {
    sessionStorage.removeItem(PENDING_TABLE_KEY);
  }
  return value;
}

export function getPendingTable(): string | null {
  return sessionStorage.getItem(PENDING_TABLE_KEY);
}
