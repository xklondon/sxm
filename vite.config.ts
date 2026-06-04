import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = process.env.SXM_API_PORT || env.SXM_API_PORT || env.API_PORT || '3017';
  const apiTarget = `http://127.0.0.1:${apiPort}`;

  return {
    plugins: [react()],
    server: {
      host: true,
      port: Number(env.VITE_PORT || 5173),
      strictPort: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const host = req.headers.host;
              if (host) {
                proxyReq.setHeader('X-Forwarded-Host', host);
              }
              const proto = req.headers['x-forwarded-proto'];
              proxyReq.setHeader('X-Forwarded-Proto', typeof proto === 'string' ? proto : 'http');
            });
          },
        },
        '/socket.io': {
          target: apiTarget,
          ws: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const host = req.headers.host;
              if (host) {
                proxyReq.setHeader('X-Forwarded-Host', host);
              }
            });
          },
        },
        '/health': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.{ts,tsx}', 'server/tests/**/*.test.ts'],
      setupFiles: ['server/tests/setup.ts'],
      pool: 'forks',
      maxWorkers: 2,
      testTimeout: 15_000,
    },
  };
});
