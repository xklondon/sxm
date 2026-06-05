import { Router } from 'express';
import type { Server as SocketServer } from 'socket.io';
import { config } from '../config.js';
import { getEmailProviderDiagnostics } from '../email/smtp.js';
import type { Store } from '../store/types.js';
import type { StoreType } from '../store/types.js';

export interface RuntimeDebugDeps {
  store: Store;
  io: SocketServer;
  startedAt: number;
  storeType: StoreType;
}

export function createRuntimeDebugRouter({ store, io, startedAt, storeType }: RuntimeDebugDeps): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    const email = getEmailProviderDiagnostics();
    res.json({
      ok: true,
      service: 'sxmcards-api',
      env: config.nodeEnv,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      processUptimeSeconds: Math.floor(process.uptime()),
      storeType,
      socket: {
        engineClients: io.engine.clientsCount,
        adapter: 'memory',
      },
      emailConfigured: email.emailConfigured,
    });
  });

  router.get('/runtime', async (_req, res) => {
    const email = getEmailProviderDiagnostics();
    const stats = await store.getRuntimeStats();
    res.json({
      ok: true,
      env: config.nodeEnv,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      storeType,
      tables: stats.tables,
      users: stats.users,
      people: stats.people,
      invites: stats.invites,
      sockets: {
        connected: io.engine.clientsCount,
      },
      auth: {
        inviteOnlyMode: config.inviteOnlyMode,
        rootUserConfigured: Boolean(config.rootUserEmail),
      },
      email: {
        provider: email.emailProvider,
        configured: email.emailConfigured,
        resendProductionReady: email.resendProductionReady,
        smtpConfigured: email.smtpConfigured,
        smtpReachable: email.smtpReachable,
      },
    });
  });

  return router;
}
