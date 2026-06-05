import type { StoreType } from './types.js';
import type { Store } from './types.js';

export type { MaybePromise, StoreType } from './types.js';

export interface StoreBundle {
  store: Store;
  storeType: StoreType;
  disconnect?: () => Promise<void>;
}

export function describeDatabaseHost(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl);
    const dbName = parsed.pathname.replace(/^\//, '') || '(default)';
    return `${parsed.hostname}:${parsed.port || '5432'}/${dbName}`;
  } catch {
    return '(invalid-url)';
  }
}
