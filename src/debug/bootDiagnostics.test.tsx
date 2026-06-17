import { describe, expect, it } from 'vitest';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BOOT_STAGES,
  formatBootError,
  recordBootStage,
  shouldRunDevChecks,
} from './bootDiagnostics';
import { BootErrorBoundary } from './BootErrorBoundary';
import { ClientConfigScreen, isClientConfigPath } from './ClientConfigScreen';
import { resolveOnlineModeEnabled } from '../api/config';
import { setBlackjackProtocolOnState } from '../engine/blackjack/protocolState';
import { createNewBlackjackTable } from '../engine/session';
import { LAS_VEGAS_PROTOCOL } from '../engine/blackjack/protocols';

describe('boot stage tracking', () => {
  it('records ordered, de-duplicated boot stages', () => {
    const list: string[] = [];
    recordBootStage(BOOT_STAGES.bundle, list);
    recordBootStage(BOOT_STAGES.reactEntry, list);
    recordBootStage(BOOT_STAGES.bundle, list); // duplicate ignored
    expect(list).toEqual([BOOT_STAGES.bundle, BOOT_STAGES.reactEntry]);
  });

  it('formats a boot error into visible text', () => {
    expect(formatBootError('Boot error', 'TypeError: x is undefined')).toContain('Boot error');
    expect(formatBootError('Boot error', 'TypeError: x is undefined')).toContain('TypeError');
  });
});

describe('dev sanity checks are gated out of host/production builds', () => {
  it('runs only when explicitly opted in during non-production dev', () => {
    expect(shouldRunDevChecks({ mode: 'development', dev: true })).toBe(false);
    expect(shouldRunDevChecks({ mode: 'development', dev: true, sanityChecks: true })).toBe(true);
    expect(shouldRunDevChecks({ mode: 'production', dev: false })).toBe(false);
  });

  it('does NOT run in the odd host build (MODE=production but DEV true)', () => {
    // This is exactly the reported Android host build; the owner-only protocol
    // mutation in the sanity suite must not auto-run here.
    expect(shouldRunDevChecks({ mode: 'production', dev: true })).toBe(false);
  });
});

describe('owner-only protocol mutation cannot auto-run on host boot', () => {
  it('setBlackjackProtocolOnState throws for a non-owner (explicit-action guard)', () => {
    const state = createNewBlackjackTable();
    expect(() => setBlackjackProtocolOnState(state, LAS_VEGAS_PROTOCOL.id, 'Nobody')).toThrow(
      /locked or owner-only/i,
    );
  });

  it('host boot neither runs sanity nor uses the offline start path', () => {
    const hostEnv = { mode: 'production', dev: true, prod: false } as const;
    // 1) sanity suite (which calls the owner-only mutation) is gated off
    expect(shouldRunDevChecks(hostEnv)).toBe(false);
    // 2) host is online → AppRoot takes the auth/login path, not offline start
    expect(resolveOnlineModeEnabled({ mode: hostEnv.mode, prod: hostEnv.prod })).toBe(true);
  });
});

describe('BootErrorBoundary', () => {
  it('derives error state from a thrown error', () => {
    const err = new Error('kaboom');
    expect(BootErrorBoundary.getDerivedStateFromError(err)).toEqual({ error: err });
  });

  it('renders visible recovery text when an error is present', () => {
    const boundary = new BootErrorBoundary({ children: null });
    boundary.state = { error: new Error('render blew up') };
    const html = renderToStaticMarkup(boundary.render() as ReactElement);
    expect(html).toContain('Something went wrong');
    expect(html).toContain('render blew up');
    expect(html).toContain('Reload');
  });

  it('renders children when there is no error', () => {
    const boundary = new BootErrorBoundary({ children: 'app-content' });
    boundary.state = { error: null };
    expect(boundary.render()).toBe('app-content');
  });
});

describe('client config debug page', () => {
  it('matches /debug/client-config (with or without trailing slash / base)', () => {
    expect(isClientConfigPath('/debug/client-config')).toBe(true);
    expect(isClientConfigPath('/debug/client-config/')).toBe(true);
    expect(isClientConfigPath('/app/debug/client-config')).toBe(true);
    expect(isClientConfigPath('/')).toBe(false);
    expect(isClientConfigPath('/login')).toBe(false);
  });

  it('renders the config without requiring auth', () => {
    const html = renderToStaticMarkup(<ClientConfigScreen />);
    expect(html).toContain('SXM client config');
    expect(html).toContain('apiBase');
    expect(html).toContain('socketBase');
    expect(html).toContain('import.meta.env.MODE');
  });
});
