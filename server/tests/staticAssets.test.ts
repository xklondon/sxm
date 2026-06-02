import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';

const envBackup = { ...process.env };

afterEach(() => {
  process.env = { ...envBackup };
  vi.resetModules();
});

const distDir = path.resolve(process.cwd(), 'dist');
const assetsDir = path.join(distDir, 'assets');

/** Minimal dist so static tests run without a full vite build. */
function ensureMinimalDist(): void {
  fs.mkdirSync(assetsDir, { recursive: true });
  const indexPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(
      indexPath,
      '<!doctype html><html><body><div id="root"></div></body></html>',
      'utf8',
    );
  }
  const fixtureJs = path.join(assetsDir, 'fixture-real.js');
  if (!fs.existsSync(fixtureJs)) {
    fs.writeFileSync(fixtureJs, 'export {};\n', 'utf8');
  }
}

beforeAll(() => {
  ensureMinimalDist();
});

function firstAssetJs(): string | null {
  if (!fs.existsSync(assetsDir)) return null;
  const js = fs.readdirSync(assetsDir).find((f) => f.endsWith('.js'));
  return js ? `/assets/${js}` : null;
}

async function createStaticApp() {
  process.env.NODE_ENV = 'production';
  process.env.SXM_SERVE_STATIC = 'true';
  process.env.PUBLIC_ORIGIN = 'https://test.example.com';
  process.env.CORS_ORIGIN = 'https://test.example.com';
  process.env.SESSION_SECRET = 'test-secret';
  process.env.INVITE_ONLY_MODE = 'true';
  process.env.ROOT_USER_EMAIL = 'root@example.com';
  vi.resetModules();
  const { createApp } = await import('../src/app.js');
  return createApp();
}

describe('static asset serving (host/production)', () => {
  it('GET /assets/<missing>.css returns 404 text/plain, never index.html', async () => {
    const { app } = await createStaticApp();
    const res = await request(app).get('/assets/index-old.css');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.headers['content-type']).not.toMatch(/html/);
    expect(res.text).toBe('Asset not found');
    expect(res.text.toLowerCase()).not.toContain('<!doctype');
  });

  it('GET /assets/<missing>.js returns 404 text/plain, never index.html', async () => {
    const { app } = await createStaticApp();
    const res = await request(app).get('/assets/index-BGVVaFKV.js');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.headers['content-type']).not.toMatch(/html/);
    expect(res.text).toBe('Asset not found');
    expect(res.text.toLowerCase()).not.toContain('<!doctype');
  });

  it('GET / returns index.html with no-store cache control', async () => {
    const { app } = await createStaticApp();
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.headers['cache-control']).toMatch(/no-store/);
    expect(res.text).toContain('id="root"');
  });

  it('GET an extensionless app route returns the SPA index.html', async () => {
    const { app } = await createStaticApp();
    const res = await request(app).get('/table/abc123');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.headers['cache-control']).toMatch(/no-store/);
    expect(res.text).toContain('id="root"');
  });

  it('GET a missing root file with extension does not return index.html', async () => {
    const { app } = await createStaticApp();
    const res = await request(app).get('/favicon.ico');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text.toLowerCase()).not.toContain('<!doctype');
  });

  it('GET an existing hashed JS asset returns JavaScript with immutable cache', async () => {
    const assetPath = firstAssetJs();
    expect(assetPath).not.toBeNull();
    const { app } = await createStaticApp();
    const res = await request(app).get(assetPath!);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
    expect(res.headers['cache-control']).toMatch(/immutable/);
  });
});
