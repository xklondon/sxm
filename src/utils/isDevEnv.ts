/** Safe DEV check for code shared between Vite client and Node server. */
export function isDevEnv(): boolean {
  try {
    return typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}
