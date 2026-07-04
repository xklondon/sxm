import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

describe('IOU handoff canonical client path', () => {
  it('frontend caller posts only to /api/iou-handoff/create', () => {
    const apiSrc = readSrc('src/api/iouHandoff.ts');
    expect(apiSrc).toContain("handoffFetch('/api/iou-handoff/create'");
    expect(apiSrc).not.toMatch(/integrations\/handoff\/create/);
    expect(apiSrc).not.toContain('IOU_HANDOFF_SECRET');
    expect(apiSrc).not.toContain('SXM_HANDOFF_SECRET');
  });

  it('game-over flow uses backend create only', () => {
    const flowSrc = readSrc('src/components/gameOverActionFlow.ts');
    expect(flowSrc).toContain("from '../api/iouHandoff'");
    expect(flowSrc).toContain('createIouHandoff');
    expect(flowSrc).not.toContain('buildGameEndIouHandoff');
    expect(flowSrc).not.toContain('encryptIouHandoff');
  });

  it('client src tree has no handoff secret env reads or frontend encryption', () => {
    const clientSrc = [
      readSrc('src/api/iouHandoff.ts'),
      readSrc('src/components/gameOverActionFlow.ts'),
      readSrc('src/engine/scoreLedger/gameEndIou.ts'),
      readSrc('src/lib/iouHandoffPayload.ts'),
    ].join('\n');
    expect(clientSrc).not.toMatch(/process\.env\.(IOU_HANDOFF_SECRET|SXM_HANDOFF_SECRET)/);
    expect(clientSrc).not.toContain('encryptIouHandoff');
    expect(clientSrc).not.toMatch(/source=sxm.*handoff=/);
    expect(clientSrc).not.toMatch(/handoff=.*source=sxm/);
  });

  it('server encrypts and posts to configured create URL', () => {
    const cryptoSrc = readSrc('server/src/lib/iouHandoffCrypto.ts');
    expect(cryptoSrc).toContain('encryptIouHandoff');
    expect(cryptoSrc).toContain('config.createUrl');
    expect(cryptoSrc).toMatch(/source:\s*config\.source/);
    expect(cryptoSrc).toMatch(/handoff,/);
  });

  it('routes use canonical not-configured helper', () => {
    const routesSrc = readSrc('server/src/iouHandoff/routes.ts');
    expect(routesSrc).toContain('getIouHandoffNotConfiguredMessage');
    expect(routesSrc).not.toContain('SXM_HANDOFF');
  });

  it('does not expose VITE or legacy SXM handoff env vars in .env.example', () => {
    const example = readFileSync(join(ROOT, '.env.example'), 'utf8');
    expect(example).not.toMatch(/VITE_.*HANDOFF/);
    expect(example).not.toMatch(/^SXM_HANDOFF_/m);
    expect(example).toContain('IOU_HANDOFF_SECRET');
    expect(example).toContain('IOU_HANDOFF_CREATE_URL');
  });
});
