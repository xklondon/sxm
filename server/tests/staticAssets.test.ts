import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';

const envBackup = { ...process.env };

afterEach(() => {
  process.env = { ...envBackup };
  vi.resetModules();
});

const distDir = path.resolve(process.cwd(), 'dist');
const distReady = fs.existsSync(path.join(distDir, 'index.html'));

function firstAssetJs(): string | null {
  const assetsDir = path.join(distDir, 'assets');
  if (!fs.existsSync(assetsDir)) return null;
  const js = fs.readdirSync(assetsDir).find((f) => f.endsWith('.js'));
  return js ? `/assets/${js}` : null;
}

async function createStaticApp() {
  process.env.NODE_ENV = 'development';
  process.env.SXM_SERVE_STATIC = 'true';
  process.env.INVITE_ONLY_MODE = 'true';
  process.env.ROOT_USER_EMAIL = 'root@example.com';
  vi.resetModules();
  const { createApp } = await import('../src/app.js');
  return createApp();
}

describe.skipIf(!distReady)('static asset serving (host/production)', () => {
  it('GET /assets/<missing>.js returns 404 text/plain, never index.html', async () => {
    const { app } = await createStaticApp();
    const res = await request(app).get('/assets/index-BGVVaFKV.js');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.headers['content-type']).not.toMatch(/html/);
    expect(res.text).not.toContain('<!doctype');
  });

  it('GET / returns index.html with no-store cache control', async () => {
    const { app } = await createStaticApp();
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.headers['cache-control']).toMatch(/no-store/);
    expect(res.text).toContain('id="root"');
  });

  it('GET an app route returns the SPA index.html', async () => {
    const { app } = await createStaticApp();
    const res = await request(app).get('/table/abc123');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('id="root"');
  });

  it('GET an existing hashed JS asset returns a JavaScript content type', async () => {
    const assetPath = firstAssetJs();
    expect(assetPath).not.toBeNull();
    const { app } = await createStaticApp();
    const res = await request(app).get(assetPath!);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
    expect(res.headers['cache-control']).toMatch(/immutable/);
  });
});
