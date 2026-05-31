import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertEnvWriteAllowed,
  parseEnvLines,
  writeEnvWithGuard,
} from '../../scripts/envGuard.js';

describe('envGuard', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sxm-env-'));
  const envPath = path.join(tmpDir, '.env');

  afterEach(() => {
    if (fs.existsSync(envPath)) {
      fs.unlinkSync(envPath);
    }
  });

  it('refuses .env write without --write-env', () => {
    const prev = process.argv;
    process.argv = ['node', 'test'];
    expect(() => assertEnvWriteAllowed()).toThrow(/Refusing to write .env/);
    process.argv = prev;
  });

  it('preserves protected secrets when --write-env is set', () => {
    fs.writeFileSync(
      envPath,
      'SMTP_USER=keep@example.com\nSMTP_PASS=secret-token\nSESSION_SECRET=abc\nPUBLIC_ORIGIN=http://old\n',
      'utf8',
    );
    const prev = process.argv;
    process.argv = ['node', 'test', '--write-env'];
    writeEnvWithGuard(
      {
        PUBLIC_ORIGIN: 'http://192.168.0.56:5173',
        SMTP_USER: 'overwrite@example.com',
        SMTP_PASS: 'new-pass',
      },
      envPath,
    );
    process.argv = prev;

    const parsed = parseEnvLines(fs.readFileSync(envPath, 'utf8'));
    expect(parsed.get('SMTP_USER')).toBe('keep@example.com');
    expect(parsed.get('SMTP_PASS')).toBe('secret-token');
    expect(parsed.get('PUBLIC_ORIGIN')).toBe('http://192.168.0.56:5173');
  });
});
