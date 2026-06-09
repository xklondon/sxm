/** Client-side online table id persisted in localStorage. */
export const ONLINE_TABLE_STORAGE_KEY = 'sxmcards:online-table-id';

const UUID_TABLE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Fallback from generateId() when crypto.randomUUID is unavailable. */
const LEGACY_TABLE_ID = /^\d+-[a-z0-9]{2,32}$/i;

export function isValidOnlineTableId(value: string | null | undefined): value is string {
  if (!value || typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  if (trimmed.length < 8 || trimmed.length > 128 || /[<>"'`\s]/.test(trimmed)) {
    return false;
  }
  return UUID_TABLE_ID.test(trimmed) || LEGACY_TABLE_ID.test(trimmed);
}

export function sanitizeOnlineTableId(value: string | null | undefined): string | null {
  if (!isValidOnlineTableId(value)) {
    return null;
  }
  return value.trim();
}

export function readStoredOnlineTableId(): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(ONLINE_TABLE_STORAGE_KEY);
    const id = sanitizeOnlineTableId(raw);
    if (raw && !id) {
      localStorage.removeItem(ONLINE_TABLE_STORAGE_KEY);
    }
    return id;
  } catch {
    return null;
  }
}

export function writeStoredOnlineTableId(tableId: string | null): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    const id = sanitizeOnlineTableId(tableId);
    if (id) {
      localStorage.setItem(ONLINE_TABLE_STORAGE_KEY, id);
    } else {
      localStorage.removeItem(ONLINE_TABLE_STORAGE_KEY);
    }
  } catch {
    /* storage unavailable */
  }
}

/** Prefer URL table param when valid; ignore corrupt localStorage. */
export function resolveOnlineTableId(
  tableFromUrl: string | null,
  forceNewTable: boolean,
): string | null {
  if (forceNewTable) {
    return null;
  }
  const fromUrl = sanitizeOnlineTableId(tableFromUrl);
  if (fromUrl) {
    return fromUrl;
  }
  return readStoredOnlineTableId();
}

/** Normal app boot — only explicit URL table params (invite accept, deep links). */
export function resolveBootTableId(
  tableFromUrl: string | null,
  forceNewTable: boolean,
): string | null {
  if (forceNewTable) {
    return null;
  }
  return sanitizeOnlineTableId(tableFromUrl);
}
