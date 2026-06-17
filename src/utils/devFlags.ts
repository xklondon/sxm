/** Opt-in expensive boot-time engine sanity suites (default off in dev). */
export function isDevSanityChecksEnabled(): boolean {
  try {
    return import.meta.env?.DEV === true && import.meta.env?.VITE_DEV_SANITY_CHECKS === 'true';
  } catch {
    return false;
  }
}

/** Verbose console diagnostics for layout, chip tray, card view, etc. */
export function isVerboseDevLogging(): boolean {
  try {
    return import.meta.env?.DEV === true && import.meta.env?.VITE_VERBOSE_DEV_LOGS === 'true';
  } catch {
    return false;
  }
}
