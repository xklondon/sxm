import { isHandledAuthRejection } from '../auth/authErrors';

/**
 * Boot diagnostics — make a stalled/crashed boot VISIBLE instead of leaving the
 * green felt background (the "green screen"). Installs global error handlers,
 * tracks boot stages, and renders a plain-DOM overlay (no React needed, so it
 * works even if the bundle/React never mounts).
 */

export const BOOT_STAGES = {
  bundle: 'Boot 1: bundle loaded',
  reactEntry: 'Boot 2: React entry',
  appRoot: 'Boot 3: AppRoot render',
  authMe: 'Boot 4: /api/auth/me returned',
} as const;

const OVERLAY_ID = 'sxm-boot-overlay';
const STALL_MS = 5000;

const stages: string[] = [];
let booted = false;
let stallTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Dev-only engine sanity suites must NEVER run in a served/host build — they
 * mutate owner-only table state and can throw during boot. Gate on MODE (which
 * is reliably 'production' in host builds) rather than the DEV flag, which can
 * be odd in some host builds.
 */
export function shouldRunDevChecks(env: {
  mode?: string;
  dev?: boolean;
  /** Opt-in: expensive engine sanity suites at boot (VITE_DEV_SANITY_CHECKS=true). */
  sanityChecks?: boolean;
}): boolean {
  if (!env.dev || env.mode === 'production') {
    return false;
  }
  return env.sanityChecks === true;
}

export function recordBootStage(stage: string, list: string[] = stages): string[] {
  if (!list.includes(stage)) {
    list.push(stage);
  }
  return list;
}

export function formatBootError(label: string, detail: string): string {
  return `${label}\n\n${detail}`.trim();
}

function hasDom(): boolean {
  return typeof document !== 'undefined' && Boolean(document.body);
}

function overlayShell(): HTMLElement | null {
  if (!hasDom()) return null;
  let el = document.getElementById(OVERLAY_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.setAttribute('role', 'alert');
    el.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;background:#0b1f17;color:#f4f4f4;' +
      'font:14px/1.5 ui-monospace,Menlo,Consolas,monospace;padding:20px;overflow:auto;' +
      '-webkit-overflow-scrolling:touch;white-space:pre-wrap;word-break:break-word';
    document.body.appendChild(el);
  }
  return el;
}

export function showBootOverlay(title: string, body: string, showReload = true): void {
  const el = overlayShell();
  if (!el) return;
  const reload = showReload
    ? '<button onclick="location.reload()" style="margin-top:14px;padding:10px 18px;font-size:15px;border:0;border-radius:8px;background:#f5c518;color:#1a1a1a;cursor:pointer">Reload</button>'
    : '';
  el.innerHTML =
    `<div style="font-size:18px;font-weight:700;margin-bottom:10px">${escapeHtml(title)}</div>` +
    `<div>${escapeHtml(body)}</div>${reload}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function markBootStage(stage: string): void {
  recordBootStage(stage);
}

export function markBootSucceeded(): void {
  booted = true;
  if (stallTimer) {
    clearTimeout(stallTimer);
    stallTimer = null;
  }
  if (hasDom()) {
    const el = document.getElementById(OVERLAY_ID);
    // Only auto-clear the *stall* overlay; keep error overlays visible.
    if (el && el.dataset.kind === 'stall') {
      el.remove();
    }
  }
}

export function showBootError(label: string, detail: string): void {
  const el = overlayShell();
  if (el) el.dataset.kind = 'error';
  showBootOverlay(label, detail, true);
}

function showStallOverlay(): void {
  if (booted) return;
  const el = overlayShell();
  if (el) el.dataset.kind = 'stall';
  showBootOverlay(
    'Still loading…',
    `The app has not finished starting.\nReached:\n${stages.join('\n') || '(no stages reached)'}`,
    true,
  );
}

/** Install global handlers + the >5s stall watchdog. Safe to call once at boot. */
export function installBootDiagnostics(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (e: ErrorEvent) => {
    const target = e.target as { tagName?: string; src?: string } | null;
    if (target && target.tagName === 'SCRIPT') {
      showBootError('App update detected', `Failed to load ${target.src || 'a script'}. Refresh or clear this site's cache.`);
      return;
    }
    showBootError('Boot error (window.onerror)', formatBootError(String(e.message || 'Unknown error'), `${e.filename ?? ''}:${e.lineno ?? ''}`));
  });

  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    if (isHandledAuthRejection(e.reason)) {
      e.preventDefault();
      return;
    }
    showBootError('Unhandled promise rejection', String(e.reason ?? 'Unknown reason'));
  });

  if (typeof setTimeout === 'function') {
    stallTimer = setTimeout(showStallOverlay, STALL_MS);
  }
}
