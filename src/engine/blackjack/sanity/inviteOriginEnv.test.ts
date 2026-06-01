import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveTableInviteOrigin } from '../../../utils/tableHost';
import { runProtocolCorrectnessSanityChecks } from './protocolCorrectnessChecks';

/** Assignment to an import.meta.env.* key (not a `==`/`===` comparison). */
const ENV_WRITE = /import\.meta\.env\.\w+\s*=(?!=)/;

describe('invite origin resolver (no import.meta.env mutation)', () => {
  it('resolves a configured LAN host without touching env', () => {
    expect(resolveTableInviteOrigin('192.168.0.56:5137', null)).toBe('http://192.168.0.56:5137');
    expect(resolveTableInviteOrigin('http://192.168.0.56:5137', null)).toBe('http://192.168.0.56:5137');
  });

  it('falls back to the page origin when no host is configured', () => {
    expect(resolveTableInviteOrigin('', 'http://127.0.0.1:5173/')).toBe('http://127.0.0.1:5173');
    expect(resolveTableInviteOrigin(undefined, null)).toBe('');
  });

  it('runs the protocol correctness suite without throwing', () => {
    expect(() => runProtocolCorrectnessSanityChecks()).not.toThrow();
  });

  it('regression: source never assigns to import.meta.env (Android read-only crash)', () => {
    // In production `import.meta.env.*` is a read-only build constant. The old
    //   import.meta.env.VITE_TABLE_HOST = '192.168.0.56:5137'
    // compiled to `undefined = '...'` → "Cannot assign to read only property
    // 'undefined' of object '#<Window>'" on strict (Android) engines. Guard so
    // no future edit reintroduces an env mutation here.
    const file = path.resolve(__dirname, 'protocolCorrectnessChecks.ts');
    const source = readFileSync(file, 'utf8');
    expect(ENV_WRITE.test(source)).toBe(false);
  });
});
