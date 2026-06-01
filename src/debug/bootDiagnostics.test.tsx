import { describe, expect, it } from 'vitest';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BOOT_STAGES,
  formatBootError,
  recordBootStage,
} from './bootDiagnostics';
import { BootErrorBoundary } from './BootErrorBoundary';
import { ClientConfigScreen, isClientConfigPath } from './ClientConfigScreen';

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
