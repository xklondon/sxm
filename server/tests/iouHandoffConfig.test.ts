import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getIouHandoffConfigDiagnostics,
  getIouHandoffNotConfiguredMessage,
} from '../src/config.js';

const ENV_KEYS = [
  'IOU_HANDOFF_SECRET',
  'IOU_HANDOFF_CREATE_URL',
  'IOU_HANDOFF_SOURCE',
  'SXM_HANDOFF_SECRET',
  'SXM_HANDOFF_SOURCE',
  'SXM_HANDOFF_CREATE_URL',
] as const;

function saveEnv(): Record<string, string | undefined> {
  const saved: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  return saved;
}

function restoreEnv(saved: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = saved[key];
    }
  }
}

describe('IOU handoff config', () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = saveEnv();
  });

  afterEach(() => {
    restoreEnv(savedEnv);
  });

  it('enables handoff only with canonical IOU_HANDOFF_SECRET and IOU_HANDOFF_CREATE_URL', () => {
    process.env.IOU_HANDOFF_SECRET = 'partner-secret';
    process.env.IOU_HANDOFF_CREATE_URL = 'https://iou-wallet.com/api/integrations/handoff/create';
    const diag = getIouHandoffConfigDiagnostics();
    expect(diag.enabled).toBe(true);
    expect(diag.missingCanonical).toEqual([]);
  });

  it('does not enable handoff when only legacy SXM_HANDOFF_SECRET is set', () => {
    process.env.SXM_HANDOFF_SECRET = 'legacy-secret';
    process.env.IOU_HANDOFF_CREATE_URL = 'https://iou-wallet.com/api/integrations/handoff/create';
    const diag = getIouHandoffConfigDiagnostics();
    expect(diag.enabled).toBe(false);
    expect(diag.legacyEnvPresent).toContain('SXM_HANDOFF_SECRET');
    expect(getIouHandoffNotConfiguredMessage()).toMatch(/Rename legacy env SXM_HANDOFF_SECRET/);
  });

  it('reports missing IOU_HANDOFF_SECRET', () => {
    process.env.IOU_HANDOFF_CREATE_URL = 'https://iou-wallet.com/api/integrations/handoff/create';
    expect(getIouHandoffNotConfiguredMessage()).toBe(
      'IOU handoff is not configured on this server. Set IOU_HANDOFF_SECRET.',
    );
  });

  it('reports missing IOU_HANDOFF_CREATE_URL', () => {
    process.env.IOU_HANDOFF_SECRET = 'partner-secret';
    expect(getIouHandoffNotConfiguredMessage()).toBe(
      'IOU handoff is not configured on this server. Set IOU_HANDOFF_CREATE_URL.',
    );
  });

  it('returns generic message when nothing is set', () => {
    expect(getIouHandoffNotConfiguredMessage()).toBe(
      'IOU handoff is not configured on this server. Set IOU_HANDOFF_SECRET.',
    );
  });
});
