/** Opt-in expensive boot-time engine sanity suites (default off in dev). */
export function isDevSanityChecksEnabled(): boolean {
  try {
    return import.meta.env?.DEV === true && import.meta.env?.VITE_DEV_SANITY_CHECKS === 'true';
  } catch {
    return false;
  }
}

/** Vitest / NODE_ENV=test — quieter logs; errors and warnings still emit. */
export function isTestRuntime(): boolean {
  try {
    if (import.meta.env?.MODE === 'test') return true;
  } catch {
    /* non-vite */
  }
  return typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
}

/** Verbose console diagnostics for layout, chip tray, card view, etc. */
export function isVerboseDevLogging(): boolean {
  if (isTestRuntime()) return false;
  try {
    return import.meta.env?.DEV === true && import.meta.env?.VITE_VERBOSE_DEV_LOGS === 'true';
  } catch {
    return false;
  }
}
