import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('debug runtime endpoints', () => {
  it('GET /api/debug/health returns JSON with uptime and store type', async () => {
    const { app } = createApp({ storeType: 'memory' });
    const res = await request(app).get('/api/debug/health');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.ok).toBe(true);
    expect(res.body.storeType).toBe('memory');
    expect(typeof res.body.uptimeSeconds).toBe('number');
    expect(res.body.socket).toMatchObject({ engineClients: expect.any(Number) });
  });

  it('GET /api/debug/runtime returns counts without secrets', async () => {
    const { app } = createApp({ storeType: 'memory' });
    const res = await request(app).get('/api/debug/runtime');
    expect(res.status).toBe(200);
    expect(res.body.tables).toBe(0);
    expect(res.body.sockets.connected).toBe(0);
    expect(res.body.email).toBeDefined();
    expect(res.body.email.provider).toBeTruthy();
    expect(res.body).not.toHaveProperty('smtpPass');
    expect(res.body).not.toHaveProperty('resendApiKey');
  });

  it('GET /api/auth/me without cookie returns 401 JSON', async () => {
    const { app } = createApp({ storeType: 'memory' });
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.error).toBeTruthy();
  });
});
