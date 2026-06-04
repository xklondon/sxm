import { Router } from 'express';
import type { Server as SocketServer } from 'socket.io';
import { config } from '../config.js';
import { getEmailProviderDiagnostics } from '../email/smtp.js';
import type { Store } from '../store/types.js';

export interface RuntimeDebugDeps {
  store: Store;
  io: SocketServer;
  startedAt: number;
}

export function createRuntimeDebugRouter({ store, io, startedAt }: RuntimeDebugDeps): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    const email = getEmailProviderDiagnostics();
    res.json({
      ok: true,
      service: 'sxmcards-api',
      env: config.nodeEnv,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      processUptimeSeconds: Math.floor(process.uptime()),
      storeType: 'memory',
      socket: {
        engineClients: io.engine.clientsCount,
        adapter: 'memory',
      },
      emailConfigured: email.emailConfigured,
    });
  });

  router.get('/runtime', (_req, res) => {
    const email = getEmailProviderDiagnostics();
    const stats = store.getRuntimeStats();
    res.json({
      ok: true,
      env: config.nodeEnv,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      storeType: 'memory',
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
